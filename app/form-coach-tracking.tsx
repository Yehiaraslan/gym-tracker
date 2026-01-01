import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { FormGuideOverlay } from '@/components/form-guide-overlay';
import { SkeletonOverlay } from '@/components/skeleton-overlay';
import { AICoach, CoachingPhase } from '@/lib/ai-coach';
import { audioFeedback, stopSpeech } from '@/lib/audio-feedback';

// TensorFlow imports for real pose detection
import * as tf from '@tensorflow/tfjs';
import * as posedetection from '@tensorflow-models/pose-detection';

type TrackingState = 'setup' | 'positioning' | 'ready' | 'tracking' | 'completed';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_KEYPOINT_SCORE = 0.3;

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
  const [currentState, setCurrentState] = useState('ready');
  const [lastRepData, setLastRepData] = useState<RepData | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [showFormGuide, setShowFormGuide] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fps, setFps] = useState(0);
  const [modelStatus, setModelStatus] = useState('Loading...');
  
  // AI Coach state
  const [coachMessage, setCoachMessage] = useState('');
  const [coachSubMessage, setCoachSubMessage] = useState('');
  const [isPositionReady, setIsPositionReady] = useState(false);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [formIssues, setFormIssues] = useState<string[]>([]);

  // Refs
  const trackerRef = useRef<PushupTracker | PullupTracker | SquatTracker | null>(null);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const cameraRef = useRef<any>(null);
  const aiCoachRef = useRef<AICoach | null>(null);
  const modelRef = useRef<posedetection.PoseDetector | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      audioFeedback.reset();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, []);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted && Platform.OS !== 'web') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Initialize TensorFlow.js and MoveNet model
  useEffect(() => {
    let isMounted = true;

    async function initializeModel() {
      try {
        setIsModelLoading(true);
        setModelStatus('Initializing TensorFlow.js...');

        // Initialize TensorFlow.js
        await tf.ready();
        if (!isMounted) return;
        
        console.log('[FormCoach] TF.js ready, backend:', tf.getBackend());
        setModelStatus('Loading MoveNet model...');

        // Load MoveNet model - SINGLEPOSE_LIGHTNING is fastest
        const detector = await posedetection.createDetector(
          posedetection.SupportedModels.MoveNet,
          {
            modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
          }
        );

        if (!isMounted) {
          detector.dispose();
          return;
        }

        console.log('[FormCoach] MoveNet model loaded successfully');
        modelRef.current = detector;
        setIsModelLoading(false);
        setTrackingState('positioning');
        setCoachMessage('Position yourself in frame');
        setCoachSubMessage(getStartPositionMessage());

      } catch (error) {
        console.error('[FormCoach] Model initialization error:', error);
        if (isMounted) {
          // Fall back to demo mode on error
          setModelError(null);
          setIsModelLoading(false);
          setTrackingState('positioning');
          setCoachMessage('Position yourself in frame');
          setCoachSubMessage(getStartPositionMessage() + '\n(Demo mode - model unavailable)');
        }
      }
    }

    // Initialize exercise tracker
    if (exerciseType === 'pushup') {
      trackerRef.current = new PushupTracker();
    } else if (exerciseType === 'pullup') {
      trackerRef.current = new PullupTracker();
    } else {
      trackerRef.current = new SquatTracker();
    }
    
    // Initialize AI Coach
    aiCoachRef.current = new AICoach(exerciseType);

    initializeModel();

    return () => {
      isMounted = false;
    };
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

  // Convert detected pose to our Pose format
  const convertToInternalPose = useCallback((detectedPose: posedetection.Pose): Pose => {
    const keypoints = detectedPose.keypoints.map((kp, idx) => {
      // Flip X coordinate for front camera
      let x = kp.x;
      if (cameraFacing === 'front') {
        x = SCREEN_WIDTH - x;
      }
      
      return {
        x: x,
        y: kp.y,
        score: kp.score || 0,
        name: kp.name || `keypoint_${idx}`,
      };
    });

    return { keypoints };
  }, [cameraFacing]);

  // Process a single frame for pose detection
  const processFrame = useCallback(async () => {
    // Skip if not active or already processing
    if (!cameraRef.current || isProcessingRef.current || !cameraReady) {
      if (trackingState === 'positioning' || trackingState === 'ready' || trackingState === 'tracking') {
        rafIdRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }

    // Throttle to ~10 FPS for performance
    const now = Date.now();
    const throttleMs = 100;
    if (now - lastInferenceTimeRef.current < throttleMs) {
      rafIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    isProcessingRef.current = true;
    lastInferenceTimeRef.current = now;

    try {
      // If we have a real model, use it
      if (modelRef.current && Platform.OS !== 'web') {
        // Take picture from camera
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.3,
          skipProcessing: true,
          exif: false,
        });

        if (photo && photo.base64 && modelRef.current) {
          // Decode image to tensor
          const { decodeJpeg } = await import('@tensorflow/tfjs-react-native');
          const imageData = tf.util.encodeString(photo.base64, 'base64');
          const imageTensor = decodeJpeg(new Uint8Array(imageData.buffer));
          
          // Run pose detection
          const poses = await modelRef.current.estimatePoses(imageTensor as tf.Tensor3D);
          
          tf.dispose(imageTensor);

          if (poses.length > 0) {
            const pose = convertToInternalPose(poses[0]);
            handlePoseDetected(pose);
          } else {
            handlePoseDetected(null);
          }
        }
      } else {
        // Demo mode - generate simulated pose
        const simulatedPose = generateSimulatedPose();
        handlePoseDetected(simulatedPose);
      }

      // Update FPS counter
      frameCountRef.current++;
      if (now - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

    } catch (error) {
      // Silently handle errors to avoid spam
    } finally {
      isProcessingRef.current = false;
    }

    // Continue processing
    if (trackingState === 'positioning' || trackingState === 'ready' || trackingState === 'tracking') {
      rafIdRef.current = requestAnimationFrame(processFrame);
    }
  }, [trackingState, cameraReady, cameraFacing, convertToInternalPose]);

  // Handle detected pose
  const handlePoseDetected = useCallback((pose: Pose | null) => {
    if (!pose) {
      setCurrentPose(null);
      setConfidence(0);
      return;
    }

    setCurrentPose(pose);
    const poseConfidence = calculatePoseConfidence(pose, exerciseType);
    setConfidence(poseConfidence);

    // AI Coach positioning check
    if (trackingState === 'positioning' && aiCoachRef.current) {
      const coachResult = aiCoachRef.current.processPositioning(pose);
      setCoachMessage(coachResult.message);
      setCoachSubMessage(coachResult.subMessage || '');
      setFormIssues(coachResult.positionIssues || []);

      if (coachResult.isPositionCorrect && coachResult.phase === 'ready') {
        setIsPositionReady(true);
        setTrackingState('ready');
        setCoachMessage('Ready! Tap Start when ready');
        setCoachSubMessage('Your form looks good');
      }
    }

    // Process rep during tracking
    if (trackingState === 'tracking' && trackerRef.current && sessionRef.current) {
      const repResult = trackerRef.current.processFrame(pose);
      setCurrentState(repResult.currentState);

      if (repResult.repCompleted && repResult.repData) {
        // Rep completed!
        const updatedSession = addRepToSession(sessionRef.current, repResult.repData);
        sessionRef.current = updatedSession;
        setSession({ ...updatedSession });
        setCurrentRep(updatedSession.totalReps);
        setLastRepData(repResult.repData);
        setFormIssues(repResult.repData.flags?.map(f => f.message) || []);

        // AI Coach feedback
        if (aiCoachRef.current) {
          aiCoachRef.current.onRepCompleted(
            updatedSession.totalReps,
            repResult.repData.formScore,
            repResult.repData.flags || []
          );
        }

        // Haptic feedback
        if (Platform.OS !== 'web') {
          if (repResult.repData.formScore >= 80) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      }

      // Update coach message during tracking
      if (aiCoachRef.current && repResult.repData?.flags && repResult.repData.flags.length > 0) {
        aiCoachRef.current.onFormIssueDetected(repResult.repData.flags);
        setFormIssues(repResult.repData.flags.map(f => f.message));
      }
    }
  }, [trackingState, audioEnabled]);

  // Generate simulated pose for demo mode
  const generateSimulatedPose = useCallback((): Pose => {
    const baseConfidence = 0.75 + Math.random() * 0.2;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const time = Date.now() / 1000;
    
    // Animate based on tracking state
    const animOffset = trackingState === 'tracking' ? Math.sin(time * 2) * 30 : 0;
    
    let keypoints: Pose['keypoints'];
    
    if (exerciseType === 'squat') {
      // Front view squat
      const squat = trackingState === 'tracking' ? Math.sin(time * 1.5) * 0.5 + 0.5 : 0;
      const kneeY = centerY + 50 + squat * 100;
      const hipY = centerY - 20 + squat * 80;
      
      keypoints = [
        { x: centerX, y: centerY - 150, score: baseConfidence, name: 'nose' },
        { x: centerX - 15, y: centerY - 160, score: baseConfidence * 0.9, name: 'left_eye' },
        { x: centerX + 15, y: centerY - 160, score: baseConfidence * 0.9, name: 'right_eye' },
        { x: centerX - 30, y: centerY - 150, score: baseConfidence * 0.8, name: 'left_ear' },
        { x: centerX + 30, y: centerY - 150, score: baseConfidence * 0.8, name: 'right_ear' },
        { x: centerX - 60, y: centerY - 100, score: baseConfidence, name: 'left_shoulder' },
        { x: centerX + 60, y: centerY - 100, score: baseConfidence, name: 'right_shoulder' },
        { x: centerX - 80, y: centerY - 50, score: baseConfidence, name: 'left_elbow' },
        { x: centerX + 80, y: centerY - 50, score: baseConfidence, name: 'right_elbow' },
        { x: centerX - 60, y: centerY, score: baseConfidence, name: 'left_wrist' },
        { x: centerX + 60, y: centerY, score: baseConfidence, name: 'right_wrist' },
        { x: centerX - 50, y: hipY, score: baseConfidence, name: 'left_hip' },
        { x: centerX + 50, y: hipY, score: baseConfidence, name: 'right_hip' },
        { x: centerX - 60, y: kneeY, score: baseConfidence, name: 'left_knee' },
        { x: centerX + 60, y: kneeY, score: baseConfidence, name: 'right_knee' },
        { x: centerX - 60, y: centerY + 200, score: baseConfidence, name: 'left_ankle' },
        { x: centerX + 60, y: centerY + 200, score: baseConfidence, name: 'right_ankle' },
      ];
    } else if (exerciseType === 'pushup') {
      // Side view push-up
      const pushup = trackingState === 'tracking' ? Math.sin(time * 2) * 0.5 + 0.5 : 0;
      const elbowY = centerY + 20 + pushup * 60;
      
      keypoints = [
        { x: centerX - 100, y: centerY - 80 + animOffset, score: baseConfidence, name: 'nose' },
        { x: centerX - 110, y: centerY - 90 + animOffset, score: baseConfidence * 0.9, name: 'left_eye' },
        { x: centerX - 90, y: centerY - 90 + animOffset, score: baseConfidence * 0.9, name: 'right_eye' },
        { x: centerX - 120, y: centerY - 80 + animOffset, score: baseConfidence * 0.8, name: 'left_ear' },
        { x: centerX - 80, y: centerY - 80 + animOffset, score: baseConfidence * 0.8, name: 'right_ear' },
        { x: centerX - 60, y: centerY - 40 + animOffset * 0.5, score: baseConfidence, name: 'left_shoulder' },
        { x: centerX - 60, y: centerY - 20 + animOffset * 0.5, score: baseConfidence, name: 'right_shoulder' },
        { x: centerX - 60, y: elbowY, score: baseConfidence, name: 'left_elbow' },
        { x: centerX - 60, y: elbowY + 20, score: baseConfidence, name: 'right_elbow' },
        { x: centerX - 60, y: centerY + 100, score: baseConfidence, name: 'left_wrist' },
        { x: centerX - 60, y: centerY + 120, score: baseConfidence, name: 'right_wrist' },
        { x: centerX + 80, y: centerY - 30, score: baseConfidence, name: 'left_hip' },
        { x: centerX + 80, y: centerY - 10, score: baseConfidence, name: 'right_hip' },
        { x: centerX + 180, y: centerY + 20, score: baseConfidence, name: 'left_knee' },
        { x: centerX + 180, y: centerY + 40, score: baseConfidence, name: 'right_knee' },
        { x: centerX + 250, y: centerY + 60, score: baseConfidence, name: 'left_ankle' },
        { x: centerX + 250, y: centerY + 80, score: baseConfidence, name: 'right_ankle' },
      ];
    } else {
      // Pull-up front view
      const pullup = trackingState === 'tracking' ? Math.sin(time * 1.5) * 0.5 + 0.5 : 0;
      const bodyY = centerY - pullup * 100;
      
      keypoints = [
        { x: centerX, y: bodyY - 100, score: baseConfidence, name: 'nose' },
        { x: centerX - 15, y: bodyY - 110, score: baseConfidence * 0.9, name: 'left_eye' },
        { x: centerX + 15, y: bodyY - 110, score: baseConfidence * 0.9, name: 'right_eye' },
        { x: centerX - 30, y: bodyY - 100, score: baseConfidence * 0.8, name: 'left_ear' },
        { x: centerX + 30, y: bodyY - 100, score: baseConfidence * 0.8, name: 'right_ear' },
        { x: centerX - 80, y: bodyY - 60, score: baseConfidence, name: 'left_shoulder' },
        { x: centerX + 80, y: bodyY - 60, score: baseConfidence, name: 'right_shoulder' },
        { x: centerX - 120, y: bodyY - 120, score: baseConfidence, name: 'left_elbow' },
        { x: centerX + 120, y: bodyY - 120, score: baseConfidence, name: 'right_elbow' },
        { x: centerX - 100, y: bodyY - 180, score: baseConfidence, name: 'left_wrist' },
        { x: centerX + 100, y: bodyY - 180, score: baseConfidence, name: 'right_wrist' },
        { x: centerX - 40, y: bodyY + 40, score: baseConfidence, name: 'left_hip' },
        { x: centerX + 40, y: bodyY + 40, score: baseConfidence, name: 'right_hip' },
        { x: centerX - 40, y: bodyY + 140, score: baseConfidence, name: 'left_knee' },
        { x: centerX + 40, y: bodyY + 140, score: baseConfidence, name: 'right_knee' },
        { x: centerX - 40, y: bodyY + 220, score: baseConfidence, name: 'left_ankle' },
        { x: centerX + 40, y: bodyY + 220, score: baseConfidence, name: 'right_ankle' },
      ];
    }

    return { keypoints };
  }, [exerciseType, trackingState]);

  // Start frame processing when camera is ready
  useEffect(() => {
    if (cameraReady && (trackingState === 'positioning' || trackingState === 'ready' || trackingState === 'tracking')) {
      rafIdRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [cameraReady, trackingState, processFrame]);

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
    setCoachMessage('Go!');
    setCoachSubMessage('');
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
        <Text className="text-muted mt-2">{modelStatus}</Text>
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

    if (!permission?.granted) {
      return (
        <View style={[styles.camera, { backgroundColor: '#1a1a1a' }]}>
          <View style={styles.cameraPlaceholder}>
            <IconSymbol name="camera.fill" size={48} color="#666" />
            <Text style={styles.placeholderText}>
              Camera permission required
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              style={{ marginTop: 16, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Grant Permission</Text>
            </TouchableOpacity>
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

        {/* Skeleton Overlay - shows detected pose */}
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
            
            <Text style={styles.exerciseTitle}>{exerciseName}</Text>
            
            <View style={styles.topBarRight}>
              {/* FPS indicator */}
              <View style={styles.fpsContainer}>
                <Text style={styles.fpsText}>{fps} FPS</Text>
              </View>
              
              {/* Camera switch */}
              {Platform.OS !== 'web' && (
                <TouchableOpacity onPress={toggleCamera} style={styles.iconButton}>
                  <IconSymbol name="camera.rotate.fill" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              
              {/* Skeleton toggle */}
              <TouchableOpacity onPress={toggleSkeleton} style={styles.iconButton}>
                <IconSymbol 
                  name="figure.stand" 
                  size={24} 
                  color={showSkeleton ? colors.primary : '#FFFFFF'} 
                />
              </TouchableOpacity>
              
              {/* Audio toggle */}
              <TouchableOpacity onPress={toggleAudio} style={styles.iconButton}>
                <IconSymbol 
                  name={audioEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill"} 
                  size={24} 
                  color={audioEnabled ? '#FFFFFF' : '#666'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Coach Message */}
          <View style={styles.coachMessageContainer}>
            <Text style={styles.coachMessage}>{coachMessage}</Text>
            {coachSubMessage ? (
              <Text style={styles.coachSubMessage}>{coachSubMessage}</Text>
            ) : null}
          </View>

          {/* Form Issues */}
          {formIssues.length > 0 && trackingState === 'tracking' && (
            <View style={styles.formIssuesContainer}>
              {formIssues.slice(0, 2).map((issue, index) => (
                <View key={index} style={styles.formIssueBadge}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color="#FFA500" />
                  <Text style={styles.formIssueText}>{issue}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Bottom Stats & Controls */}
          <View style={styles.bottomContainer}>
            {/* Confidence indicator */}
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceLabel}>Tracking</Text>
              <View style={styles.confidenceBar}>
                <View 
                  style={[
                    styles.confidenceFill, 
                    { 
                      width: `${confidence * 100}%`,
                      backgroundColor: confidence > 0.6 ? colors.success : confidence > 0.3 ? colors.warning : colors.error
                    }
                  ]} 
                />
              </View>
              <Text style={styles.confidenceValue}>{Math.round(confidence * 100)}%</Text>
            </View>

            {/* Rep counter (during tracking) */}
            {trackingState === 'tracking' && (
              <View style={styles.repCounterContainer}>
                <Text style={styles.repCounterLabel}>REPS</Text>
                <Text style={styles.repCounter}>{currentRep}</Text>
                {lastRepData && (
                  <Text style={[
                    styles.lastRepScore,
                    { color: lastRepData.formScore >= 80 ? colors.success : colors.warning }
                  ]}>
                    Last: {Math.round(lastRepData.formScore)}%
                  </Text>
                )}
              </View>
            )}

            {/* Control buttons */}
            <View style={styles.controlsContainer}>
              {trackingState === 'positioning' && (
                <Text style={styles.positioningHint}>
                  Get into position and hold steady
                </Text>
              )}
              
              {trackingState === 'ready' && (
                <TouchableOpacity
                  onPress={handleStartTracking}
                  style={[styles.startButton, { backgroundColor: colors.success }]}
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
                  <IconSymbol name="stop.fill" size={24} color="#FFFFFF" />
                  <Text style={styles.stopButtonText}>Stop</Text>
                </TouchableOpacity>
              )}
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fpsContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fpsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachMessageContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
  },
  coachMessage: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  coachSubMessage: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  formIssuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  formIssueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  formIssueText: {
    color: '#FFA500',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  confidenceLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    width: 60,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  repCounterContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  repCounterLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  repCounter: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 80,
  },
  lastRepScore: {
    fontSize: 14,
    fontWeight: '600',
  },
  controlsContainer: {
    alignItems: 'center',
  },
  positioningHint: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  completedHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
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
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 24,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  completedActions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
