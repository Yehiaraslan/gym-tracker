// ============================================================
// DATA SYNC SERVICE — Server-side handlers for all user data domains
// Workouts, Nutrition, Sleep, Body Weight, Streaks, Form Coach
// ============================================================
import { getDb } from './db';
import {
  workoutSessions,
  workoutExerciseLogs,
  workoutSetLogs,
  formCoachSessions,
  nutritionDays,
  foodEntries,
  bodyWeightEntries,
  sleepEntries,
  workoutStreaks,
  personalRecords,
  scheduleOverrides,
} from '../drizzle/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

// ════════════════════════════════════════════════════════════
// WORKOUT SESSIONS
// ════════════════════════════════════════════════════════════

export interface SyncSetLog {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  isWarmup?: boolean;
  e1rm?: number;
  timestamp?: string;
}

export interface SyncExerciseLog {
  exerciseName: string;
  exerciseOrder: number;
  skipped: boolean;
  skipReason?: string;
  sets: SyncSetLog[];
}

export interface SyncWorkoutSession {
  id: string;
  date: string;
  sessionType: string;
  startTime: string;
  endTime?: string;
  completed: boolean;
  durationMinutes?: number;
  totalVolumeKg?: number;
  exercises: SyncExerciseLog[];
}

export async function upsertWorkoutSession(userOpenId: string, session: SyncWorkoutSession): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Upsert the session row
  await db.insert(workoutSessions).values({
    id: session.id,
    userOpenId,
    date: session.date,
    sessionType: session.sessionType,
    startTime: session.startTime,
    endTime: session.endTime,
    completed: session.completed,
    durationMinutes: session.durationMinutes,
    totalVolumeKg: session.totalVolumeKg?.toString(),
  }).onDuplicateKeyUpdate({
    set: {
      endTime: session.endTime,
      completed: session.completed,
      durationMinutes: session.durationMinutes,
      totalVolumeKg: session.totalVolumeKg?.toString(),
    },
  });

  // For each exercise, upsert the exercise log and its sets
  for (const ex of (session.exercises ?? [])) {
    // Check if exercise log already exists
    const existing = await db.select({ id: workoutExerciseLogs.id })
      .from(workoutExerciseLogs)
      .where(and(
        eq(workoutExerciseLogs.sessionId, session.id),
        eq(workoutExerciseLogs.exerciseName, ex.exerciseName),
      ))
      .limit(1);

    let exerciseLogId: number;

    if (existing.length > 0) {
      exerciseLogId = existing[0].id;
      // Update skipped status
      await db.update(workoutExerciseLogs)
        .set({ skipped: ex.skipped, skipReason: ex.skipReason })
        .where(eq(workoutExerciseLogs.id, exerciseLogId));
    } else {
      const [inserted] = await db.insert(workoutExerciseLogs).values({
        sessionId: session.id,
        userOpenId,
        exerciseName: ex.exerciseName,
        exerciseOrder: ex.exerciseOrder,
        skipped: ex.skipped,
        skipReason: ex.skipReason,
      });
      exerciseLogId = (inserted as any).insertId;
    }

    // Delete and re-insert sets (simpler than per-set upsert)
    if ((ex.sets ?? []).length > 0) {
      await db.delete(workoutSetLogs)
        .where(eq(workoutSetLogs.exerciseLogId, exerciseLogId));

      await db.insert(workoutSetLogs).values(
        (ex.sets ?? []).map(s => ({
          exerciseLogId,
          sessionId: session.id,
          userOpenId,
          setNumber: s.setNumber,
          weightKg: s.weightKg.toString(),
          reps: s.reps,
          rpe: s.rpe,
          isWarmup: s.isWarmup ?? false,
          e1rm: s.e1rm?.toString(),
          setTimestamp: s.timestamp,
        })),
      );
    }
  }
}

