import { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { getDayName, generateId, WorkoutLog, ExerciseLog } from '@/lib/types';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { 
    store, 
    currentCycleInfo, 
    getTodayProgram, 
    getExerciseById,
    getLastWeight,
  } = useGym();
  
  const todayProgram = getTodayProgram();
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const startWorkout = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/workout');
  };

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <Text className="text-muted text-sm">{today}</Text>
          <Text className="text-3xl font-bold text-foreground mt-1">Today's Workout</Text>
        </View>

        {/* Cycle Info Card */}
        <View 
          className="mx-6 mb-6 bg-surface rounded-2xl p-5"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-sm text-muted">Current Cycle</Text>
              <Text className="text-2xl font-bold text-foreground">
                Cycle {currentCycleInfo.cycle}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm text-muted">Week {currentCycleInfo.week} of 8</Text>
              <Text className="text-lg font-semibold text-foreground">
                {getDayName(currentCycleInfo.day)}
              </Text>
            </View>
          </View>
          
          {/* Week Progress Bar */}
          <View className="mt-4">
            <View 
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: colors.border }}
            >
              <View 
                className="h-full rounded-full"
                style={{ 
                  width: `${(currentCycleInfo.week / 8) * 100}%`,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
          </View>
        </View>

        {/* Today's Exercises */}
        {todayProgram && todayProgram.exercises.length > 0 ? (
          <>
            <View className="px-6 mb-4">
              <Text className="text-lg font-semibold text-foreground">
                {todayProgram.exercises.length} Exercises Today
              </Text>
            </View>

            {todayProgram.exercises.map((dayEx, index) => {
              const exercise = getExerciseById(dayEx.exerciseId);
              const lastWeight = getLastWeight(dayEx.exerciseId);
              
              return (
                <View 
                  key={index}
                  className="mx-6 mb-3 bg-surface rounded-xl p-4"
                  style={{ borderWidth: 1, borderColor: colors.border }}
                >
                  <View className="flex-row items-center">
                    <View 
                      className="w-8 h-8 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: colors.primary + '20' }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground">
                        {exercise?.name || 'Unknown Exercise'}
                      </Text>
                      <Text className="text-sm text-muted mt-1">
                        {dayEx.sets} sets × {dayEx.reps} reps
                      </Text>
                    </View>
                    {lastWeight !== null && (
                      <View className="items-end">
                        <Text className="text-xs text-muted">Last</Text>
                        <Text className="font-semibold" style={{ color: colors.primary }}>
                          {lastWeight} kg
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Start Workout Button */}
            <View className="px-6 mt-6">
              <TouchableOpacity
                onPress={startWorkout}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 18,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconSymbol name="play.fill" size={24} color="#FFFFFF" />
                <Text className="text-white font-bold text-lg ml-2">
                  Start Workout
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="mx-6 items-center py-12">
            <IconSymbol name="calendar" size={64} color={colors.muted} />
            <Text className="text-xl font-semibold text-foreground mt-4">Rest Day</Text>
            <Text className="text-muted text-center mt-2">
              No workout scheduled for today.{'\n'}
              Go to Admin to configure your program.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/admin')}
              className="mt-6 px-6 py-3 rounded-xl"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Text className="font-semibold text-foreground">Go to Admin</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Form Coach */}
        <View className="px-6 mt-6">
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/form-coach');
            }}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary + '40',
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View 
              className="w-12 h-12 rounded-xl items-center justify-center mr-4"
              style={{ backgroundColor: colors.primary + '15' }}
            >
              <Text style={{ fontSize: 24 }}>🤖</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-foreground">AI Form Coach</Text>
              <Text className="text-sm text-muted mt-0.5">Track push-ups & pull-ups with AI</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        {store.workoutLogs.filter(l => l.isCompleted).length > 0 && (
          <View className="px-6 mt-8">
            <Text className="text-lg font-semibold text-foreground mb-4">Quick Stats</Text>
            <View className="flex-row">
              <View 
                className="flex-1 bg-surface rounded-xl p-4 mr-2"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <IconSymbol name="checkmark.circle.fill" size={24} color={colors.success} />
                <Text className="text-2xl font-bold text-foreground mt-2">
                  {store.workoutLogs.filter(l => l.isCompleted).length}
                </Text>
                <Text className="text-sm text-muted">Workouts</Text>
              </View>
              <View 
                className="flex-1 bg-surface rounded-xl p-4 ml-2"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <IconSymbol name="trophy.fill" size={24} color={colors.warning} />
                <Text className="text-2xl font-bold text-foreground mt-2">
                  {currentCycleInfo.cycle}
                </Text>
                <Text className="text-sm text-muted">Cycles</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
