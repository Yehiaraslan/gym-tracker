// Custom entry point — registers the Android widget task handler
// before booting the Expo Router app.
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);

// Boot the normal Expo Router app
import 'expo-router/entry';