export async function getWorkoutSessions(userOpenId: string, limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userOpenId, userOpenId))
    .orderBy(desc(workoutSessions.date))
    .limit(limit);

  // Fetch exercises and sets for each session
  const result = [];
  for (const session of sessions) {
    const exercises = await db.select()
      .from(workoutExerciseLogs)
      .where(eq(workoutExerciseLogs.sessionId, session.id))
      .orderBy(workoutExerciseLogs.exerciseOrder);

    const exercisesWithSets = await Promise.all(
      exercises.map(async (ex: typeof workoutExerciseLogs.$inferSelect) => {
        const sets = await db.select()
          .from(workoutSetLogs)
          .where(eq(workoutSetLogs.exerciseLogId, ex.id))
          .orderBy(workoutSetLogs.setNumber);
        return { ...ex, sets };
      }),
    );

    result.push({ ...session, exercises: exercisesWithSets });
  }
  return result;
}

export async function bulkUpsertWorkoutSessions(userOpenId: string, sessions: SyncWorkoutSession[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  let count = 0;
  for (const session of sessions) {
    await upsertWorkoutSession(userOpenId, session);
    count++;
  }
  return count;
}

// ════════════════════════════════════════════════════════════
// FORM COACH SESSIONS
// ════════════════════════════════════════════════════════════

export interface SyncFormCoachSession {
  id: string;
  exerciseName: string;
  date: string;
  totalReps: number;
  avgFormScore?: number;
  peakFormScore?: number;
  issues?: string[];
  durationSeconds?: number;
}

export async function upsertFormCoachSession(userOpenId: string, session: SyncFormCoachSession): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(formCoachSessions).values({
    id: session.id,
    userOpenId,
    exerciseName: session.exerciseName,
    date: session.date,
    totalReps: session.totalReps,
    avgFormScore: session.avgFormScore?.toString(),
    peakFormScore: session.peakFormScore?.toString(),
    issuesJson: session.issues ? JSON.stringify(session.issues) : null,
    durationSeconds: session.durationSeconds,
  }).onDuplicateKeyUpdate({
    set: {
      totalReps: session.totalReps,
      avgFormScore: session.avgFormScore?.toString(),
      peakFormScore: session.peakFormScore?.toString(),
      issuesJson: session.issues ? JSON.stringify(session.issues) : null,
      durationSeconds: session.durationSeconds,
    },
  });
}

export async function getFormCoachSessions(userOpenId: string, limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(formCoachSessions)
    .where(eq(formCoachSessions.userOpenId, userOpenId))
    .orderBy(desc(formCoachSessions.date))
    .limit(limit);
}

// ════════════════════════════════════════════════════════════
// NUTRITION
// ════════════════════════════════════════════════════════════

export interface SyncFoodEntry {
  id: string;
  mealNumber: number;
  foodName: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  servingGrams?: number;
  timestamp?: string;
}

export interface SyncNutritionDay {
  date: string;
  isTrainingDay: boolean;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  supplements?: Array<{ name: string; dose: string; timing: string; taken: boolean }>;
  meals: SyncFoodEntry[];
}

export async function upsertNutritionDay(userOpenId: string, day: SyncNutritionDay): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Upsert the day summary
  const existing = await db.select({ id: nutritionDays.id })
    .from(nutritionDays)
    .where(and(eq(nutritionDays.userOpenId, userOpenId), eq(nutritionDays.date, day.date)))
    .limit(1);

  let dayId: number;

  if (existing.length > 0) {
    dayId = existing[0].id;
    await db.update(nutritionDays)
      .set({
        isTrainingDay: day.isTrainingDay,
        targetCalories: day.targetCalories,
        targetProtein: day.targetProtein,
        targetCarbs: day.targetCarbs,
        targetFat: day.targetFat,
        supplementsJson: day.supplements ? JSON.stringify(day.supplements) : null,
      })
      .where(eq(nutritionDays.id, dayId));
  } else {
    const [inserted] = await db.insert(nutritionDays).values({
      userOpenId,
      date: day.date,
      isTrainingDay: day.isTrainingDay,
      targetCalories: day.targetCalories,
      targetProtein: day.targetProtein,
      targetCarbs: day.targetCarbs,
      targetFat: day.targetFat,
      supplementsJson: day.supplements ? JSON.stringify(day.supplements) : null,
    });
    dayId = (inserted as any).insertId;
  }

  // Upsert food entries
  for (const entry of day.meals) {
    await db.insert(foodEntries).values({
      id: entry.id,
      nutritionDayId: dayId,
      userOpenId,
      date: day.date,
      mealNumber: entry.mealNumber,
      foodName: entry.foodName,
      protein: entry.protein.toString(),
      carbs: entry.carbs.toString(),
      fat: entry.fat.toString(),
      calories: entry.calories,
      servingGrams: entry.servingGrams,
      entryTimestamp: entry.timestamp,
    }).onDuplicateKeyUpdate({
      set: {
        mealNumber: entry.mealNumber,
        foodName: entry.foodName,
        protein: entry.protein.toString(),
        carbs: entry.carbs.toString(),
        fat: entry.fat.toString(),
        calories: entry.calories,
      },
    });
  }
}

