// Discrete slider with 1..max stops (training days per week). Tap or drag.
// Gesture-handler pan works on native and web alike (the legacy PanResponder
// props are dropped on react-native-web).
import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useI18n } from '@/lib/i18n';

type Props = {
  value: number;
  max?: number;
  onChange: (v: number) => void;
  accent: string;
  track: string;
  fill: string;
};

export function DaySlider({ value, max = 7, onChange, accent, track, fill }: Props) {
  const { isRTL } = useI18n();
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const latest = useRef(value);
  latest.current = value;

  const pan = useMemo(() => {
    const pick = (px: number) => {
      const width = wRef.current || 1;
      const p = Math.max(0, Math.min(1, px / width));
      const q = isRTL ? 1 - p : p;
      const v = 1 + Math.round(q * (max - 1));
      if (v !== latest.current) onChange(v);
    };
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => pick(e.x))
      .onUpdate((e) => pick(e.x));
  }, [isRTL, max, onChange]);

  const p = (value - 1) / (max - 1);
  const thumbX = (isRTL ? 1 - p : p) * w;

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width);
          wRef.current = e.nativeEvent.layout.width;
        }}
        style={{ height: 44, justifyContent: 'center', alignSelf: 'stretch' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: track }} />
        {w > 0 && (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                height: 6,
                borderRadius: 3,
                backgroundColor: fill,
                left: isRTL ? thumbX : 0,
                width: isRTL ? w - thumbX : thumbX,
              }}
            />
            {Array.from({ length: max }, (_, i) => {
              const q = i / (max - 1);
              const cx = (isRTL ? 1 - q : q) * w;
              return <View key={i} pointerEvents="none" style={{ position: 'absolute', left: cx - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: i + 1 <= value ? fill : track, opacity: 0.9 }} />;
            })}
            <View pointerEvents="none" style={{ position: 'absolute', left: thumbX - 3, width: 6, height: 28, borderRadius: 3, backgroundColor: accent }} />
          </>
        )}
      </View>
    </GestureDetector>
  );
}
