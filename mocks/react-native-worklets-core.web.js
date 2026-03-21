// Web mock for react-native-worklets-core
'use strict';
module.exports = {
  useWorklet: () => {},
  createWorklet: (fn) => fn,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
};
