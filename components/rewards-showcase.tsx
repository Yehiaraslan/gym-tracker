import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { UnlockableReward } from '@/lib/milestone-rewards';

interface RewardsShowcaseProps {
  unlockedRewards: UnlockableReward[];
  onRewardPress?: (reward: UnlockableReward) => void;
}

export function RewardsShowcase({ unlockedRewards, onRewardPress }: RewardsShowcaseProps) {
  const colors = useColors();

  if (unlockedRewards.length === 0) {
    return (
      <View className="bg-surface rounded-2xl p-6" style={{ borderWidth: 1, borderColor: colors.cardBorder }}>
        <Text className="text-sm font-medium text-cardMuted mb-2">Unlocked Rewards</Text>
        <Text className="text-sm text-cardMuted">Keep your streak going to unlock rewards!</Text>
      </View>
    );
  }

  return (
    <View className="bg-surface rounded-2xl p-4" style={{ borderWidth: 1, borderColor: colors.cardBorder }}>
      <Text className="text-sm font-medium text-cardForeground mb-3">
        Unlocked Rewards ({unlockedRewards.length})
      </Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
        {unlockedRewards.map((reward) => (
          <TouchableOpacity
            key={reward.id}
            onPress={() => onRewardPress?.(reward)}
            className="items-center justify-center rounded-2xl p-4"
            style={{
              backgroundColor: colors.primary + '15',
              borderWidth: 1,
              borderColor: colors.primary,
              minWidth: 100,
            }}
          >
            <Text style={{ fontSize: 32, marginBottom: 4 }}>{reward.icon}</Text>
            <Text className="text-xs font-semibold text-cardForeground text-center">{reward.name}</Text>
            <Text className="text-xs text-cardMuted text-center mt-1">
              {reward.type === 'theme' && 'Theme'}
              {reward.type === 'exercise_pack' && 'Exercises'}
              {reward.type === 'feature' && 'Feature'}
              {reward.type === 'badge' && 'Badge'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
