module.exports = function (api) {
  api.cache(true);

  // react-native-worklets-core/plugin was removed with the VisionCamera/MediaPipe
  // pose stack (2026-06-13). Reanimated 4 worklets are handled automatically by
  // babel-preset-expo (react-native-worklets/plugin).
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [],
  };
};
