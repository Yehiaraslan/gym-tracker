/**
 * Custom Expo config plugin to ensure react-native-worklets-core is properly
 * linked as a Gradle project in settings.gradle.
 *
 * WHY THIS IS NEEDED:
 * react-native-vision-camera's build.gradle checks:
 *   def hasWorklets = findProject(":react-native-worklets-core") != null
 *   if (!hasWorklets) { enableFrameProcessors = false }
 *
 * If worklets-core is not registered as a Gradle subproject, frame processors
 * are disabled at compile time and Frames: 0 / FPS: 0 on device.
 *
 * This plugin adds the include + projectDir lines to settings.gradle so
 * findProject(":react-native-worklets-core") returns non-null.
 */
const { withSettingsGradle, withGradleProperties } = require('@expo/config-plugins');
const path = require('path');

const withWorkletsCore = (config) => {
  // Step 1: Add worklets-core to settings.gradle as a Gradle project
  config = withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;

    const includeStatement = `include ':react-native-worklets-core'`;
    const projectDirStatement = `project(':react-native-worklets-core').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-worklets-core/android')`;

    // Only add if not already present
    if (!contents.includes(includeStatement)) {
      config.modResults.contents = contents + `\n${includeStatement}\n${projectDirStatement}\n`;
    }

    return config;
  });

  // Step 2: Also set VisionCamera_enableFrameProcessors=true in gradle.properties
  // as a belt-and-suspenders approach
  config = withGradleProperties(config, (config) => {
    const key = 'VisionCamera_enableFrameProcessors';
    // Remove existing entry if present
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === key)
    );
    // Add with value true
    config.modResults.push({
      type: 'property',
      key,
      value: 'true',
    });
    return config;
  });

  return config;
};

module.exports = withWorkletsCore;
