import { View, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface RPGStatsCardProps {
  strength: number;   // 0-100, based on top PR e1RM
  endurance: number;  // 0-100, based on streak/consistency
  recovery: number;   // 0-100, WHOOP recovery or readiness score
  nutrition: number;  // 0-100, protein adherence percentage
}

const STATS = [
  { key: 'strength', label: 'STR', fullName: 'Strength', icon: '⚡', color: '#EF4444' },
  { key: 'endurance', label: 'END', fullName: 'Endurance', icon: '🔥', color: '#F59E0B' },
  { key: 'recovery', label: 'REC', fullName: 'Recovery', icon: '💚', color: '#22C55E' },
  { key: 'nutrition', label: 'NUT', fullName: 'Nutrition', icon: '🥩', color: '#3B82F6' },
] as const;

export function RPGStatsCard(props: RPGStatsCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: '#1A1D1A',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2D2A',
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: 'bold',
          color: '#F5F5F5',
          marginBottom: 16,
        }}
      >
        ⚔️ Athlete Stats
      </Text>

      <View style={{ gap: 12 }}>
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
              <View style={{ width: 80 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#F5F5F5',
                  }}
                >
                  {stat.label} {stat.icon}
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    color: '#6B6B6B',
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
                  backgroundColor: '#2A2D2A',
                  overflow: 'hidden',
                }}
              >
                {value > 0 && (
                  <View
                    style={{
                      width: `${Math.min(value, 100)}%`,
                      height: '100%',
                      borderRadius: 5,
                      backgroundColor: stat.color,
                      ...(isHighValue
                        ? {
                            shadowColor: stat.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.6,
                            shadowRadius: 6,
                            elevation: 4,
                          }
                        : {}),
                    }}
                  />
                )}
              </View>

              {/* Numeric Value */}
              <View style={{ width: 40, alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: isEmpty ? '#6B6B6B' : stat.color,
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
