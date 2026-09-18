// Scrollable tape-measure picker (vertical for height, horizontal for weight).
// The value under the fixed center marker is the selection.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

const TICK = 12; // px between consecutive ticks

type Props = {
  orientation: 'vertical' | 'horizontal';
  min: number;
  max: number;
  step: number;
  /** label every N units */
  majorEvery: number;
  value: number;
  onChange: (v: number) => void;
  /** cross-axis size (width for vertical, height for horizontal) */
  thickness?: number;
  /** main-axis size */
  length: number;
  accent: string;
  tick: string;
  label: string;
  formatLabel?: (v: number) => string;
  /** vertical only — put labels/ticks on the left edge (true) or right edge */
  leftEdge?: boolean;
};

export function RulerPicker({
  orientation, min, max, step, majorEvery, value, onChange, thickness = 72, length, accent, tick, label, formatLabel, leftEdge = true,
}: Props) {
  const vertical = orientation === 'vertical';
  const count = Math.round((max - min) / step) + 1;
  const ref = useRef<ScrollView>(null);
  const [ready, setReady] = useState(false);
  const lastIdx = useRef(-1);

  // index 0 sits at the max for vertical rulers (bigger numbers up), at min for horizontal
  const indexToValue = useCallback((i: number) => (vertical ? max - i * step : min + i * step), [vertical, max, min, step]);
  const valueToIndex = useCallback((v: number) => Math.round(vertical ? (max - v) / step : (v - min) / step), [vertical, max, min, step]);

  const pad = length / 2;

  useEffect(() => {
    // scroll to the initial value once laid out
    const i = valueToIndex(value);
    const t = setTimeout(() => {
      ref.current?.scrollTo(vertical ? { y: i * TICK, animated: false } : { x: i * TICK, animated: false });
      setReady(true);
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const off = vertical ? e.nativeEvent.contentOffset.y : e.nativeEvent.contentOffset.x;
    const i = Math.max(0, Math.min(count - 1, Math.round(off / TICK)));
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      onChange(round(indexToValue(i), step));
    }
  };

  const ticks = useMemo(() => {
    const arr: { v: number; major: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      const v = round(indexToValue(i), step);
      const major = Math.abs(v / majorEvery - Math.round(v / majorEvery)) < 1e-6;
      arr.push({ v, major });
    }
    return arr;
  }, [count, indexToValue, step, majorEvery]);

  const fmt = formatLabel ?? ((v: number) => String(v));

  if (vertical) {
    return (
      <View style={{ width: thickness, height: length }}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          snapToInterval={TICK}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: pad }}
          style={{ opacity: ready ? 1 : 0 }}
        >
          {ticks.map(({ v, major }) => (
            <View key={v} style={{ height: TICK, flexDirection: leftEdge ? 'row' : 'row-reverse', alignItems: 'center' }}>
              <View style={{ width: major ? 22 : 12, height: major ? 2 : 1, backgroundColor: tick, opacity: major ? 1 : 0.55 }} />
              {major ? <Text style={{ color: label, fontSize: 13, marginHorizontal: 6 }}>{fmt(v)}</Text> : null}
            </View>
          ))}
        </ScrollView>
        {/* fixed center marker */}
        <View pointerEvents="none" style={{ position: 'absolute', top: pad - 1, left: 0, right: 0, height: 2, backgroundColor: accent }} />
      </View>
    );
  }

  return (
    <View style={{ height: thickness, width: length }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={TICK}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: pad, alignItems: 'flex-end' }}
        style={{ opacity: ready ? 1 : 0 }}
      >
        {ticks.map(({ v, major }) => (
          <View key={v} style={{ width: TICK, alignItems: 'center', justifyContent: 'flex-end', height: thickness }}>
            {major ? <Text style={{ color: label, fontSize: 12, marginBottom: 6, width: 40, textAlign: 'center' }}>{fmt(v)}</Text> : null}
            <View style={{ height: major ? 26 : 14, width: major ? 2 : 1, backgroundColor: tick, opacity: major ? 1 : 0.55 }} />
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', left: pad - 1.5, bottom: 0, width: 3, height: thickness * 0.75, borderRadius: 2, backgroundColor: accent }} />
    </View>
  );
}

function round(v: number, step: number) {
  const d = step < 1 ? 1 : 0;
  return Number(v.toFixed(d));
}
