import { View, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import {
  Radius,
  Space,
  FontSize,
  FontWeight,
  Shadow,
  StatColors,
} from '@/lib/design-tokens';

interface RPGStatsCardProps {
  strength: number;   // 0-100, based on top PR e1RM
  endurance: number;  // 0-100, based on streak/consistency
  recovery: number;   // 0-100, WHOOP recovery or readiness score
  nutrition: number;  // 0-100, protein adherence percentage
}

const STATS = [
  { key: 'strength', label: 'STR', fullName: 'Strength', icon: '⚡', color: StatColors.STR },
  { key: 'endurance', label: 'END', fullName: 'Endurance', icon: '🔥', color: StatColors.END },
  { key: 'recovery', label: 'REC', fullName: 'Recovery', icon: '💚', color: StatColors.REC },
  { key: 'nutrition', label: 'NUT', fullName: 'Nutrition', icon: '🥩', color: StatColors.NUT },
] as const;

export function RPGStatsCard(props: RPGStatsCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.hero,
        padding: Space._4,
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      <Text
        style={{
          fontSize: FontSize.section,
          fontWeight: FontWeight.bold,
          color: colors.cardForeground,
          marginBottom: Space._4,
        }}
      >
        ⚔️ Athlete Stats
      </Text>

      <View style={{ gap: Space._3 }}>
        {STATS.map((stat) => {
          const value = props[stat.key as keyof RPGStatsCardProps];
          const isHighValue = value >= 80;
          const isEmpty = value === 0;

          return (
            <View
              key={stat.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {/* Label + Icon */}
              <View style={{ width: 60 }}>
                <Text
                  style={{
                    fontSize: FontSize.eyebrow,
                    fontWeight: FontWeight.heavy,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: colors.cardForeground,
                  }}
                >
                  {stat.label} {stat.icon}
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.tiny,
                    color: colors.mute3,
                    marginTop: 1,
                  }}
                >
                  {stat.fullName}
                </Text>
              </View>

              {/* Progress Bar */}
              <View
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.cardBorder,
                  overflow: 'hidden',
                  marginHorizontal: Space._2,
                }}
              >
                {value > 0 && (
                  <View
                    style={{
                      width: `${Math.min(value, 100)}%`,
                      height: '100%',
                      borderRadius: 5,
                      backgroundColor: stat.color,
                      ...(isHighValue ? Shadow.glow(stat.color) : {}),
                    }}
                  />
                )}
              </View>

              {/* Numeric Value */}
              <View style={{ width: 32, alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: FontSize.body,
                    fontWeight: FontWeight.heavy,
                    color: isEmpty ? colors.mute3 : stat.color,
                  }}
                >
                  {isEmpty ? '—' : value}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
