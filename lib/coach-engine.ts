// ============================================================
// COACH ENGINE — Weekly analysis, stall detection, insights
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { epley1RM } from './fitness-utils';
import type { WorkoutLog, BodyMeasurement } from './types';

// ---- Types ----

export type RecommendationType = 'nutrition' | 'training' | 'recovery' | 'overload';
export type Priority = 'high' | 'medium' | 'low';

export interface CoachRecommendation {
  id: string;
  date: string;
  type: RecommendationType;
  message: string;
  actionable: string;
  priority: Priority;
  dismissed: boolean;
}

export interface SleepEntry {
  date: string;
  bedtime: string;
  wakeTime: string;
  durationHours: number;
  qualityRating: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
  notes?: string;
}

// ---- Storage keys ----

const SLEEP_KEY = '@gym_tracker_sleep';
const WEIGHT_KEY = '@gym_tracker_weight';
const RECS_KEY = '@gym_tracker_recommendations';
const MESO_KEY = '@gym_tracker_mesocycle_start';

// ---- Sleep tracking ----

export async function saveSleepEntry(entry: SleepEntry): Promise<void> {
  const entries = await getSleepEntries();
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  await AsyncStorage.setItem(SLEEP_KEY, JSON.stringify(entries));
}

export async function getSleepEntries(): Promise<SleepEntry[]> {
  const data = await AsyncStorage.getItem(SLEEP_KEY);
  if (!data) return [];
  return (JSON.parse(data) as SleepEntry[]).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getRecentSleep(days = 7): Promise<SleepEntry[]> {
  const all = await getSleepEntries();
  return all.slice(0, days);
}

// ---- Weight tracking ----

export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  const entries = await getWeightEntries();
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(entries));
}

export async function getWeightEntries(): Promise<WeightEntry[]> {
  const data = await AsyncStorage.getItem(WEIGHT_KEY);
  if (!data) return [];
  return (JSON.parse(data) as WeightEntry[]).sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Mesocycle ----

export async function getMesocycleStartDate(): Promise<string> {
  const data = await AsyncStorage.getItem(MESO_KEY);
  if (data) return data;
  const today = new Date().toISOString().split('T')[0];
  await AsyncStorage.setItem(MESO_KEY, today);
  return today;
}

export async function resetMesocycle(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  await AsyncStorage.setItem(MESO_KEY, today);
  return today;
}

// ---- Recommendations ----

export async function saveRecommendation(rec: CoachRecommendation): Promise<void> {
  const recs = await getRecommendations();
  recs.push(rec);
  await AsyncStorage.setItem(RECS_KEY, JSON.stringify(recs));
}

export async function getRecommendations(): Promise<CoachRecommendation[]> {
  const data = await AsyncStorage.getItem(RECS_KEY);
  if (!data) return [];
  return JSON.parse(data) as CoachRecommendation[];
}

export async function getActiveRecommendations(): Promise<CoachRecommendation[]> {
  const all = await getRecommendations();
  return all.filter(r => !r.dismissed).sort((a, b) => b.date.localeCompare(a.date));
}

export async function dismissRecommendation(id: string): Promise<void> {
  const recs = await getRecommendations();
  const updated = recs.map(r => r.id === id ? { ...r, dismissed: true } : r);
  await AsyncStorage.setItem(RECS_KEY, JSON.stringify(updated));
}

// ---- Helpers ----

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function makeRec(type: RecommendationType, message: string, actionable: string, priority: Priority): CoachRecommendation {
  return {
    id: makeId(),
    date: new Date().toISOString().split('T')[0],
    type,
    message,
    actionable,
    priority,
    dismissed: false,
  };
}

// ---- Analysis functions ----

export function analyzeWeightTrend(entries: WeightEntry[]): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];
  if (entries.length < 14) return recs;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-30);

  if (recent.length >= 28) {
    const gain = recent[recent.length - 1].weightKg - recent[0].weightKg;
    if (gain > 1.0) {
      recs.push(makeRec(
        'nutrition',
        `Gaining too fast: +${gain.toFixed(1)}kg this month`,
        'Reduce carbs by 30g on rest days',
        'high',
      ));
    } else if (gain < 0.25) {
      recs.push(makeRec(
        'nutrition',
        `Weight stalling: only +${gain.toFixed(1)}kg this month`,
        'Add 25g carbs to training days',
        'medium',
      ));
    }
  }

  return recs;
}

