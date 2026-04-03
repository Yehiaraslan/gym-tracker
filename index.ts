// Custom entry point — registers the Android widget task handler
// before booting the Expo Router app (native only).
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Dynamic require so Metro doesn't bundle this on web/iOS
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { widgetTaskHandler } = require('./widgets/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

// Boot the normal Expo Router app
import 'expo-router/entry';
