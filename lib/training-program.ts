// ============================================================
// TRAINING PROGRAM — Yehia's Upper/Lower 4-Day Split
// ============================================================

import type { BodyPart } from './types';

export type SessionType = 'upper-a' | 'lower-a' | 'upper-b' | 'lower-b' | 'rest';

export interface ProgramExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes: string;
  muscleGroup: 'upper' | 'lower';
  bodyPart: BodyPart;
  category: 'compound' | 'isolation';
}

export const WEEKLY_SCHEDULE: Record<string, SessionType> = {
  Sunday: 'upper-a',
  Monday: 'lower-a',
  Tuesday: 'rest',
  Wednesday: 'upper-b',
  Thursday: 'lower-b',
  Friday: 'rest',
  Saturday: 'rest',
};

export const SESSION_NAMES: Record<SessionType, string> = {
  'upper-a': 'Upper A — Strength',
  'lower-a': 'Lower A — Strength',
  'upper-b': 'Upper B — Volume',
  'lower-b': 'Lower B — Volume',
  rest: 'Rest Day',
};

export const SESSION_COLORS: Record<SessionType, string> = {
  'upper-a': '#3B82F6',
  'lower-a': '#8B5CF6',
  'upper-b': '#06B6D4',
  'lower-b': '#10B981',
  rest: '#6B7280',
};

// ==================== UPPER A — STRENGTH ====================
export const UPPER_A: ProgramExercise[] = [
  {
    name: 'Barbell Bench Press',
    sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180,
    notes: 'Compound strength driver',
    muscleGroup: 'upper', bodyPart: 'Chest', category: 'compound',
  },
  {
    name: 'Dips',
    sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120,
    notes: 'Lean forward for chest emphasis. Add weight belt when 12+ reps easy.',
    muscleGroup: 'upper', bodyPart: 'Chest', category: 'compound',
  },
  {
    name: 'Chest-Supported DB Row',
    sets: 4, repsMin: 8, repsMax: 10, restSeconds: 150,
    notes: 'Chest on incline bench — zero lower back stress',
    muscleGroup: 'upper', bodyPart: 'Back', category: 'compound',
  },
  {
    name: 'DB Overhead Press',
    sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120,
    notes: 'Seated or standing',
    muscleGroup: 'upper', bodyPart: 'Shoulders', category: 'compound',
  },
  {
    name: 'Close-Grip Cable Row',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90,
    notes: 'Squeeze at contraction',
    muscleGroup: 'upper', bodyPart: 'Back', category: 'compound',
  },
  {
    name: 'Incline DB Curl',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60,
    notes: 'Full stretch at bottom',
    muscleGroup: 'upper', bodyPart: 'Arms', category: 'isolation',
  },
  {
    name: 'Cable Overhead Tricep Extension',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60,
    notes: 'Long head emphasis',
    muscleGroup: 'upper', bodyPart: 'Arms', category: 'isolation',
  },
  {
    name: 'DB Lateral Raise',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Controlled, no momentum',
    muscleGroup: 'upper', bodyPart: 'Shoulders', category: 'isolation',
  },
];

// ==================== LOWER A — STRENGTH ====================
export const LOWER_A: ProgramExercise[] = [
  {
    name: 'Barbell Back Squat',
    sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180,
    notes: 'Below parallel',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound',
  },
  {
    name: 'Romanian Deadlift',
    sets: 3, repsMin: 8, repsMax: 10, restSeconds: 150,
    notes: 'Feel hamstring stretch',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound',
  },
  {
    name: 'Leg Press',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: 'Foot placement high & wide',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound',
  },
  {
    name: 'Seated Leg Curl',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90,
    notes: 'Slow eccentric (3 sec)',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'isolation',
  },
  {
    name: 'Standing Calf Raise',
    sets: 4, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Full ROM, pause at bottom',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'isolation',
  },
  {
    name: 'Hanging Leg Raise',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Control the movement',
    muscleGroup: 'lower', bodyPart: 'Core', category: 'isolation',
  },
  {
    name: "Farmer's Walk",
    sets: 3, repsMin: 30, repsMax: 40, restSeconds: 90,
    notes: 'Heavy DBs, grip builder (reps = seconds)',
    muscleGroup: 'lower', bodyPart: 'Other', category: 'compound',
  },
];

