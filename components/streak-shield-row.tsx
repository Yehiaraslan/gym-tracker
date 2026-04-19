import { View, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import {
  Radius,
  Space,
  FontSize,
  FontWeight,
  Shadow,
} from '@/lib/design-tokens';

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

  const streakColor = streak >= 3 ? '#F59E0B' : colors.muted;
  const shieldColor = shields > 0 ? '#3B82F6' : colors.muted;
  const clampedProgress = Math.max(0, Math.min(100, rewardProgress));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.card,
        padding: Space._3,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Section 1 - Streak */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: FontSize.section }}>🔥</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: FontWeight.heavy,
              color: streakColor,
              marginLeft: Space._1,
              ...(streak >= 7 ? Shadow.fire : {}),
            }}
          >
            {streak}
          </Text>
        </View>
        <Text style={{ fontSize: FontSize.tiny + 1, color: colors.cardMuted, marginTop: 2 }}>
          day streak
        </Text>
      </View>

      {/* Divider */}
      <View style={{ width: 1, height: 32, backgroundColor: colors.cardBorder }} />

      {/* Section 2 - Shields */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: FontSize.section }}>🛡️</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: FontWeight.heavy,
              color: shieldColor,
              marginLeft: Space._1,
            }}
          >
            {shields}
          </Text>
        </View>
        <Text style={{ fontSize: FontSize.tiny + 1, color: colors.cardMuted, marginTop: 2 }}>
          shields
        </Text>
      </View>

      {/* Divider */}
      <View style={{ width: 1, height: 32, backgroundColor: colors.cardBorder }} />

      {/* Section 3 - Next Reward */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {nextReward ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.body }}>{nextReward.icon}</Text>
              <Text
                style={{
                  fontSize: FontSize.meta,
                  fontWeight: FontWeight.bold,
                  color: colors.primary,
                  marginLeft: Space._1,
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
                borderRadius: Radius.bar,
                backgroundColor: colors.cardBorder,
                marginTop: Space._1,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${clampedProgress}%`,
                  height: 4,
                  borderRadius: Radius.bar,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
            <Text style={{ fontSize: FontSize.tiny + 1, color: colors.cardMuted, marginTop: 2 }}>
              {daysUntilReward} {daysUntilReward === 1 ? 'day' : 'days'} to go
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: FontSize.meta, color: colors.primary, textAlign: 'center' }}>
            🏆 All rewards unlocked!
          </Text>
        )}
      </View>
    </View>
  );
}
