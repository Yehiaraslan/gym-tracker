// ============================================================
// DB SYNC — Client-side helpers that mirror AsyncStorage writes
// to the cloud database via tRPC.
//
// Strategy:
//   • AsyncStorage remains the primary local store (fast, offline-first)
//   • Every write also fires a background tRPC mutation to persist to MySQL
//   • On first launch after upgrade, a one-time migration uploads all
//     existing local data to the DB
//   • Errors are silently swallowed so DB issues never break the UX
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from './trpc';

const MIGRATION_KEY = 'db_sync_migrated_v1';

// ════════════════════════════════════════════════════════════
// WORKOUT SYNC
// ════════════════════════════════════════════════════════════

/**
 * Sync a single completed workout session to the cloud DB.
 * Call this after every workout save in split-workout-store.ts.
 */
export async function syncWorkoutSession(
  session: any,
  syncMutation: (data: any) => Promise<any>,
): Promise<void> {
  try {
    await syncMutation({ session });
  } catch (err) {
    // Silently fail — local data is safe in AsyncStorage
    console.warn('[DB Sync] Failed to sync workout session:', err);
  }
}

/**
 * Sync a form coach session to the cloud DB.
 */
export async function syncFormCoachSession(
  session: any,
  syncMutation: (data: any) => Promise<any>,
): Promise<void> {
  try {
    await syncMutation({ session });
  } catch (err) {
    console.warn('[DB Sync] Failed to sync form coach session:', err);
  }
}

/**
 * Sync a nutrition day to the cloud DB.
 */
export async function syncNutritionDay(
  day: any,
  syncMutation: (data: any) => Promise<any>,
): Promise<void> {
  try {
    await syncMutation({ day });
  } catch (err) {
    console.warn('[DB Sync] Failed to sync nutrition day:', err);
  }
}

/**
 * Sync a body weight entry to the cloud DB.
 */
export async function syncBodyWeightEntry(
  entry: any,
  syncMutation: (data: any) => Promise<any>,
): Promise<void> {
  try {
    await syncMutation({ entry });
  } catch (err) {
    console.warn('[DB Sync] Failed to sync body weight entry:', err);
  }
}

/**
 * Sync streak data to the cloud DB.
 */
export async function syncStreak(
  streak: any,
  syncMutation: (data: any) => Promise<any>,
): Promise<void> {
  try {
    await syncMutation({ streak });
  } catch (err) {
    console.warn('[DB Sync] Failed to sync streak:', err);
  }
}

// ════════════════════════════════════════════════════════════
// ONE-TIME MIGRATION
// ════════════════════════════════════════════════════════════

/**
 * Check if the one-time migration has already been run.
 */
export async function hasMigrated(): Promise<boolean> {
  const val = await AsyncStorage.getItem(MIGRATION_KEY);
  return val === 'true';
}

/**
 * Mark the migration as complete so it doesn't run again.
 */
export async function markMigrated(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_KEY, 'true');
}

/**
 * Run the one-time migration: upload all existing AsyncStorage data to the DB.
 * This is called once on first app launch after the DB sync feature is added.
 *
 * @param trpcUtils - tRPC utils object from useTRPC() for calling mutations
 */
