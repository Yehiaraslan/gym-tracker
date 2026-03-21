/**
 * usePoseCamera — VisionCamera + MediaPipe Pose Landmarker hook
 *
 * Debug state tracks every stage of the pipeline so failures can be pinpointed:
 *   Stage 1: Camera device found
 *   Stage 2: Camera permission granted
 *   Stage 3: usePoseDetection hook initialized (module loaded)
 *   Stage 4: createDetector() resolved (detectorHandle available)
 *   Stage 5: frameProcessor attached to Camera
 *   Stage 6: onResults fired at least once (full pipeline working)
 *   Stage 7: Landmarks present in result (person detected)
 *
 * Key fix: newArchEnabled: false in app.config.ts — react-native-mediapipe
 * uses old NativeModules bridge for createDetector(), which breaks under
 * the New Architecture's TurboModules.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type CameraPosition,
} from 'react-native-vision-camera';
import {
  usePoseDetection,
  type PoseDetectionResultBundle,
  RunningMode,
  Delegate,
} from 'react-native-mediapipe';
import type { ViewCoordinator } from 'react-native-mediapipe';
import { getRealPoseDetector, type MediaPipeLandmark } from '@/lib/real-pose-detection';

export interface UsePoseCameraOptions {
  position?: CameraPosition;
  active?: boolean;
}

export interface PoseCameraDebugState {
  stage: number;           // Current pipeline stage (1-7)
  stageLabel: string;      // Human-readable stage name
  deviceFound: boolean;
  permissionGranted: boolean;
  hookInitialized: boolean;
  cameraAllowed: boolean;  // 2s delay passed
  onResultsFired: boolean; // onResults called at least once
  landmarksReceived: boolean; // Actual landmarks in result
  errorMessage: string | null;
  totalFrames: number;
  fps: number;
}

export function usePoseCamera(opts: UsePoseCameraOptions = {}) {
  const { position = 'back', active = true } = opts;
  const cameraRef = useRef<Camera>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // --- Debug state ---
  const [debugState, setDebugState] = useState<PoseCameraDebugState>({
    stage: 1,
    stageLabel: 'Waiting for camera device...',
    deviceFound: false,
    permissionGranted: false,
    hookInitialized: false,
    cameraAllowed: false,
    onResultsFired: false,
    landmarksReceived: false,
    errorMessage: null,
    totalFrames: 0,
    fps: 0,
  });

  const totalFramesRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsTickRef = useRef(Date.now());
  const detectorReadyRef = useRef(false);

  // Derived: detectorReady = onResults fired at least once
  const [detectorReady, setDetectorReady] = useState(false);

  // VisionCamera device + permission
  const device = useCameraDevice(position);
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Update debug state when device/permission change
  useEffect(() => {
    setDebugState(prev => {
      const deviceFound = !!device;
      const permissionGranted = hasPermission;
      let stage = 1;
      let stageLabel = 'Waiting for camera device...';
      if (deviceFound) { stage = 2; stageLabel = 'Waiting for camera permission...'; }
      if (deviceFound && permissionGranted) { stage = 3; stageLabel = 'Initializing MediaPipe detector...'; }
      if (prev.hookInitialized) { stage = 4; stageLabel = 'Waiting for detector ready (2s delay)...'; }
      if (prev.cameraAllowed) { stage = 5; stageLabel = 'Frame processor attached — waiting for onResults...'; }
      if (prev.onResultsFired) { stage = 6; stageLabel = 'Pipeline active — detecting poses...'; }
      if (prev.landmarksReceived) { stage = 7; stageLabel = 'Person detected! Tracking landmarks.'; }
      return { ...prev, deviceFound, permissionGranted, stage, stageLabel };
    });
  }, [device, hasPermission]);

  // FPS counter
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFpsTickRef.current) / 1000;
      const fps = elapsed > 0 ? Math.round(frameCountRef.current / elapsed) : 0;
      frameCountRef.current = 0;
      lastFpsTickRef.current = now;
      setDebugState(prev => ({ ...prev, fps, totalFrames: totalFramesRef.current }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // onResults — called by MediaPipe when a frame is processed
  const onResults = useCallback(
    (result: PoseDetectionResultBundle, _vc: ViewCoordinator) => {
      if (!active) return;
      frameCountRef.current++;
      totalFramesRef.current++;

      const hasLandmarks = !!(
        result.results?.[0]?.landmarks?.[0]?.length
      );

      if (!detectorReadyRef.current) {
        detectorReadyRef.current = true;
        setDetectorReady(true);
        setDebugState(prev => ({
          ...prev,
          onResultsFired: true,
          landmarksReceived: hasLandmarks,
          stage: hasLandmarks ? 7 : 6,
          stageLabel: hasLandmarks
            ? 'Person detected! Tracking landmarks.'
            : 'Pipeline active — detecting poses...',
        }));
      } else if (hasLandmarks) {
        setDebugState(prev => ({
          ...prev,
          landmarksReceived: true,
          stage: 7,
          stageLabel: 'Person detected! Tracking landmarks.',
        }));
      }

      const poseResults = result.results;
      if (poseResults && poseResults.length > 0) {
        const firstResult = poseResults[0];
        if (firstResult.landmarks && firstResult.landmarks.length > 0) {
          const landmarks = firstResult.landmarks[0] as MediaPipeLandmark[];
          const detector = getRealPoseDetector();
          detector.onMediaPipePose(
            landmarks,
            result.inputImageWidth,
            result.inputImageHeight,
          );
        }
      }
    },
    [active],
  );

  const onError = useCallback((error: { code: number; message: string }) => {
    console.warn('[MediaPipe Pose] Error:', error.code, error.message);
    setDebugState(prev => ({
      ...prev,
      errorMessage: `Error ${error.code}: ${error.message}`,
    }));
  }, []);

  // MediaPipe Pose hook — CPU delegate, more reliable than GPU
  let poseDetection: ReturnType<typeof usePoseDetection>;
  try {
    poseDetection = usePoseDetection(
      { onResults, onError },
      RunningMode.LIVE_STREAM,
      'pose_landmarker_lite.task',
      {
        delegate: Delegate.CPU,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        shouldOutputSegmentationMasks: false,
        mirrorMode: 'no-mirror',
        fpsMode: 'none',
      },
    );
    // Mark hook as initialized if we get here without throwing
    // (usePoseDetection throws if VisionCameraProxy.initFrameProcessorPlugin returns null)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[MediaPipe] usePoseDetection failed:', msg);
    setDebugState(prev => ({
      ...prev,
      errorMessage: `usePoseDetection init failed: ${msg}`,
      stage: 3,
      stageLabel: `FAILED: ${msg}`,
    }));
    // Return a stub so the component doesn't crash
    return {
      cameraRef,
      device,
      hasPermission,
      cameraReady,
      setCameraReady,
      detectorReady: false,
      cameraAllowed: false,
      frameProcessor: undefined,
      cameraViewLayoutChangeHandler: () => {},
      cameraOrientationChangedHandler: () => {},
      fps: 0,
      debugState: { ...debugState, errorMessage: `usePoseDetection init failed: ${msg}` },
    };
  }

  // Mark hook as initialized
  useEffect(() => {
    setDebugState(prev => ({
      ...prev,
      hookInitialized: true,
      stage: prev.stage < 4 ? 4 : prev.stage,
      stageLabel: prev.stage < 4 ? 'Waiting for detector ready (2s delay)...' : prev.stageLabel,
    }));
  }, []);

  // Notify MediaPipe when camera device changes (sensor orientation)
  useEffect(() => {
    if (device) {
      poseDetection.cameraDeviceChangeHandler(device);
    }
  }, [device, poseDetection.cameraDeviceChangeHandler]);

  // 2-second delay before attaching frameProcessor to avoid ClassCastException
  // when detectorHandle is undefined on the first frames
  const [cameraAllowed, setCameraAllowed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setCameraAllowed(true);
      setDebugState(prev => ({
        ...prev,
        cameraAllowed: true,
        stage: prev.stage < 5 ? 5 : prev.stage,
        stageLabel: prev.stage < 5
          ? 'Frame processor attached — waiting for onResults...'
          : prev.stageLabel,
      }));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return {
    cameraRef,
    device,
    hasPermission,
    cameraReady,
    setCameraReady,
    detectorReady,
    cameraAllowed,
    frameProcessor: poseDetection.frameProcessor,
    cameraViewLayoutChangeHandler: poseDetection.cameraViewLayoutChangeHandler,
    cameraOrientationChangedHandler: poseDetection.cameraOrientationChangedHandler,
    fps: debugState.fps,
    debugState,
  };
}
