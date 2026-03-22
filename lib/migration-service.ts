// ============================================================
// MIGRATION SERVICE — One-time upload of AsyncStorage data to cloud DB
// Runs once on first launch after DB sync is enabled.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from './trpc';

const MIGRATION_KEY = '@gym_tracker_db_migration_v1';

/**
 * Run the one-time migration of all AsyncStorage data to the cloud DB.
 * Safe to call on every app launch — it checks a flag and skips if already done.
 */
export async function runMigrationIfNeeded(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_KEY);
    if (done === 'done') return;

    console.log('[Migration] Starting one-time AsyncStorage → DB migration...');

    await Promise.allSettled([
      migrateWorkouts(),
      migrateNutrition(),
      migrateStreak(),
      migrateFormCoach(),
    ]);

    await AsyncStorage.setItem(MIGRATION_KEY, 'done');
    console.log('[Migration] Complete.');
  } catch (err) {
    console.warn('[Migration] Migration failed (non-fatal):', err);
  }
}

async function migrateWorkouts(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('@gym_tracker_split_workouts');
    if (!raw) return;
    const sessions: Array<{
      id: string;
      date: string;
      sessionType: string;
      startTime?: string;
      endTime?: string;
      completed: boolean;
      durationMinutes?: number;
      totalVolume?: number;
      exercises: Array<{
        exerciseName: string;
        skipped?: boolean;
        skipReason?: string;
        sets: Array<{
          weightKg: number;
          reps: number;
          rpe?: number;
          isWarmup?: boolean;
          timestamp?: string;
        }>;
      }>;
    }> = JSON.parse(raw);

    for (const session of sessions) {
      await trpcClient.sync.upsertWorkout.mutate({
        session: {
          id: session.id,
          date: session.date,
          sessionType: session.sessionType,
          startTime: session.startTime,
          endTime: session.endTime,
          completed: session.completed,
          durationMinutes: session.durationMinutes,
          totalVolumeKg: session.totalVolume,
          exercises: session.exercises.map((ex, exIdx) => ({
            exerciseName: ex.exerciseName,
            exerciseOrder: exIdx,
            skipped: ex.skipped ?? false,
            skipReason: ex.skipReason,
            sets: ex.sets.map((s, sIdx) => ({
              setNumber: sIdx + 1,
              weightKg: s.weightKg,
              reps: s.reps,
              rpe: s.rpe,
              isWarmup: s.isWarmup ?? false,
              timestamp: s.timestamp,
            })),
          })),
        },
      });
    }
    console.log(`[Migration] Migrated ${sessions.length} workout sessions.`);
  } catch (err) {
    console.warn('[Migration] Workout migration failed:', err);
  }
}

async function migrateNutrition(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('@gym_tracker_nutrition');
    if (!raw) return;
    const allDays: Record<string, {
      date: string;
      isTrainingDay: boolean;
      targetCalories: number;
      targetProtein: number;
      targetCarbs: number;
      targetFat: number;
      supplementsChecked: Array<{ name: string; taken: boolean }>;
      meals: Array<{
        id: string;
        mealNumber: 1 | 2 | 3 | 4 | 5;
        foodName: string;
        protein: number;
        carbs: number;
        fat: number;
        calories: number;
        timestamp: string;
      }>;
    }> = JSON.parse(raw);

    for (const day of Object.values(allDays)) {
      await trpcClient.sync.upsertNutritionDay.mutate({
        day: {
          date: day.date,
          isTrainingDay: day.isTrainingDay,
          targetCalories: day.targetCalories,
          targetProtein: day.targetProtein,
          targetCarbs: day.targetCarbs,
          targetFat: day.targetFat,
          supplements: day.supplementsChecked
            ?.filter(s => s.taken)
            .map(s => s.name)
            .join(',') || null,
          meals: day.meals.map(food => ({
            id: food.id,
            mealNumber: food.mealNumber,
            foodName: food.foodName,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            calories: food.calories,
            servingGrams: null,
            timestamp: food.timestamp,
          })),
        },
      });
    }
    console.log(`[Migration] Migrated ${Object.keys(allDays).length} nutrition days.`);
  } catch (err) {
    console.warn('[Migration] Nutrition migration failed:', err);
  }
}

async function migrateStreak(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('gym_tracker_streak_data');
    if (!raw) return;
    const data: {
      currentStreak: number;
      bestStreak: number;
      lastWorkoutDate: string | null;
      workoutDates: string[];
    } = JSON.parse(raw);

    await trpcClient.sync.upsertStreak.mutate({
      streak: {
        currentStreak: data.currentStreak,
        bestStreak: data.bestStreak,
        lastWorkoutDate: data.lastWorkoutDate,
        workoutDates: data.workoutDates,
      },
    });
    console.log('[Migration] Migrated streak data.');
  } catch (err) {
    console.warn('[Migration] Streak migration failed:', err);
  }
}

async function migrateFormCoach(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('@gym_tracker_form_coach_sessions');
    if (!raw) return;
    const sessions: Array<{
      id: string;
      exerciseName: string;
      date: string;
      reps: number;
      formScore: number;
      topIssues?: string[];
      durationSeconds?: number;
    }> = JSON.parse(raw);

    for (const session of sessions) {
      await trpcClient.sync.upsertFormCoach.mutate({
        session: {
          id: session.id,
          exerciseName: session.exerciseName,
          date: session.date,
          totalReps: session.reps,
          avgFormScore: session.formScore,
          peakFormScore: session.formScore,
          issues: session.topIssues?.join(', '),
          durationSeconds: session.durationSeconds,
        },
      });
    }
    console.log(`[Migration] Migrated ${sessions.length} form coach sessions.`);
  } catch (err) {
    console.warn('[Migration] Form coach migration failed:', err);
  }
}
