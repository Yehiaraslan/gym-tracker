import { View, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface StreakShieldRowProps {
  streak: number;
  bestStreak: number;
  shields: number;
  nextReward: { name: string; icon: string; streakRequired: number } | null;
  rewardProgress: number; // 0-100
  daysUntilReward: number;
}

export function StreakShieldRow(props: StreakShieldRowProps) {
  const { streak, bestStreak, shields, nextReward, rewardProgress, daysUntilReward } = props;
  const colors = useColors();

  const streakColor = streak >= 3 ? '#F59E0B' : '#7A8070';
  const shieldColor = shields > 0 ? '#3B82F6' : '#7A8070';
  const clampedProgress = Math.max(0, Math.min(100, rewardProgress));

  return (
    <View
      style={{
        backgroundColor: '#1A1D1A',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#2A2D2A',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Section 1 - Streak */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16 }}>🔥</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: streakColor,
              marginLeft: 4,
              ...(streak >= 7
                ? {
                    textShadowColor: '#F59E0B',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 8,
                  }
                : {}),
            }}
          >
            {streak}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: '#7A8070', marginTop: 2 }}>
          day streak
        </Text>
      </View>

      {/* Divider */}
      <View style={{ width: 1, height: 32, backgroundColor: '#2A2D2A' }} />

      {/* Section 2 - Shields */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16 }}>🛡️</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: shieldColor,
              marginLeft: 4,
            }}
          >
            {shields}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: '#7A8070', marginTop: 2 }}>
          shields
        </Text>
      </View>

      {/* Divider */}
      <View style={{ width: 1, height: 32, backgroundColor: '#2A2D2A' }} />

      {/* Section 3 - Next Reward */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {nextReward ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14 }}>{nextReward.icon}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: '#C8F53C',
                  marginLeft: 4,
                }}
                numberOfLines={1}
              >
                {nextReward.name}
              </Text>
            </View>
            <View
              style={{
                width: '80%',
                height: 4,
                borderRadius: 2,
                backgroundColor: '#2A2D2A',
                marginTop: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${clampedProgress}%`,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#C8F53C',
                }}
              />
            </View>
            <Text style={{ fontSize: 10, color: '#7A8070', marginTop: 2 }}>
              {daysUntilReward} {daysUntilReward === 1 ? 'day' : 'days'} to go
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 12, color: '#C8F53C', textAlign: 'center' }}>
            🏆 All rewards unlocked!
          </Text>
        )}
      </View>
    </View>
  );
}
