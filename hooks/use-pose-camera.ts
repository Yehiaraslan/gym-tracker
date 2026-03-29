/**
 * usePoseCamera — VisionCamera + MediaPipe Pose Landmarker hook
 *
 * Provides a Camera ref and a frame processor that feeds MediaPipe landmarks
 * into the RealPoseDetector singleton. The rest of the tracking pipeline
 * (progressive calibration, exercise trackers, overlays) reads from the
 * detector as before — zero API changes.
 *
 * Pipeline:
 *   VisionCamera → MediaPipe Pose Landmarker (native C++ thread, 15-30 FPS)
 *   → onResults callback → RealPoseDetector.onMediaPipePose()
 *   → detectPoseFromFrame() → exercise trackers
 */

import { useRef, useCallback, useEffect, useState } from 'react';
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

  // onResults — called by MediaPipe when a frame is processed
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
    console.warn('[MediaPipe Pose] Error:', error.code, error.message);
  }, []);

  // MediaPipe Pose hook — CPU delegate for maximum compatibility
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[MediaPipe] usePoseDetection failed:', msg);
    // Return a stub so the component doesn't crash on web / simulator
    return {
      cameraRef,
      device,
      hasPermission,
      cameraReady,
      setCameraReady,
      frameProcessor: undefined,
      cameraViewLayoutChangeHandler: () => {},
      cameraOrientationChangedHandler: () => {},
      fps: 0,
    };
  }

  // Notify MediaPipe when camera device changes (sensor orientation)
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
    cameraViewLayoutChangeHandler: poseDetection.cameraViewLayoutChangeHandler,
    cameraOrientationChangedHandler: poseDetection.cameraOrientationChangedHandler,
    fps,
  };
}