export async function runInitialMigration(trpcUtils: {
  bulkUpsertWorkouts: (data: { sessions: any[] }) => Promise<any>;
  bulkUpsertFormCoach: (data: { sessions: any[] }) => Promise<any>;
  bulkUpsertNutrition: (data: { days: any[] }) => Promise<any>;
  bulkUpsertBodyWeight: (data: { entries: any[] }) => Promise<any>;
  upsertStreak: (data: { streak: any }) => Promise<any>;
}): Promise<{ workouts: number; nutrition: number; formCoach: number; bodyWeight: number }> {
  const results = { workouts: 0, nutrition: 0, formCoach: 0, bodyWeight: 0 };

  try {
    // 1. Migrate workout sessions
    const workoutRaw = await AsyncStorage.getItem('split_workout_sessions');
    if (workoutRaw) {
      const sessions = JSON.parse(workoutRaw);
      const sessionArray = Array.isArray(sessions) ? sessions : Object.values(sessions);
      if (sessionArray.length > 0) {
        // Transform to server format
        const syncSessions = sessionArray.map((s: any) => ({
          id: s.id || `migrated_${s.date}_${s.sessionType}`,
          date: s.date,
          sessionType: s.sessionType || s.type || 'unknown',
          startTime: s.startTime || s.date,
          endTime: s.endTime,
          completed: s.completed ?? true,
          durationMinutes: s.durationMinutes,
          totalVolumeKg: s.totalVolumeKg,
          exercises: (s.exercises || []).map((ex: any, exIdx: number) => ({
            exerciseName: ex.exerciseName || ex.name,
            exerciseOrder: exIdx,
            skipped: ex.skipped ?? false,
            skipReason: ex.skipReason,
            sets: (ex.sets || ex.completedSets || []).map((set: any, setIdx: number) => ({
              setNumber: set.setNumber ?? setIdx + 1,
              weightKg: parseFloat(set.weightKg ?? set.weight ?? 0),
              reps: parseInt(set.reps ?? 0, 10),
              rpe: set.rpe,
              isWarmup: set.isWarmup ?? false,
              e1rm: set.e1rm ?? set.e1RM,
              timestamp: set.timestamp,
            })),
          })),
        }));
        const res = await trpcUtils.bulkUpsertWorkouts({ sessions: syncSessions });
        results.workouts = res?.count ?? syncSessions.length;
      }
    }
  } catch (err) {
    console.warn('[DB Migration] Workout migration failed:', err);
  }

  try {
    // 2. Migrate form coach sessions
    const formRaw = await AsyncStorage.getItem('form_coach_sessions');
    if (formRaw) {
      const sessions = JSON.parse(formRaw);
      const sessionArray = Array.isArray(sessions) ? sessions : Object.values(sessions);
      if (sessionArray.length > 0) {
        const syncSessions = sessionArray.map((s: any) => ({
          id: s.id || `migrated_form_${s.date}_${s.exerciseName}`,
          exerciseName: s.exerciseName,
          date: s.date,
          totalReps: s.totalReps ?? 0,
          avgFormScore: s.avgFormScore,
          peakFormScore: s.peakFormScore,
          issues: s.issues,
          durationSeconds: s.durationSeconds,
        }));
        const res = await trpcUtils.bulkUpsertFormCoach({ sessions: syncSessions });
        results.formCoach = res?.count ?? syncSessions.length;
      }
    }
  } catch (err) {
    console.warn('[DB Migration] Form coach migration failed:', err);
  }

  try {
    // 3. Migrate nutrition days
    const nutritionRaw = await AsyncStorage.getItem('nutrition_log');
    if (nutritionRaw) {
      const nutritionData = JSON.parse(nutritionRaw);
      // nutritionData is typically { [date]: DailyNutrition }
      const days = Object.entries(nutritionData).map(([date, day]: [string, any]) => ({
        date,
        isTrainingDay: day.isTrainingDay ?? true,
        targetCalories: day.targetCalories,
        targetProtein: day.targetProtein,
        targetCarbs: day.targetCarbs,
        targetFat: day.targetFat,
        supplements: day.supplements,
        meals: (day.meals || []).flatMap((meal: any, mealIdx: number) =>
          (meal.foods || meal.items || []).map((food: any) => ({
            id: food.id || `migrated_food_${date}_${mealIdx}_${food.name}`,
            mealNumber: mealIdx + 1,
            foodName: food.name || food.foodName,
            protein: parseFloat(food.protein ?? 0),
            carbs: parseFloat(food.carbs ?? 0),
            fat: parseFloat(food.fat ?? 0),
            calories: parseInt(food.calories ?? 0, 10),
            servingGrams: food.servingGrams ?? food.grams,
            timestamp: food.timestamp,
          })),
        ),
      }));
      if (days.length > 0) {
        const res = await trpcUtils.bulkUpsertNutrition({ days });
        results.nutrition = res?.count ?? days.length;
      }
    }
  } catch (err) {
    console.warn('[DB Migration] Nutrition migration failed:', err);
  }

  try {
    // 4. Migrate body weight entries
    const bodyRaw = await AsyncStorage.getItem('body_weight_entries');
    if (bodyRaw) {
      const entries = JSON.parse(bodyRaw);
      const entryArray = Array.isArray(entries) ? entries : Object.values(entries);
      if (entryArray.length > 0) {
        const syncEntries = entryArray.map((e: any) => ({
          id: e.id || `migrated_bw_${e.date}`,
          date: e.date,
          weightKg: e.weightKg ?? e.weight,
          bodyFatPercent: e.bodyFatPercent,
          chestCm: e.chestCm,
          waistCm: e.waistCm,
          hipsCm: e.hipsCm,
          armsCm: e.armsCm,
          thighsCm: e.thighsCm,
          notes: e.notes,
        }));
        const res = await trpcUtils.bulkUpsertBodyWeight({ entries: syncEntries });
        results.bodyWeight = res?.count ?? syncEntries.length;
      }
    }
  } catch (err) {
    console.warn('[DB Migration] Body weight migration failed:', err);
  }

  try {
    // 5. Migrate streak data
    const streakRaw = await AsyncStorage.getItem('workout_streak');
    if (streakRaw) {
      const streak = JSON.parse(streakRaw);
      await trpcUtils.upsertStreak({
        streak: {
          currentStreak: streak.currentStreak ?? 0,
          bestStreak: streak.bestStreak ?? 0,
          lastWorkoutDate: streak.lastWorkoutDate ?? null,
          workoutDates: streak.workoutDates ?? [],
        },
      });
    }
  } catch (err) {
    console.warn('[DB Migration] Streak migration failed:', err);
  }

  return results;
}
