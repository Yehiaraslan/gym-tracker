/**
 * usePoseCamera — VisionCamera + MediaPipe Pose Landmarker hook
 *
 * Provides a Camera ref and a frame processor that feeds MediaPipe landmarks
 * into the RealPoseDetector singleton. The rest of the tracking pipeline
 * (progressive calibration, exercise trackers, overlays) reads from the
 * detector as before — zero API changes.
 *
 * Requirements (install once):
 *   npx expo install react-native-vision-camera
 *   npm install react-native-mediapipe
 *
 * You also need an Expo development build (not Expo Go).
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

  // Callback-based pose detection results handler
  const onResults = useCallback(
    (result: PoseDetectionResultBundle) => {
      if (!active) return;
      frameCountRef.current++;

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
    console.warn('[MediaPipe Pose] Error:', error.message);
  }, []);

  // MediaPipe Pose hook — callback-based API
  // usePoseDetection(callbacks, runningMode, model, options?)
  const poseDetection = usePoseDetection(
    { onResults, onError },
    RunningMode.LIVE_STREAM,
    'pose_landmarker_lite.task',
    {
      delegate: Delegate.GPU,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      shouldOutputSegmentationMasks: false,
      mirrorMode: 'no-mirror',
      fpsMode: 'none',
    },
  );

  return {
    cameraRef,
    device,
    hasPermission,
    cameraReady,
    setCameraReady,
    frameProcessor: poseDetection.frameProcessor,
    cameraViewLayoutChangeHandler: poseDetection.cameraViewLayoutChangeHandler,
    cameraDeviceChangeHandler: poseDetection.cameraDeviceChangeHandler,
    cameraOrientationChangedHandler: poseDetection.cameraOrientationChangedHandler,
    fps,
  };
}