// ==================== UPPER B — VOLUME ====================
export const UPPER_B: ProgramExercise[] = [
  {
    name: 'Incline DB Press',
    sets: 4, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: '30° angle',
    muscleGroup: 'upper', bodyPart: 'Chest', category: 'compound',
  },
  {
    name: 'Wide-Grip Lat Pulldown',
    sets: 4, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: 'Pull to upper chest',
    muscleGroup: 'upper', bodyPart: 'Back', category: 'compound',
  },
  {
    name: 'Cable Fly (Low-to-High)',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Constant tension',
    muscleGroup: 'upper', bodyPart: 'Chest', category: 'isolation',
  },
  {
    name: 'Wide-Grip Seated Cable Row',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90,
    notes: 'Rear delt involvement',
    muscleGroup: 'upper', bodyPart: 'Back', category: 'compound',
  },
  {
    name: 'Face Pulls',
    sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'External rotation at top',
    muscleGroup: 'upper', bodyPart: 'Shoulders', category: 'isolation',
  },
  {
    name: 'Hammer Curls',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Brachialis focus',
    muscleGroup: 'upper', bodyPart: 'Arms', category: 'isolation',
  },
  {
    name: 'Tricep Rope Pushdown',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Split at bottom',
    muscleGroup: 'upper', bodyPart: 'Arms', category: 'isolation',
  },
  {
    name: 'Cable Lateral Raise',
    sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'Behind-the-body angle',
    muscleGroup: 'upper', bodyPart: 'Shoulders', category: 'isolation',
  },
];

// ==================== LOWER B — VOLUME ====================
export const LOWER_B: ProgramExercise[] = [
  {
    name: 'Bulgarian Split Squat',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90,
    notes: 'Hold DBs, rear foot elevated (per leg)',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound',
  },
  {
    name: 'Barbell Hip Thrust',
    sets: 4, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: 'Pause at top (2 sec)',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound',
  },
  {
    name: 'Leg Extension',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Squeeze at top (1 sec)',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'isolation',
  },
  {
    name: 'Lying Leg Curl',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Slow eccentric',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'isolation',
  },
  {
    name: 'Walking Lunges',
    sets: 3, repsMin: 12, repsMax: 12, restSeconds: 90,
    notes: 'DBs in hand (per leg)',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound',
  },
  {
    name: 'Seated Calf Raise',
    sets: 4, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'Soleus focus',
    muscleGroup: 'lower', bodyPart: 'Legs', category: 'isolation',
  },
  {
    name: 'Cable Crunch',
    sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'Exhale hard at contraction',
    muscleGroup: 'lower', bodyPart: 'Core', category: 'isolation',
  },
  {
    name: 'Dead Hang',
    sets: 3, repsMin: 0, repsMax: 0, restSeconds: 60,
    notes: 'Overhand grip, grip builder (max hold)',
    muscleGroup: 'lower', bodyPart: 'Other', category: 'compound',
  },
];

export const PROGRAM_SESSIONS: Record<Exclude<SessionType, 'rest'>, ProgramExercise[]> = {
  'upper-a': UPPER_A,
  'lower-a': LOWER_A,
  'upper-b': UPPER_B,
  'lower-b': LOWER_B,
};

// ---- Schedule helpers ----

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getTodaySession(): SessionType {
  const today = DAY_NAMES[new Date().getDay()];
  return WEEKLY_SCHEDULE[today] || 'rest';
}

export function getSessionForDate(date: Date): SessionType {
  const day = DAY_NAMES[date.getDay()];
  return WEEKLY_SCHEDULE[day] || 'rest';
}

export function isTrainingDay(date?: Date): boolean {
  const d = date || new Date();
  return getSessionForDate(d) !== 'rest';
}

/**
 * Get the next 7 days of schedule starting from a given date.
 */
export function getWeekSchedule(startDate: Date): { date: Date; session: SessionType; dayName: string }[] {
  const schedule: { date: Date; session: SessionType; dayName: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    schedule.push({
      date: d,
      session: getSessionForDate(d),
      dayName: DAY_NAMES[d.getDay()],
    });
  }
  return schedule;
}

