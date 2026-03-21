// ============================================================
// HYPERTROPHY TRACKER — Training Program Data
// Yehia's Upper/Lower 4-Day Split
// Design: Obsidian Lab
// ============================================================

import type { ExerciseTarget, SessionType } from '../types';

export type WeeklySchedule = Record<string, SessionType>;

export const WEEKLY_SCHEDULE: WeeklySchedule = {
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
  'rest': 'Rest Day',
};

export const SESSION_COLORS: Record<SessionType, string> = {
  'upper-a': '#3B82F6',
  'lower-a': '#8B5CF6',
  'upper-b': '#06B6D4',
  'lower-b': '#10B981',
  'rest': '#6B7280',
};

export const UPPER_A: ExerciseTarget[] = [
  {
    name: 'Barbell Bench Press',
    sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180,
    notes: 'Compound strength driver',
    muscleGroup: 'upper',
  },
  {
    name: 'Barbell Bent-Over Row',
    sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180,
    notes: 'Overhand grip',
    muscleGroup: 'upper',
  },
  {
    name: 'DB Overhead Press',
    sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120,
    notes: 'Seated or standing',
    muscleGroup: 'upper',
  },
  {
    name: 'Close-Grip Cable Row',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90,
    notes: 'Squeeze at contraction',
    muscleGroup: 'upper',
  },
  {
    name: 'Incline DB Curl',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60,
    notes: 'Full stretch at bottom',
    muscleGroup: 'upper',
  },
  {
    name: 'Cable Overhead Tricep Extension',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60,
    notes: 'Long head emphasis',
    muscleGroup: 'upper',
  },
  {
    name: 'DB Lateral Raise',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Controlled, no momentum',
    muscleGroup: 'upper',
  },
];

export const LOWER_A: ExerciseTarget[] = [
  {
    name: 'Barbell Back Squat',
    sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180,
    notes: 'Below parallel',
    muscleGroup: 'lower',
  },
  {
    name: 'Romanian Deadlift',
    sets: 3, repsMin: 8, repsMax: 10, restSeconds: 150,
    notes: 'Feel hamstring stretch',
    muscleGroup: 'lower',
  },
  {
    name: 'Leg Press',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: 'Foot placement high & wide',
    muscleGroup: 'lower',
  },
  {
    name: 'Seated Leg Curl',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90,
    notes: 'Slow eccentric (3 sec)',
    muscleGroup: 'lower',
  },
  {
    name: 'Standing Calf Raise',
    sets: 4, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Full ROM, pause at bottom',
    muscleGroup: 'lower',
  },
  {
    name: 'Hanging Leg Raise',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Control the movement',
    muscleGroup: 'lower',
  },
  {
    name: "Farmer's Walk",
    sets: 3, repsMin: 30, repsMax: 40, restSeconds: 90,
    notes: 'Heavy DBs, grip builder (reps = seconds)',
    muscleGroup: 'lower',
  },
];

export const UPPER_B: ExerciseTarget[] = [
  {
    name: 'Incline DB Press',
    sets: 4, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: '30° angle',
    muscleGroup: 'upper',
  },
  {
    name: 'Wide-Grip Lat Pulldown',
    sets: 4, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: 'Pull to upper chest',
    muscleGroup: 'upper',
  },
  {
    name: 'Cable Fly (Low-to-High)',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Constant tension',
    muscleGroup: 'upper',
  },
  {
    name: 'Wide-Grip Seated Cable Row',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 90,
    notes: 'Rear delt involvement',
    muscleGroup: 'upper',
  },
  {
    name: 'Face Pulls',
    sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'External rotation at top',
    muscleGroup: 'upper',
  },
  {
    name: 'Hammer Curls',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Brachialis focus',
    muscleGroup: 'upper',
  },
  {
    name: 'Tricep Rope Pushdown',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Split at bottom',
    muscleGroup: 'upper',
  },
  {
    name: 'Cable Lateral Raise',
    sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'Behind-the-body angle',
    muscleGroup: 'upper',
  },
];

export const LOWER_B: ExerciseTarget[] = [
  {
    name: 'Bulgarian Split Squat',
    sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90,
    notes: 'Hold DBs, rear foot elevated (per leg)',
    muscleGroup: 'lower',
  },
  {
    name: 'Barbell Hip Thrust',
    sets: 4, repsMin: 10, repsMax: 12, restSeconds: 120,
    notes: 'Pause at top (2 sec)',
    muscleGroup: 'lower',
  },
  {
    name: 'Leg Extension',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Squeeze at top (1 sec)',
    muscleGroup: 'lower',
  },
  {
    name: 'Lying Leg Curl',
    sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60,
    notes: 'Slow eccentric',
    muscleGroup: 'lower',
  },
  {
    name: 'Walking Lunges',
    sets: 3, repsMin: 12, repsMax: 12, restSeconds: 90,
    notes: 'DBs in hand (per leg)',
    muscleGroup: 'lower',
  },
  {
    name: 'Seated Calf Raise',
    sets: 4, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'Soleus focus',
    muscleGroup: 'lower',
  },
  {
    name: 'Cable Crunch',
    sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60,
    notes: 'Exhale hard at contraction',
    muscleGroup: 'lower',
  },
  {
    name: 'Dead Hang',
    sets: 3, repsMin: 0, repsMax: 0, restSeconds: 60,
    notes: 'Overhand grip, grip builder (max hold)',
    muscleGroup: 'lower',
  },
];

export const SESSIONS: Record<Exclude<SessionType, 'rest'>, ExerciseTarget[]> = {
  'upper-a': UPPER_A,
  'lower-a': LOWER_A,
  'upper-b': UPPER_B,
  'lower-b': LOWER_B,
};

export function getTodaySession(): SessionType {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  return WEEKLY_SCHEDULE[today] || 'rest';
}

export function getSessionForDay(dayIndex: number): SessionType {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return WEEKLY_SCHEDULE[days[dayIndex]] || 'rest';
}

export function isTrainingDay(date?: Date): boolean {
  const d = date || new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[d.getDay()];
  return WEEKLY_SCHEDULE[day] !== 'rest';
}

export function getOverloadSuggestion(muscleGroup: 'upper' | 'lower'): number {
  return muscleGroup === 'upper' ? 2.5 : 5;
}

export function checkProgressiveOverload(
  exerciseName: string,
  sets: { weightKg: number; reps: number }[],
  target: ExerciseTarget
): boolean {
  if (sets.length < target.sets) return false;
  return sets.every(s => s.reps >= target.repsMax);
}

// Nutrition targets
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

export const WEIGHT_TARGETS = {
  minGainPerMonth: 0.5,
  maxGainPerMonth: 1.0,
};
