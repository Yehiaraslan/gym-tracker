# AI Form Coach Research Notes

## Technology Stack

### Core Dependencies
- `@tensorflow/tfjs` - Core TensorFlow.js library
- `@tensorflow/tfjs-react-native` - React Native platform adapter
- `@tensorflow-models/pose-detection` - Pose detection models (MoveNet)
- `expo-gl` - WebGL support for GPU acceleration
- `expo-camera` - Camera access

### Model Choice
- **MoveNet.SinglePose.Lightning** - Fastest model, suitable for real-time on mobile
- Returns 17 keypoints per person
- Keypoints: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles

## Implementation Approach

### Performance Considerations
1. **Throttle inference** - Don't run on every frame (target 5-10 FPS for inference)
2. **Use Lightning model** - Fastest variant of MoveNet
3. **Single pose detection** - Don't need multi-pose
4. **Lower resolution input** - 192x192 or 256x256 for faster inference

### Exercise Detection Logic

#### Push-up Detection
- Track: shoulders, elbows, wrists, hips
- Rep counting: Detect up/down cycle based on elbow angle
- Down position: Elbow angle < 90 degrees
- Up position: Elbow angle > 160 degrees (near straight)
- Form flags:
  - Partial ROM: Elbow doesn't reach < 90° at bottom
  - No lockout: Elbow doesn't reach > 160° at top
  - Hip sag: Hip Y position significantly lower than shoulder-ankle line

#### Pull-up Detection
- Track: shoulders, elbows, wrists, chin (nose as proxy)
- Rep counting: Detect up/down cycle based on chin position relative to hands
- Up position: Nose Y position above wrist Y position
- Down position: Arms nearly straight (elbow angle > 160°)
- Form flags:
  - Partial ROM: Chin doesn't clear bar level
  - No lockout: Arms not fully extended at bottom
  - Kipping: Excessive hip movement

### Keypoint Indices (MoveNet)
```
0: nose
1: left_eye
2: right_eye
3: left_ear
4: right_ear
5: left_shoulder
6: right_shoulder
7: left_elbow
8: right_elbow
9: left_wrist
10: right_wrist
11: left_hip
12: right_hip
13: left_knee
14: right_knee
15: left_ankle
16: right_ankle
```

### Form Score Calculation
- Base score: 100
- Deductions:
  - Partial ROM: -20 per occurrence
  - No lockout: -15 per occurrence
  - Hip sag/kipping: -10 per occurrence
- Minimum score: 0

## Known Limitations
- FPS may be low (3-10 FPS) on older devices
- Requires good lighting
- Camera must be stable
- Works best with side view for push-ups, front view for pull-ups
- Expo managed workflow may have limitations

## Alternative Approach
If TensorFlow.js performance is too poor, consider:
1. Using MediaPipe via custom dev client
2. Simpler motion detection without full pose estimation
3. Recording video and processing frames at lower rate
