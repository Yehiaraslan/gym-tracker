// Web mock for react-native-mediapipe
'use strict';
module.exports = {
  usePoseDetection: () => ({
    frameProcessor: undefined,
    cameraViewLayoutChangeHandler: () => {},
    cameraDeviceChangeHandler: () => {},
    cameraOrientationChangedHandler: () => {},
    resizeModeChangeHandler: () => {},
    cameraViewDimensions: { width: 1, height: 1 },
  }),
  RunningMode: { LIVE_STREAM: 'LIVE_STREAM', IMAGE: 'IMAGE', VIDEO: 'VIDEO' },
  Delegate: { GPU: 'GPU', CPU: 'CPU' },
  PoseLandmarker: {},
  NormalizedLandmark: {},
};
