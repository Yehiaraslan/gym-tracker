import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
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
  RepData,
  ExerciseSession,
  createExerciseSession,
  addRepToSession,
  finalizeSession,
  getFormSummary,
  calculatePoseConfidence,
  Pose,
} from '@/lib/pose-detection';

// Conditionally import camera - only on native
let CameraView: any = null;
let useCameraPermissions: any = null;

if (Platform.OS !== 'web') {
  try {
    const ExpoCamera = require('expo-camera');
    CameraView = ExpoCamera.CameraView;
    useCameraPermissions = ExpoCamera.useCameraPermissions;
  } catch (e) {
    console.log('Camera not available');
  }
}

type TrackingState = 'setup' | 'ready' | 'tracking' | 'completed';

export default function FormCoachTrackingScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const exerciseType = (params.exercise as ExerciseType) || 'pushup';

  const [trackingState, setTrackingState] = useState<TrackingState>('setup');
  const [permission, setPermission] = useState<{ granted: boolean } | null>(null);
  const [session, setSession] = useState<ExerciseSession | null>(null);
  const [currentRep, setCurrentRep] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [currentState, setCurrentState] = useState('ready');
  const [lastRepData, setLastRepData] = useState<RepData | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const trackerRef = useRef<PushupTracker | PullupTracker | null>(null);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const frameCountRef = useRef(0);
  const lastProcessTimeRef = useRef(0);

  // Request camera permission on native
  useEffect(() => {
    if (Platform.OS !== 'web' && useCameraPermissions) {
      (async () => {
        const [status, requestPermission] = useCameraPermissions();
        if (!status?.granted) {
          const result = await requestPermission();
          setPermission(result);
        } else {
          setPermission(status);
        }
      })();
    } else {
      // On web, simulate permission granted for demo
      setPermission({ granted: true });
    }
  }, []);

  // Initialize tracker
  useEffect(() => {
    if (exerciseType === 'pushup') {
      trackerRef.current = new PushupTracker();
    } else {
      trackerRef.current = new PullupTracker();
    }
    
    // Simulate model loading (in real implementation, this would load TensorFlow model)
    const loadModel = async () => {
      setIsModelLoading(true);
      try {
        // Simulate async model loading
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsModelLoading(false);
        setTrackingState('ready');
      } catch (error) {
        setModelError('Failed to load AI model. Please try again.');
        setIsModelLoading(false);
      }
    };
    
    loadModel();
  }, [exerciseType]);

  // Simulate pose detection (in real implementation, this would use TensorFlow.js)
  const simulatePoseDetection = useCallback((): Pose | null => {
    // This is a simulation - in real implementation, this would process camera frames
    // through TensorFlow.js MoveNet model
    
    // Generate simulated keypoints with some randomness
    const baseConfidence = 0.7 + Math.random() * 0.25;
    
    const keypoints = Array.from({ length: 17 }, (_, i) => ({
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 300,
      score: baseConfidence + (Math.random() - 0.5) * 0.2,
      name: `keypoint_${i}`,
    }));

    return {
      keypoints,
      score: baseConfidence,
    };
  }, []);

  // Process frame for pose detection (throttled)
  const processFrame = useCallback(() => {
    if (trackingState !== 'tracking' || !trackerRef.current) return;

    const now = Date.now();
    // Throttle to ~5 FPS for pose detection
    if (now - lastProcessTimeRef.current < 200) return;
    lastProcessTimeRef.current = now;

    frameCountRef.current++;

    // Simulate pose detection
    const pose = simulatePoseDetection();
    if (!pose) return;

    // Calculate confidence
    const poseConfidence = calculatePoseConfidence(pose, exerciseType);
    setConfidence(poseConfidence);

    // Process pose through tracker
    const result = trackerRef.current.processFrame(pose);
    setCurrentState(result.currentState);

    if (result.repCompleted && result.repData) {
      // Rep completed!
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setCurrentRep(result.repData.repNumber);
      setLastRepData(result.repData);
      
      // Update session
      if (sessionRef.current) {
        sessionRef.current = addRepToSession(sessionRef.current, result.repData);
        setSession({ ...sessionRef.current });
      }
    }
  }, [trackingState, exerciseType, simulatePoseDetection]);

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
    }
    
    setTrackingState('completed');
  };

  const handleClose = () => {
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
    setTrackingState('ready');
    setSession(null);
    setCurrentRep(0);
    setLastRepData(null);
  };

  const exerciseName = exerciseType === 'pushup' ? 'Push-up' : 'Pull-up';

  // Render loading state
  if (isModelLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4 text-lg">Loading AI Model...</Text>
        <Text className="text-muted mt-2">This may take a few seconds</Text>
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
            marginTop: 24,
          }}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Render completed state (summary)
  if (trackingState === 'completed' && session) {
    const summary = getFormSummary(session);
    
    return (
      <ScreenContainer className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">Session Complete</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="flex-1 px-4">
          {/* Score Card */}
          <View 
            className="bg-surface rounded-3xl p-6 items-center mb-6"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <Text className="text-6xl font-bold" style={{ color: colors.primary }}>
              {session.totalReps}
            </Text>
            <Text className="text-xl text-muted mt-1">
              {exerciseName} Reps
            </Text>
            
            <View 
              className="w-full h-px my-6"
              style={{ backgroundColor: colors.border }}
            />
            
            <View className="flex-row items-center justify-around w-full">
              <View className="items-center">
                <Text className="text-3xl font-bold text-foreground">
                  {summary.score}
                </Text>
                <Text className="text-sm text-muted">Form Score</Text>
              </View>
              <View className="items-center">
                <Text 
                  className="text-xl font-semibold"
                  style={{ 
                    color: summary.score >= 75 ? colors.success : 
                           summary.score >= 50 ? colors.warning : colors.error 
                  }}
                >
                  {summary.grade}
                </Text>
                <Text className="text-sm text-muted">Grade</Text>
              </View>
            </View>
          </View>

          {/* Feedback */}
          {summary.feedback.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">
                Form Feedback
              </Text>
              <View 
                className="bg-surface rounded-2xl p-4"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                {summary.feedback.map((feedback, index) => (
                  <View 
                    key={index} 
                    className="flex-row items-start mb-3 last:mb-0"
                  >
                    <IconSymbol 
                      name="info.circle.fill" 
                      size={18} 
                      color={colors.warning} 
                    />
                    <Text className="flex-1 ml-3 text-foreground">
                      {feedback}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Rep Details */}
          {session.reps.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">
                Rep Details
              </Text>
              <View 
                className="bg-surface rounded-2xl p-4"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                {session.reps.map((rep, index) => (
                  <View 
                    key={index}
                    className="flex-row items-center justify-between py-2"
                    style={{
                      borderBottomWidth: index < session.reps.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text className="text-foreground">Rep {rep.repNumber}</Text>
                    <View className="flex-row items-center">
                      <Text 
                        className="font-semibold mr-2"
                        style={{ 
                          color: rep.formScore >= 75 ? colors.success : 
                                 rep.formScore >= 50 ? colors.warning : colors.error 
                        }}
                      >
                        {rep.formScore}
                      </Text>
                      {rep.flags.length > 0 && (
                        <IconSymbol 
                          name="exclamationmark.triangle.fill" 
                          size={16} 
                          color={colors.warning} 
                        />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="px-4 pb-6">
          <TouchableOpacity
            onPress={handleNewSession}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 16,
              borderRadius: 14,
              marginBottom: 12,
            }}
          >
            <Text className="text-white font-bold text-center text-lg">
              New Session
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: colors.surface,
              paddingVertical: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text className="text-foreground font-semibold text-center">
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Render tracking/ready state
  return (
    <View style={styles.container}>
      {/* Camera View (or placeholder on web) */}
      <View style={styles.cameraContainer}>
        {Platform.OS !== 'web' && CameraView && permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="front"
          />
        ) : (
          <View style={[styles.camera, { backgroundColor: '#1a1a1a' }]}>
            <View style={styles.cameraPlaceholder}>
              <IconSymbol name="camera.fill" size={48} color="#666" />
              <Text style={styles.placeholderText}>
                {Platform.OS === 'web' 
                  ? 'Camera preview not available on web\n(Demo mode active)'
                  : 'Camera permission required'}
              </Text>
            </View>
          </View>
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
            <View style={{ width: 44 }} />
          </View>

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
            <View style={styles.repCounter}>
              <Text style={styles.repCounterNumber}>{currentRep}</Text>
              <Text style={styles.repCounterLabel}>REPS</Text>
            </View>
            
            {trackingState === 'tracking' && (
              <View style={styles.stateIndicator}>
                <View 
                  style={[
                    styles.stateLight,
                    { backgroundColor: currentState === 'down' ? colors.primary : colors.success }
                  ]}
                />
                <Text style={styles.stateText}>
                  {currentState === 'up' ? 'UP' : currentState === 'down' ? 'DOWN' : 'READY'}
                </Text>
              </View>
            )}
          </View>

          {/* Last Rep Feedback */}
          {lastRepData && trackingState === 'tracking' && (
            <View style={styles.lastRepFeedback}>
              <Text style={styles.lastRepScore}>
                Rep {lastRepData.repNumber}: {lastRepData.formScore} pts
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
            {trackingState === 'ready' && (
              <TouchableOpacity
                onPress={handleStartTracking}
                style={[styles.startButton, { backgroundColor: colors.primary }]}
              >
                <IconSymbol name="play.fill" size={32} color="#FFFFFF" />
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            )}
            
            {trackingState === 'tracking' && (
              <TouchableOpacity
                onPress={handleStopTracking}
                style={[styles.stopButton, { backgroundColor: colors.error }]}
              >
                <IconSymbol name="stop.fill" size={28} color="#FFFFFF" />
                <Text style={styles.stopButtonText}>Stop</Text>
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
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
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
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseLabel: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  exerciseLabelText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
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
    marginTop: 8,
    fontSize: 14,
  },
  repCounterContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  repCounter: {
    alignItems: 'center',
  },
  repCounterNumber: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  repCounterLabel: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginTop: -10,
  },
  stateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stateLight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  stateText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  lastRepFeedback: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  lastRepScore: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  lastRepFlag: {
    color: '#FFB800',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 60,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 30,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
