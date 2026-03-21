import { useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';

// Epley 1RM formula
function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

interface PRRecord {
  exerciseId: string;
  exerciseName: string;
  bestWeight: number;
  bestReps: number;
  estimated1RM: number;
  date: string;
  bodyPart: string;
}

export default function PRBoardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { store } = useGym();

  // Calculate PRs from workout logs
  const prRecords = useMemo(() => {
    const prMap = new Map<string, PRRecord>();

    for (const log of store.workoutLogs) {
      for (const exLog of log.exercises) {
        const exercise = store.exercises.find(e => e.id === exLog.exerciseId);
        if (!exercise) continue;

        for (const set of exLog.sets) {
          if (!set.weight || set.weight <= 0) continue;
          const reps = set.reps || 0;
          if (reps <= 0) continue;

          const e1rm = epley1RM(set.weight, reps);
          const existing = prMap.get(exLog.exerciseId);

          if (!existing || e1rm > existing.estimated1RM) {
            prMap.set(exLog.exerciseId, {
              exerciseId: exLog.exerciseId,
              exerciseName: exercise.name,
              bestWeight: set.weight,
              bestReps: reps,
              estimated1RM: e1rm,
              date: log.date,
              bodyPart: (exercise as any).bodyPart || 'Other',
            });
          }
        }
      }
    }

    return Array.from(prMap.values()).sort((a, b) => b.estimated1RM - a.estimated1RM);
  }, [store.workoutLogs, store.exercises]);

  // Group by body part
  const groupedPRs = useMemo(() => {
    const groups: Record<string, PRRecord[]> = {};
    for (const pr of prRecords) {
      if (!groups[pr.bodyPart]) groups[pr.bodyPart] = [];
      groups[pr.bodyPart].push(pr);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [prRecords]);

  // Top 3 lifts
  const topLifts = prRecords.slice(0, 3);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: '700', flex: 1 }}>
            PR Board
          </Text>
        </View>

        {/* Top 3 Podium */}
        {topLifts.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Top Lifts
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {topLifts.map((pr, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                const bgColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                return (
                  <View
                    key={pr.exerciseId}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      padding: 14,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: bgColors[index] + '40',
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{medals[index]}</Text>
                    <Text style={{
                      color: colors.foreground,
                      fontSize: 22,
                      fontWeight: '800',
                      marginTop: 4,
                    }}>
                      {pr.estimated1RM}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>est. 1RM (kg)</Text>
                    <Text style={{
                      color: colors.foreground,
                      fontSize: 12,
                      fontWeight: '600',
                      marginTop: 6,
                      textAlign: 'center',
                    }}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>
                      {pr.bestWeight}kg × {pr.bestReps}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Total Estimated 1RM */}
        {prRecords.length > 0 && (
          <View style={{
            marginHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
            alignItems: 'center',
          }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Total Estimated 1RM</Text>
            <Text style={{ color: colors.foreground, fontSize: 36, fontWeight: '800' }}>
              {Math.round(prRecords.reduce((s, pr) => s + pr.estimated1RM, 0))} kg
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Across {prRecords.length} exercises
            </Text>
          </View>
        )}

        {/* PRs by Body Part */}
        {groupedPRs.map(([bodyPart, prs]) => (
          <View key={bodyPart} style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              {bodyPart}
            </Text>
            {prs.map((pr) => (
              <View
                key={pr.exerciseId}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>
                    {pr.exerciseName}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Best: {pr.bestWeight}kg × {pr.bestReps} reps
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>
                    {pr.estimated1RM}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>est. 1RM</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {prRecords.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>🏆</Text>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '600', marginTop: 12 }}>
              No PRs Yet
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
              Complete workouts with weight tracking to see your personal records here.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
