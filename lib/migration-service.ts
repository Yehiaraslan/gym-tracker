// ============================================================
// MIGRATION SERVICE — One-time upload of AsyncStorage data to cloud DB
// Runs once on first launch after DB sync is enabled.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  syncWorkoutSession,
  syncNutritionDay,
  syncStreak,
  syncFormCoachSession,
} from './db-sync-fetch';

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
      syncWorkoutSession({
        sessionId: session.id,
        splitDay: session.sessionType,
        startTime: session.startTime ?? session.date,
        endTime: session.endTime ?? session.date,
        durationMinutes: session.durationMinutes ?? 0,
        totalVolume: session.totalVolume ?? 0,
        exercises: session.exercises.map(ex => ({
          exerciseName: ex.exerciseName,
          muscleGroup: '',
          sets: ex.sets.map((s, sIdx) => ({
            setNumber: sIdx + 1,
            weightKg: s.weightKg,
            reps: s.reps,
            rpe: s.rpe,
            completedAt: s.timestamp ?? session.date,
          })),
        })),
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
      const totals = day.meals.reduce(
        (acc, m) => ({ cal: acc.cal + m.calories, prot: acc.prot + m.protein, carb: acc.carb + m.carbs, fat: acc.fat + m.fat }),
        { cal: 0, prot: 0, carb: 0, fat: 0 },
      );
      syncNutritionDay({
        date: day.date,
        isTrainingDay: day.isTrainingDay,
        targetCalories: day.targetCalories,
        targetProtein: day.targetProtein,
        targetCarbs: day.targetCarbs,
        targetFat: day.targetFat,
        totalCalories: totals.cal,
        totalProtein: totals.prot,
        totalCarbs: totals.carb,
        totalFat: totals.fat,
        meals: day.meals.map(food => ({
          mealNumber: food.mealNumber,
          foodName: food.foodName,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          servingGrams: 100,
          timestamp: food.timestamp,
        })),
        supplementsTaken: day.supplementsChecked?.filter(s => s.taken).length ?? 0,
        supplementsTotal: day.supplementsChecked?.length ?? 0,
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

    syncStreak({
      currentStreak: data.currentStreak,
      bestStreak: data.bestStreak,
      lastWorkoutDate: data.lastWorkoutDate ?? new Date().toLocaleDateString('en-CA'),
      totalWorkouts: data.workoutDates.length,
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
      syncFormCoachSession({
        sessionId: session.id,
        exerciseName: session.exerciseName,
        date: session.date,
        totalReps: session.reps,
        avgFormScore: session.formScore,
        peakFormScore: session.formScore,
        lowFormScore: session.formScore,
        durationSeconds: session.durationSeconds ?? 0,
        repScores: [],
        feedback: session.topIssues ?? [],
      });
    }
    console.log(`[Migration] Migrated ${sessions.length} form coach sessions.`);
  } catch (err) {
    console.warn('[Migration] Form coach migration failed:', err);
  }
}
