import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getTodayChallenges, completeChallenge, type DailyChallenge } from '@/lib/daily-challenges';
import {
  Radius,
  Space,
  FontSize,
  FontWeight,
  ActiveOpacity,
} from '@/lib/design-tokens';

export function DailyChallengesCard() {
  const colors = useColors();
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);

  useEffect(() => {
    getTodayChallenges().then(setChallenges);
  }, []);

  const handleToggle = async (id: string) => {
    const updated = await completeChallenge(id);
    setChallenges(updated);
  };

  const completedCount = challenges.filter(c => c.completed).length;

  if (challenges.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.hero,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: Space._4,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space._3 }}>
        <Text style={{ color: colors.cardForeground, fontSize: FontSize.section, fontWeight: FontWeight.bold }}>
          Daily Challenges
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space._2 }}>
          <Text style={{ color: colors.primary, fontSize: FontSize.meta, fontWeight: FontWeight.semi }}>
            {completedCount}/{challenges.length}
          </Text>
          <View style={{ width: 40, height: 4, backgroundColor: colors.cardBorder, borderRadius: Radius.bar }}>
            <View
              style={{
                width: `${(completedCount / challenges.length) * 100}%` as any,
                height: 4,
                backgroundColor: colors.primary,
                borderRadius: Radius.bar,
              }}
            />
          </View>
        </View>
      </View>

      {/* Challenge list */}
      {challenges.map((c) => (
        <TouchableOpacity
          key={c.id}
          onPress={() => !c.completed && handleToggle(c.id)}
          activeOpacity={ActiveOpacity.secondary}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Space._2 + 2,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
            opacity: c.completed ? 0.5 : 1,
          }}
        >
          <Text style={{ fontSize: 20, marginRight: Space._3 }}>{c.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.cardForeground,
                fontSize: FontSize.bodySm,
                fontWeight: FontWeight.semi,
                textDecorationLine: c.completed ? 'line-through' : 'none',
              }}
            >
              {c.title}
            </Text>
            <Text style={{ color: colors.cardMuted, fontSize: FontSize.eyebrow, marginTop: 1 }}>
              {c.description}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: c.completed
                ? 'rgba(200, 245, 60, 0.14)'
                : 'rgba(245, 158, 11, 0.14)',
              paddingHorizontal: Space._2,
              paddingVertical: 3,
              borderRadius: Radius.pill,
            }}
          >
            <Text
              style={{
                color: c.completed ? colors.primary : '#F59E0B',
                fontSize: FontSize.eyebrow,
                fontWeight: FontWeight.semi,
              }}
            >
              {c.completed ? '✓' : `+${c.xpReward} XP`}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
