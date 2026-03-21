// ============================================================
// SPLIT WORKOUT STORE — Dedicated storage for Upper/Lower program
// Keeps split workouts separate from the existing gym-tracker store
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionType, ProgramExercise } from './training-program';
import { PROGRAM_SESSIONS } from './training-program';
import { epley1RM, suggestWeight, calculateVolumeLoad } from './fitness-utils';

// ---- Types ----

export interface SplitSetLog {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number; // 6-10
  isWarmup?: boolean;
  timestamp: string;
}

export interface SplitExerciseLog {
  exerciseName: string;
  sets: SplitSetLog[];
  skipped: boolean;
  skipReason?: string;
}

export interface SplitWorkoutSession {
  id: string;
  date: string; // ISO date
  sessionType: SessionType;
  exercises: SplitExerciseLog[];
  startTime: string;
  endTime?: string;
  completed: boolean;
  durationMinutes?: number;
  totalVolume?: number;
}

// ---- Storage ----

const SPLIT_WORKOUTS_KEY = '@gym_tracker_split_workouts';

export async function getSplitWorkouts(): Promise<SplitWorkoutSession[]> {
  const data = await AsyncStorage.getItem(SPLIT_WORKOUTS_KEY);
  if (!data) return [];
  return JSON.parse(data) as SplitWorkoutSession[];
}

export async function saveSplitWorkout(workout: SplitWorkoutSession): Promise<void> {
  const workouts = await getSplitWorkouts();
  const idx = workouts.findIndex(w => w.id === workout.id);
  if (idx >= 0) workouts[idx] = workout;
  else workouts.push(workout);
  await AsyncStorage.setItem(SPLIT_WORKOUTS_KEY, JSON.stringify(workouts));
}

export async function getRecentSplitWorkouts(limit = 20): Promise<SplitWorkoutSession[]> {
  const all = await getSplitWorkouts();
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function getLastSessionOfType(sessionType: SessionType): Promise<SplitWorkoutSession | undefined> {
  const all = await getSplitWorkouts();
  return all
    .filter(w => w.sessionType === sessionType && w.completed)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/**
 * Get last N sessions of a specific type (for progression tracking).
 */
export async function getSessionHistory(sessionType: SessionType, limit = 5): Promise<SplitWorkoutSession[]> {
  const all = await getSplitWorkouts();
  return all
    .filter(w => w.sessionType === sessionType && w.completed)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * Count consecutive sessions where an exercise hit top of rep range.
 */
export async function getConsecutiveTopRange(
  sessionType: SessionType,
  exerciseName: string,
  repsMax: number,
): Promise<number> {
  const sessions = await getSessionHistory(sessionType, 10);
  let count = 0;

  for (const session of sessions) {
    const exLog = session.exercises.find(e => e.exerciseName === exerciseName);
    if (!exLog || exLog.skipped) break;

    const workingSets = exLog.sets.filter(s => !s.isWarmup);
    if (workingSets.length === 0) break;

    const allHitTop = workingSets.every(s => s.reps >= repsMax);
    if (allHitTop) count++;
    else break;
  }

  return count;
}

/**
 * Get smart weight suggestion for an exercise in the upcoming session.
 */
export async function getSmartWeightSuggestion(
  sessionType: SessionType,
  exercise: ProgramExercise,
  isDeload: boolean,
): Promise<{ weight: number; reason: string } | null> {
  const lastSession = await getLastSessionOfType(sessionType);
  if (!lastSession) return null;

  const lastExLog = lastSession.exercises.find(e => e.exerciseName === exercise.name);
  if (!lastExLog || lastExLog.skipped) return null;

  const workingSets = lastExLog.sets.filter(s => !s.isWarmup);
  if (workingSets.length === 0) return null;

  const lastWeight = workingSets[0].weightKg;
  const lastReps = workingSets[0].reps;
  const lastRPE = workingSets[workingSets.length - 1].rpe;
  const consecutiveTop = await getConsecutiveTopRange(sessionType, exercise.name, exercise.repsMax);

  return suggestWeight({
    lastWeight,
    lastReps,
    lastRPE,
    targetRepsMax: exercise.repsMax,
    muscleGroup: exercise.muscleGroup,
    isDeload,
    consecutiveTopRangeSessions: consecutiveTop,
  });
}

/**
 * Get all-time PR (best estimated 1RM) for an exercise.
 */
export async function getExercisePR(exerciseName: string): Promise<{ e1rm: number; weight: number; reps: number; date: string } | null> {
  const workouts = await getSplitWorkouts();
  let best: { e1rm: number; weight: number; reps: number; date: string } | null = null;

  for (const w of workouts) {
    if (!w.completed) continue;
    const exLog = w.exercises.find(e => e.exerciseName === exerciseName);
    if (!exLog) continue;

    for (const s of exLog.sets) {
      if (s.isWarmup || s.weightKg <= 0 || s.reps <= 0) continue;
      const e1rm = epley1RM(s.weightKg, s.reps);
      if (!best || e1rm > best.e1rm) {
        best = { e1rm, weight: s.weightKg, reps: s.reps, date: w.date };
      }
    }
  }

  return best;
}

/**
 * Get all PRs for every exercise in the program.
 */
export async function getAllPRs(): Promise<Record<string, { e1rm: number; weight: number; reps: number; date: string }>> {
  const workouts = await getSplitWorkouts();
  const prs: Record<string, { e1rm: number; weight: number; reps: number; date: string }> = {};

  for (const w of workouts) {
    if (!w.completed) continue;
    for (const exLog of w.exercises) {
      for (const s of exLog.sets) {
        if (s.isWarmup || s.weightKg <= 0 || s.reps <= 0) continue;
        const e1rm = epley1RM(s.weightKg, s.reps);
        const current = prs[exLog.exerciseName];
        if (!current || e1rm > current.e1rm) {
          prs[exLog.exerciseName] = { e1rm, weight: s.weightKg, reps: s.reps, date: w.date };
        }
      }
    }
  }

  return prs;
}

/**
 * Get 1RM history for an exercise over time.
 */
export async function get1RMHistory(exerciseName: string): Promise<{ date: string; e1rm: number }[]> {
  const workouts = await getSplitWorkouts();
  const history: { date: string; e1rm: number }[] = [];

  const sorted = workouts
    .filter(w => w.completed)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const w of sorted) {
    const exLog = w.exercises.find(e => e.exerciseName === exerciseName);
    if (!exLog) continue;

    const best = exLog.sets
      .filter(s => !s.isWarmup && s.weightKg > 0 && s.reps > 0)
      .reduce((b, s) => Math.max(b, epley1RM(s.weightKg, s.reps)), 0);

    if (best > 0) {
      history.push({ date: w.date, e1rm: best });
    }
  }

  return history;
}

/**
 * Get volume history for a session type over time.
 */
export async function getVolumeHistory(sessionType: SessionType): Promise<{ date: string; volume: number }[]> {
  const workouts = await getSplitWorkouts();
  return workouts
    .filter(w => w.completed && w.sessionType === sessionType)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({
      date: w.date,
      volume: w.totalVolume || w.exercises.reduce((total, ex) =>
        total + calculateVolumeLoad(ex.sets.filter(s => !s.isWarmup).map(s => ({ weight: s.weightKg, reps: s.reps }))), 0),
    }));
}
