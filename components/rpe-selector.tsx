// ============================================================
// RPE SELECTOR — Rate of Perceived Exertion (6-10)
// ============================================================

import { Text, View, TouchableOpacity, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { RPE_LABELS, RPE_VALUES } from '@/lib/fitness-utils';
import * as Haptics from 'expo-haptics';

interface RPESelectorProps {
  value: number | null;
  onChange: (rpe: number | null) => void;
}

export function RPESelector({ value, onChange }: RPESelectorProps) {
  const colors = useColors();

  const handlePress = (rpe: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value === rpe ? null : rpe);
  };

  return (
    <View>
      <Text className="text-xs font-medium text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
        RPE — Rate of Perceived Exertion
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {RPE_VALUES.map(rpe => {
          const info = RPE_LABELS[rpe];
          const isSelected = value === rpe;
          return (
            <TouchableOpacity
              key={rpe}
              onPress={() => handlePress(rpe)}
              className="flex-1 items-center py-3 rounded-xl"
              style={{
                backgroundColor: isSelected ? info.color + '25' : colors.surface,
                borderWidth: 1.5,
                borderColor: isSelected ? info.color + '60' : colors.border,
              }}
            >
              <Text
                className="text-base font-bold"
                style={{ color: isSelected ? info.color : colors.muted }}
              >
                {rpe}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {value && (
        <Text
          className="text-xs text-center mt-2 font-medium"
          style={{ color: RPE_LABELS[value].color }}
        >
          RPE {value} — {RPE_LABELS[value].label}
        </Text>
      )}
    </View>
  );
}
