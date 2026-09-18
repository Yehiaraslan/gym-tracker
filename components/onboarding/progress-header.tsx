// Thin progress bar + logo/wordmark + forward arrow (matches the reference header).
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/lib/i18n';

type Props = {
  step: number;
  total: number;
  accent: string;
  track: string;
  fg: string;
  onForward?: () => void;
  forwardDisabled?: boolean;
};

export function ProgressHeader({ step, total, accent, track, fg, onForward, forwardDisabled }: Props) {
  const { isRTL, t } = useI18n();
  const pct = Math.max(0.04, Math.min(1, (step + 1) / total));
  return (
    <View style={{ paddingTop: 6, paddingBottom: 4 }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: track, overflow: 'hidden', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <View style={{ width: `${pct * 100}%`, backgroundColor: accent, borderRadius: 2 }} />
      </View>
      <View style={{ height: 44, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
        <View style={{ width: 44 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Image source={require('@/assets/images/logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
          <Text style={{ color: fg, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 }}>
            <Text style={{ color: accent }}>MY</Text> Lifestyle
          </Text>
        </View>
        <TouchableOpacity
          onPress={onForward}
          disabled={!onForward || forwardDisabled}
          hitSlop={10}
          accessibilityLabel={t('continue')}
          style={{ width: 44, alignItems: 'center', opacity: !onForward || forwardDisabled ? 0.25 : 1 }}
        >
          <Text style={{ color: fg, fontSize: 26, fontWeight: '300' }}>{isRTL ? '←' : '→'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
