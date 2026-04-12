import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getTodayChallenges, completeChallenge, type DailyChallenge } from '@/lib/daily-challenges';

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
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, padding: 16, marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: colors.cardForeground, fontSize: 15, fontWeight: '700' }}>
          Daily Challenges
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
            {completedCount}/{challenges.length}
          </Text>
          <View style={{ width: 40, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2 }}>
            <View style={{ width: `${(completedCount / challenges.length) * 100}%` as any, height: 4, backgroundColor: colors.primary, borderRadius: 2 }} />
          </View>
        </View>
      </View>
      {challenges.map((c) => (
        <TouchableOpacity
          key={c.id}
          onPress={() => !c.completed && handleToggle(c.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
            opacity: c.completed ? 0.5 : 1,
          }}
        >
          <Text style={{ fontSize: 20, marginRight: 12 }}>{c.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.cardForeground, fontSize: 13, fontWeight: '600', textDecorationLine: c.completed ? 'line-through' : 'none' }}>
              {c.title}
            </Text>
            <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 1 }}>{c.description}</Text>
          </View>
          <View style={{
            backgroundColor: c.completed ? colors.primary + '20' : '#F59E0B20',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
          }}>
            <Text style={{ color: c.completed ? colors.primary : '#F59E0B', fontSize: 11, fontWeight: '600' }}>
              {c.completed ? '✓' : `+${c.xpReward} XP`}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
