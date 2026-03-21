# Pose Detection Migration: TensorFlow.js → MediaPipe (VisionCamera)

## Why

| | TF.js + expo-camera (old) | VisionCamera + MediaPipe (new) |
|---|---|---|
| **FPS** | 3-8 FPS (JS thread bottleneck) | 15-30 FPS (native C++ thread) |
| **Keypoints** | 17 (MoveNet) | 33 (MediaPipe) — mapped to 17 |
| **Processing** | JS bridge overhead per frame | Zero JS bridge during inference |
| **Accuracy** | MoveNet Lightning (speed-optimized) | MediaPipe Pose Landmarker (balanced) |
| **3D** | 2D only | (x, y, z) with depth estimates |
| **Requires** | expo-gl, TF.js React Native bindings | VisionCamera frame processors |

## What Changed

### Files Modified
- `lib/real-pose-detection.ts` — Added `onMediaPipePose()` method that receives MediaPipe landmarks and converts to internal Pose format. All existing public APIs unchanged.
- `app/form-coach-tracking.tsx` — Swapped `CameraView` (expo-camera) → `VisionCamera` (react-native-vision-camera). Uses new `usePoseCamera` hook.
- `app.config.ts` — Added VisionCamera plugin + camera permission.
- `package.json` — Removed TF.js deps, added VisionCamera + MediaPipe deps.

### Files Added
- `hooks/use-pose-camera.ts` — Hook that wires VisionCamera frame processor to MediaPipe pose detection and feeds results into `RealPoseDetector`.
- `docs/mediapipe-migration.md` — This file.

### Files NOT Changed (fully reused)
- `lib/pose-detection.ts` — All exercise trackers (PushupTracker, SquatTracker, etc.)
- `lib/pose-service.ts` — Smoothing/confidence service
- `lib/pose-calibration.ts` — Calibration logic
- `lib/progressive-calibration.ts` — Progressive joint detection
- `lib/ai-coach.ts` — AI coaching logic
- `lib/audio-feedback.ts` — Audio feedback
- `lib/joint-loss-alert.ts` — Joint loss alerts
- `app/form-coach.tsx` — Exercise picker screen
- All overlay components (skeleton, calibration, form guide, etc.)

## Dependencies Changed

### Removed
- `@tensorflow/tfjs` ^4.22.0
- `@tensorflow/tfjs-react-native` ^1.0.0
- `@tensorflow-models/pose-detection` ^2.1.3
- `expo-gl` ^16.0.9

### Added
- `react-native-vision-camera` ^4.6.3
- `react-native-mediapipe` ^0.5.0
- `react-native-worklets-core` ^1.5.0

## Setup After Merge

```bash
# Install new deps
npm install

# Download MediaPipe model (place in android/app/src/main/assets/)
# The model file: pose_landmarker_lite.task
# Download from: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task

# Create Expo development build (required — won't work in Expo Go)
npx expo prebuild --clean
npx expo run:android   # or run:ios
```

## MediaPipe Landmark Mapping

MediaPipe returns 33 landmarks. We map 17 to MoveNet format:

| MediaPipe Index | MoveNet Index | Joint |
|---|---|---|
| 0 | 0 | Nose |
| 2 | 1 | Left Eye |
| 5 | 2 | Right Eye |
| 7 | 3 | Left Ear |
| 8 | 4 | Right Ear |
| 11 | 5 | Left Shoulder |
| 12 | 6 | Right Shoulder |
| 13 | 7 | Left Elbow |
| 14 | 8 | Right Elbow |
| 15 | 9 | Left Wrist |
| 16 | 10 | Right Wrist |
| 23 | 11 | Left Hip |
| 24 | 12 | Right Hip |
| 25 | 13 | Left Knee |
| 26 | 14 | Right Knee |
| 27 | 15 | Left Ankle |
| 28 | 16 | Right Ankle |

Extra MediaPipe landmarks (fingers, feet, face mesh) available for future use.
