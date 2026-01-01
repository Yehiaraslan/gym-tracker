import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  Platform,
  StyleSheet,
  Alert,
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
import { CameraView, CameraType } from 'expo-camera';
import { FormGuideOverlay } from '@/components/form-guide-overlay';
import { SkeletonOverlay } from '@/components/skeleton-overlay';
import { AICoach, CoachingPhase } from '@/lib/ai-coach';
import { audioFeedback, stopSpeech } from '@/lib/audio-feedback';

type TrackingState = 'setup' | 'positioning' | 'ready' | 'tracking' | 'completed';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FormCoachTrackingScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const exerciseType = (params.exercise as ExerciseType) || 'pushup';

  const [trackingState, setTrackingState] = useState<TrackingState>('setup');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [session, setSession] = useState<ExerciseSession | null>(null);
  const [currentRep, setCurrentRep] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [currentState, setCurrentState] = useState('ready');
  const [lastRepData, setLastRepData] = useState<RepData | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [showFormGuide, setShowFormGuide] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // AI Coach state
  const [coachMessage, setCoachMessage] = useState('');
  const [coachSubMessage, setCoachSubMessage] = useState('');
  const [isPositionReady, setIsPositionReady] = useState(false);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [formIssues, setFormIssues] = useState<string[]>([]);

  const trackerRef = useRef<PushupTracker | PullupTracker | SquatTracker | null>(null);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const frameCountRef = useRef(0);
  const lastProcessTimeRef = useRef(0);
  const cameraRef = useRef<any>(null);
  const aiCoachRef = useRef<AICoach | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      audioFeedback.reset();
    };
  }, []);

  // Request camera permission on native
  useEffect(() => {
    const requestCameraPermission = async () => {
      if (Platform.OS !== 'web') {
        try {
          const { Camera } = require('expo-camera');
          const { status } = await Camera.requestCameraPermissionsAsync();
          setHasCameraPermission(status === 'granted');
        } catch (e) {
          console.log('Camera not available:', e);
          setHasCameraPermission(false);
        }
      } else {
        // On web, we'll use demo mode
        setHasCameraPermission(true);
      }
    };
    
    requestCameraPermission();
  }, []);

  // Initialize tracker and AI coach based on exercise type
  useEffect(() => {
    if (exerciseType === 'pushup') {
      trackerRef.current = new PushupTracker();
    } else if (exerciseType === 'pullup') {
      trackerRef.current = new PullupTracker();
    } else {
      trackerRef.current = new SquatTracker();
    }
    
    // Initialize AI Coach
    aiCoachRef.current = new AICoach(exerciseType);
    
    // Simulate model loading (in real implementation, this would load TensorFlow model)
    const loadModel = async () => {
      setIsModelLoading(true);
      try {
        // Simulate async model loading
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsModelLoading(false);
        setTrackingState('positioning');
        setCoachMessage('Position yourself in frame');
        setCoachSubMessage(getStartPositionMessage());
      } catch (error) {
        setModelError('Failed to load AI model. Please try again.');
        setIsModelLoading(false);
      }
    };
    
    loadModel();
  }, [exerciseType]);

  const getStartPositionMessage = () => {
    switch (exerciseType) {
      case 'pushup':
        return 'Get into plank position with arms extended';
      case 'pullup':
        return 'Hang from the bar with arms fully extended';
      case 'squat':
        return 'Stand with feet shoulder-width apart';
      default:
        return 'Position yourself in frame';
    }
  };

  // Generate realistic pose based on exercise type and state
  const generateSimulatedPose = useCallback((isPositioning: boolean): Pose => {
    const baseConfidence = 0.75 + Math.random() * 0.2;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    
    // Generate keypoints based on exercise type
    let keypoints: Pose['keypoints'];
    
    if (exerciseType === 'pushup') {
      // Side view push-up position
      const bodyLength = 300;
      const armLength = 80;
      
      keypoints = [
        // Face (nose, eyes, ears)
        { x: centerX - 100, y: centerY - 80, score: baseConfidence, name: 'nose' },
        { x: centerX - 110, y: centerY - 90, score: baseConfidence * 0.9, name: 'left_eye' },
        { x: centerX - 90, y: centerY - 90, score: baseConfidence * 0.9, name: 'right_eye' },
        { x: centerX - 120, y: centerY - 80, score: baseConfidence * 0.8, name: 'left_ear' },
        { x: centerX - 80, y: centerY - 80, score: baseConfidence * 0.8, name: 'right_ear' },
        // Shoulders
        { x: centerX - 60, y: centerY - 40, score: baseConfidence, name: 'left_shoulder' },
        { x: centerX - 60, y: centerY - 20, score: baseConfidence, name: 'right_shoulder' },
        // Elbows
        { x: centerX - 60, y: centerY + 40, score: baseConfidence, name: 'left_elbow' },
        { x: centerX - 60, y: centerY + 60, score: baseConfidence, name: 'right_elbow' },
        // Wrists
        { x: centerX - 60, y: centerY + 100, score: baseConfidence, name: 'left_wrist' },
        { x: centerX - 60, y: centerY + 120, score: baseConfidence, name: 'right_wrist' },
        // Hips
        { x: centerX + 80, y: centerY - 30, score: baseConfidence, name: 'left_hip' },
        { x: centerX + 80, y: centerY - 10, score: baseConfidence, name: 'right_hip' },
        // Knees
        { x: centerX + 180, y: centerY + 20, score: baseConfidence, name: 'left_knee' },
        { x: centerX + 180, y: centerY + 40, score: baseConfidence, name: 'right_knee' },
        // Ankles
        { x: centerX + 250, y: centerY + 60, score: baseConfidence, name: 'left_ankle' },
        { x: centerX + 250, y: centerY + 80, score: baseConfidence, name: 'right_ankle' },
      ];
    } else if (exerciseType === 'pullup') {
      // Front view pull-up position (hanging)
      keypoints = [
        // Face
        { x: centerX, y: centerY - 100, score: baseConfidence, name: 'nose' },
        { x: centerX - 15, y: centerY - 110, score: baseConfidence * 0.9, name: 'left_eye' },
        { x: centerX + 15, y: centerY - 110, score: baseConfidence * 0.9, name: 'right_eye' },
        { x: centerX - 30, y: centerY - 100, score: baseConfidence * 0.8, name: 'left_ear' },
        { x: centerX + 30, y: centerY - 100, score: baseConfidence * 0.8, name: 'right_ear' },
        // Shoulders
        { x: centerX - 60, y: centerY - 50, score: baseConfidence, name: 'left_shoulder' },
        { x: centerX + 60, y: centerY - 50, score: baseConfidence, name: 'right_shoulder' },
        // Elbows (arms extended up)
        { x: centerX - 70, y: centerY - 120, score: baseConfidence, name: 'left_elbow' },
        { x: centerX + 70, y: centerY - 120, score: baseConfidence, name: 'right_elbow' },
        // Wrists (on bar)
        { x: centerX - 80, y: centerY - 180, score: baseConfidence, name: 'left_wrist' },
        { x: centerX + 80, y: centerY - 180, score: baseConfidence, name: 'right_wrist' },
        // Hips
        { x: centerX - 30, y: centerY + 50, score: baseConfidence, name: 'left_hip' },
        { x: centerX + 30, y: centerY + 50, score: baseConfidence, name: 'right_hip' },
        // Knees
        { x: centerX - 30, y: centerY + 150, score: baseConfidence, name: 'left_knee' },
        { x: centerX + 30, y: centerY + 150, score: baseConfidence, name: 'right_knee' },
        // Ankles
        { x: centerX - 30, y: centerY + 250, score: baseConfidence, name: 'left_ankle' },
        { x: centerX + 30, y: centerY + 250, score: baseConfidence, name: 'right_ankle' },
      ];
    } else {
      // Side view squat position (standing)
      keypoints = [
        // Face
        { x: centerX, y: centerY - 200, score: baseConfidence, name: 'nose' },
        { x: centerX - 10, y: centerY - 210, score: baseConfidence * 0.9, name: 'left_eye' },
        { x: centerX + 10, y: centerY - 210, score: baseConfidence * 0.9, name: 'right_eye' },
        { x: centerX - 20, y: centerY - 200, score: baseConfidence * 0.8, name: 'left_ear' },
        { x: centerX + 20, y: centerY - 200, score: baseConfidence * 0.8, name: 'right_ear' },
        // Shoulders
        { x: centerX - 40, y: centerY - 140, score: baseConfidence, name: 'left_shoulder' },
        { x: centerX + 40, y: centerY - 140, score: baseConfidence, name: 'right_shoulder' },
        // Elbows
        { x: centerX - 60, y: centerY - 80, score: baseConfidence, name: 'left_elbow' },
        { x: centerX + 60, y: centerY - 80, score: baseConfidence, name: 'right_elbow' },
        // Wrists
        { x: centerX - 50, y: centerY - 20, score: baseConfidence, name: 'left_wrist' },
        { x: centerX + 50, y: centerY - 20, score: baseConfidence, name: 'right_wrist' },
        // Hips
        { x: centerX - 35, y: centerY, score: baseConfidence, name: 'left_hip' },
        { x: centerX + 35, y: centerY, score: baseConfidence, name: 'right_hip' },
        // Knees
        { x: centerX - 40, y: centerY + 120, score: baseConfidence, name: 'left_knee' },
        { x: centerX + 40, y: centerY + 120, score: baseConfidence, name: 'right_knee' },
        // Ankles
        { x: centerX - 45, y: centerY + 240, score: baseConfidence, name: 'left_ankle' },
        { x: centerX + 45, y: centerY + 240, score: baseConfidence, name: 'right_ankle' },
      ];
    }

    // Add some natural movement/jitter
    keypoints = keypoints.map(kp => ({
      ...kp,
      x: kp.x + (Math.random() - 0.5) * 10,
      y: kp.y + (Math.random() - 0.5) * 10,
    }));

    return {
      keypoints,
      score: baseConfidence,
    };
  }, [exerciseType]);

  // Process positioning phase
  const processPositioning = useCallback(() => {
    if (trackingState !== 'positioning' || !aiCoachRef.current) return;

    const now = Date.now();
    if (now - lastProcessTimeRef.current < 300) return;
    lastProcessTimeRef.current = now;

    // Generate simulated pose
    const pose = generateSimulatedPose(true);
    setCurrentPose(pose);

    // Process through AI coach
    const coachState = aiCoachRef.current.processPositioning(pose);
    setCoachMessage(coachState.message);
    setCoachSubMessage(coachState.subMessage || '');
    setFormIssues(coachState.positionIssues);

    if (coachState.phase === 'ready') {
      setIsPositionReady(true);
      setTrackingState('ready');
    }
  }, [trackingState, generateSimulatedPose]);

  // Run positioning check loop
  useEffect(() => {
    if (trackingState !== 'positioning') return;

    const interval = setInterval(processPositioning, 200);
    return () => clearInterval(interval);
  }, [trackingState, processPositioning]);

  // Process frame for pose detection during tracking (throttled)
  const processFrame = useCallback(() => {
    if (trackingState !== 'tracking' || !trackerRef.current) return;

    const now = Date.now();
    // Throttle to ~5 FPS for pose detection
    if (now - lastProcessTimeRef.current < 200) return;
    lastProcessTimeRef.current = now;

    frameCountRef.current++;

    // Generate pose
    const pose = generateSimulatedPose(false);
    setCurrentPose(pose);

    // Calculate confidence
    const poseConfidence = calculatePoseConfidence(pose, exerciseType);
    setConfidence(poseConfidence);

    // Process pose through tracker
    const result = trackerRef.current.processFrame(pose);
    setCurrentState(result.currentState);

    // Check for form issues during movement
    if (result.repData && result.repData.flags.length > 0) {
      setFormIssues(result.repData.flags.map(f => f.type));
      aiCoachRef.current?.onFormIssueDetected(result.repData.flags);
    } else {
      setFormIssues([]);
    }

    if (result.repCompleted && result.repData) {
      // Rep completed!
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setCurrentRep(result.repData.repNumber);
      setLastRepData(result.repData);
      
      // AI Coach feedback for rep
      aiCoachRef.current?.onRepCompleted(
        result.repData.repNumber,
        result.repData.formScore,
        result.repData.flags
      );
      
      // Update session
      if (sessionRef.current) {
        sessionRef.current = addRepToSession(sessionRef.current, result.repData);
        setSession({ ...sessionRef.current });
      }
    }
  }, [trackingState, exerciseType, generateSimulatedPose]);

  // Run pose detection loop when tracking
  useEffect(() => {
    if (trackingState !== 'tracking') return;

    const interval = setInterval(processFrame, 100);
    return () => clearInterval(interval);
  }, [trackingState, processFrame]);

  const handleStartTracking = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Initialize session
    const newSession = createExerciseSession(exerciseType);
    sessionRef.current = newSession;
    setSession(newSession);
    
    // Reset tracker
    trackerRef.current?.reset();
    setCurrentRep(0);
    setLastRepData(null);
    setFormIssues([]);
    
    // Start AI coach tracking
    aiCoachRef.current?.setEnabled(audioEnabled);
    aiCoachRef.current?.startTracking();
    
    setTrackingState('tracking');
  };

  const handleStopTracking = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    // Finalize session
    if (sessionRef.current) {
      sessionRef.current = finalizeSession(sessionRef.current);
      setSession({ ...sessionRef.current });
      
      // AI Coach session complete
      aiCoachRef.current?.onSessionComplete(
        sessionRef.current.totalReps,
        sessionRef.current.averageFormScore
      );
    }
    
    setTrackingState('completed');
  };

  const handleClose = () => {
    stopSpeech();
    if (trackingState === 'tracking') {
      Alert.alert(
        'Stop Tracking?',
        'Your current session will be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Stop & Exit', 
            style: 'destructive',
            onPress: () => {
              handleStopTracking();
              router.back();
            }
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleNewSession = () => {
    stopSpeech();
    aiCoachRef.current?.reset();
    setTrackingState('positioning');
    setSession(null);
    setCurrentRep(0);
    setLastRepData(null);
    setIsPositionReady(false);
    setCurrentPose(null);
    setFormIssues([]);
    setCoachMessage('Position yourself in frame');
    setCoachSubMessage(getStartPositionMessage());
  };

  const toggleCamera = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCameraFacing(current => current === 'front' ? 'back' : 'front');
  };

  const toggleFormGuide = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowFormGuide(current => !current);
  };

  const toggleSkeleton = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowSkeleton(current => !current);
  };

  const toggleAudio = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    aiCoachRef.current?.setEnabled(newState);
  };

  const exerciseName = exerciseType === 'pushup' ? 'Push-up' : 
                       exerciseType === 'pullup' ? 'Pull-up' : 'Squat';

  // Render loading state
  if (isModelLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4 text-lg">Loading AI Coach...</Text>
        <Text className="text-muted mt-2">Preparing pose detection model</Text>
      </ScreenContainer>
    );
  }

  // Render error state
  if (modelError) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <IconSymbol name="xmark.circle.fill" size={64} color={colors.error} />
        <Text className="text-foreground mt-4 text-lg text-center">{modelError}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            marginTop: 20,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Render completed state
  if (trackingState === 'completed' && session) {
    const summary = getFormSummary(session);
    return (
      <ScreenContainer className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
          {/* Header */}
          <View style={styles.completedHeader}>
            <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
            <Text className="text-foreground text-2xl font-bold mt-4">
              Workout Complete!
            </Text>
          </View>

          {/* Stats Card */}
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <Text className="text-muted">Total Reps</Text>
              <Text className="text-foreground text-3xl font-bold">{session.totalReps}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statRow}>
              <Text className="text-muted">Average Form Score</Text>
              <Text style={[styles.scoreText, { color: summary.grade === 'A' || summary.grade === 'B' ? colors.success : colors.warning }]}>
                {Math.round(session.averageFormScore)}%
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statRow}>
              <Text className="text-muted">Grade</Text>
              <View style={[styles.gradeBadge, { backgroundColor: summary.grade === 'A' || summary.grade === 'B' ? colors.success : colors.warning }]}>
                <Text style={styles.gradeText}>{summary.grade}</Text>
              </View>
            </View>
          </View>

          {/* Feedback */}
          {summary.feedback.length > 0 && (
            <View style={[styles.feedbackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text className="text-foreground font-semibold mb-3">Form Feedback</Text>
              {summary.feedback.map((item, index) => (
                <View key={index} style={styles.feedbackItem}>
                  <IconSymbol name="info.circle.fill" size={16} color={colors.primary} />
                  <Text className="text-muted flex-1 ml-2">{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.completedActions}>
            <TouchableOpacity
              onPress={handleNewSession}
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
            >
              <IconSymbol name="play.fill" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>New Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Render camera view
  const renderCameraView = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.camera, { backgroundColor: '#1a1a1a' }]}>
          <View style={styles.cameraPlaceholder}>
            <IconSymbol name="camera.fill" size={48} color="#666" />
            <Text style={styles.placeholderText}>
              Camera preview not available on web{'\n'}
              Demo mode active - simulating pose detection
            </Text>
          </View>
        </View>
      );
    }

    if (!hasCameraPermission) {
      return (
        <View style={[styles.camera, { backgroundColor: '#1a1a1a' }]}>
          <View style={styles.cameraPlaceholder}>
            <IconSymbol name="camera.fill" size={48} color="#666" />
            <Text style={styles.placeholderText}>
              Camera permission required
            </Text>
          </View>
        </View>
      );
    }

    // Native camera view
    return (
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraFacing}
        onCameraReady={() => setCameraReady(true)}
      />
    );
  };

  // Render positioning/ready/tracking state
  return (
    <View style={styles.container}>
      {/* Camera View (or placeholder) */}
      <View style={styles.cameraContainer}>
        {renderCameraView()}

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
        {showFormGuide && !showSkeleton && (
          <FormGuideOverlay 
            exerciseType={exerciseType}
            isTracking={trackingState === 'tracking'}
            currentState={currentState}
          />
        )}

        {/* Overlay UI */}
        <View style={styles.overlay}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity 
              onPress={handleClose}
              style={styles.closeButton}
            >
              <IconSymbol name="xmark" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.exerciseLabel}>
              <Text style={styles.exerciseLabelText}>{exerciseName}</Text>
            </View>
            <View style={styles.topBarRight}>
              {/* Audio Toggle Button */}
              <TouchableOpacity 
                onPress={toggleAudio}
                style={[styles.iconButton, !audioEnabled && styles.iconButtonInactive]}
              >
                <IconSymbol 
                  name={audioEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill"} 
                  size={22} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              {/* Skeleton Toggle */}
              <TouchableOpacity 
                onPress={toggleSkeleton}
                style={[styles.iconButton, !showSkeleton && styles.iconButtonInactive]}
              >
                <IconSymbol name="figure.stand" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              {/* Camera Switch Button */}
              {Platform.OS !== 'web' && hasCameraPermission && (
                <TouchableOpacity 
                  onPress={toggleCamera}
                  style={styles.iconButton}
                >
                  <IconSymbol name="camera.rotate.fill" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Coach Message (Positioning/Ready phase) */}
          {(trackingState === 'positioning' || trackingState === 'ready') && (
            <View style={styles.coachMessageContainer}>
              <View style={[
                styles.coachMessageBox,
                { backgroundColor: isPositionReady ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0,0,0,0.7)' }
              ]}>
                <Text style={styles.coachMessageText}>{coachMessage}</Text>
                {coachSubMessage && (
                  <Text style={styles.coachSubMessageText}>{coachSubMessage}</Text>
                )}
              </View>
            </View>
          )}

          {/* Confidence Indicator */}
          {trackingState === 'tracking' && (
            <View style={styles.confidenceContainer}>
              <View style={styles.confidenceBar}>
                <View 
                  style={[
                    styles.confidenceFill,
                    { 
                      width: `${confidence}%`,
                      backgroundColor: confidence >= 50 ? colors.success : colors.warning,
                    }
                  ]} 
                />
              </View>
              <Text style={styles.confidenceText}>
                Tracking: {confidence}%
              </Text>
            </View>
          )}

          {/* Rep Counter */}
          <View style={styles.repCounterContainer}>
            {trackingState === 'tracking' ? (
              <>
                <View style={styles.repCounter}>
                  <Text style={styles.repCounterNumber}>{currentRep}</Text>
                  <Text style={styles.repCounterLabel}>REPS</Text>
                </View>
                
                {/* Current State Indicator */}
                <View style={[
                  styles.stateIndicator,
                  { backgroundColor: currentState === 'down' ? colors.primary : colors.success }
                ]}>
                  <Text style={styles.stateText}>
                    {currentState.toUpperCase()}
                  </Text>
                </View>
              </>
            ) : trackingState === 'positioning' ? (
              <View style={styles.positioningIndicator}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.positioningText}>Analyzing position...</Text>
              </View>
            ) : null}
          </View>

          {/* Last Rep Feedback */}
          {lastRepData && trackingState === 'tracking' && (
            <View style={styles.lastRepContainer}>
              <Text style={[
                styles.lastRepScore,
                { color: lastRepData.formScore >= 80 ? colors.success : colors.warning }
              ]}>
                +{lastRepData.formScore}
              </Text>
              {lastRepData.flags.length > 0 && (
                <Text style={styles.lastRepFlag}>
                  {lastRepData.flags[0].message}
                </Text>
              )}
            </View>
          )}

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {trackingState === 'positioning' && (
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Getting ready...</Text>
                <Text style={styles.tipText}>• Position your full body in frame</Text>
                <Text style={styles.tipText}>• The AI coach will guide you</Text>
                <Text style={styles.tipText}>• Hold still when in position</Text>
              </View>
            )}

            {trackingState === 'ready' && (
              <>
                <View style={styles.tipsContainer}>
                  <Text style={[styles.tipsTitle, { color: colors.success }]}>✓ Position looks good!</Text>
                  <Text style={styles.tipText}>• Audio coaching is {audioEnabled ? 'ON' : 'OFF'}</Text>
                  <Text style={styles.tipText}>• Skeleton tracking is {showSkeleton ? 'ON' : 'OFF'}</Text>
                  <Text style={styles.tipText}>• Tap Start when ready</Text>
                </View>
                <TouchableOpacity
                  onPress={handleStartTracking}
                  style={[styles.actionButton, { backgroundColor: colors.success }]}
                >
                  <IconSymbol name="play.fill" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Start Workout</Text>
                </TouchableOpacity>
              </>
            )}

            {trackingState === 'tracking' && (
              <TouchableOpacity
                onPress={handleStopTracking}
                style={[styles.actionButton, { backgroundColor: colors.error }]}
              >
                <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
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
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonInactive: {
    opacity: 0.5,
  },
  exerciseLabel: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  exerciseLabelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  coachMessageContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  coachMessageBox: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  coachMessageText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  coachSubMessageText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  confidenceContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 20,
  },
  confidenceBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 6,
  },
  repCounterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  repCounter: {
    alignItems: 'center',
  },
  repCounterNumber: {
    color: '#FFFFFF',
    fontSize: 120,
    fontWeight: '700',
    lineHeight: 130,
  },
  repCounterLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 4,
  },
  positioningIndicator: {
    alignItems: 'center',
  },
  positioningText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 16,
  },
  stateIndicator: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  lastRepContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  lastRepScore: {
    fontSize: 32,
    fontWeight: '700',
  },
  lastRepFlag: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  bottomControls: {
    padding: 20,
    paddingBottom: 40,
  },
  tipsContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tipsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Completed screen styles
  completedHeader: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  divider: {
    height: 1,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '700',
  },
  gradeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  feedbackCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  completedActions: {
    gap: 12,
    marginTop: 20,
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
