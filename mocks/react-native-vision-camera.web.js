// Web mock for react-native-vision-camera
// VisionCamera is a native-only package — this stub prevents the web bundle from crashing
'use strict';

const Camera = function() { return null; };
Camera.getAvailableCameraDevices = () => [];
Camera.requestCameraPermission = async () => 'denied';
Camera.getCameraPermissionStatus = () => 'not-determined';

module.exports = {
  Camera,
  useCameraDevice: () => null,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: async () => false }),
  useFrameProcessor: () => undefined,
  createRunInJsFn: (fn) => fn,
  runAtTargetFps: () => {},
  VisionCameraProxy: { initFrameProcessorPlugin: () => ({}) },
};
