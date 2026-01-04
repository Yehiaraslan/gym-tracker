// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "clock.fill": "history",
  "gearshape.fill": "settings",
  "plus": "add",
  "trash.fill": "delete",
  "pencil": "edit",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "timer": "timer",
  "video.fill": "videocam",
  "dumbbell.fill": "fitness-center",
  "calendar": "calendar-today",
  "arrow.left": "arrow-back",
  "trophy.fill": "emoji-events",
  "chart.line.uptrend.xyaxis": "trending-up",
  "info.circle.fill": "info",
  "xmark": "close",
  "stop.fill": "stop",
  "camera.fill": "camera-alt",
  "exclamationmark.triangle.fill": "warning",
  "chevron.left": "chevron-left",
  "camera.rotate.fill": "flip-camera-ios",
  "figure.stand": "accessibility",
  "speaker.wave.2.fill": "volume-up",
  "speaker.slash.fill": "volume-off",
  "star": "star-outline",
  "star.fill": "star",
  "square.and.arrow.up": "share",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
