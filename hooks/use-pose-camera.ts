/**
 * usePoseCamera — VisionCamera + MediaPipe Pose Landmarker hook
 *
 * Wiring based on the official MediapipeCamera reference component:
 * - cameraDeviceChangeHandler called via useEffect on device change
 * - cameraViewLayoutChangeHandler passed as onLayout to Camera
 * - cameraOrientationChangedHandler passed as onOutputOrientationChanged
 * - outputOrientation="preview" required for correct landmark mapping
 * - pixelFormat="rgb" required by MediaPipe (not "yuv")
 * - onResults accepts (result, viewCoordinator) — both args required
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
// ViewCoordinator is exported from react-native-mediapipe shared/types via index
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

  // onResults — accepts (result, viewCoordinator) per DetectionCallbacks interface
  const onResults = useCallback(
    (result: PoseDetectionResultBundle, _vc: ViewCoordinator) => {
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

  // MediaPipe Pose hook
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

  // CRITICAL: notify MediaPipe when the camera device changes so it can
  // update the BaseViewCoordinator with the correct sensor orientation.
  useEffect(() => {
    if (device) {
      poseDetection.cameraDeviceChangeHandler(device);
    }
  }, [device, poseDetection.cameraDeviceChangeHandler]);

  return {
    cameraRef,
    device,
    hasPermission,
    cameraReady,
    setCameraReady,
    frameProcessor: poseDetection.frameProcessor,
    // Pass these to the Camera component:
    // onLayout={cameraViewLayoutChangeHandler}
    // onOutputOrientationChanged={cameraOrientationChangedHandler}
    cameraViewLayoutChangeHandler: poseDetection.cameraViewLayoutChangeHandler,
    cameraOrientationChangedHandler: poseDetection.cameraOrientationChangedHandler,
    fps,
  };
}
