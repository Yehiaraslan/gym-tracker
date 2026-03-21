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

import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type CameraPosition,
} from 'react-native-vision-camera';
import { usePoseDetection } from 'react-native-mediapipe';
import { getRealPoseDetector, type MediaPipeLandmark } from '@/lib/real-pose-detection';
import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

  // MediaPipe Pose hook — runs on native thread via frame processor plugin
  const poseDetection = usePoseDetection({
    modelPath: 'pose_landmarker_lite.task', // bundled in android/ios assets
    delegate: 'GPU',
    numPoses: 1,
  });

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

  // Frame processor — runs on the native camera thread (worklet)
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!active) return;

      const results = poseDetection.detectOnFrame(frame);
      if (results && results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0] as MediaPipeLandmark[];
        // Bridge back to JS thread
        const detector = getRealPoseDetector();
        detector.onMediaPipePose(landmarks, frame.width, frame.height);
      }

      frameCountRef.current++;
    },
    [active, poseDetection],
  );

  return {
    cameraRef,
    device,
    hasPermission,
    cameraReady,
    setCameraReady,
    frameProcessor,
    fps,
  };
}
