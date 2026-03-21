const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Alias native-only packages to web mocks so the web preview doesn't crash
const webMocks = {
  'react-native-vision-camera': path.resolve(__dirname, 'mocks/react-native-vision-camera.web.js'),
  'react-native-worklets-core': path.resolve(__dirname, 'mocks/react-native-worklets-core.web.js'),
  'react-native-mediapipe': path.resolve(__dirname, 'mocks/react-native-mediapipe.web.js'),
};

const originalResolver = config.resolver || {};
config.resolver = {
  ...originalResolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web' && webMocks[moduleName]) {
      return { filePath: webMocks[moduleName], type: 'sourceFile' };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
