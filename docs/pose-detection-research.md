# Pose Detection Research for Expo React Native

## Research Date: January 2026

## Overview

This document summarizes research on implementing real-time pose detection in Expo React Native for the gym workout tracker app.

## Options Evaluated

### 1. TensorFlow.js with MoveNet (Recommended for Expo Managed)

**Packages:**
- `@tensorflow/tfjs` - Core TensorFlow.js
- `@tensorflow/tfjs-react-native` - React Native adapter
- `@tensorflow-models/pose-detection` - Pose detection models
- `expo-gl` - WebGL support for GPU acceleration

**Pros:**
- Works with Expo managed workflow
- MoveNet Lightning is fast (designed for mobile)
- Well-documented by TensorFlow team
- Detects 17 keypoints (nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles)

**Cons:**
- Performance varies (3-12 FPS reported)
- Requires `expo-gl` for GPU acceleration
- Some compatibility issues with newer React Native versions
- TensorCamera component needed for real-time processing

**Key Implementation Notes:**
- Use `MoveNet.SinglePose.Lightning` for best mobile performance
- TensorCamera provides tensor output directly from camera frames
- Must call `tf.ready()` before using models
- Dispose tensors after use to prevent memory leaks

### 2. react-native-mediapipe (Requires Custom Dev Client)

**Packages:**
- `react-native-mediapipe`
- `react-native-vision-camera`
- `react-native-worklets-core`

**Pros:**
- Native MediaPipe integration (faster)
- Better performance than JS-based solutions
- Supports object detection, hand tracking, pose

**Cons:**
- Requires Expo custom dev client (not managed workflow)
- More complex setup
- Requires babel plugin for worklets

### 3. @gymbrosinc/react-native-mediapipe-pose (Testing Only)

**Status:** Testing package - NOT recommended for production
- Marked as potentially deprecated
- Contact owner required for production use
- iOS only currently

### 4. PoseTracker API (Cloud-based)

**Pros:**
- No ML packages needed
- Works with any framework

**Cons:**
- Requires internet connection
- Latency for real-time use
- Subscription/API costs

## Recommended Approach

For our Expo managed workflow app, use **TensorFlow.js with MoveNet**:

1. Install required packages:
```bash
npx expo install @tensorflow/tfjs @tensorflow/tfjs-react-native expo-gl
npm install @tensorflow-models/pose-detection
```

2. Key components:
- `TensorCamera` from `@tensorflow/tfjs-react-native` for camera tensor output
- `movenet.load()` to load the MoveNet model
- Custom frame processor for pose detection

3. Performance optimization:
- Throttle inference to 8-12 FPS
- Use Lightning model (faster than Thunder)
- Dispose tensors properly
- Use WebGL backend for GPU acceleration

## MoveNet Keypoints (17 total)

| Index | Name |
|-------|------|
| 0 | nose |
| 1 | left_eye |
| 2 | right_eye |
| 3 | left_ear |
| 4 | right_ear |
| 5 | left_shoulder |
| 6 | right_shoulder |
| 7 | left_elbow |
| 8 | right_elbow |
| 9 | left_wrist |
| 10 | right_wrist |
| 11 | left_hip |
| 12 | right_hip |
| 13 | left_knee |
| 14 | right_knee |
| 15 | left_ankle |
| 16 | right_ankle |

## Implementation Architecture

```
Camera Preview
    ↓
TensorCamera (produces tensors)
    ↓
Pose Model (MoveNet Lightning)
    ↓
Raw Keypoints
    ↓
Keypoint Smoothing (temporal filter)
    ↓
Confidence Tracking
    ↓
Calibration Phase (if not calibrated)
    ↓
Tracking Phase (if calibrated & confidence good)
    ↓
Rep Counting + Form Analysis
    ↓
Feedback + Summary
```

## Confidence Gating Strategy

1. **Per-keypoint confidence**: Each keypoint has a score (0-1)
2. **Overall pose confidence**: Average of required keypoints
3. **Smoothed confidence**: Exponential moving average over frames
4. **Thresholds**:
   - Good: >= 0.6 (tracking active)
   - Weak: 0.3-0.6 (show warning)
   - Lost: < 0.3 (pause tracking)

## References

- TensorFlow.js React Native Tutorial: https://www.tensorflow.org/js/tutorials/applications/react_native
- MoveNet Documentation: https://www.tensorflow.org/hub/tutorials/movenet
- Pose Detection Models: https://github.com/tensorflow/tfjs-models/tree/master/pose-detection
