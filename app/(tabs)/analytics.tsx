import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { calculateDifficultyStats, getExercisesThatNeedAttention } from '@/lib/difficulty-analytics';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const colors = useColors();
  const { store } = useGym();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, [store.workoutLogs, store.exercises]);

  const loadAnalytics = async () => {
    try {
      // Calculate workout statistics
      const totalWorkouts = store.workoutLogs.length;
      const totalExercises = store.exercises.length;
      
      // Calculate average exercises per workout
      const avgExercisesPerWorkout = totalWorkouts > 0
        ? (store.workoutLogs.reduce((sum, log) => sum + log.exercises.length, 0) / totalWorkouts).toFixed(1)
        : 0;

      // Calculate body part distribution
      const bodyPartStats = new Map<string, number>();
      store.exercises.forEach(ex => {
        const count = bodyPartStats.get(ex.bodyPart) || 0;
        bodyPartStats.set(ex.bodyPart, count + 1);
      });

      // Calculate difficulty distribution
      const allLogs = store.workoutLogs.flatMap(log => log.exercises);
      const easyCount = allLogs.filter(log => log.difficulty === 'easy').length;
      const mediumCount = allLogs.filter(log => log.difficulty === 'medium').length;
      const hardCount = allLogs.filter(log => log.difficulty === 'hard').length;
      const totalRated = easyCount + mediumCount + hardCount;

      // Get exercises that need attention
      const needAttention = getExercisesThatNeedAttention(store.workoutLogs);

      // Calculate weekly activity
      const weeklyActivity = new Map<number, number>();
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = store.workoutLogs.filter(log => log.date === dateStr).length;
        weeklyActivity.set(i, count);
      }

      setStats({
        totalWorkouts,
        totalExercises,
        avgExercisesPerWorkout,
        bodyPartStats: Object.fromEntries(bodyPartStats),
        easyCount,
        mediumCount,
        hardCount,
        totalRated,
        easyPercentage: totalRated > 0 ? ((easyCount / totalRated) * 100).toFixed(0) : 0,
        mediumPercentage: totalRated > 0 ? ((mediumCount / totalRated) * 100).toFixed(0) : 0,
        hardPercentage: totalRated > 0 ? ((hardCount / totalRated) * 100).toFixed(0) : 0,
        needAttention,
        weeklyActivity: Array.from(weeklyActivity.values()),
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
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

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-4 py-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Analytics</Text>
          <Text className="text-muted">Track your fitness progress</Text>
        </View>

        {/* Key Metrics */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-3">
            <View
              className="flex-1 bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-2xl font-bold text-foreground">{stats.totalWorkouts}</Text>
              <Text className="text-xs text-muted mt-1">Total Workouts</Text>
            </View>
            <View
              className="flex-1 bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-2xl font-bold text-foreground">{stats.totalExercises}</Text>
              <Text className="text-xs text-muted mt-1">Unique Exercises</Text>
            </View>
            <View
              className="flex-1 bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="text-2xl font-bold text-foreground">{stats.avgExercisesPerWorkout}</Text>
              <Text className="text-xs text-muted mt-1">Avg Per Workout</Text>
            </View>
          </View>
        </View>

        {/* Weekly Activity */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Weekly Activity</Text>
          <View
            className="bg-surface rounded-xl p-4"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row justify-between items-end h-24">
              {stats.weeklyActivity.map((count: number, index: number) => {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const maxHeight = 80;
                const height = count > 0 ? (count / Math.max(...stats.weeklyActivity, 1)) * maxHeight : 4;
                
                return (
                  <View key={index} className="items-center flex-1">
                    <View
                      className="rounded-t-lg"
                      style={{
                        width: '70%',
                        height,
                        backgroundColor: count > 0 ? colors.primary : colors.border,
                      }}
                    />
                    <Text className="text-xs text-muted mt-2">{days[(6 - index + new Date().getDay()) % 7]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Difficulty Distribution */}
        {stats.totalRated > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-lg font-bold text-foreground mb-3">Difficulty Distribution</Text>
            <View
              className="bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-foreground">😌 Easy</Text>
                  <Text className="text-sm font-semibold text-foreground">{stats.easyPercentage}%</Text>
                </View>
                <View
                  className="h-2 rounded-full"
                  style={{ backgroundColor: colors.border }}
                >
                  <View
                    className="h-2 rounded-full"
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
                  <Text className="text-sm font-semibold text-foreground">{stats.mediumPercentage}%</Text>
                </View>
                <View
                  className="h-2 rounded-full"
                  style={{ backgroundColor: colors.border }}
                >
                  <View
                    className="h-2 rounded-full"
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
                  <Text className="text-sm font-semibold text-foreground">{stats.hardPercentage}%</Text>
                </View>
                <View
                  className="h-2 rounded-full"
                  style={{ backgroundColor: colors.border }}
                >
                  <View
                    className="h-2 rounded-full"
                    style={{
                      width: `${stats.hardPercentage}%`,
                      backgroundColor: '#EF4444',
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Body Part Distribution */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Body Part Distribution</Text>
          <View
            className="bg-surface rounded-xl p-4"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            {Object.entries(stats.bodyPartStats).map(([bodyPart, count]: [string, any]) => (
              <View key={bodyPart} className="flex-row items-center justify-between py-2 border-b" style={{ borderBottomColor: colors.border }}>
                <Text className="text-sm text-foreground">{bodyPart}</Text>
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-2 rounded-full"
                    style={{
                      width: 40,
                      backgroundColor: colors.border,
                    }}
                  >
                    <View
                      className="h-2 rounded-full"
                      style={{
                        width: `${(count / stats.totalExercises) * 100}%`,
                        backgroundColor: colors.primary,
                      }}
                    />
                  </View>
                  <Text className="text-sm font-semibold text-foreground w-8">{count}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Exercises Needing Attention */}
        {stats.needAttention.length > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-lg font-bold text-foreground mb-3">⚠️ Exercises Needing Attention</Text>
            <View
              className="bg-surface rounded-xl p-4"
              style={{ borderWidth: 1, borderColor: colors.error + '40' }}
            >
              {stats.needAttention.map((exercise: any) => (
                <View key={exercise.exerciseId} className="py-3 border-b" style={{ borderBottomColor: colors.border }}>
                  <Text className="text-sm font-semibold text-foreground mb-1">{exercise.exerciseName}</Text>
                  <Text className="text-xs text-muted mb-2">
                    {exercise.hardPercentage.toFixed(0)}% rated as hard
                  </Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1 h-1 rounded-full" style={{ backgroundColor: colors.border }}>
                      <View
                        className="h-1 rounded-full"
                        style={{
                          width: `${exercise.hardPercentage}%`,
                          backgroundColor: colors.error,
                        }}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
