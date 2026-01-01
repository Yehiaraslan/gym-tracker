import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { 
  ExerciseType, 
  PushupTracker, 
  PullupTracker,
  SquatTracker,
  RDLTracker,
  RepData,
  ExerciseSession,
  createExerciseSession,
  addRepToSession,
  finalizeSession,
  getFormSummary,
  calculatePoseConfidence,
  Pose,
  KEYPOINTS,
} from '@/lib/pose-detection';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { FormGuideOverlay } from '@/components/form-guide-overlay';

// Helper to get summary with additional fields
interface FormSummary {
  averageScore: number;
  grade: string;
  topIssues: string[];
  tip?: string;
}

function getFormSummaryExtended(session: ExerciseSession): FormSummary {
  const baseSummary = getFormSummary(session);
  return {
    averageScore: baseSummary.score,
    grade: baseSummary.grade,
    topIssues: baseSummary.feedback,
    tip: baseSummary.feedback.length > 0 ? 'Focus on form over speed' : undefined,
  };
}
import { SkeletonOverlay } from '@/components/skeleton-overlay';
import { AICoach } from '@/lib/ai-coach';
import { audioFeedback, stopSpeech } from '@/lib/audio-feedback';

type TrackingState = 'setup' | 'positioning' | 'ready' | 'tracking' | 'completed';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FormCoachTrackingScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const exerciseType = (params.exercise as ExerciseType) || 'pushup';

  const [trackingState, setTrackingState] = useState<TrackingState>('setup');
  const [permission, requestPermission] = useCameraPermissions();
  const [session, setSession] = useState<ExerciseSession | null>(null);
  const [currentRep, setCurrentRep] = useState(0);
  const [confidence, setConfidence] = useState(0.8);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [showFormGuide, setShowFormGuide] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fps, setFps] = useState(0);
  const [coachMessage, setCoachMessage] = useState('');
  const [coachSubMessage, setCoachSubMessage] = useState('');
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [formIssues, setFormIssues] = useState<string[]>([]);

  const trackerRef = useRef<PushupTracker | PullupTracker | SquatTracker | RDLTracker | null>(null);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const aiCoachRef = useRef<AICoach | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      audioFeedback.reset();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Request camera permission on native
  useEffect(() => {
    if (!permission?.granted && Platform.OS !== 'web') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Initialize tracker and coach - no TensorFlow.js model loading
  useEffect(() => {
    // Create exercise tracker
    if (exerciseType === 'pushup') {
      trackerRef.current = new PushupTracker();
    } else if (exerciseType === 'pullup') {
      trackerRef.current = new PullupTracker();
    } else if (exerciseType === 'rdl') {
      trackerRef.current = new RDLTracker();
    } else {
      trackerRef.current = new SquatTracker();
    }
    
    // Create AI coach
    aiCoachRef.current = new AICoach(exerciseType);
    
    // Skip TensorFlow.js model loading - use demo mode
    setIsModelLoading(false);
    setTrackingState('positioning');
    setCoachMessage('Position yourself in frame');
    setCoachSubMessage(getStartPositionMessage() + '\n\n(Demo mode - simulated tracking)');
  }, [exerciseType]);

  const getStartPositionMessage = () => {
    switch (exerciseType) {
      case 'pushup': return 'Get into plank position with arms extended';
      case 'pullup': return 'Hang from the bar with arms fully extended';
      case 'squat': return 'Stand with feet shoulder-width apart';
      case 'rdl': return 'Stand with feet hip-width apart, slight knee bend';
      default: return 'Position yourself in frame';
    }
  };

  // Generate simulated pose for demo mode
  const generateSimulatedPose = useCallback((): Pose => {
    const time = Date.now() / 1000;
    const phase = (time % 3) / 3; // 3-second cycle
    
    // Base standing pose keypoints
    const baseKeypoints = [
      { x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.15, score: 0.9, name: 'nose' },
      { x: SCREEN_WIDTH * 0.48, y: SCREEN_HEIGHT * 0.13, score: 0.85, name: 'left_eye' },
      { x: SCREEN_WIDTH * 0.52, y: SCREEN_HEIGHT * 0.13, score: 0.85, name: 'right_eye' },
      { x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.14, score: 0.8, name: 'left_ear' },
      { x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.14, score: 0.8, name: 'right_ear' },
      { x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.25, score: 0.95, name: 'left_shoulder' },
      { x: SCREEN_WIDTH * 0.6, y: SCREEN_HEIGHT * 0.25, score: 0.95, name: 'right_shoulder' },
      { x: SCREEN_WIDTH * 0.35, y: SCREEN_HEIGHT * 0.35, score: 0.9, name: 'left_elbow' },
      { x: SCREEN_WIDTH * 0.65, y: SCREEN_HEIGHT * 0.35, score: 0.9, name: 'right_elbow' },
      { x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.45, score: 0.85, name: 'left_wrist' },
      { x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.45, score: 0.85, name: 'right_wrist' },
      { x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.5, score: 0.95, name: 'left_hip' },
      { x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.5, score: 0.95, name: 'right_hip' },
      { x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.7, score: 0.9, name: 'left_knee' },
      { x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.7, score: 0.9, name: 'right_knee' },
      { x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.9, score: 0.85, name: 'left_ankle' },
      { x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.9, score: 0.85, name: 'right_ankle' },
    ];

    // Animate based on exercise type
    const keypoints = baseKeypoints.map((kp, idx) => {
      let y = kp.y;
      
      if (exerciseType === 'squat') {
        // Squat animation - move hips and knees down
        if (idx === 11 || idx === 12) { // hips
          y += Math.sin(phase * Math.PI * 2) * SCREEN_HEIGHT * 0.15;
        }
        if (idx === 13 || idx === 14) { // knees
          y += Math.sin(phase * Math.PI * 2) * SCREEN_HEIGHT * 0.1;
        }
      } else if (exerciseType === 'pushup') {
        // Push-up animation - move body up and down
        if (idx >= 5 && idx <= 12) { // upper body
          y += Math.sin(phase * Math.PI * 2) * SCREEN_HEIGHT * 0.05;
        }
      } else if (exerciseType === 'pullup') {
        // Pull-up animation - move body up
        if (idx <= 12) { // upper body
          y -= Math.sin(phase * Math.PI * 2) * SCREEN_HEIGHT * 0.1;
        }
      } else if (exerciseType === 'rdl') {
        // RDL animation - hip hinge
        if (idx === 5 || idx === 6) { // shoulders move forward/down
          y += Math.sin(phase * Math.PI * 2) * SCREEN_HEIGHT * 0.1;
        }
      }
      
      return { ...kp, y };
    });

    return { keypoints };
  }, [exerciseType]);

  // Handle pose detection result
  const handlePoseDetected = useCallback((pose: Pose | null) => {
    if (!pose) {
      setCurrentPose(null);
      setConfidence(0);
      return;
    }

    setCurrentPose(pose);
    const poseConfidence = calculatePoseConfidence(pose, exerciseType);
    setConfidence(poseConfidence);

    // Process with AI coach
    if (aiCoachRef.current) {
      let coachResult;
      if (trackingState === 'positioning' || trackingState === 'ready') {
        coachResult = aiCoachRef.current.processPositioning(pose);
      } else {
        coachResult = aiCoachRef.current.getState();
      }
      if (coachResult.message) setCoachMessage(coachResult.message);
      if (coachResult.subMessage) setCoachSubMessage(coachResult.subMessage);
      if (coachResult.positionIssues) setFormIssues(coachResult.positionIssues);
    }

    // Process rep tracking
    if (trackingState === 'tracking' && trackerRef.current && sessionRef.current) {
      const result = trackerRef.current.processFrame(pose);
      if (result.repCompleted && result.repData) {
        const repData = result.repData;
        const newRep = currentRep + 1;
        setCurrentRep(newRep);
        sessionRef.current = addRepToSession(sessionRef.current, repData);
        setSession(sessionRef.current);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        if (audioEnabled) {
          audioFeedback.onRepCompleted(newRep, repData.formScore, repData.flags || []);
        }
      }
    }
  }, [trackingState, exerciseType, currentRep, audioEnabled]);

  // Frame processing loop using simulated poses
  const processFrame = useCallback(async () => {
    if (trackingState !== 'positioning' && trackingState !== 'ready' && trackingState !== 'tracking') {
      return;
    }

    const now = Date.now();
    
    // Throttle to ~10 FPS
    if (now - lastInferenceTimeRef.current < 100) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastInferenceTimeRef.current = now;

    // Generate simulated pose for demo
    const simulatedPose = generateSimulatedPose();
    handlePoseDetected(simulatedPose);

    // Update FPS counter
    frameCountRef.current++;
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [trackingState, generateSimulatedPose, handlePoseDetected]);

  // Start/stop frame processing
  useEffect(() => {
    if (trackingState === 'positioning' || trackingState === 'ready' || trackingState === 'tracking') {
      rafIdRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [trackingState, processFrame]);

  const handleReadyToStart = useCallback(() => {
    if (audioEnabled) {
      audioFeedback.onSessionStart(getExerciseName());
    }
    
    const newSession = createExerciseSession(exerciseType);
    sessionRef.current = newSession;
    setSession(newSession);
    setCurrentRep(0);
    
    if (trackerRef.current) {
      trackerRef.current.reset();
    }
    
    setTrackingState('tracking');
    setCoachMessage('Go!');
    setCoachSubMessage('Perform your reps with good form');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [exerciseType, audioEnabled]);

  const handleFinish = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    if (sessionRef.current) {
      sessionRef.current = finalizeSession(sessionRef.current);
      setSession(sessionRef.current);
    }
    
    setTrackingState('completed');
    
    if (audioEnabled && sessionRef.current) {
      const summary = getFormSummary(sessionRef.current);
      audioFeedback.onSessionEnd(currentRep, summary.score);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [currentRep, audioEnabled]);

  const toggleCamera = useCallback(() => {
    setCameraFacing(prev => prev === 'front' ? 'back' : 'front');
  }, []);

  const getExerciseName = () => {
    switch (exerciseType) {
      case 'pushup': return 'Push-ups';
      case 'pullup': return 'Pull-ups';
      case 'squat': return 'Squats';
      case 'rdl': return 'Romanian Deadlifts';
      default: return 'Exercise';
    }
  };

  const getConfidenceColor = () => {
    if (confidence >= 0.7) return colors.success;
    if (confidence >= 0.4) return colors.warning;
    return colors.error;
  };

  const getConfidenceLabel = () => {
    if (confidence >= 0.7) return 'Good';
    if (confidence >= 0.4) return 'Weak';
    return 'Lost';
  };

  // Loading state
  if (isModelLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4 text-lg">Initializing AI Coach...</Text>
        <Text className="text-muted mt-2 text-sm">This may take a moment</Text>
      </ScreenContainer>
    );
  }

  // Completed state
  if (trackingState === 'completed' && session) {
    const summary = getFormSummaryExtended(session);
    return (
      <ScreenContainer className="flex-1">
        <ScrollView className="flex-1 p-6">
          <View className="items-center mb-8">
            <Text className="text-4xl mb-2">🎉</Text>
            <Text className="text-2xl font-bold text-foreground">Workout Complete!</Text>
          </View>
          
          <View className="bg-surface rounded-2xl p-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">{getExerciseName()}</Text>
            
            <View className="flex-row justify-between mb-4">
              <View className="items-center flex-1">
                <Text className="text-4xl font-bold text-primary">{currentRep}</Text>
                <Text className="text-muted">Reps</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-4xl font-bold" style={{ color: colors.success }}>{summary.averageScore}</Text>
                <Text className="text-muted">Form Score</Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-4xl font-bold text-foreground">{summary.grade}</Text>
                <Text className="text-muted">Grade</Text>
              </View>
            </View>
            
            {summary.topIssues.length > 0 && (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-sm font-medium text-foreground mb-2">Areas to Improve:</Text>
                {summary.topIssues.map((issue, idx) => (
                  <Text key={idx} className="text-muted text-sm">• {issue}</Text>
                ))}
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            className="bg-primary py-4 rounded-xl items-center"
            onPress={() => router.back()}
          >
            <Text className="text-background font-semibold text-lg">Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Main tracking view
  return (
    <View style={styles.container}>
      {/* Camera or Demo Background */}
      {Platform.OS !== 'web' && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraFacing}
          onCameraReady={() => setCameraReady(true)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]}>
          <View style={styles.demoBackground}>
            <Text style={[styles.demoText, { color: colors.muted }]}>Demo Mode</Text>
            <Text style={[styles.demoSubtext, { color: colors.muted }]}>Simulated pose tracking</Text>
          </View>
        </View>
      )}

      {/* Skeleton Overlay */}
      {showSkeleton && currentPose && (
        <SkeletonOverlay 
          pose={currentPose} 
          exerciseType={exerciseType}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          formIssues={formIssues}
        />
      )}

      {/* Form Guide Overlay */}
      {showFormGuide && trackingState !== 'completed' && (
        <FormGuideOverlay 
          exerciseType={exerciseType}
          isTracking={trackingState === 'tracking'}
          currentState={trackingState}
        />
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <IconSymbol name="chevron.left" size={24} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.exerciseTitle}>{getExerciseName()}</Text>
        
        <View style={styles.topBarRight}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity onPress={toggleCamera} style={styles.iconButton}>
              <IconSymbol name="camera.rotate" size={20} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setAudioEnabled(!audioEnabled)} style={styles.iconButton}>
            <IconSymbol 
              name={audioEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill"} 
              size={20} 
              color="white" 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Overlay */}
      <View style={[styles.statsOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{currentRep}</Text>
          <Text style={styles.statLabel}>Reps</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
          <Text style={styles.statLabel}>{getConfidenceLabel()}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{fps}</Text>
          <Text style={styles.statLabel}>FPS</Text>
        </View>
      </View>

      {/* Coach Message Overlay */}
      <View style={[styles.coachOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <Text style={styles.coachMessage}>{coachMessage}</Text>
        {coachSubMessage && (
          <Text style={styles.coachSubMessage}>{coachSubMessage}</Text>
        )}
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        {trackingState === 'positioning' && (
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            onPress={handleReadyToStart}
          >
            <Text style={styles.startButtonText}>Start Tracking</Text>
          </TouchableOpacity>
        )}
        
        {trackingState === 'tracking' && (
          <TouchableOpacity 
            style={[styles.finishButton, { backgroundColor: colors.error }]}
            onPress={handleFinish}
          >
            <Text style={styles.finishButtonText}>Finish Set</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.toggleRow}>
          <TouchableOpacity 
            style={[styles.toggleButton, showSkeleton && styles.toggleActive]}
            onPress={() => setShowSkeleton(!showSkeleton)}
          >
            <Text style={styles.toggleText}>Skeleton</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, showFormGuide && styles.toggleActive]}
            onPress={() => setShowFormGuide(!showFormGuide)}
          >
            <Text style={styles.toggleText}>Guide</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  demoBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  demoSubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  formGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  exerciseTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  statsOverlay: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  confidenceDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
  },
  coachOverlay: {
    position: 'absolute',
    bottom: 200,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  coachMessage: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  coachSubMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginBottom: 16,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginBottom: 16,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toggleActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  toggleText: {
    color: 'white',
    fontSize: 12,
  },
});
