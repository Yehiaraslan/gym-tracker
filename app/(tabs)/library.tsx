import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { getAllPRs, getRecentSplitWorkouts, type SplitWorkoutSession } from '@/lib/split-workout-store';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDALS = ['🥇', '🥈', '🥉'];

export default function LibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const [prs, setPrs] = useState<Array<{ name: string; e1rm: number; weight: number; reps: number; date: string }>>([]);
  const [recentExercises, setRecentExercises] = useState<Array<{ name: string; lastWeight: number; lastReps: number; lastDate: string }>>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [prData, workouts] = await Promise.all([
        getAllPRs(),
        getRecentSplitWorkouts(3),
      ]);

      // Top 5 PRs
      const prList = Object.entries(prData)
        .map(([name, pr]) => ({ name, e1rm: Math.round(pr.e1rm), weight: pr.weight, reps: pr.reps, date: pr.date }))
        .sort((a, b) => b.e1rm - a.e1rm)
        .slice(0, 5);
      setPrs(prList);

      // Recently used exercises (unique, from last 3 workouts)
      const exerciseMap = new Map<string, { name: string; lastWeight: number; lastReps: number; lastDate: string }>();
      for (const workout of workouts) {
        if (!workout.exercises) continue;
        for (const ex of workout.exercises) {
          if (!exerciseMap.has(ex.exerciseName)) {
            const lastSet = ex.sets?.filter(s => s.weightKg > 0).pop();
            if (lastSet) {
              exerciseMap.set(ex.exerciseName, {
                name: ex.exerciseName,
                lastWeight: lastSet.weightKg,
                lastReps: lastSet.reps,
                lastDate: workout.date,
              });
            }
          }
        }
      }
      setRecentExercises(Array.from(exerciseMap.values()).slice(0, 8));
    } catch (e) {
      console.warn('[library] loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
      >
        {/* Header */}
        <Text style={{ color: colors.cardForeground, fontSize: 28, fontWeight: '900', marginBottom: 4 }}>
          ⚔️ Arsenal
        </Text>
        <Text style={{ color: colors.cardMuted, fontSize: 14, marginBottom: 20 }}>
          Your exercises, records, and training tools
        </Text>

        {/* Top PRs Board */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: (colors as any).cardBorder ?? '#2A2D2A',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: colors.cardForeground, fontSize: 16, fontWeight: '700' }}>🏆 Personal Records</Text>
            <TouchableOpacity onPress={() => router.push('/pr-board' as any)}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>View All →</Text>
            </TouchableOpacity>
          </View>

          {prs.length === 0 ? (
            <Text style={{ color: colors.cardMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
              Complete workouts to see your PRs here
            </Text>
          ) : (
            prs.map((pr, idx) => (
              <View
                key={pr.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: (colors as any).cardBorder ?? '#2A2D2A',
                }}
              >
                <Text style={{ fontSize: 20, width: 32 }}>{idx < 3 ? MEDALS[idx] : ''}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.cardForeground, fontSize: 14, fontWeight: '600' }}>{pr.name}</Text>
                  <Text style={{ color: colors.cardMuted, fontSize: 11, marginTop: 2 }}>
                    {pr.weight}kg × {pr.reps} · {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: idx < 3 ? MEDAL_COLORS[idx] : colors.primary, fontSize: 18, fontWeight: '800' }}>
                    {pr.e1rm}
                  </Text>
                  <Text style={{ color: colors.cardMuted, fontSize: 9 }}>est. 1RM</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recently Used Exercises */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: (colors as any).cardBorder ?? '#2A2D2A',
        }}>
          <Text style={{ color: colors.cardForeground, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>
            ⏱️ Recently Used
          </Text>

          {recentExercises.length === 0 ? (
            <Text style={{ color: colors.cardMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
              Complete workouts to see recent exercises
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recentExercises.map(ex => (
                <View
                  key={ex.name}
                  style={{
                    backgroundColor: '#0A0B0A',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: '#2A2D2A',
                    flexBasis: '47%',
                    flexGrow: 1,
                  }}
                >
                  <Text style={{ color: colors.cardForeground, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={{ color: colors.cardMuted, fontSize: 10, marginTop: 2 }}>
                    Last: {ex.lastWeight}kg × {ex.lastReps}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Browse Exercise Library */}
        <TouchableOpacity
          onPress={() => router.push('/exercise-library' as any)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.primary + '40',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.cardForeground, fontSize: 16, fontWeight: '700' }}>📚 Exercise Library</Text>
            <Text style={{ color: colors.cardMuted, fontSize: 13, marginTop: 4 }}>
              Browse all exercises by muscle group
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
        </TouchableOpacity>

        {/* Quick Links */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/muscle-heatmap' as any)}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: (colors as any).cardBorder ?? '#2A2D2A',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 28 }}>🔥</Text>
            <Text style={{ color: colors.cardForeground, fontSize: 13, fontWeight: '600' }}>Muscle Heatmap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/pr-board' as any)}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: (colors as any).cardBorder ?? '#2A2D2A',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 28 }}>🏆</Text>
            <Text style={{ color: colors.cardForeground, fontSize: 13, fontWeight: '600' }}>PR Board</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
