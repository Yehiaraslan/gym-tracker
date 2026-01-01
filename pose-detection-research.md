# Real Pose Detection Implementation Research

## How Kinect Worked
- Used depth sensors (infrared) combined with RGB camera
- Machine learning algorithm: "Real-Time Human Pose Recognition in Parts from Single Depth Image"
- Predicted 3D positions of body joints from depth images
- Ran at 200 FPS on Xbox 360 hardware
- Key innovation: treated pose estimation as per-pixel classification problem

## Modern Mobile Alternative: TensorFlow.js + MoveNet

### Key Components from TensorFlow.js Example:
1. **TensorCamera** - `cameraWithTensors(Camera)` wraps expo-camera to output tensors
2. **MoveNet Model** - `posedetection.SupportedModels.MoveNet` with SINGLEPOSE_LIGHTNING
3. **Real-time loop** - Uses `requestAnimationFrame` for continuous inference
4. **Tensor disposal** - Must call `tf.dispose([imageTensor])` to prevent memory leaks

### Implementation Pattern:
```typescript
import * as tf from '@tensorflow/tfjs';
import * as posedetection from '@tensorflow-models/pose-detection';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';

// Create TensorCamera
const TensorCamera = cameraWithTensors(Camera);

// Load model
const model = await posedetection.createDetector(
  posedetection.SupportedModels.MoveNet,
  { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true }
);

// Handle camera stream
const handleCameraStream = async (images, updatePreview, gl) => {
  const loop = async () => {
    const imageTensor = images.next().value;
    const poses = await model.estimatePoses(imageTensor);
    tf.dispose([imageTensor]);
    // Update UI with poses
    requestAnimationFrame(loop);
  };
  loop();
};
```

### Key Settings:
- OUTPUT_TENSOR_WIDTH: 180 (smaller = faster)
- MIN_KEYPOINT_SCORE: 0.3 (threshold for valid keypoints)
- AUTO_RENDER: false (manual rendering for better control)

### Required Packages:
- @tensorflow/tfjs
- @tensorflow-models/pose-detection
- @tensorflow/tfjs-react-native
- expo-gl
- react-native-svg (for drawing keypoints)