export async function getNutritionDays(userOpenId: string, days = 30): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const dayRows = await db.select()
    .from(nutritionDays)
    .where(and(
      eq(nutritionDays.userOpenId, userOpenId),
      gte(nutritionDays.date, cutoffStr),
    ))
    .orderBy(desc(nutritionDays.date));

  const result = [];
  for (const day of dayRows) {
    const meals = await db.select()
      .from(foodEntries)
      .where(and(eq(foodEntries.nutritionDayId, day.id), eq(foodEntries.userOpenId, userOpenId)))
      .orderBy(foodEntries.mealNumber);
    result.push({ ...day, meals });
  }
  return result;
}

// ════════════════════════════════════════════════════════════
// BODY WEIGHT & MEASUREMENTS
// ════════════════════════════════════════════════════════════

export interface SyncBodyWeightEntry {
  id: string;
  date: string;
  weightKg?: number;
  bodyFatPercent?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  armsCm?: number;
  thighsCm?: number;
  notes?: string;
}

export async function upsertBodyWeightEntry(userOpenId: string, entry: SyncBodyWeightEntry): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(bodyWeightEntries).values({
    id: entry.id,
    userOpenId,
    date: entry.date,
    weightKg: entry.weightKg?.toString(),
    bodyFatPercent: entry.bodyFatPercent?.toString(),
    chestCm: entry.chestCm?.toString(),
    waistCm: entry.waistCm?.toString(),
    hipsCm: entry.hipsCm?.toString(),
    armsCm: entry.armsCm?.toString(),
    thighsCm: entry.thighsCm?.toString(),
    notes: entry.notes,
  }).onDuplicateKeyUpdate({
    set: {
      weightKg: entry.weightKg?.toString(),
      bodyFatPercent: entry.bodyFatPercent?.toString(),
      chestCm: entry.chestCm?.toString(),
      waistCm: entry.waistCm?.toString(),
      hipsCm: entry.hipsCm?.toString(),
      armsCm: entry.armsCm?.toString(),
      thighsCm: entry.thighsCm?.toString(),
      notes: entry.notes,
    },
  });
}

export async function getBodyWeightEntries(userOpenId: string, limit = 90): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(bodyWeightEntries)
    .where(eq(bodyWeightEntries.userOpenId, userOpenId))
    .orderBy(desc(bodyWeightEntries.date))
    .limit(limit);
}

// ════════════════════════════════════════════════════════════
// SLEEP
// ════════════════════════════════════════════════════════════

export interface SyncSleepEntry {
  id: string;
  date: string;
  bedtime?: string;
  wakeTime?: string;
  durationHours?: number;
  qualityRating?: number;
  notes?: string;
}

export async function upsertSleepEntry(userOpenId: string, entry: SyncSleepEntry): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(sleepEntries).values({
    id: entry.id,
    userOpenId,
    date: entry.date,
    bedtime: entry.bedtime,
    wakeTime: entry.wakeTime,
    durationHours: entry.durationHours?.toString(),
    qualityRating: entry.qualityRating,
    notes: entry.notes,
  }).onDuplicateKeyUpdate({
    set: {
      bedtime: entry.bedtime,
      wakeTime: entry.wakeTime,
      durationHours: entry.durationHours?.toString(),
      qualityRating: entry.qualityRating,
      notes: entry.notes,
    },
  });
}

export async function getSleepEntries(userOpenId: string, limit = 30): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(sleepEntries)
    .where(eq(sleepEntries.userOpenId, userOpenId))
    .orderBy(desc(sleepEntries.date))
    .limit(limit);
}

// ════════════════════════════════════════════════════════════
// STREAK
// ════════════════════════════════════════════════════════════

