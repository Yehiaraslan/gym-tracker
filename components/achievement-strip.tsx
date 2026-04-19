import { View, Text, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import {
  RarityColors,
  Radius,
  Space,
  FontSize,
  FontWeight,
} from '@/lib/design-tokens';

interface AchievementStripProps {
  unlockedAchievements: Array<{
    id: string;
    name: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    unlockedAt?: number;
  }>;
  totalAchievements: number;
}

export function AchievementStrip({
  unlockedAchievements,
  totalAchievements,
}: AchievementStripProps) {
  const colors = useColors();

  const hasUnlocked = unlockedAchievements.length > 0;

  const renderBadge = (
    icon: string,
    name: string,
    borderColor: string,
    key: string,
    locked = false,
  ) => (
    <View key={key} style={{ alignItems: 'center', marginRight: Space._3 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: Radius.full,
          backgroundColor: colors.background,
          borderWidth: 3,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          ...(locked ? { opacity: 0.6 } : {}),
        }}
      >
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: colors.cardMuted,
          fontSize: FontSize.tiny,
          fontWeight: FontWeight.semi,
          marginTop: Space._1,
          maxWidth: 60,
          textAlign: 'center',
          letterSpacing: 0.2,
        }}
      >
        {name}
      </Text>
    </View>
  );

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
      {/* Title row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: Space._3,
        }}
      >
        <Text
          style={{
            color: colors.cardForeground,
            fontSize: FontSize.body,
            fontWeight: FontWeight.bold,
          }}
        >
          Achievements
        </Text>
        <Text
          style={{
            color: colors.cardMuted,
            fontSize: FontSize.meta,
            fontWeight: FontWeight.semi,
          }}
        >
          {unlockedAchievements.length}/{totalAchievements} unlocked
        </Text>
      </View>

      {/* Badges */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: Space._1 }}
      >
        {hasUnlocked ? (
          <>
            {unlockedAchievements.map((achievement) =>
              renderBadge(
                achievement.icon,
                achievement.name,
                RarityColors[achievement.rarity] ?? RarityColors.common,
                achievement.id,
              )
            )}
            {/* Locked next badge as motivation */}
            {renderBadge('🔒', '???', colors.surface3, 'locked-next', true)}
          </>
        ) : (
          /* Empty state: 3 locked badges */
          [0, 1, 2].map((i) =>
            renderBadge('🔒', '???', colors.surface3, `locked-${i}`, true)
          )
        )}
      </ScrollView>

      {/* Empty state hint */}
      {!hasUnlocked && (
        <Text
          style={{
            color: colors.cardMuted,
            fontSize: FontSize.eyebrow,
            textAlign: 'center',
            marginTop: Space._2,
          }}
        >
          Complete workouts to earn badges
        </Text>
      )}
    </View>
  );
}
