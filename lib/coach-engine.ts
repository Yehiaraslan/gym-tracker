// ============================================================
// Coach Engine — Rule-based fitness coaching
// Adapted from hypertrophy-tracker
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GymStore,
  CoachRecommendation,
  generateId,
  WeightEntry,
  SleepEntry,
  PersonalRecord,
} from './types';

// Re-export types needed by branch files
export type { CoachRecommendation, SleepEntry, WeightEntry };

// Epley 1RM formula
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Analyze weight trend over last 7 entries
function analyzeWeightTrend(entries: WeightEntry[]): CoachRecommendation | null {
  if (entries.length < 3) return null;
  
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent = sorted.slice(0, 7);
  
  if (recent.length < 3) return null;
  
  const avgRecent = recent.slice(0, 3).reduce((s, e) => s + (e.weight || 0), 0) / 3;
  const avgOlder = recent.slice(-3).reduce((s, e) => s + (e.weight || 0), 0) / 3;
  const diff = avgRecent - avgOlder;
  
  if (diff > 0.5) {
    return {
      id: generateId(),
      date: new Date().toLocaleDateString('en-CA'),
      type: 'nutrition',
      message: `Weight trending up (+${diff.toFixed(1)} kg). If this is unintended, consider reducing daily calories by 200-300.`,
      actionable: 'Review your calorie intake and adjust portions.',
      priority: 'medium',
      dismissed: false,
    };
  }
  
  if (diff < -0.5) {
    return {
      id: generateId(),
      date: new Date().toLocaleDateString('en-CA'),
      type: 'nutrition',
      message: `Weight trending down (${diff.toFixed(1)} kg). If bulking, increase daily calories by 200-300.`,
      actionable: 'Add an extra meal or increase portion sizes.',
      priority: 'medium',
      dismissed: false,
    };
  }
  
  return null;
}

// Analyze sleep quality
function analyzeSleep(entries: SleepEntry[]): CoachRecommendation | null {
  if (entries.length < 3) return null;
  
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent = sorted.slice(0, 7);
  
  const avgDuration = recent.reduce((s, e) => s + e.durationHours, 0) / recent.length;
  const avgQuality = recent.reduce((s, e) => s + e.qualityRating, 0) / recent.length;
  
  if (avgDuration < 7) {
    return {
      id: generateId(),
      date: new Date().toLocaleDateString('en-CA'),
      type: 'recovery',
      message: `Average sleep is ${avgDuration.toFixed(1)}h — below the 7-8h target. Sleep debt impairs muscle recovery and strength gains.`,
      actionable: 'Set a consistent bedtime alarm 8 hours before your wake time.',
      priority: 'high',
      dismissed: false,
    };
  }
  
  if (avgQuality < 3) {
    return {
      id: generateId(),
      date: new Date().toLocaleDateString('en-CA'),
      type: 'recovery',
      message: `Sleep quality averaging ${avgQuality.toFixed(1)}/5. Poor sleep quality reduces testosterone and growth hormone.`,
      actionable: 'Avoid screens 1h before bed. Keep room cool and dark.',
      priority: 'medium',
      dismissed: false,
    };
  }
  
  return null;
}

// Detect strength stalls
function detectStrengthStalls(store: GymStore): CoachRecommendation | null {
  const completedLogs = store.workoutLogs.filter(l => l.isCompleted);
  if (completedLogs.length < 6) return null;
  
  const sorted = [...completedLogs].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const recentLogs = sorted.slice(0, 6);
  
  // Check if any exercise has stalled (same weight for 3+ sessions)
  const exerciseWeights: Record<string, number[]> = {};
  
  for (const log of recentLogs) {
    for (const ex of (log.exercises ?? [])) {
      if (!exerciseWeights[ex.exerciseName]) {
        exerciseWeights[ex.exerciseName] = [];
      }
      const maxWeight = ex.sets.reduce((max, s) => Math.max(max, s.weight), 0);
      if (maxWeight > 0) {
        exerciseWeights[ex.exerciseName].push(maxWeight);
      }
    }
  }
  
  for (const [name, weights] of Object.entries(exerciseWeights)) {
    if (weights.length >= 3) {
      const last3 = weights.slice(0, 3);
      const allSame = last3.every(w => w === last3[0]);
      if (allSame) {
        return {
          id: generateId(),
          date: new Date().toLocaleDateString('en-CA'),
          type: 'training',
          message: `${name} has stalled at ${last3[0]} kg for 3 sessions. Time to apply progressive overload.`,
          actionable: 'Try adding 2.5 kg, or increase reps by 1-2 before adding weight.',
          priority: 'medium',
          dismissed: false,
        };
      }
    }
  }
  
  return null;
}

// Check if deload is needed
function checkDeloadNeeded(store: GymStore): CoachRecommendation | null {
  if (store.mesocycle.currentWeek >= 5 && !store.mesocycle.isDeload) {
    return {
      id: generateId(),
      date: new Date().toLocaleDateString('en-CA'),
      type: 'recovery',
      message: 'Week 5 of mesocycle — time for a deload week. Reduce volume by 40-50% to allow recovery.',
      actionable: 'Use 60% of normal working weights. Keep sets at 2 instead of 3-4.',
      priority: 'high',
      dismissed: false,
    };
  }
  return null;
}

