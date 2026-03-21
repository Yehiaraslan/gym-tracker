// Web stub — VisionCamera + MediaPipe are native-only
// Metro uses this file on web instead of use-pose-camera.ts
export function usePoseCamera() {
  return {
    cameraRef: { current: null },
    device: null,
    hasPermission: false,
    cameraReady: false,
    setCameraReady: (_: boolean) => {},
    detectorReady: false,
    cameraAllowed: false,
    frameProcessor: undefined,
    cameraViewLayoutChangeHandler: () => {},
    cameraOrientationChangedHandler: () => {},
    fps: 0,
    debugState: {
      stage: 0,
      stageLabel: 'Web — native only',
      deviceFound: false,
      permissionGranted: false,
      hookInitialized: false,
      cameraAllowed: false,
      onResultsFired: false,
      landmarksReceived: false,
      errorMessage: 'Web platform — VisionCamera not available',
      totalFrames: 0,
      fps: 0,
    },
  };
}
