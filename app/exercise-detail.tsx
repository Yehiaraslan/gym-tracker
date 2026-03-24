import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { calculateDifficultyStats, getDifficultyTrend } from '@/lib/difficulty-analytics';
import { getSplitWorkouts } from '@/lib/split-workout-store';
import type { ExerciseLog } from '@/lib/types';

export default function ExerciseDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { exerciseId } = useLocalSearchParams();
  const { store } = useGym();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    loadExerciseDetails();
  }, [exerciseId]);

  const loadExerciseDetails = async () => {
    try {
      const exercise = store.exercises.find(ex => ex.id === exerciseId);
      if (!exercise) return;

      // Pull exercise logs from split workout sessions (the active data source)
      // SplitExerciseLog uses exerciseName not exerciseId, so we match by name.
      // We convert them to ExerciseLog shape so difficulty-analytics can process them.
      const splitSessions = await getSplitWorkouts();
      const allLogs: ExerciseLog[] = splitSessions
        .filter(s => s.completed)
        .flatMap(s =>
          s.exercises
            .filter(
              e =>
                !e.skipped &&
                e.exerciseName.toLowerCase() === exercise.name.toLowerCase(),
            )
            .map(e => ({
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              targetSets: e.sets.filter(st => !st.isWarmup).length,
              targetReps: '',
              sets: e.sets.map((st, idx) => ({
                setNumber: idx + 1,
                weight: st.weightKg,
                reps: st.reps,
                completedAt: Date.now(),
              })),
              difficulty: undefined, // split workouts don't store difficulty rating
            }))
        );

      // Count actual sessions this exercise appeared in
      const count = splitSessions.filter(
        s =>
          s.completed &&
          s.exercises.some(
            e =>
              !e.skipped &&
              e.exerciseName.toLowerCase() === exercise.name.toLowerCase(),
          ),
      ).length;
      setSessionCount(count);

      // Calculate difficulty stats
      const diffStats = calculateDifficultyStats(exercise.id, exercise.name, allLogs);
      setStats(diffStats);

      // Get difficulty trend
      const diffTrend = getDifficultyTrend(exercise.id, exercise.name, allLogs);
      setTrend(diffTrend);
    } catch (error) {
      console.error('Error loading exercise details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const exercise = store.exercises.find(ex => ex.id === exerciseId);

  if (!exercise || !stats) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-foreground">Exercise not found</Text>
      </ScreenContainer>
    );
  }

  const getTrendEmoji = (trend: string) => {
    if (trend === 'improving') return '📈';
    if (trend === 'declining') return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'improving') return colors.success;
    if (trend === 'declining') return colors.error;
    return colors.warning;
  };

  const getRecommendation = () => {
    if (stats.hardPercentage >= 70) {
      return {
        title: '⚠️ Challenging Exercise',
        message: 'This exercise is consistently difficult. Consider reducing weight or focusing on form.',
        color: colors.error,
      };
    }
    if (stats.hardPercentage >= 50) {
      return {
        title: '💪 Good Challenge',
        message: 'This exercise provides a good challenge. Keep pushing to improve!',
        color: colors.warning,
      };
    }
    if (stats.easyPercentage >= 70) {
      return {
        title: '🚀 Ready to Progress',
        message: 'This exercise feels easy now. Consider increasing weight or reps.',
        color: colors.success,
      };
    }
    return {
      title: '✅ Balanced',
      message: 'This exercise is well-balanced. Keep maintaining consistent form.',
      color: colors.primary,
    };
  };

  const recommendation = getRecommendation();

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b" style={{ borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground flex-1 ml-2">{exercise.name}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Exercise Info */}
        <View className="px-4 py-6">
          <View className="flex-row gap-4 mb-6">
            <View
              className="flex-1 bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-2xl font-bold text-foreground">{sessionCount}</Text>
              <Text className="text-xs text-muted mt-1">Sessions Logged</Text>
            </View>
            <View
              className="flex-1 bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-2xl font-bold text-foreground">{stats.averageDifficulty.toFixed(1)}</Text>
              <Text className="text-xs text-muted mt-1">Avg Difficulty</Text>
            </View>
            <View
              className="flex-1 bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-2xl font-bold" style={{ color: getTrendColor(stats.trend) }}>
                {getTrendEmoji(stats.trend)}
              </Text>
              <Text className="text-xs text-muted mt-1 capitalize">{stats.trend}</Text>
            </View>
          </View>
        </View>

        {/* Recommendation Card */}
        <View className="px-4 mb-6">
          <View
            className="bg-surface rounded-xl p-4"
            style={{ borderWidth: 2, borderColor: recommendation.color + '40', backgroundColor: recommendation.color + '10' }}
          >
            <Text className="text-lg font-bold text-foreground mb-2">{recommendation.title}</Text>
            <Text className="text-muted">{recommendation.message}</Text>
          </View>
        </View>

        {/* Difficulty Distribution */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Difficulty Distribution</Text>
          <View
            className="bg-surface rounded-xl p-4"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-foreground">😌 Easy</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.easyPercentage.toFixed(0)}% ({stats.easyCount})
                </Text>
              </View>
              <View
                className="h-3 rounded-full"
                style={{ backgroundColor: colors.border }}
              >
                <View
                  className="h-3 rounded-full"
                  style={{
                    width: `${stats.easyPercentage}%`,
                    backgroundColor: '#22C55E',
                  }}
                />
              </View>
            </View>

            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-foreground">💪 Medium</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.mediumPercentage.toFixed(0)}% ({stats.mediumCount})
                </Text>
              </View>
              <View
                className="h-3 rounded-full"
                style={{ backgroundColor: colors.border }}
              >
                <View
                  className="h-3 rounded-full"
                  style={{
                    width: `${stats.mediumPercentage}%`,
                    backgroundColor: '#F59E0B',
                  }}
                />
              </View>
            </View>

            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-foreground">🔥 Hard</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {stats.hardPercentage.toFixed(0)}% ({stats.hardCount})
                </Text>
              </View>
              <View
                className="h-3 rounded-full"
                style={{ backgroundColor: colors.border }}
              >
                <View
                  className="h-3 rounded-full"
                  style={{
                    width: `${stats.hardPercentage}%`,
                    backgroundColor: '#EF4444',
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Recent Trend */}
        {trend && trend.lastFiveRatings.length > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-lg font-bold text-foreground mb-3">Last 5 Attempts</Text>
            <View
              className="bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row justify-between items-end h-24">
                {trend.lastFiveRatings.map((rating: string, index: number) => {
                  const difficultyValue = rating === 'easy' ? 1 : rating === 'medium' ? 2 : 3;
                  const maxHeight = 80;
                  const height = (difficultyValue / 3) * maxHeight;
                  const color = rating === 'easy' ? '#22C55E' : rating === 'medium' ? '#F59E0B' : '#EF4444';

                  return (
                    <View key={index} className="items-center flex-1">
                      <View
                        className="rounded-t-lg"
                        style={{
                          width: '60%',
                          height,
                          backgroundColor: color,
                        }}
                      />
                      <Text className="text-xs text-muted mt-2">
                        {index === 0 ? 'Oldest' : index === trend.lastFiveRatings.length - 1 ? 'Latest' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Exercise Details */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Exercise Details</Text>
          <View
            className="bg-surface rounded-xl p-4"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <View className="py-3 border-b" style={{ borderBottomColor: colors.border }}>
              <Text className="text-sm text-muted">Body Part</Text>
              <Text className="text-base font-semibold text-foreground capitalize mt-1">
                {exercise.bodyPart}
              </Text>
            </View>
            {exercise.notes && (
              <View className="py-3 border-b" style={{ borderBottomColor: colors.border }}>
                <Text className="text-sm text-muted">Notes</Text>
                <Text className="text-base text-foreground mt-1">{exercise.notes}</Text>
              </View>
            )}
            <View className="py-3">
              <Text className="text-sm text-muted">Default Reps</Text>
              <Text className="text-base font-semibold text-foreground mt-1">{exercise.defaultReps || 'N/A'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
