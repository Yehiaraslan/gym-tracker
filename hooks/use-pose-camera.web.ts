// Web stub — VisionCamera is native-only
// Metro uses this file on web instead of use-pose-camera.ts
export function usePoseCamera() {
  return {
    device: null,
    hasPermission: false,
    requestPermission: async () => false,
    isActive: false,
    frameProcessor: undefined,
    toggleCamera: () => {},
    cameraPosition: 'front' as const,
  };
}
