/**
 * usePoseCamera — VisionCamera + MediaPipe Pose Landmarker hook
 *
 * Root cause of "no detection": the mediapipe Kotlin plugin does
 *   val detectorHandle: Double = params!!["detectorHandle"] as Double
 * When detectorHandle is undefined (before createDetector() resolves),
 * this throws a ClassCastException → frame processor silently stops.
 *
 * Fix: expose `detectorReady` flag. Caller should only mount <Camera> with
 * frameProcessor once detectorReady === true.
 *
 * Also: Delegate.CPU instead of GPU — GPU delegate fails silently on many
 * Android devices (driver issues, init timeout).
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
  /** 'front' | 'back' */
  position?: CameraPosition;
  /** Enable/disable processing (pause when not tracking) */
  active?: boolean;
}

export function usePoseCamera(opts: UsePoseCameraOptions = {}) {
  const { position = 'back', active = true } = opts;
  const cameraRef = useRef<Camera>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [fps, setFps] = useState(0);

  // detectorReady: true once createDetector() has resolved AND at least one
  // frame has been processed successfully. Until then, the Camera should not
  // pass frames to the mediapipe frame processor (avoids Kotlin ClassCastException).
  const [detectorReady, setDetectorReady] = useState(false);
  const detectorReadyRef = useRef(false);

  // VisionCamera device + permission
  const device = useCameraDevice(position);
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // FPS counter
  const frameCountRef = useRef(0);
  const lastFpsTickRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFpsTickRef.current) / 1000;
      if (elapsed > 0) setFps(Math.round(frameCountRef.current / elapsed));
      frameCountRef.current = 0;
      lastFpsTickRef.current = now;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // onResults — called by MediaPipe when a pose is detected.
  // First call confirms the detector is fully initialized.
  const onResults = useCallback(
    (result: PoseDetectionResultBundle, _vc: ViewCoordinator) => {
      if (!active) return;
      frameCountRef.current++;

      // Mark detector as ready on first successful result
      if (!detectorReadyRef.current) {
        detectorReadyRef.current = true;
        setDetectorReady(true);
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
  }, []);

  // MediaPipe Pose hook — CPU delegate is more reliable than GPU across Android devices.
  // GPU can fail silently on many devices (init timeout, driver issues).
  const poseDetection = usePoseDetection(
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

  // CRITICAL: notify MediaPipe when the camera device changes so it can
  // update the BaseViewCoordinator with the correct sensor orientation.
  useEffect(() => {
    if (device) {
      poseDetection.cameraDeviceChangeHandler(device);
    }
  }, [device, poseDetection.cameraDeviceChangeHandler]);

  // Delay: give createDetector() time to resolve before mounting the camera
  // with a frame processor. This prevents the Kotlin ClassCastException from
  // detectorHandle being undefined on the first frames.
  // The mediapipe library logs "usePoseDetection.createDetector <handle>" when ready.
  const [cameraAllowed, setCameraAllowed] = useState(false);
  useEffect(() => {
    // 2 second delay — createDetector() typically resolves in 500ms-1500ms
    const timer = setTimeout(() => setCameraAllowed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return {
    cameraRef,
    device,
    hasPermission,
    cameraReady,
    setCameraReady,
    detectorReady,
    // cameraAllowed: only mount Camera with frameProcessor after this is true
    cameraAllowed,
    frameProcessor: poseDetection.frameProcessor,
    // Pass these to the Camera component:
    // onLayout={cameraViewLayoutChangeHandler}
    // onOutputOrientationChanged={cameraOrientationChangedHandler}
    cameraViewLayoutChangeHandler: poseDetection.cameraViewLayoutChangeHandler,
    cameraOrientationChangedHandler: poseDetection.cameraOrientationChangedHandler,
    fps,
  };
}
