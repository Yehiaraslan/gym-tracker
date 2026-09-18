// Five-band BMI bar with a marker at the user's value.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useI18n, localizeDigits } from '@/lib/i18n';

const LO = 12;
const HI = 42;
const BANDS: { from: number; to: number; color: string; key: 'bmi_under' | 'bmi_normal' | 'bmi_over' | 'bmi_obese' | 'bmi_severe' }[] = [
  { from: LO, to: 18.5, color: '#3B82F6', key: 'bmi_under' },
  { from: 18.5, to: 25, color: '#22C55E', key: 'bmi_normal' },
  { from: 25, to: 30, color: '#F59E0B', key: 'bmi_over' },
  { from: 30, to: 35, color: '#EF4444', key: 'bmi_obese' },
  { from: 35, to: HI, color: '#991B1B', key: 'bmi_severe' },
];

export function bmiCategory(bmi: number) {
  return (BANDS.find((b) => bmi < b.to) ?? BANDS[BANDS.length - 1]).key;
}

type Props = { bmi: number; fg: string; muted: string };

export function BmiGauge({ bmi, fg, muted }: Props) {
  const { t, isRTL, lang } = useI18n();
  const [w, setW] = useState(0);
  const H = 8;
  const x = (v: number) => {
    const p = (Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO);
    return (isRTL ? 1 - p : p) * w;
  };

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }}>
      {/* boundary numbers */}
      <View style={{ height: 18 }}>
        {w > 0 &&
          [18.5, 25, 30, 35].map((b) => (
            <Text key={b} style={{ position: 'absolute', left: x(b) - 20, width: 40, textAlign: 'center', color: fg, fontSize: 12 }}>
              {localizeDigits(b, lang)}
            </Text>
          ))}
      </View>
      {w > 0 && (
        <Svg width={w} height={H + 10}>
          {BANDS.map((b) => {
            const x1 = x(b.from);
            const x2 = x(b.to);
            return <Rect key={b.key} x={Math.min(x1, x2)} y={5} width={Math.abs(x2 - x1)} height={H} fill={b.color} />;
          })}
          <Circle cx={x(bmi)} cy={5 + H / 2} r={6} fill="#fff" stroke="#F59E0B" strokeWidth={3} />
        </Svg>
      )}
      {/* band names */}
      <View style={{ height: 18, marginTop: 2 }}>
        {w > 0 &&
          BANDS.map((b) => {
            const cx = (x(b.from) + x(b.to)) / 2;
            // keep the label box inside the gauge so edge bands don't clip
            const left = Math.max(0, Math.min(w - 72, cx - 36));
            return (
              <Text key={b.key} numberOfLines={1} style={{ position: 'absolute', left, width: 72, textAlign: 'center', color: muted, fontSize: 10.5 }}>
                {t(b.key)}
              </Text>
            );
          })}
      </View>
    </View>
  );
}
