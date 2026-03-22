// ============================================================
// AI DATA AGGREGATOR
// Collects and structures all user data into a single payload
// for the AI coaching pipeline. Runs client-side, sends the
// structured snapshot to the server for inference.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRecentSplitWorkouts,
  getExerciseHistory,
  type SplitWorkoutSession,
  type ExerciseSetEntry,
} from './split-workout-store';
import { getDailyNutrition, getRecentNutrition, type DailyNutrition, type FoodEntry } from './nutrition-store';
import { getTodayRecoveryData, type RecoveryData } from './whoop-recovery-service';
import { getStreakData } from './streak-tracker';
import { getMesocycleStartDate, epley1RM } from './coach-engine';
import {
  getMesocycleInfo,
  getTodaySession,
  SESSION_NAMES,
  type SessionType,
} from './training-program';

// ── Types ────────────────────────────────────────────────────

export interface WorkoutSummary {
  date: string;
  sessionType: string;
  sessionName: string;
  completed: boolean;
  durationMinutes: number;
  totalSets: number;
  totalVolume: number;
  exercises: {
    name: string;
    sets: { weight: number; reps: number; e1rm: number }[];
    bestE1RM: number;
    totalVolume: number;
  }[];
}

export interface NutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  targetCalories: number;
  targetProtein: number;
  mealCount: number;
  adherencePercent: number;
}

export interface RecoverySummary {
  available: boolean;
  score: number | null;
  hrv: number | null;
  rhr: number | null;
  strain: number | null;
  sleepScore: number | null;
  zone: 'green' | 'yellow' | 'red' | 'unknown';
}

