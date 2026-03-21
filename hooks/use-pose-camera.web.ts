// Web stub — VisionCamera + MediaPipe are native-only
// Metro uses this file on web instead of use-pose-camera.ts
export function usePoseCamera() {
  return {
    cameraRef: { current: null },
    device: null,
    hasPermission: false,
    cameraReady: false,
    setCameraReady: (_: boolean) => {},
    frameProcessor: undefined,
    cameraViewLayoutChangeHandler: () => {},
    cameraOrientationChangedHandler: () => {},
    fps: 0,
  };
}
