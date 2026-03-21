module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  // react-native-worklets-core/plugin is required by VisionCamera v4 and MediaPipe
  // to compile "worklet" directives in frame processors.
  // DO NOT use "react-native-worklets/plugin" — that is a different unrelated package.
  plugins.push("react-native-worklets-core/plugin");

  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins,
  };
};
