import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { getAllPRs, getRecentSplitWorkouts, type SplitWorkoutSession } from '@/lib/split-workout-store';
import {
  Space,
  Gutter,
  Radius,
  FontSize,
  FontWeight,
  ActiveOpacity,
} from '@/lib/design-tokens';

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
        contentContainerStyle={{ paddingHorizontal: Gutter, paddingTop: Space._4, paddingBottom: Space._10 }}
      >
        {/* Header */}
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: FontWeight.heavy, letterSpacing: -0.5, marginBottom: Space._1 }}>
          ⚔️ Arsenal
        </Text>
        <Text style={{ color: colors.muted, fontSize: FontSize.body, marginBottom: Space._5 }}>
          Your exercises, records, and training tools
        </Text>

        {/* Top PRs Board */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.hero,
          padding: Space._4,
          marginBottom: Space._4,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space._3 + 2 }}>
            <Text style={{ color: colors.cardForeground, fontSize: FontSize.section, fontWeight: FontWeight.bold }}>🏆 Personal Records</Text>
            <TouchableOpacity onPress={() => router.push('/pr-board' as any)} activeOpacity={ActiveOpacity.secondary}>
              <Text style={{ color: colors.primary, fontSize: FontSize.bodySm, fontWeight: FontWeight.semi }}>View All →</Text>
            </TouchableOpacity>
          </View>

          {prs.length === 0 ? (
            <Text style={{ color: colors.cardMuted, fontSize: FontSize.bodySm, textAlign: 'center', paddingVertical: Space._5 }}>
              Complete workouts to see your PRs here
            </Text>
          ) : (
            prs.map((pr, idx) => (
              <View
                key={pr.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Space._2 + 2,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: colors.cardBorder,
                }}
              >
                <Text style={{ fontSize: 20, width: 32 }}>{idx < 3 ? MEDALS[idx] : ''}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.cardForeground, fontSize: FontSize.body, fontWeight: FontWeight.semi }}>{pr.name}</Text>
                  <Text style={{ color: colors.cardMuted, fontSize: FontSize.eyebrow, marginTop: 2 }}>
                    {pr.weight}kg × {pr.reps} · {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: idx < 3 ? MEDAL_COLORS[idx] : colors.primary, fontSize: FontSize.title, fontWeight: FontWeight.heavy }}>
                    {pr.e1rm}
                  </Text>
                  <Text style={{ color: colors.cardMuted, fontSize: FontSize.tiny }}>est. 1RM</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recently Used Exercises */}
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.hero,
          padding: Space._4,
          marginBottom: Space._4,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}>
          <Text style={{ color: colors.cardForeground, fontSize: FontSize.section, fontWeight: FontWeight.bold, marginBottom: Space._3 + 2 }}>
            ⏱️ Recently Used
          </Text>

          {recentExercises.length === 0 ? (
            <Text style={{ color: colors.cardMuted, fontSize: FontSize.bodySm, textAlign: 'center', paddingVertical: Space._5 }}>
              Complete workouts to see recent exercises
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space._2 }}>
              {recentExercises.map(ex => (
                <View
                  key={ex.name}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: Radius.pill,
                    paddingHorizontal: Space._3,
                    paddingVertical: Space._2,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    flexBasis: '47%',
                    flexGrow: 1,
                  }}
                >
                  <Text style={{ color: colors.cardForeground, fontSize: FontSize.meta, fontWeight: FontWeight.semi }} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={{ color: colors.cardMuted, fontSize: FontSize.tiny + 1, marginTop: 2 }}>
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
          activeOpacity={ActiveOpacity.secondary}
          style={{
            backgroundColor: colors.surface,
            borderRadius: Radius.hero,
            padding: Space._5,
            marginBottom: Space._4,
            borderWidth: 1,
            borderColor: colors.primary + '40',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.cardForeground, fontSize: FontSize.section, fontWeight: FontWeight.bold }}>📚 Exercise Library</Text>
            <Text style={{ color: colors.cardMuted, fontSize: FontSize.bodySm, marginTop: Space._1 }}>
              Browse all exercises by muscle group
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 22 }}>›</Text>
        </TouchableOpacity>

        {/* Quick Links */}
        <View style={{ flexDirection: 'row', gap: Space._2 }}>
          <TouchableOpacity
            onPress={() => router.push('/muscle-heatmap' as any)}
            activeOpacity={ActiveOpacity.secondary}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: Radius.card,
              padding: Space._4,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              alignItems: 'center',
              gap: Space._2,
            }}
          >
            <Text style={{ fontSize: 28 }}>🔥</Text>
            <Text style={{ color: colors.cardForeground, fontSize: FontSize.bodySm, fontWeight: FontWeight.semi }}>Muscle Heatmap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/pr-board' as any)}
            activeOpacity={ActiveOpacity.secondary}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: Radius.card,
              padding: Space._4,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              alignItems: 'center',
              gap: Space._2,
            }}
          >
            <Text style={{ fontSize: 28 }}>🏆</Text>
            <Text style={{ color: colors.cardForeground, fontSize: FontSize.bodySm, fontWeight: FontWeight.semi }}>PR Board</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
