import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getWaterData, addGlass, removeGlass, type WaterData } from '@/lib/water-store';
import * as Haptics from 'expo-haptics';

export function WaterTracker() {
  const colors = useColors();
  const [data, setData] = useState<WaterData>({ date: '', glasses: 0, target: 8 });

  useEffect(() => {
    getWaterData().then(setData);
  }, []);

  const handleAdd = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await addGlass();
    setData(updated);
  };

  const handleRemove = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await removeGlass();
    setData(updated);
  };

  const pct = Math.min((data.glasses / data.target) * 100, 100);

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, padding: 16, marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: colors.cardForeground, fontSize: 15, fontWeight: '700' }}>
          💧 Water
        </Text>
        <Text style={{ color: data.glasses >= data.target ? '#4ADE80' : colors.cardMuted, fontSize: 13, fontWeight: '600' }}>
          {data.glasses}/{data.target} glasses
        </Text>
      </View>

      {/* Progress bar */}
      <View style={{ height: 6, backgroundColor: colors.cardBorder, borderRadius: 3, marginBottom: 12 }}>
        <View style={{ height: 6, backgroundColor: '#38BDF8', borderRadius: 3, width: `${pct}%` as any }} />
      </View>

      {/* Glass grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length: data.target }).map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={i === data.glasses ? handleAdd : undefined}
            onLongPress={i < data.glasses ? handleRemove : undefined}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: i < data.glasses ? '#38BDF820' : colors.background,
              borderWidth: 1,
              borderColor: i < data.glasses ? '#38BDF840' : colors.cardBorder,
            }}
          >
            <Text style={{ fontSize: 18 }}>{i < data.glasses ? '💧' : '○'}</Text>
          </TouchableOpacity>
        ))}
        {data.glasses < data.target && (
          <TouchableOpacity
            onPress={handleAdd}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary + '15',
              borderWidth: 1,
              borderColor: colors.primary + '30',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
