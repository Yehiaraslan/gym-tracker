// Selectable card — list row (icon + label + desc) or square tile.
import React from 'react';
import { Platform, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/lib/i18n';

type Colors = { fg: string; muted: string; accent: string; surface: string; border: string };

type Props = {
  label: string;
  desc?: string;
  icon?: React.ReactNode;
  /** small pill rendered before the label (e.g. "LEVEL 1") */
  badge?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  variant?: 'row' | 'tile';
  colors: Colors;
  style?: ViewStyle;
  trailing?: React.ReactNode;
};

export function OptionCard({ label, desc, icon, badge, selected, onPress, variant = 'row', colors, style, trailing }: Props) {
  const { isRTL } = useI18n();
  const press = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  const frame = {
    backgroundColor: selected ? colors.accent + '14' : colors.surface,
    borderColor: selected ? colors.accent : colors.border,
    borderWidth: selected ? 2 : 1,
  };

  if (variant === 'tile') {
    return (
      <TouchableOpacity onPress={press} activeOpacity={0.75} style={[{ borderRadius: 18, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 10 }, frame, style]}>
        {icon}
        <Text style={{ color: selected ? colors.accent : colors.fg, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
        {desc ? <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{desc}</Text> : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={0.75}
      style={[
        { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
        frame,
        style,
      ]}
    >
      {badge}
      {icon ? <View style={{ width: 44, alignItems: 'center' }}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.fg, fontSize: 16, fontWeight: '700', textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>{label}</Text>
        {desc ? (
          <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 17, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>{desc}</Text>
        ) : null}
      </View>
      {trailing}
    </TouchableOpacity>
  );
}
