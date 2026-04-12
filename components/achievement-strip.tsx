import { View, Text, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';

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

const rarityColors: Record<string, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export function AchievementStrip({
  unlockedAchievements,
  totalAchievements,
}: AchievementStripProps) {
  const colors = useColors();

  const hasUnlocked = unlockedAchievements.length > 0;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
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
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            color: colors.cardForeground,
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          Achievements
        </Text>
        <Text
          style={{
            color: colors.cardMuted,
            fontSize: 12,
          }}
        >
          {unlockedAchievements.length}/{totalAchievements} unlocked
        </Text>
      </View>

      {/* Badges */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 4 }}
      >
        {hasUnlocked ? (
          <>
            {unlockedAchievements.map((achievement) => (
              <View
                key={achievement.id}
                style={{
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#0A0B0A',
                    borderWidth: 3,
                    borderColor: rarityColors[achievement.rarity] ?? '#9CA3AF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{achievement.icon}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.cardMuted,
                    fontSize: 9,
                    marginTop: 4,
                    maxWidth: 60,
                    textAlign: 'center',
                  }}
                >
                  {achievement.name}
                </Text>
              </View>
            ))}

            {/* Locked next badge */}
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#0A0B0A',
                  borderWidth: 3,
                  borderColor: '#3A3D3A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 24 }}>🔒</Text>
              </View>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.cardMuted,
                  fontSize: 9,
                  marginTop: 4,
                  maxWidth: 60,
                  textAlign: 'center',
                }}
              >
                ???
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Empty state: 3 locked badges */}
            {[0, 1, 2].map((i) => (
              <View
                key={`locked-${i}`}
                style={{
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#0A0B0A',
                    borderWidth: 3,
                    borderColor: '#3A3D3A',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>🔒</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.cardMuted,
                    fontSize: 9,
                    marginTop: 4,
                    maxWidth: 60,
                    textAlign: 'center',
                  }}
                >
                  ???
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Empty state hint */}
      {!hasUnlocked && (
        <Text
          style={{
            color: colors.cardMuted,
            fontSize: 11,
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          Complete workouts to earn badges
        </Text>
      )}
    </View>
  );
}