/**
 * Get next week's full schedule.
 */
export function getNextWeekSchedule(): { date: Date; session: SessionType; dayName: string }[] {
  const now = new Date();
  // Find next Sunday
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);
  return getWeekSchedule(nextSunday);
}

// ---- Mesocycle ----

export const MESOCYCLE_WEEKS = 5; // 4 progressive + 1 deload

export interface MesocycleInfo {
  currentWeek: number; // 1-5
  totalWeeks: number;
  isDeload: boolean;
  daysUntilDeload: number;
}

export function getMesocycleInfo(startDate: string): MesocycleInfo {
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.min(Math.floor(diffDays / 7) + 1, MESOCYCLE_WEEKS);
  const isDeload = weekNum === MESOCYCLE_WEEKS;
  const daysUntilDeload = isDeload ? 0 : (MESOCYCLE_WEEKS - weekNum) * 7 - (diffDays % 7);

  return {
    currentWeek: weekNum,
    totalWeeks: MESOCYCLE_WEEKS,
    isDeload,
    daysUntilDeload: Math.max(0, daysUntilDeload),
  };
}

// ---- Nutrition targets ----

export const NUTRITION_TARGETS = {
  training: { calories: 3000, protein: 180, fat: 80, carbs: 390 },
  rest: { calories: 2750, protein: 180, fat: 80, carbs: 328 },
};

export const MEAL_SCHEDULE = [
  { meal: 1, time: '12:00 PM', kcal: 650, focus: 'Balanced — protein + carbs + fats' },
  { meal: 2, time: '4:00 PM', kcal: 600, focus: 'Balanced' },
  { meal: 3, time: '7:00–7:30 PM', kcal: 650, focus: 'High carb, moderate protein, low fat (Pre-workout)' },
  { meal: 4, time: '10:30 PM', kcal: 700, focus: 'High protein + high carb, low fat (Post-workout)' },
  { meal: 5, time: '12:00 AM', kcal: 400, focus: 'Casein/Greek yogurt + slow carbs (Before bed)' },
];

export const SUPPLEMENTS = [
  { name: 'Creatine Monohydrate', dose: '5g/day', timing: 'Any time' },
  { name: 'Whey Protein', dose: 'As needed', timing: 'Post-workout' },
  { name: 'Casein Protein', dose: '30-40g', timing: 'Before bed' },
  { name: 'Vitamin D3', dose: '2000-4000 IU', timing: 'With fatty meal' },
  { name: 'Magnesium', dose: '400mg', timing: 'Before bed' },
];

export const USER_PROFILE = {
  name: 'Yehia AbdelAziz',
  age: 40,
  heightCm: 184,
  startingWeightKg: 87,
  bodyFatPercent: 18,
  goal: 'Hypertrophy (Lean Bulk)',
  trainingSplit: 'Upper/Lower, 4 days/week',
  trainingTime: '9:00 PM',
};

export const SLEEP_TARGETS = {
  bedtime: '12:00 AM',
  wakeTime: '7:30 AM',
  durationHours: 7.5,
};

/**
 * Get training sessions that were scheduled but not completed in the last N days.
 * Compares the fixed weekly schedule against the list of completed session dates.
 *
 * @param completedDates - ISO date strings of days a workout was completed (e.g. ["2026-03-20"])
 * @param lookbackDays   - How many past days to check (default 7)
 * @returns Array of missed sessions sorted by date ascending
 */
export function getMissedSessions(
  completedDates: string[],
  lookbackDays = 7
): Array<{ date: string; sessionType: SessionType; sessionName: string; daysAgo: number }> {
  const missed: Array<{ date: string; sessionType: SessionType; sessionName: string; daysAgo: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = lookbackDays; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const session = getSessionForDate(d);

    // Only flag scheduled training days that have no completed workout
    if (session !== 'rest' && !completedDates.includes(dateStr)) {
      missed.push({
        date: dateStr,
        sessionType: session,
        sessionName: SESSION_NAMES[session],
        daysAgo: i,
      });
    }
  }
  return missed;
}