export interface ProgressSummary {
  exerciseName: string;
  sessions: number;
  bestE1RM: number;
  latestE1RM: number;
  e1rmTrend: 'improving' | 'plateau' | 'declining';
  volumeTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface UserSnapshot {
  timestamp: string;
  todaySession: string;
  todaySessionName: string;
  mesocycleWeek: number;
  mesocycleTotalWeeks: number;
  daysUntilDeload: number;
  currentStreak: number;
  longestStreak: number;
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  recentWorkouts: WorkoutSummary[];
  recentNutrition: NutritionSummary[];
  recovery: RecoverySummary;
  progressSummaries: ProgressSummary[];
  weightTrend: {
    current: number | null;
    weekAgo: number | null;
    twoWeeksAgo: number | null;
    direction: 'gaining' | 'stable' | 'losing' | 'unknown';
  };
}

// ── Helpers ──────────────────────────────────────────────────

function getRecoveryZone(score: number | null): RecoverySummary['zone'] {
  if (score == null) return 'unknown';
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

function computeE1RMTrend(history: ExerciseSetEntry[]): ProgressSummary['e1rmTrend'] {
  if (history.length < 2) return 'plateau';
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const recent = sorted.slice(-3);
  const older = sorted.slice(0, Math.min(3, sorted.length));
  const avgRecent = recent.reduce((s, e) => s + e.e1rm, 0) / recent.length;
  const avgOlder = older.reduce((s, e) => s + e.e1rm, 0) / older.length;
  const diff = avgRecent - avgOlder;
  if (diff > 2) return 'improving';
  if (diff < -2) return 'declining';
  return 'plateau';
}

function computeVolumeTrend(
  workouts: WorkoutSummary[],
  exerciseName: string,
): ProgressSummary['volumeTrend'] {
  const relevant = workouts
    .filter((w) => w.exercises.some((e) => e.name === exerciseName))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (relevant.length < 2) return 'stable';
  const recentVol =
    relevant.slice(-2).reduce((s, w) => {
      const ex = w.exercises.find((e) => e.name === exerciseName);
      return s + (ex?.totalVolume ?? 0);
    }, 0) / 2;
  const olderVol =
    relevant.slice(0, 2).reduce((s, w) => {
      const ex = w.exercises.find((e) => e.name === exerciseName);
      return s + (ex?.totalVolume ?? 0);
    }, 0) / 2;
  const diff = recentVol - olderVol;
  if (diff > 50) return 'increasing';
  if (diff < -50) return 'decreasing';
  return 'stable';
}

// ── Main Aggregator ──────────────────────────────────────────

export async function buildUserSnapshot(): Promise<UserSnapshot> {
  const now = new Date();
  const todaySession = getTodaySession();

  // Parallel data fetching
  const [recentWorkoutSessions, streakData, mesoStart, nutritionHistory, recoveryData] =
    await Promise.all([
      getRecentSplitWorkouts(14),
      getStreakData(),
      getMesocycleStartDate(),
      getRecentNutrition(3).catch(() => [] as DailyNutrition[]),
      getTodayRecoveryData().catch(() => null as RecoveryData | null),
    ]);

  // Mesocycle info
  const mesoInfo = getMesocycleInfo(mesoStart);

  // Build workout summaries (last 7 days)
  const recentWorkouts: WorkoutSummary[] = recentWorkoutSessions
    .filter((w: SplitWorkoutSession) => {
      const wDate = new Date(w.date);
      const daysDiff = (now.getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    })
    .map((w: SplitWorkoutSession) => {
      const exercises = w.exercises.map((ex) => {
        const sets = ex.sets.map((s) => ({
          weight: s.weightKg,
          reps: s.reps,
          e1rm: epley1RM(s.weightKg, s.reps),
        }));
        const bestE1RM = Math.max(0, ...sets.map((s) => s.e1rm));
        const totalVolume = sets.reduce((sum, set) => sum + set.weight * set.reps, 0); // weight is already extracted from weightKg above
        return { name: ex.exerciseName, sets, bestE1RM, totalVolume };
      });
      const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
      const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
      const durationMinutes = w.durationMinutes ?? 0;
      return {
        date: w.date,
        sessionType: w.sessionType,
        sessionName: SESSION_NAMES[w.sessionType as SessionType] || w.sessionType,
        completed: w.completed,
        durationMinutes,
        totalSets,
        totalVolume,
        exercises,
      };
    });

  // Nutrition summaries
  const recentNutrition: NutritionSummary[] = (nutritionHistory || []).map(
    (n: DailyNutrition) => {
      const totalCal = n.meals.reduce((s: number, m: FoodEntry) => s + m.calories, 0);
      const totalProt = n.meals.reduce((s: number, m: FoodEntry) => s + m.protein, 0);
      const totalCarbs = n.meals.reduce((s: number, m: FoodEntry) => s + m.carbs, 0);
      const totalFat = n.meals.reduce((s: number, m: FoodEntry) => s + m.fat, 0);
      return {
        date: n.date,
        totalCalories: totalCal,
        totalProtein: totalProt,
        totalCarbs: totalCarbs,
        totalFat: totalFat,
        targetCalories: n.targetCalories || 2750,
        targetProtein: n.targetProtein || 180,
        mealCount: n.meals.length,
        adherencePercent: Math.round((totalCal / (n.targetCalories || 2750)) * 100),
      };
    },
  );

  // Recovery
  const recovery: RecoverySummary = {
    available: recoveryData != null,
    score: recoveryData?.recoveryScore ?? null,
    hrv: null, // WHOOP recovery service doesn't expose HRV directly
    rhr: null, // WHOOP recovery service doesn't expose RHR directly
    strain: recoveryData?.strain ?? null,
    sleepScore: recoveryData?.sleepScore ?? null,
    zone: getRecoveryZone(recoveryData?.recoveryScore ?? null),
  };

  // Progress summaries
  const allExerciseNames = new Set<string>();
  recentWorkoutSessions.forEach((w: SplitWorkoutSession) =>
    w.exercises.forEach((e) => allExerciseNames.add(e.exerciseName)),
  );

  const progressSummaries: ProgressSummary[] = [];
  for (const name of allExerciseNames) {
    const history = await getExerciseHistory(name);
    if (history.length === 0) continue;
    const sorted = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const bestE1RM = Math.max(0, ...history.map((h) => h.e1rm));
    const latestE1RM = sorted[sorted.length - 1]?.e1rm ?? 0;
    progressSummaries.push({
      exerciseName: name,
      sessions: history.length,
      bestE1RM,
      latestE1RM,
      e1rmTrend: computeE1RMTrend(history),
      volumeTrend: computeVolumeTrend(recentWorkouts, name),
    });
  }

  // Body weight trend
  const weightRaw = await AsyncStorage.getItem('gym_store');
  let weightTrend: UserSnapshot['weightTrend'] = {
    current: null,
    weekAgo: null,
    twoWeeksAgo: null,
    direction: 'unknown',
  };
  if (weightRaw) {
    try {
      const store = JSON.parse(weightRaw);
      const entries = (store.weightEntries || []).sort(
        (a: { date: string }, b: { date: string }) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      if (entries.length > 0) {
        weightTrend.current = entries[0].weight;
        const weekAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgoDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const weekAgoEntry = entries.find(
          (e: { date: string }) => new Date(e.date) <= weekAgoDate,
        );
        const twoWeeksAgoEntry = entries.find(
          (e: { date: string }) => new Date(e.date) <= twoWeeksAgoDate,
        );
        weightTrend.weekAgo = weekAgoEntry?.weight ?? null;
        weightTrend.twoWeeksAgo = twoWeeksAgoEntry?.weight ?? null;
        if (weightTrend.current && weightTrend.weekAgo) {
          const diff = weightTrend.current - weightTrend.weekAgo;
          if (diff > 0.3) weightTrend.direction = 'gaining';
          else if (diff < -0.3) weightTrend.direction = 'losing';
          else weightTrend.direction = 'stable';
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // Workouts this week / last week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const workoutsThisWeek = recentWorkoutSessions.filter((w: SplitWorkoutSession) => {
    const d = new Date(w.date);
    return d >= startOfWeek && w.completed;
  }).length;

  const workoutsLastWeek = recentWorkoutSessions.filter((w: SplitWorkoutSession) => {
    const d = new Date(w.date);
    return d >= startOfLastWeek && d < startOfWeek && w.completed;
  }).length;

  return {
    timestamp: now.toISOString(),
    todaySession: todaySession,
    todaySessionName: SESSION_NAMES[todaySession],
    mesocycleWeek: mesoInfo.currentWeek,
    mesocycleTotalWeeks: mesoInfo.totalWeeks,
    daysUntilDeload: mesoInfo.daysUntilDeload,
    currentStreak: streakData?.currentStreak ?? 0,
    longestStreak: streakData?.bestStreak ?? 0,
    workoutsThisWeek,
    workoutsLastWeek,
    recentWorkouts,
    recentNutrition,
    recovery,
    progressSummaries,
    weightTrend,
  };
}

/**
 * Serialize the snapshot into a compact text summary for the LLM prompt.
 * Keeps token usage low while preserving all signal.
 */
export function snapshotToPromptContext(snap: UserSnapshot): string {
  const lines: string[] = [];

  lines.push(`=== USER TRAINING SNAPSHOT (${snap.timestamp.split('T')[0]}) ===`);
  lines.push(
    `Today: ${snap.todaySessionName} | Mesocycle Week ${snap.mesocycleWeek}/${snap.mesocycleTotalWeeks} | Deload in ${snap.daysUntilDeload} days`,
  );
  lines.push(
    `Streak: ${snap.currentStreak} days (best: ${snap.longestStreak}) | This week: ${snap.workoutsThisWeek} workouts | Last week: ${snap.workoutsLastWeek}`,
  );

  // Body weight
  if (snap.weightTrend.current) {
    lines.push(
      `\nBody Weight: ${snap.weightTrend.current}kg (${snap.weightTrend.direction}) | Week ago: ${snap.weightTrend.weekAgo ?? '?'}kg`,
    );
  }

  // Recovery
  if (snap.recovery.available) {
    lines.push(
      `\nWHOOP Recovery: ${snap.recovery.score}% (${snap.recovery.zone}) | HRV: ${snap.recovery.hrv}ms | RHR: ${snap.recovery.rhr}bpm | Strain: ${snap.recovery.strain ?? '?'} | Sleep: ${snap.recovery.sleepScore ?? '?'}%`,
    );
  } else {
    lines.push(`\nWHOOP: Not connected`);
  }

  // Recent workouts
  if (snap.recentWorkouts.length > 0) {
    lines.push(`\n--- RECENT WORKOUTS (last 7 days) ---`);
    for (const w of snap.recentWorkouts) {
      lines.push(
        `${w.date} | ${w.sessionName} | ${w.completed ? 'Completed' : 'Incomplete'} | ${w.durationMinutes}min | ${w.totalSets} sets | ${Math.round(w.totalVolume)}kg vol`,
      );
      for (const ex of w.exercises) {
        const setsStr = ex.sets.map((s) => `${s.weight}x${s.reps}`).join(', ');
        lines.push(
          `  ${ex.name}: ${setsStr} (best e1RM: ${Math.round(ex.bestE1RM)}kg, vol: ${Math.round(ex.totalVolume)}kg)`,
        );
      }
    }
  }

  // Nutrition
  if (snap.recentNutrition.length > 0) {
    lines.push(`\n--- NUTRITION (last 3 days) ---`);
    for (const n of snap.recentNutrition) {
      lines.push(
        `${n.date} | ${n.totalCalories}/${n.targetCalories}kcal (${n.adherencePercent}%) | P:${n.totalProtein}g C:${n.totalCarbs}g F:${n.totalFat}g | ${n.mealCount} meals`,
      );
    }
  }

  // Progress
  if (snap.progressSummaries.length > 0) {
    lines.push(`\n--- EXERCISE PROGRESS ---`);
    const sorted = [...snap.progressSummaries].sort((a, b) => b.bestE1RM - a.bestE1RM);
    for (const p of sorted.slice(0, 15)) {
      lines.push(
        `${p.exerciseName}: best e1RM ${Math.round(p.bestE1RM)}kg, latest ${Math.round(p.latestE1RM)}kg (${p.e1rmTrend}) | ${p.sessions} sessions | vol: ${p.volumeTrend}`,
      );
    }
  }

  return lines.join('\n');
}