export interface SyncStreakData {
  currentStreak: number;
  bestStreak: number;
  lastWorkoutDate: string | null;
  workoutDates: string[];
}

export async function upsertStreak(userOpenId: string, data: SyncStreakData): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(workoutStreaks).values({
    userOpenId,
    currentStreak: data.currentStreak,
    bestStreak: data.bestStreak,
    lastWorkoutDate: data.lastWorkoutDate ?? undefined,
    workoutDatesJson: JSON.stringify(data.workoutDates),
  }).onDuplicateKeyUpdate({
    set: {
      currentStreak: data.currentStreak,
      bestStreak: data.bestStreak,
      lastWorkoutDate: data.lastWorkoutDate ?? undefined,
      workoutDatesJson: JSON.stringify(data.workoutDates),
    },
  });
}

export async function getStreak(userOpenId: string): Promise<SyncStreakData | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select()
    .from(workoutStreaks)
    .where(eq(workoutStreaks.userOpenId, userOpenId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    currentStreak: row.currentStreak,
    bestStreak: row.bestStreak,
    lastWorkoutDate: row.lastWorkoutDate ?? null,
    workoutDates: row.workoutDatesJson ? JSON.parse(row.workoutDatesJson) : [],
  };
}

// ════════════════════════════════════════════════════════════
// PERSONAL RECORDS
// ════════════════════════════════════════════════════════════

export interface SyncPersonalRecord {
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1rm?: number;
  sessionType?: string;
  date: string;
  sessionId?: string;
}

export async function upsertPersonalRecord(userOpenId: string, pr: SyncPersonalRecord): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Check if this is actually a new PR for this exercise
  const existing = await db.select()
    .from(personalRecords)
    .where(and(
      eq(personalRecords.userOpenId, userOpenId),
      eq(personalRecords.exerciseName, pr.exerciseName),
    ))
    .orderBy(desc(personalRecords.estimated1rm))
    .limit(1);

  const newE1rm = pr.estimated1rm ?? pr.weightKg;
  const existingE1rm = existing.length > 0 ? parseFloat(existing[0].estimated1rm ?? '0') : 0;

  if (newE1rm > existingE1rm) {
    await db.insert(personalRecords).values({
      userOpenId,
      exerciseName: pr.exerciseName,
      weightKg: pr.weightKg.toString(),
      reps: pr.reps,
      estimated1rm: pr.estimated1rm?.toString(),
      sessionType: pr.sessionType,
      date: pr.date,
      sessionId: pr.sessionId,
    });
  }
}

export async function getPersonalRecords(userOpenId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  // Get the best PR per exercise
  return db.select()
    .from(personalRecords)
    .where(eq(personalRecords.userOpenId, userOpenId))
    .orderBy(desc(personalRecords.estimated1rm));
}


// ════════════════════════════════════════════════════════════
// SCHEDULE OVERRIDES
// ════════════════════════════════════════════════════════════

export interface SyncScheduleOverride {
  scheduleJson: Record<string, string>;
  description?: string;
  appliedByZaki?: boolean;
  weightAdjustments?: string;
  appliedAt: string;
}

/**
 * Upsert the latest schedule override for a device.
 * Inserts a new row each time (history), so we can track evolution.
 */
export async function upsertScheduleOverride(
  deviceId: string,
  override: SyncScheduleOverride,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(scheduleOverrides).values({
    deviceId,
    scheduleJson: override.scheduleJson,
    description: override.description ?? null,
    appliedByZaki: override.appliedByZaki ?? false,
    weightAdjustments: override.weightAdjustments ?? null,
    appliedAt: new Date(override.appliedAt),
  });
}

/**
 * Get the latest schedule override for a device.
 */
export async function getLatestScheduleOverride(
  deviceId: string,
): Promise<SyncScheduleOverride | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select()
    .from(scheduleOverrides)
    .where(eq(scheduleOverrides.deviceId, deviceId))
    .orderBy(desc(scheduleOverrides.appliedAt))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    scheduleJson: row.scheduleJson as Record<string, string>,
    description: row.description ?? undefined,
    appliedByZaki: row.appliedByZaki,
    weightAdjustments: row.weightAdjustments ?? undefined,
    appliedAt: row.appliedAt.toISOString(),
  };
}
