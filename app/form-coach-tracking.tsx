import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Camera as VisionCamera, type CameraPosition } from 'react-native-vision-camera';
import { usePoseCamera } from '@/hooks/use-pose-camera';
import { FormGuideOverlay } from '@/components/form-guide-overlay';
import { SkeletonOverlay } from '@/components/skeleton-overlay';
import { CalibratedJointsOverlay } from '@/components/calibrated-joints-overlay';
import { ProgressiveCalibrationOverlay, JOINT_DETECTION_ORDER, JointDetectionStatus } from '@/components/progressive-calibration-overlay';
import { ProgressiveCalibrationManager } from '@/lib/progressive-calibration';
import { AICoach } from '@/lib/ai-coach';
import { audioFeedback, stopSpeech } from '@/lib/audio-feedback';
import { 
  detectPoseFromFrame, 
  resetRealPoseDetector,
  setDetectionMode,
  startDemoDetection,
  stopDemoDetection,
  isDemoActive,
  getDetectionMode,
} from '@/lib/real-pose-detection';
import { ConfidenceLegend } from '@/components/confidence-legend';
import { JointLossAlertManager } from '@/lib/joint-loss-alert';

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
  // Camera permission now handled by usePoseCamera hook
  const [session, setSession] = useState<ExerciseSession | null>(null);
  const [currentRep, setCurrentRep] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraPosition>('back');
  const [showFormGuide, setShowFormGuide] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false); // Off by default after calibration
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fps, setFps] = useState(0);
  const [coachMessage, setCoachMessage] = useState('');
  const [coachSubMessage, setCoachSubMessage] = useState('');
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [formIssues, setFormIssues] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [calibratedPose, setCalibratedPose] = useState<Pose | null>(null);

  // Progressive calibration state
  const [detectedJoints, setDetectedJoints] = useState<JointDetectionStatus[]>([]);
  const [currentSearchingGroup, setCurrentSearchingGroup] = useState(0);
  const [allJointsDetected, setAllJointsDetected] = useState(false);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);

  const [lostJointsWarning, setLostJointsWarning] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [waitingForPerson, setWaitingForPerson] = useState(true);

  const trackerRef = useRef<PushupTracker | PullupTracker | SquatTracker | RDLTracker | null>(null);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const cameraRef = useRef<any>(null); // Legacy ref (VisionCamera ref handled by usePoseCamera)
  const aiCoachRef = useRef<AICoach | null>(null);
  const progressiveCalibrationRef = useRef<ProgressiveCalibrationManager | null>(null);
  const jointLossAlertRef = useRef<JointLossAlertManager | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  // VisionCamera + MediaPipe pose detection
  const isActive = trackingState === 'calibrating' || trackingState === 'positioning' || 
                   trackingState === 'ready' || trackingState === 'tracking';
  const { cameraRef: visionCameraRef, device, hasPermission, frameProcessor, fps: detectionFps } = usePoseCamera({
    position: cameraFacing,
    active: isActive,
  });

  const lastFpsUpdateRef = useRef(Date.now());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      audioFeedback.reset();
      resetRealPoseDetector();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (jointLossAlertRef.current) jointLossAlertRef.current.stop();
    };
  }, []);

  // Camera permission handled by usePoseCamera hook

  // Initialize tracker, coach, and calibration manager
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
    
    // Create progressive calibration manager
    progressiveCalibrationRef.current = new ProgressiveCalibrationManager();
    progressiveCalibrationRef.current.setOnJointDetected((groupIndex, groupName) => {
      // Haptic feedback when joint group is detected
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (audioEnabled) {
        audioFeedback.speak(`${groupName} detected`);
      }
    });
    progressiveCalibrationRef.current.setOnAllDetected(() => {
      // Haptic feedback when all joints detected
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (audioEnabled) {
        audioFeedback.speak('All joints detected! Tap Confirm to start.');
      }
    });
    
    // Create joint loss alert manager
    jointLossAlertRef.current = new JointLossAlertManager();
    jointLossAlertRef.current.setAudioEnabled(audioEnabled);
    jointLossAlertRef.current.setHapticEnabled(true);
    
    // Reset pose detector
    resetRealPoseDetector();
    
    // Start with calibration phase
    setTrackingState('calibrating');
    setCoachMessage('Looking for your body...');
    setCoachSubMessage('Stand so your full body is visible');
    
    if (audioEnabled) {
      audioFeedback.speak('Stand so your full body is visible. I will find your joints.');
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
      // Still waiting for a person to be detected
      if (trackingState === 'calibrating') {
        setWaitingForPerson(true);
      }
      return;
    }

    // Person detected!
    setWaitingForPerson(false);
    setCurrentPose(pose);
    const poseConfidence = calculatePoseConfidence(pose, exerciseType);
    setConfidence(poseConfidence);

    // Handle calibration phase with progressive detection
    if (trackingState === 'calibrating' && progressiveCalibrationRef.current) {
      const calState = progressiveCalibrationRef.current.processFrame(pose);
      
      // Update UI state
      setDetectedJoints(calState.detectedJoints);
      setCurrentSearchingGroup(calState.currentGroupIndex);
      setAllJointsDetected(calState.allDetected);
      
      // Update coach message based on current state
      if (calState.allDetected) {
        setCoachMessage('All joints found!');
        setCoachSubMessage('Tap "Confirm & Start" when ready');
      } else {
        const currentGroup = JOINT_DETECTION_ORDER[calState.currentGroupIndex];
        setCoachMessage(`Looking for ${currentGroup?.name || 'joints'}...`);
        setCoachSubMessage('Keep your full body visible');
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
      
      // Check for joint loss during tracking
      if (jointLossAlertRef.current) {
        const alertState = jointLossAlertRef.current.processFrame(pose);
        if (alertState.lostJoints.length > 0) {
          setLostJointsWarning(jointLossAlertRef.current.getLostJoints());
        } else if (alertState.recoveredJoints.length > 0) {
          setLostJointsWarning(jointLossAlertRef.current.getLostJoints());
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

  // Handle calibration confirmation
  const handleConfirmCalibration = useCallback(() => {
    if (!progressiveCalibrationRef.current || !allJointsDetected) return;
    
    const calibratedPoseResult = progressiveCalibrationRef.current.confirm();
    if (calibratedPoseResult) {
      setCalibratedPose(calibratedPoseResult);
      setCalibrationConfirmed(true);
      setTrackingState('positioning');
      setCoachMessage('Calibration confirmed!');
      setCoachSubMessage(getStartPositionMessage());
      
      if (audioEnabled) {
        audioFeedback.speak('Calibration confirmed! ' + getStartPositionMessage());
      }
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [allJointsDetected, audioEnabled, getStartPositionMessage]);

  const handleReadyToStart = useCallback(() => {
    if (audioEnabled) {
      audioFeedback.onSessionStart(getExerciseName());
    }
    
    const newSession = createExerciseSession(exerciseType);
    sessionRef.current = newSession;
    setSession(newSession);
    setCurrentRep(0);
    setTrackingState('tracking');
    setCoachMessage('Go!');
    setCoachSubMessage('');
    setShowSkeleton(false); // Hide skeleton by default during tracking
    
    // Start joint loss monitoring
    if (jointLossAlertRef.current && calibratedPose) {
      jointLossAlertRef.current.start();
      jointLossAlertRef.current.initializeFromPose(calibratedPose);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [exerciseType, audioEnabled, calibratedPose]);

  const handleFinish = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current = finalizeSession(sessionRef.current);
      setSession(sessionRef.current);
    }
    
    // Stop joint loss monitoring
    if (jointLossAlertRef.current) {
      jointLossAlertRef.current.stop();
    }
    
    setTrackingState('completed');
    
    if (audioEnabled && sessionRef.current) {
      const summary = getFormSummaryExtended(sessionRef.current);
      audioFeedback.onSessionEnd(currentRep, summary.averageScore);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [currentRep, audioEnabled]);

  const handleRecalibrate = useCallback(() => {
    if (progressiveCalibrationRef.current) {
      progressiveCalibrationRef.current.reset();
    }
    if (aiCoachRef.current) {
      aiCoachRef.current.reset();
    }
    if (jointLossAlertRef.current) {
      jointLossAlertRef.current.stop();
      jointLossAlertRef.current.reset();
    }
    
    // Reset demo mode
    setDemoMode(false);
    setDetectionMode('real');
    stopDemoDetection();
    resetRealPoseDetector();
    
    // Reset all calibration state
    setDetectedJoints([]);
    setCurrentSearchingGroup(0);
    setAllJointsDetected(false);
    setCalibrationConfirmed(false);
    setCalibratedPose(null);
    setLostJointsWarning([]);
    setWaitingForPerson(true);
    
    setTrackingState('calibrating');
    setCoachMessage('Looking for your body...');
    setCoachSubMessage('Stand so your full body is visible');
    
    if (audioEnabled) {
      audioFeedback.speak('Recalibrating. Stand so your full body is visible.');
    }
  }, [audioEnabled]);

  const toggleCamera = useCallback(() => {
    setCameraFacing(prev => prev === 'front' ? 'back' : 'front');
    // Reset calibration when switching camera
    handleRecalibrate();
  }, [handleRecalibrate]);

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
              <View className="mt-4 p-3 bg-primary/10 rounded-lg">
                <Text className="text-sm text-primary">💡 {summary.tip}</Text>
              </View>
            )}
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-surface py-4 rounded-xl items-center"
              onPress={() => router.back()}
            >
              <Text className="text-foreground font-semibold">Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-primary py-4 rounded-xl items-center"
              onPress={handleRecalibrate}
            >
              <Text className="text-background font-semibold">New Set</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Render camera view
  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Camera View */}
        <View style={styles.cameraContainer}>
          {Platform.OS !== 'web' && device ? (
            <VisionCamera
              ref={visionCameraRef}
              style={styles.camera}
              device={device}
              isActive={isActive}
              frameProcessor={frameProcessor}
              pixelFormat="yuv"
              onStarted={() => setCameraReady(true)}
            />
          ) : (
            <View style={[styles.camera, { backgroundColor: colors.surface }]}>
              <Text className="text-muted">Camera preview (web simulation)</Text>
            </View>
          )}

          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: colors.surface }]}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </TouchableOpacity>

            <View style={styles.topRightControls}>
              {/* Camera Switch */}
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

              {/* Skeleton Toggle (only during tracking) */}
              {trackingState === 'tracking' && (
                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: showSkeleton ? colors.primary : colors.surface }]}
                  onPress={() => setShowSkeleton(!showSkeleton)}
                >
                  <IconSymbol name="figure.stand" size={20} color={showSkeleton ? colors.background : colors.foreground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Progressive Calibration Overlay */}
          {trackingState === 'calibrating' && (
            <ProgressiveCalibrationOverlay
              pose={currentPose}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT * 0.6}
              detectedJoints={detectedJoints}
              currentSearchingGroup={currentSearchingGroup}
              allDetected={allJointsDetected}
              onConfirm={handleConfirmCalibration}
            />
          )}

          {/* Skeleton Overlay (after calibration, during tracking if enabled) */}
          {showSkeleton && trackingState === 'tracking' && currentPose && (
            <SkeletonOverlay
              pose={currentPose}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT * 0.6}
              exerciseType={exerciseType}
              formIssues={formIssues}
            />
          )}

          {/* Calibrated Joints Overlay - positioning/ready phase */}
          {(trackingState === 'positioning' || trackingState === 'ready') && calibratedPose && (
            <CalibratedJointsOverlay
              pose={calibratedPose}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT * 0.6}
              isCalibrated={true}
              showCelebration={false}
              showLabels={true}
              confidenceMode={false}
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

          {/* Confidence Legend */}
          {trackingState === 'tracking' && showLegend && (
            <ConfidenceLegend compact={true} visible={true} />
          )}

          {/* Lost Joints Warning Banner */}
          {trackingState === 'tracking' && lostJointsWarning.length > 0 && (
            <View style={styles.lostJointsWarning}>
              <Text style={styles.lostJointsText}>
                ⚠️ Lost: {lostJointsWarning.slice(0, 3).join(', ')}
                {lostJointsWarning.length > 3 ? ` +${lostJointsWarning.length - 3} more` : ''}
              </Text>
            </View>
          )}

          {/* Confidence Indicator (during tracking) */}
          {trackingState === 'tracking' && (
            <View style={[styles.confidenceIndicator, { backgroundColor: colors.surface }]}>
              <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
              <Text style={[styles.confidenceText, { color: colors.foreground }]}>
                {getConfidenceLabel()}
              </Text>
              {showDebug && (
                <Text style={[styles.fpsText, { color: colors.muted }]}>
                  {detectionFps} FPS | {Math.round(confidence * 100)}%
                </Text>
              )}
            </View>
          )}

          {/* Debug Overlay */}
          {showDebug && currentPose && (
            <View style={[styles.debugOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <Text style={styles.debugText}>Keypoints: {currentPose.keypoints.length}</Text>
              <Text style={styles.debugText}>Confidence: {Math.round(confidence * 100)}%</Text>
              <Text style={styles.debugText}>State: {trackingState}</Text>
              <Text style={styles.debugText}>Reps: {currentRep}</Text>
              <Text style={styles.debugText}>Camera: {cameraFacing}</Text>
            </View>
          )}
        </View>

        {/* Bottom Panel */}
        <View style={[styles.bottomPanel, { backgroundColor: colors.background }]}>
          {/* Coach Message */}
          <View style={styles.coachMessageContainer}>
            {trackingState === 'calibrating' && waitingForPerson && !demoMode ? (
              <>
                <Text style={[styles.coachMessage, { color: colors.warning }]}>
                  📷 No person detected
                </Text>
                <Text style={[styles.coachSubMessage, { color: colors.muted }]}>
                  Stand in front of the camera so your full body is visible.
                  {Platform.OS === 'web' ? '\nNote: Real detection requires a native app build.' : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.coachMessage, { color: colors.foreground }]}>
                  {coachMessage}
                </Text>
                <Text style={[styles.coachSubMessage, { color: colors.muted }]}>
                  {coachSubMessage}
                </Text>
              </>
            )}
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
            {trackingState === 'calibrating' && !allJointsDetected && (
              <>
                {/* Demo Mode Toggle - for testing without real pose detection */}
                <TouchableOpacity
                  style={[
                    styles.secondaryButton, 
                    { backgroundColor: demoMode ? colors.warning : colors.surface }
                  ]}
                  onPress={() => {
                    const newDemoMode = !demoMode;
                    setDemoMode(newDemoMode);
                    if (newDemoMode) {
                      setDetectionMode('demo');
                      startDemoDetection();
                      setCoachMessage('Demo Mode Active');
                      setCoachSubMessage('Simulating pose detection for testing');
                    } else {
                      setDetectionMode('real');
                      stopDemoDetection();
                      setWaitingForPerson(true);
                      setCoachMessage('Step into frame');
                      setCoachSubMessage('Stand so your full body is visible');
                    }
                  }}
                >
                  <Text style={[styles.secondaryButtonText, { color: demoMode ? '#000' : colors.foreground }]}>
                    {demoMode ? '🎭 Demo ON' : '🎭 Demo'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: colors.surface }]}
                  onPress={handleRecalibrate}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                    Restart
                  </Text>
                </TouchableOpacity>
              </>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
  debugOverlay: {
    position: 'absolute',
    top: 110,
    left: 16,
    padding: 8,
    borderRadius: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  bottomPanel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  coachMessageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coachMessage: {
    fontSize: 20,
    fontWeight: '700',
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
    fontSize: 64,
    fontWeight: '800',
  },
  repLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
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
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  finishButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  lostJointsWarning: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  lostJointsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
