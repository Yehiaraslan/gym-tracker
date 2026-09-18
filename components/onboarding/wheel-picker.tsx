// Vertical drum picker — the item between the two rules is the selection.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

const ITEM_H = 56;
const VISIBLE = 5;

type Props = {
  items: (string | number)[];
  index: number;
  onChange: (index: number) => void;
  fg: string;
  muted: string;
  rule: string;
  format?: (item: string | number) => string;
  width?: number;
};

export function WheelPicker({ items, index, onChange, fg, muted, rule, format, width = 220 }: Props) {
  const ref = useRef<ScrollView>(null);
  const [cur, setCur] = useState(index);
  const [ready, setReady] = useState(false);
  const pad = ITEM_H * Math.floor(VISIBLE / 2);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
      setReady(true);
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (i !== cur) {
      setCur(i);
      onChange(i);
    }
  };

  const fmt = format ?? ((x: string | number) => String(x));

  return (
    <View style={{ height: ITEM_H * VISIBLE, width, alignSelf: 'center' }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: pad }}
        style={{ opacity: ready ? 1 : 0 }}
      >
        {items.map((it, i) => {
          const d = Math.abs(i - cur);
          return (
            <View key={i} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  color: d === 0 ? fg : muted,
                  fontSize: d === 0 ? 28 : d === 1 ? 20 : 17,
                  fontWeight: d === 0 ? '700' : '400',
                  opacity: d === 0 ? 1 : d === 1 ? 0.7 : 0.4,
                }}
              >
                {fmt(it)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: pad, height: 1, backgroundColor: rule }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: pad + ITEM_H, height: 1, backgroundColor: rule }} />
    </View>
  );
}