export function analyzeSleepTrend(entries: SleepEntry[]): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];
  if (entries.length < 5) return recs;

  const recent = entries.slice(0, 7);
  const avgDuration = recent.reduce((sum, e) => sum + e.durationHours, 0) / recent.length;

  if (avgDuration < 7) {
    recs.push(makeRec(
      'recovery',
      `Sleep avg: ${avgDuration.toFixed(1)}h (below 7h target)`,
      'Priority: fix sleep before adding volume.',
      'high',
    ));
  }

  return recs;
}

export function analyzeStrengthStall(workouts: WorkoutLog[]): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];

  // Group completed workouts by day
  const byDay: Record<number, WorkoutLog[]> = {};
  workouts.filter(w => w.isCompleted).forEach(w => {
    if (!byDay[w.dayNumber]) byDay[w.dayNumber] = [];
    byDay[w.dayNumber].push(w);
  });

  Object.values(byDay).forEach(sessions => {
    const recent = sessions.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 4);
    if (recent.length < 4) return;

    // Check each exercise for 1RM stall
    const exercise1RMs: Record<string, number[]> = {};
    recent.forEach(session => {
      session.exercises.forEach(ex => {
        if (!exercise1RMs[ex.exerciseName]) exercise1RMs[ex.exerciseName] = [];
        const best = ex.sets.filter(s => s.weight > 0 && s.reps > 0)
          .reduce((b, s) => Math.max(b, epley1RM(s.weight, s.reps)), 0);
        if (best > 0) exercise1RMs[ex.exerciseName].push(best);
      });
    });

    Object.entries(exercise1RMs).forEach(([name, e1rms]) => {
      if (e1rms.length >= 4) {
        const improvement = ((e1rms[0] - e1rms[e1rms.length - 1]) / e1rms[e1rms.length - 1]) * 100;
        if (improvement < 1) {
          recs.push(makeRec(
            'training',
            `${name} stalled at ~${Math.round(e1rms[0])}kg 1RM for ${e1rms.length} sessions`,
            'Check sleep first. If fine, add 100 cal to training days.',
            'medium',
          ));
        }
      }
    });
  });

  return recs;
}

export function checkDeloadApproaching(currentWeek: number): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];
  if (currentWeek === 4) {
    recs.push(makeRec('training', 'Deload week approaching (next week)', 'Next week: 50% volume, 70% weight. Focus on recovery.', 'medium'));
  }
  if (currentWeek === 5) {
    recs.push(makeRec('training', 'This is your deload week', 'Reduce all sets by 50% and use 70% of normal working weights.', 'high'));
  }
  return recs;
}

/**
 * Check if progressive overload was achieved on an exercise.
 * Returns a recommendation if all sets hit top of rep range.
 */
export function checkProgressiveOverload(
  exerciseName: string,
  sets: { weight: number; reps: number }[],
  repsMax: number,
  muscleGroup: 'upper' | 'lower',
): CoachRecommendation | null {
  if (sets.length === 0) return null;
  const allHitTop = sets.every(s => s.reps >= repsMax);
  if (!allHitTop) return null;

  const increment = muscleGroup === 'upper' ? 2.5 : 5;
  const currentWeight = sets[0].weight;

  return makeRec(
    'overload',
    `${exerciseName}: Hit top of rep range on all sets! 🎯`,
    `Increase weight to ${currentWeight + increment}kg next session (+${increment}kg)`,
    'medium',
  );
}

/**
 * Run full weekly analysis. Call periodically (e.g., on app open).
 */
export async function runWeeklyAnalysis(
  workouts: WorkoutLog[],
  currentWeek: number,
): Promise<CoachRecommendation[]> {
  const [weightEntries, sleepEntries] = await Promise.all([
    getWeightEntries(),
    getSleepEntries(),
  ]);

  const allRecs: CoachRecommendation[] = [
    ...analyzeWeightTrend(weightEntries),
    ...analyzeSleepTrend(sleepEntries),
    ...analyzeStrengthStall(workouts),
    ...checkDeloadApproaching(currentWeek),
  ];

  // Only save new recs (check by message to avoid duplicates)
  const existing = await getActiveRecommendations();
  const existingMessages = new Set(existing.map(r => r.message));
  for (const rec of allRecs) {
    if (!existingMessages.has(rec.message)) {
      await saveRecommendation(rec);
    }
  }

  return allRecs;
}

// ---- Sleep duration helper ----

export function getSleepDuration(bedtime: string, wakeTime: string): number {
  const [bedH, bedM] = bedtime.split(':').map(Number);
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  let bedMinutes = bedH * 60 + bedM;
  let wakeMinutes = wakeH * 60 + wakeM;
  if (wakeMinutes < bedMinutes) wakeMinutes += 24 * 60;
  return (wakeMinutes - bedMinutes) / 60;
}