// Check protein intake
function checkProteinIntake(store: GymStore): CoachRecommendation | null {
  const today = new Date().toLocaleDateString('en-CA');
  const recentLogs = store.nutritionLogs
    .filter(l => {
      const diff = Math.abs(new Date(today).getTime() - new Date(l.date).getTime());
      return diff < 7 * 24 * 60 * 60 * 1000;
    });
  
  if (recentLogs.length < 3) return null;
  
  const avgProtein = recentLogs.reduce((s, l) => {
    const totalProtein = l.meals.reduce((ms, m) => ms + m.protein, 0);
    return s + totalProtein;
  }, 0) / recentLogs.length;
  
  // Assuming 80kg bodyweight target of 1.6g/kg = 128g
  if (avgProtein < 120) {
    return {
      id: generateId(),
      date: today,
      type: 'nutrition',
      message: `Average protein intake is ${Math.round(avgProtein)}g/day — below the recommended 1.6-2.2g/kg for muscle growth.`,
      actionable: 'Add a protein shake or extra chicken breast to hit your target.',
      priority: 'high',
      dismissed: false,
    };
  }
  
  return null;
}

// ---- AsyncStorage-based helpers (used by split-workout, weekly-report, etc.) ----

const RECS_KEY = '@gym_tracker_recommendations';
const MESO_KEY = '@gym_tracker_mesocycle_start';
const SLEEP_KEY_CE = '@gym_tracker_sleep';
const WEIGHT_KEY_CE = '@gym_tracker_weight';

export async function getMesocycleStartDate(): Promise<string> {
  const data = await AsyncStorage.getItem(MESO_KEY);
  if (data) return data;
  const today = new Date().toLocaleDateString('en-CA');
  await AsyncStorage.setItem(MESO_KEY, today);
  return today;
}

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

export async function getRecentSleep(days = 7): Promise<SleepEntry[]> {
  const data = await AsyncStorage.getItem(SLEEP_KEY_CE);
  if (!data) return [];
  const all = (JSON.parse(data) as SleepEntry[]).sort((a, b) => b.date.localeCompare(a.date));
  return all.slice(0, days);
}

export async function getWeightEntries(): Promise<WeightEntry[]> {
  const data = await AsyncStorage.getItem(WEIGHT_KEY_CE);
  if (!data) return [];
  return (JSON.parse(data) as WeightEntry[]).sort((a, b) => a.date.localeCompare(b.date));
}

export function checkProgressiveOverload(
  exerciseName: string,
  sets: { weight: number; reps: number }[],
  repsMax: number,
  muscleGroup: 'upper' | 'lower' | 'core',
): CoachRecommendation | null {
  if (sets.length === 0) return null;
  const allHitTop = sets.every(s => s.reps >= repsMax);
  if (!allHitTop) return null;

  const increment = muscleGroup === 'upper' ? 2.5 : 5;
  const currentWeight = sets[0].weight;

  return {
    id: generateId(),
    date: new Date().toLocaleDateString('en-CA'),
    type: 'overload',
    message: `${exerciseName}: Hit top of rep range on all sets!`,
    actionable: `Increase weight to ${currentWeight + increment}kg next session (+${increment}kg)`,
    priority: 'medium',
    dismissed: false,
  };
}

export function getSleepDuration(bedtime: string, wakeTime: string): number {
  const [bedH, bedM] = bedtime.split(':').map(Number);
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  let bedMinutes = bedH * 60 + bedM;
  let wakeMinutes = wakeH * 60 + wakeM;
  if (wakeMinutes < bedMinutes) wakeMinutes += 24 * 60;
  return (wakeMinutes - bedMinutes) / 60;
}

// Main coach engine — runs all analyses
export function runCoachEngine(store: GymStore): CoachRecommendation[] {
  const recommendations: CoachRecommendation[] = [];
  
  const weightRec = analyzeWeightTrend(store.weightEntries);
  if (weightRec) recommendations.push(weightRec);
  
  const sleepRec = analyzeSleep(store.sleepEntries);
  if (sleepRec) recommendations.push(sleepRec);
  
  const stallRec = detectStrengthStalls(store);
  if (stallRec) recommendations.push(stallRec);
  
  const deloadRec = checkDeloadNeeded(store);
  if (deloadRec) recommendations.push(deloadRec);
  
  const proteinRec = checkProteinIntake(store);
  if (proteinRec) recommendations.push(proteinRec);
  
  return recommendations;
}

// Get top PR for each exercise
export function getPersonalRecords(store: GymStore): PersonalRecord[] {
  const prMap: Record<string, PersonalRecord> = {};
  
  for (const log of store.workoutLogs) {
    if (!log.isCompleted) continue;
    for (const ex of (log.exercises ?? [])) {
      for (const set of ex.sets) {
        const est1RM = epley1RM(set.weight, set.reps);
        const existing = prMap[ex.exerciseName];
        if (!existing || est1RM > existing.estimated1RM) {
          prMap[ex.exerciseName] = {
            exerciseName: ex.exerciseName,
            weightKg: set.weight,
            reps: set.reps,
            estimated1RM: est1RM,
            date: log.date,
            sessionType: 'upper-a', // simplified
          };
        }
      }
    }
  }
  
  return Object.values(prMap).sort((a, b) => b.estimated1RM - a.estimated1RM);
}
