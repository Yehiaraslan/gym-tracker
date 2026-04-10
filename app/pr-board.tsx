import { useMemo, useEffect, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { getAllPRs } from '@/lib/split-workout-store';
import { PROGRAM_SESSIONS } from '@/lib/training-program';

// Build a name → bodyPart lookup from all program sessions
const EXERCISE_BODY_PART: Record<string, string> = {};
for (const exercises of Object.values(PROGRAM_SESSIONS)) {
  for (const ex of exercises) {
    EXERCISE_BODY_PART[ex.name] = ex.bodyPart;
  }
}

interface PRRecord {
  exerciseName: string;
  bestWeight: number;
  bestReps: number;
  estimated1RM: number;
  date: string;
  bodyPart: string;
}

const ACCENT = '#C8F53C';
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDALS = ['🥇', '🥈', '🥉'];
const BODY_PART_ORDER = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];

export default function PRBoardScreen() {
  const router = useRouter();
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [rawPRs, setRawPRs] = useState<Record<string, { e1rm: number; weight: number; reps: number; date: string }>>({});

  useEffect(() => {
    getAllPRs()
      .then(prs => { setRawPRs(prs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const prRecords: PRRecord[] = useMemo(() =>
    Object.entries(rawPRs)
      .map(([name, pr]) => ({
        exerciseName: name,
        bestWeight: pr.weight,
        bestReps: pr.reps,
        estimated1RM: Math.round(pr.e1rm),
        date: pr.date,
        bodyPart: EXERCISE_BODY_PART[name] ?? 'Other',
      }))
      .sort((a, b) => b.estimated1RM - a.estimated1RM),
    [rawPRs]);

  const groupedPRs = useMemo(() => {
    const groups: Record<string, PRRecord[]> = {};
    for (const pr of prRecords) {
      if (!groups[pr.bodyPart]) groups[pr.bodyPart] = [];
      groups[pr.bodyPart].push(pr);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = BODY_PART_ORDER.indexOf(a);
      const bi = BODY_PART_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [prRecords]);

  const topLifts = prRecords.slice(0, 3);
  const totalE1RM = Math.round(prRecords.reduce((s, pr) => s + pr.estimated1RM, 0));

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <Text style={{ color: colors.cardForeground, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.cardForeground, fontSize: 22, fontWeight: '800', flex: 1 }}>
          🏆 PR Board
        </Text>
        <Text style={{ color: colors.cardMuted, fontSize: 12 }}>
          {prRecords.length} exercises
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ color: colors.cardMuted, marginTop: 12 }}>Loading your PRs…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Total strength score */}
          {prRecords.length > 0 && (
            <View style={{
              marginHorizontal: 16,
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: ACCENT + '30',
            }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>Total Strength Score</Text>
              <Text style={{ color: ACCENT, fontSize: 48, fontWeight: '900', marginTop: 4 }}>
                {totalE1RM}
              </Text>
              <Text style={{ color: colors.cardMuted, fontSize: 12 }}>kg combined estimated 1RM · {prRecords.length} exercises</Text>
            </View>
          )}

          {/* Top 3 Podium */}
          {topLifts.length > 0 && (
            <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
                Top Lifts
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {topLifts.map((pr, index) => (
                  <View
                    key={pr.exerciseName}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      padding: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: MEDAL_COLORS[index] + '50',
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{MEDALS[index]}</Text>
                    <Text style={{ color: MEDAL_COLORS[index], fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                      {pr.estimated1RM}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 9, marginTop: 1 }}>est. 1RM (kg)</Text>
                    <Text style={{ color: colors.cardForeground, fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' }} numberOfLines={2}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 10, marginTop: 2 }}>
                      {pr.bestWeight}kg × {pr.bestReps}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 9, marginTop: 2 }}>
                      {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* PRs by Body Part */}
          {groupedPRs.map(([bodyPart, prs]) => (
            <View key={bodyPart} style={{ marginHorizontal: 16, marginBottom: 20 }}>
              <Text style={{ color: colors.cardMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
                {bodyPart}
              </Text>
              {prs.map((pr, idx) => (
                <View
                  key={pr.exerciseName}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ color: colors.cardMuted, fontSize: 13, fontWeight: '700', width: 24 }}>
                    {idx + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.cardForeground, fontSize: 14, fontWeight: '600' }}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 2 }}>
                      {pr.bestWeight}kg × {pr.bestReps} reps · {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: ACCENT, fontSize: 20, fontWeight: '800' }}>
                      {pr.estimated1RM}
                    </Text>
                    <Text style={{ color: colors.cardMuted, fontSize: 9 }}>est. 1RM</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}

          {/* Empty state */}
          {prRecords.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 56 }}>🏋️</Text>
              <Text style={{ color: colors.cardForeground, fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                No PRs Yet
              </Text>
              <Text style={{ color: colors.cardMuted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
                Complete workouts with weight tracking to see your personal records here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
