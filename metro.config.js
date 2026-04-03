const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Alias native-only packages to web mocks so the web preview doesn't crash
const webMocks = {
  'react-native-vision-camera': path.resolve(__dirname, 'mocks/react-native-vision-camera.web.js'),
  'react-native-worklets-core': path.resolve(__dirname, 'mocks/react-native-worklets-core.web.js'),
  'react-native-mediapipe': path.resolve(__dirname, 'mocks/react-native-mediapipe.web.js'),
  'react-native-android-widget': path.resolve(__dirname, 'mocks/react-native-android-widget.web.js'),
};

// Widget files that should be stubbed on web
const webWidgetMocks = {
  [path.resolve(__dirname, 'widgets/widget-task-handler.tsx')]: path.resolve(__dirname, 'mocks/widget-task-handler.web.js'),
  [path.resolve(__dirname, 'widgets/gym-stats-widget.tsx')]: path.resolve(__dirname, 'mocks/react-native-android-widget.web.js'),
};

const originalResolver = config.resolver || {};
config.resolver = {
  ...originalResolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web' && webMocks[moduleName]) {
      return { filePath: webMocks[moduleName], type: 'sourceFile' };
    }
    // Stub widget files on web — Metro resolves require() statically so we must
    // intercept these paths here regardless of Platform.OS runtime guards.
    if (platform === 'web') {
      const resolved = moduleName.startsWith('.')
        ? path.resolve(path.dirname(context.originModulePath), moduleName)
        : null;
      if (resolved && (resolved.endsWith('widget-task-handler') || resolved.endsWith('widget-task-handler.tsx') || resolved.endsWith('widget-task-handler.ts'))) {
        return { filePath: path.resolve(__dirname, 'mocks/widget-task-handler.web.js'), type: 'sourceFile' };
      }
      if (resolved && (resolved.endsWith('gym-stats-widget') || resolved.endsWith('gym-stats-widget.tsx'))) {
        return { filePath: path.resolve(__dirname, 'mocks/react-native-android-widget.web.js'), type: 'sourceFile' };
      }
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
