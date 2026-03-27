// ============================================================
// AI DATA AGGREGATOR
// Collects and structures all user data into a single payload
// for the AI coaching pipeline. Runs client-side, sends the
// structured snapshot to the server for inference.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProgressPhotos } from './progress-photos';
import { loadUserProfile, calculateAge, type UserProfile } from './profile-store';
import {
  getRecentSplitWorkouts,
  getSplitWorkouts,
  getExerciseHistory,
  type SplitWorkoutSession,
  type ExerciseSetEntry,
} from './split-workout-store';
import { getDailyNutrition, getRecentNutrition, type DailyNutrition, type FoodEntry } from './nutrition-store';
import { getTodayRecoveryData, getWeeklyRecoveryData, type RecoveryData, type WeeklyRecoveryData } from './whoop-recovery-service';
import { getStreakData } from './streak-tracker';
import { getMesocycleStartDate, epley1RM } from './coach-engine';
import {
  getMesocycleInfo,
  getTodaySession,
  SESSION_NAMES,
  NUTRITION_TARGETS,
  MEAL_SCHEDULE,
  SUPPLEMENTS,
  USER_PROFILE,
  type SessionType,
} from './training-program';
import {
  loadScheduleOverride,
  getActiveSchedule,
  getTodaySessionFromSchedule,
  scheduleToString,
  type ScheduleOverride,
} from './schedule-store';

// ── Types ────────────────────────────────────────────────────

