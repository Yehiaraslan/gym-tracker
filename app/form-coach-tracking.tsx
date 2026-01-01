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
import { SkeletonOverlay } from '@/components/skeleton-overlay';
import { CalibratedJointsOverlay } from '@/components/calibrated-joints-overlay';
import { AICoach } from '@/lib/ai-coach';
import { audioFeedback, stopSpeech } from '@/lib/audio-feedback';
import { PoseCalibrator, CalibrationState, CalibrationStatus } from '@/lib/pose-calibration';
import { detectPoseFromFrame, resetRealPoseDetector } from '@/lib/real-pose-detection';

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

type TrackingState = 'setup' | 'calibrating' | 'positioning' | 'ready' | 'tracking' | 'completed';

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
  const [confidence, setConfidence] = useState(0);
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
  const [calibrationState, setCalibrationState] = useState<CalibrationState | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showCalibrationSuccess, setShowCalibrationSuccess] = useState(false);
  const [calibratedPose, setCalibratedPose] = useState<Pose | null>(null);

  const trackerRef = useRef<PushupTracker | PullupTracker | SquatTracker | RDLTracker | null>(null);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const aiCoachRef = useRef<AICoach | null>(null);
  const calibratorRef = useRef<PoseCalibrator | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      audioFeedback.reset();
      resetRealPoseDetector();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Request camera permission on native
  useEffect(() => {
    if (!permission?.granted && Platform.OS !== 'web') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Initialize tracker, coach, and calibrator
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
    
    // Create calibrator
    calibratorRef.current = new PoseCalibrator(exerciseType);
    
    // Reset pose detector
    resetRealPoseDetector();
    
    // Start with calibration phase
    setTrackingState('calibrating');
    setCoachMessage('Stand still for calibration');
    setCoachSubMessage('Keep your full body visible in frame');
    
    if (audioEnabled) {
      audioFeedback.speak('Stand still for calibration. Keep your full body visible.');
    }
  }, [exerciseType, audioEnabled]);

  const getStartPositionMessage = () => {
    switch (exerciseType) {
      case 'pushup': return 'Get into plank position with arms extended';
      case 'pullup': return 'Hang from the bar with arms fully extended';
      case 'squat': return 'Stand with feet shoulder-width apart';
      case 'rdl': return 'Stand with feet hip-width apart, slight knee bend';
      default: return 'Position yourself in frame';
    }
  };

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

    // Handle calibration phase
    if (trackingState === 'calibrating' && calibratorRef.current) {
      const calState = calibratorRef.current.processFrame(pose);
      setCalibrationState(calState);
      setCoachMessage(calState.message);
      setCoachSubMessage(calState.subMessage);
      
      // Haptic feedback for newly detected joints
      if (calState.newlyDetectedJoints && calState.newlyDetectedJoints.length > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      
      // Haptic feedback for newly stable joints (slightly stronger)
      if (calState.newlyStableJoints && calState.newlyStableJoints.length > 0) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
      
      if (calState.status === 'calibrated') {
        // Calibration complete - move to positioning
        setTrackingState('positioning');
        setCoachMessage('Calibration complete!');
        setCoachSubMessage(getStartPositionMessage());
        
        // Store calibrated pose and show success animation
        setCalibratedPose(pose);
        setShowCalibrationSuccess(true);
        
        // Hide celebration after 3 seconds
        setTimeout(() => {
          setShowCalibrationSuccess(false);
        }, 3000);
        
        if (audioEnabled) {
          audioFeedback.speak('Calibration complete! ' + getStartPositionMessage());
        }
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else if (calState.status === 'failed') {
        setCoachMessage('Calibration failed');
        setCoachSubMessage('Please try again with better lighting');
        
        if (audioEnabled) {
          audioFeedback.speak('Calibration failed. Please try again.');
        }
      }
      return;
    }

    // Process with AI coach for positioning/ready states
    if (aiCoachRef.current) {
      if (trackingState === 'positioning' || trackingState === 'ready') {
        const coachResult = aiCoachRef.current.processPositioning(pose);
        
        // Check if ready to start (phase changed to 'ready')
        if (coachResult.phase === 'ready' && trackingState === 'positioning') {
          setTrackingState('ready');
          setCoachMessage('Ready!');
          setCoachSubMessage('Tap Start when ready');
          
          if (audioEnabled) {
            audioFeedback.speak('Ready to start!');
          }
        } else if (trackingState !== 'ready') {
          setCoachMessage(coachResult.message);
          if (coachResult.subMessage) setCoachSubMessage(coachResult.subMessage);
        }
        if (coachResult.positionIssues) setFormIssues(coachResult.positionIssues);
      }
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

  // Frame processing loop with real pose detection
  const processFrame = useCallback(async () => {
    if (trackingState !== 'calibrating' && trackingState !== 'positioning' && 
        trackingState !== 'ready' && trackingState !== 'tracking') {
      return;
    }

    const now = Date.now();
    
    // Throttle to ~10 FPS
    if (now - lastInferenceTimeRef.current < 100) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastInferenceTimeRef.current = now;

    try {
      // Get pose from real detector (uses camera frame dimensions)
      const pose = await detectPoseFromFrame(
        { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, timestamp: now },
        currentPose
      );
      
      if (pose) {
        handlePoseDetected(pose);
      }
    } catch (error) {
      console.warn('Pose detection error:', error);
    }

    // Update FPS counter
    frameCountRef.current++;
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [trackingState, currentPose, handlePoseDetected]);

  // Start/stop frame processing
  useEffect(() => {
    if (trackingState === 'calibrating' || trackingState === 'positioning' || 
        trackingState === 'ready' || trackingState === 'tracking') {
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

  const handleRecalibrate = useCallback(() => {
    if (calibratorRef.current) {
      calibratorRef.current.reset();
    }
    if (aiCoachRef.current) {
      aiCoachRef.current.reset();
    }
    resetRealPoseDetector();
    setCalibrationState(null);
    setCalibratedPose(null);
    setShowCalibrationSuccess(false);
    setTrackingState('calibrating');
    setCoachMessage('Stand still for calibration');
    setCoachSubMessage('Keep your full body visible in frame');
    
    if (audioEnabled) {
      audioFeedback.speak('Recalibrating. Stand still.');
    }
  }, [audioEnabled]);

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

  const getCalibrationProgress = () => {
    return calibrationState?.progress || 0;
  };

  // Render loading state
  if (trackingState === 'setup') {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4">Setting up...</Text>
      </ScreenContainer>
    );
  }

  // Render completed state
  if (trackingState === 'completed' && session) {
    const summary = getFormSummaryExtended(session);
    return (
      <ScreenContainer className="flex-1">
        <ScrollView className="flex-1 p-4">
          <View className="items-center mb-6">
            <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
            <Text className="text-2xl font-bold text-foreground mt-4">Workout Complete!</Text>
          </View>

          <View className="bg-surface rounded-2xl p-6 mb-4">
            <Text className="text-lg font-semibold text-foreground mb-4">{getExerciseName()}</Text>
            
            <View className="flex-row justify-between mb-4">
              <View className="items-center">
                <Text className="text-3xl font-bold text-primary">{currentRep}</Text>
                <Text className="text-muted">Reps</Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold" style={{ color: colors.success }}>{summary.averageScore}</Text>
                <Text className="text-muted">Form Score</Text>
              </View>
              <View className="items-center">
                <Text className="text-3xl font-bold text-foreground">{summary.grade}</Text>
                <Text className="text-muted">Grade</Text>
              </View>
            </View>

            {summary.topIssues.length > 0 && (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-sm font-medium text-foreground mb-2">Areas to Improve:</Text>
                {summary.topIssues.map((issue, idx) => (
                  <Text key={idx} className="text-sm text-muted">• {issue}</Text>
                ))}
              </View>
            )}

            {summary.tip && (
              <View className="mt-4 bg-primary/10 rounded-lg p-3">
                <Text className="text-sm text-primary">{summary.tip}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center mb-4"
            onPress={() => router.back()}
          >
            <Text className="text-background font-semibold text-lg">Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-surface rounded-xl py-4 items-center"
            onPress={() => {
              handleRecalibrate();
            }}
          >
            <Text className="text-foreground font-semibold">Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Render camera/tracking view
  return (
    <ScreenContainer edges={['top', 'left', 'right']} className="flex-1">
      <View style={styles.container}>
        {/* Camera View */}
        <View style={styles.cameraContainer}>
          {Platform.OS !== 'web' && permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={cameraFacing}
              onCameraReady={() => setCameraReady(true)}
            />
          ) : (
            <View style={[styles.camera, { backgroundColor: colors.surface }]}>
              <Text className="text-muted text-center">
                {Platform.OS === 'web' ? 'Camera preview (Web)' : 'Camera not available'}
              </Text>
            </View>
          )}

          {/* Skeleton Overlay */}
          {showSkeleton && currentPose && (
            <SkeletonOverlay
              pose={currentPose}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT * 0.6}
              exerciseType={exerciseType}
              formIssues={formIssues}
            />
          )}

          {/* Calibrated Joints Highlight Overlay - positioning/ready phase */}
          {(trackingState === 'positioning' || trackingState === 'ready') && calibratedPose && (
            <CalibratedJointsOverlay
              pose={calibratedPose}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT * 0.6}
              isCalibrated={true}
              showCelebration={showCalibrationSuccess}
              showLabels={true}
              confidenceMode={false}
            />
          )}

          {/* Calibrated Joints Overlay during tracking - with confidence colors */}
          {trackingState === 'tracking' && currentPose && showSkeleton && (
            <CalibratedJointsOverlay
              pose={currentPose}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT * 0.6}
              isCalibrated={true}
              showCelebration={false}
              showLabels={false}
              confidenceMode={true}
            />
          )}

          {/* Form Guide Overlay */}
          {showFormGuide && trackingState === 'tracking' && (
            <FormGuideOverlay
              exerciseType={exerciseType}
              isTracking={true}
              currentState={'up'}
            />
          )}

          {/* Calibration Progress Overlay */}
          {trackingState === 'calibrating' && calibrationState && (
            <View style={styles.calibrationOverlay}>
              <View style={styles.calibrationCard}>
                <Text style={[styles.calibrationTitle, { color: colors.foreground }]}>
                  Calibrating...
                </Text>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { 
                        width: `${getCalibrationProgress()}%`,
                        backgroundColor: colors.primary 
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.calibrationProgress, { color: colors.muted }]}>
                  {getCalibrationProgress()}%
                </Text>
                
                {/* Joint status indicators */}
                {calibrationState.joints && (
                  <View style={styles.jointStatusContainer}>
                    {calibrationState.joints.slice(0, 6).map((joint, idx) => (
                      <View key={idx} style={styles.jointStatus}>
                        <View 
                          style={[
                            styles.jointDot,
                            { 
                              backgroundColor: joint.stable ? colors.success : 
                                joint.detected ? colors.warning : colors.error 
                            }
                          ]} 
                        />
                        <Text style={[styles.jointName, { color: colors.muted }]}>
                          {joint.name.replace('Left ', 'L ').replace('Right ', 'R ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.surface }]}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>

            <View style={styles.topRightControls}>
              {/* Debug Toggle */}
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: showDebug ? colors.primary : colors.surface }]}
                onPress={() => setShowDebug(!showDebug)}
              >
                <IconSymbol name="info.circle" size={20} color={showDebug ? colors.background : colors.foreground} />
              </TouchableOpacity>

              {/* Camera Toggle */}
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: colors.surface }]}
                onPress={toggleCamera}
              >
                <IconSymbol name="camera.rotate" size={20} color={colors.foreground} />
              </TouchableOpacity>

              {/* Audio Toggle */}
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: audioEnabled ? colors.primary : colors.surface }]}
                onPress={() => setAudioEnabled(!audioEnabled)}
              >
                <IconSymbol 
                  name={audioEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill"} 
                  size={20} 
                  color={audioEnabled ? colors.background : colors.foreground} 
                />
              </TouchableOpacity>

              {/* Skeleton Toggle */}
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: showSkeleton ? colors.primary : colors.surface }]}
                onPress={() => setShowSkeleton(!showSkeleton)}
              >
                <IconSymbol name="figure.stand" size={20} color={showSkeleton ? colors.background : colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confidence Indicator */}
          <View style={[styles.confidenceIndicator, { backgroundColor: colors.surface }]}>
            <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
            <Text style={[styles.confidenceText, { color: colors.foreground }]}>
              {getConfidenceLabel()}
            </Text>
            {showDebug && (
              <Text style={[styles.fpsText, { color: colors.muted }]}>
                {fps} FPS | {Math.round(confidence * 100)}%
              </Text>
            )}
          </View>

          {/* Debug Overlay */}
          {showDebug && currentPose && (
            <View style={[styles.debugOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <Text style={styles.debugText}>Keypoints: {currentPose.keypoints.length}</Text>
              <Text style={styles.debugText}>Confidence: {Math.round(confidence * 100)}%</Text>
              <Text style={styles.debugText}>State: {trackingState}</Text>
              <Text style={styles.debugText}>Reps: {currentRep}</Text>
              {calibrationState && (
                <Text style={styles.debugText}>Cal: {calibrationState.status}</Text>
              )}
            </View>
          )}
        </View>

        {/* Bottom Panel */}
        <View style={[styles.bottomPanel, { backgroundColor: colors.background }]}>
          {/* Coach Message */}
          <View style={styles.coachMessageContainer}>
            <Text style={[styles.coachMessage, { color: colors.foreground }]}>
              {coachMessage}
            </Text>
            <Text style={[styles.coachSubMessage, { color: colors.muted }]}>
              {coachSubMessage}
            </Text>
          </View>

          {/* Rep Counter (during tracking) */}
          {trackingState === 'tracking' && (
            <View style={styles.repCounter}>
              <Text style={[styles.repCount, { color: colors.primary }]}>{currentRep}</Text>
              <Text style={[styles.repLabel, { color: colors.muted }]}>reps</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {trackingState === 'calibrating' && (
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surface }]}
                onPress={handleRecalibrate}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                  Restart Calibration
                </Text>
              </TouchableOpacity>
            )}

            {(trackingState === 'positioning' || trackingState === 'ready') && (
              <>
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: colors.surface }]}
                  onPress={handleRecalibrate}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                    Recalibrate
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.primaryButton, 
                    { backgroundColor: trackingState === 'ready' ? colors.primary : colors.muted }
                  ]}
                  onPress={handleReadyToStart}
                  disabled={trackingState !== 'ready'}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                    Start
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {trackingState === 'tracking' && (
              <TouchableOpacity
                style={[styles.finishButton, { backgroundColor: colors.error }]}
                onPress={handleFinish}
              >
                <Text style={[styles.finishButtonText, { color: '#fff' }]}>
                  Finish Set
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topControls: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidenceIndicator: {
    position: 'absolute',
    top: 70,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fpsText: {
    fontSize: 10,
    marginLeft: 8,
  },
  calibrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  calibrationCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  calibrationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  calibrationProgress: {
    fontSize: 14,
    marginTop: 8,
  },
  jointStatusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  jointStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  jointName: {
    fontSize: 10,
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    padding: 8,
    borderRadius: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bottomPanel: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  coachMessageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coachMessage: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  coachSubMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  repCounter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  repCount: {
    fontSize: 48,
    fontWeight: '700',
  },
  repLabel: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  finishButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