export interface WorkoutSummary {
  date: string;
  sessionType: string;
  sessionName: string;
  completed: boolean;
  durationMinutes: number;
  totalSets: number;
  totalVolume: number;
  notes?: string;
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

export interface ProgressPhotoSummary {
  id: string;
  uri: string;
  date: string;
  category?: 'front' | 'back' | 'side' | 'other';
  notes?: string;
  s3Url?: string;
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
  /** Full workout history (all sessions ever logged) */
  allWorkouts: WorkoutSummary[];
  recentNutrition: NutritionSummary[];
  recovery: RecoverySummary;
  /** 30-day WHOOP recovery/strain/sleep history */
  whoopHistory: WeeklyRecoveryData[];
  progressSummaries: ProgressSummary[];
  weightTrend: {
    current: number | null;
    weekAgo: number | null;
    twoWeeksAgo: number | null;
    direction: 'gaining' | 'stable' | 'losing' | 'unknown';
  };
  progressPhotos: ProgressPhotoSummary[];
  userProfile: {
    name: string;
    age: number | null;
    gender: string;
    heightCm: string;
    weightKg: string;
    fitnessGoal: string;
    experienceLevel: string;
    equipment: string;
  } | null;
  /** Programmed nutrition targets and meal schedule */
  nutritionProgram: {
    trainingDay: { calories: number; protein: number; fat: number; carbs: number };
    restDay: { calories: number; protein: number; fat: number; carbs: number };
    mealSchedule: { meal: number; time: string; kcal: number; focus: string }[];
    supplements: { name: string; dose: string; timing: string }[];
  };
  /** Compact string representation of the active 7-day schedule */
  activeSchedule: string;
  /** The current schedule override (null = using hardcoded default) */
  scheduleOverride: ScheduleOverride | null;
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
    .filter((w) => (w.exercises ?? []).some((e) => e.name === exerciseName))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (relevant.length < 2) return 'stable';
  const recentVol =
    relevant.slice(-2).reduce((s, w) => {
      const ex = (w.exercises ?? []).find((e) => e.name === exerciseName);
      return s + (ex?.totalVolume ?? 0);
    }, 0) / 2;
  const olderVol =
    relevant.slice(0, 2).reduce((s, w) => {
      const ex = (w.exercises ?? []).find((e) => e.name === exerciseName);
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
  // Use schedule-aware session (reads Zaki's override from AsyncStorage)
  const todaySession = await getTodaySessionFromSchedule();

  // Parallel data fetching
  const [
    recentWorkoutSessions,
    allWorkoutSessions,
    streakData,
    mesoStart,
    nutritionHistory,
    recoveryData,
    rawProfile,
    whoopHistory,
    activeScheduleMap,
    scheduleOverride,
  ] = await Promise.all([
    getRecentSplitWorkouts(14),
    getSplitWorkouts().then(s => s.filter(w => w.completed).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())),
    getStreakData(),
    getMesocycleStartDate(),
    getRecentNutrition(3).catch(() => [] as DailyNutrition[]),
    getTodayRecoveryData().catch(() => null as RecoveryData | null),
    loadUserProfile().catch(() => null as UserProfile | null),
    getWeeklyRecoveryData().catch(() => [] as WeeklyRecoveryData[]),
    getActiveSchedule(),
    loadScheduleOverride(),
  ]);

  const userProfile = rawProfile && (rawProfile.name || rawProfile.heightCm || rawProfile.fitnessGoal)
    ? {
        name: rawProfile.name,
        age: calculateAge(rawProfile.dateOfBirth),
        gender: rawProfile.gender,
        heightCm: rawProfile.heightCm,
        weightKg: rawProfile.weightKg,
        fitnessGoal: rawProfile.fitnessGoal,
        experienceLevel: rawProfile.experienceLevel || '',
        equipment: rawProfile.equipment || '',
      }
    : null;

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
      const exercises = (w.exercises ?? []).map((ex) => {
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
        notes: w.notes,
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

  // Recovery — now includes full HRV, RHR, SpO2, sleep stages
  const recovery: RecoverySummary = {
    available: recoveryData != null,
    score: recoveryData?.recoveryScore ?? null,
    hrv: recoveryData?.hrv ?? null,
    rhr: recoveryData?.rhr ?? null,
    strain: recoveryData?.strain ?? null,
    sleepScore: recoveryData?.sleepScore ?? null,
    zone: getRecoveryZone(recoveryData?.recoveryScore ?? null),
  };

  // Progress summaries
  const allExerciseNames = new Set<string>();
  recentWorkoutSessions.forEach((w: SplitWorkoutSession) =>
    (w.exercises ?? []).forEach((e) => allExerciseNames.add(e.exerciseName)),
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

  // Progress photos — load last 6 (most recent per category)
  let progressPhotos: ProgressPhotoSummary[] = [];
  try {
    const allPhotos = await getProgressPhotos();
    progressPhotos = allPhotos
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
      .map(p => ({
        id: p.id,
        uri: p.uri,
        date: p.date,
        category: p.category,
        notes: p.notes,
      }));
  } catch {
    // ignore — photos are optional
  }

  // Build full workout history summaries (all sessions, not just last 7 days)
  const allWorkouts: WorkoutSummary[] = allWorkoutSessions.map((w: SplitWorkoutSession) => {
    const exercises = w.exercises.map((ex) => {
      const sets = ex.sets.map((s) => ({
        weight: s.weightKg,
        reps: s.reps,
        e1rm: epley1RM(s.weightKg, s.reps),
      }));
      const bestE1RM = Math.max(0, ...sets.map((s) => s.e1rm));
      const totalVolume = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      return { name: ex.exerciseName, sets, bestE1RM, totalVolume };
    });
    const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
    const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
    return {
      date: w.date,
      sessionType: w.sessionType,
      sessionName: SESSION_NAMES[w.sessionType as SessionType] || w.sessionType,
      completed: w.completed,
      durationMinutes: w.durationMinutes ?? 0,
      totalSets,
      totalVolume,
      exercises,
      notes: w.notes,
    };
  });

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
    allWorkouts,
    recentNutrition,
    recovery,
    whoopHistory,
    progressSummaries,
    weightTrend,
    progressPhotos,
    userProfile,
    nutritionProgram: {
      trainingDay: NUTRITION_TARGETS.training,
      restDay: NUTRITION_TARGETS.rest,
      mealSchedule: MEAL_SCHEDULE,
      supplements: SUPPLEMENTS,
    },
    activeSchedule: scheduleToString(activeScheduleMap),
    scheduleOverride,
  };
}

/**
 * Serialize the snapshot into a compact text summary for the LLM prompt.
 * Keeps token usage low while preserving all signal.
 */
export function snapshotToPromptContext(snap: UserSnapshot): string {
  const lines: string[] = [];

  lines.push(`=== USER TRAINING SNAPSHOT (${snap.timestamp.split('T')[0]}) ===`);
  // User profile — always first so Zaki knows who he's coaching
  if (snap.userProfile) {
    const p = snap.userProfile;
    const parts: string[] = [];
    if (p.name) parts.push(`Name: ${p.name}`);
    if (p.age != null) parts.push(`Age: ${p.age}`);
    if (p.gender) parts.push(`Gender: ${p.gender}`);
    if (p.heightCm) parts.push(`Height: ${p.heightCm}cm`);
    if (p.weightKg) parts.push(`Profile Weight: ${p.weightKg}kg`);
    if (p.fitnessGoal) parts.push(`Primary Goal: ${p.fitnessGoal.replace('_', ' ')}`);
    if (p.experienceLevel) parts.push(`Experience: ${p.experienceLevel}`);
    if (p.equipment) parts.push(`Equipment: ${p.equipment.replace('_', ' ')}`);
    if (parts.length > 0) lines.push(parts.join(' | '));
  }
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

  // BMR / TDEE — calculated from profile if available
  if (snap.userProfile) {
    const p = snap.userProfile;
    const w = parseFloat(p.weightKg) || 0;
    const h = parseFloat(p.heightCm) || 0;
    const age = p.age ?? 30;
    if (w > 0 && h > 0) {
      // Mifflin-St Jeor BMR
      const bmr = p.gender === 'female'
        ? 10 * w + 6.25 * h - 5 * age - 161
        : 10 * w + 6.25 * h - 5 * age + 5;
      // TDEE: moderately active (4 workouts/week)
      const tdee = Math.round(bmr * 1.55);
      const bmrRound = Math.round(bmr);
      lines.push(`BMR: ~${bmrRound} kcal/day | Estimated TDEE (moderate activity): ~${tdee} kcal/day`);
    }
  }

  // Recovery
  if (snap.recovery.available) {
    const r = snap.recovery;
    lines.push(`\nWHOOP Recovery: ${r.score}% (${r.zone}) | HRV: ${r.hrv != null ? r.hrv + 'ms' : '--'} | RHR: ${r.rhr != null ? r.rhr + 'bpm' : '--'} | Strain: ${r.strain ?? '?'} | Sleep Score: ${r.sleepScore ?? '?'}%`);
    // Extended sleep data from RecoveryData
    const rd = snap.recovery as RecoverySummary & {
      sleepDurationHours?: number | null;
      sleepEfficiency?: number | null;
      sleepConsistency?: number | null;
      remSleepMinutes?: number | null;
      deepSleepMinutes?: number | null;
      lightSleepMinutes?: number | null;
      spo2?: number | null;
    };
    const sleepParts: string[] = [];
    if (rd.sleepDurationHours != null) sleepParts.push(`Duration: ${rd.sleepDurationHours}h`);
    if (rd.sleepEfficiency != null) sleepParts.push(`Efficiency: ${rd.sleepEfficiency}%`);
    if (rd.sleepConsistency != null) sleepParts.push(`Consistency: ${rd.sleepConsistency}%`);
    if (rd.remSleepMinutes != null) sleepParts.push(`REM: ${rd.remSleepMinutes}min`);
    if (rd.deepSleepMinutes != null) sleepParts.push(`Deep: ${rd.deepSleepMinutes}min`);
    if (rd.lightSleepMinutes != null) sleepParts.push(`Light: ${rd.lightSleepMinutes}min`);
    if (rd.spo2 != null) sleepParts.push(`SpO2: ${rd.spo2}%`);
    if (sleepParts.length > 0) lines.push(`Sleep Details: ${sleepParts.join(' | ')}`);
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
      for (const ex of (w.exercises ?? [])) {
        const setsStr = ex.sets.map((s) => `${s.weight}x${s.reps}`).join(', ');
        lines.push(
          `  ${ex.name}: ${setsStr} (best e1RM: ${Math.round(ex.bestE1RM)}kg, vol: ${Math.round(ex.totalVolume)}kg)`,
        );
      }
      if (w.notes) {
        lines.push(`  [Session Notes] ${w.notes}`);
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

  // Progress photos
  if (snap.progressPhotos && snap.progressPhotos.length > 0) {
    lines.push(`\n--- PROGRESS PHOTOS (${snap.progressPhotos.length} total) ---`);
    for (const p of snap.progressPhotos) {
      const catLabel = p.category ? ` [${p.category}]` : '';
      const notesLabel = p.notes ? ` — "${p.notes}"` : '';
      const urlLabel = p.s3Url ? ` URL: ${p.s3Url}` : ' (local only)';
      lines.push(`${p.date}${catLabel}${notesLabel}${urlLabel}`);
    }
  }

  // WHOOP 30-day history
  if (snap.whoopHistory && snap.whoopHistory.length > 0) {
    lines.push(`\n--- WHOOP HISTORY (${snap.whoopHistory.length} days) ---`);
    for (const h of snap.whoopHistory) {
      lines.push(`${h.date} | Recovery: ${h.recoveryScore}% | Strain: ${h.strain} | Sleep: ${h.sleepScore}%`);
    }
  }

  // Full workout history (beyond last 7 days)
  const olderWorkouts = snap.allWorkouts.filter(w => {
    if (!snap.recentWorkouts.some(r => r.date === w.date && r.sessionType === w.sessionType)) return true;
    return false;
  });
  if (olderWorkouts.length > 0) {
    lines.push(`\n--- FULL WORKOUT HISTORY (${snap.allWorkouts.length} sessions total) ---`);
    for (const w of olderWorkouts.slice(0, 30)) {
      lines.push(
        `${w.date} | ${w.sessionName} | ${w.durationMinutes}min | ${w.totalSets} sets | ${Math.round(w.totalVolume)}kg vol`,
      );
      for (const ex of (w.exercises ?? [])) {
        const setsStr = ex.sets.map((s) => `${s.weight}x${s.reps}`).join(', ');
        lines.push(`  ${ex.name}: ${setsStr} (best e1RM: ${Math.round(ex.bestE1RM)}kg)`);
      }
      if (w.notes) lines.push(`  [Notes] ${w.notes}`);
    }
  }

  // Nutrition program
  const np = snap.nutritionProgram;
  lines.push(`\n--- NUTRITION PROGRAM ---`);
  lines.push(`Training day: ${np.trainingDay.calories}kcal | P:${np.trainingDay.protein}g C:${np.trainingDay.carbs}g F:${np.trainingDay.fat}g`);
  lines.push(`Rest day: ${np.restDay.calories}kcal | P:${np.restDay.protein}g C:${np.restDay.carbs}g F:${np.restDay.fat}g`);
  lines.push(`Meal schedule:`);
  for (const m of np.mealSchedule) {
    lines.push(`  Meal ${m.meal} @ ${m.time}: ${m.kcal}kcal — ${m.focus}`);
  }
  lines.push(`Supplements: ${np.supplements.map(s => `${s.name} ${s.dose} (${s.timing})`).join(', ')}`);

  // Active schedule
  lines.push(`\n--- ACTIVE TRAINING SCHEDULE ---`);
  if (snap.scheduleOverride) {
    lines.push(`Custom schedule (set by ${snap.scheduleOverride.appliedByZaki ? 'Zaki' : 'user'} on ${snap.scheduleOverride.appliedAt.split('T')[0]}): ${snap.scheduleOverride.description}`);
  } else {
    lines.push(`Default schedule (Upper/Lower 4-day split):`);
  }
  lines.push(snap.activeSchedule);

  return lines.join('\n');
}
