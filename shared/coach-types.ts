// ============================================================
// COACH ↔ TRAINEE SHARED TYPES
// The shapes a coach authors (workout plan, meal plan) and the
// shapes both sides exchange (messages, progress). Kept free of
// server/client imports so both bundles can use them.
// ============================================================

// ── Workout plan ─────────────────────────────────────────────

export interface CoachPlanExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes: string;
  muscleGroup: 'upper' | 'lower' | 'core';
  bodyPart: string;
  category: 'compound' | 'isolation';
}

export interface CoachPlanSession {
  /** Stable id used as the session key on the trainee's device, e.g. "day-1" */
  id: string;
  name: string;
  exercises: CoachPlanExercise[];
}

export type WeekDay = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface CoachWorkoutPlanBody {
  name: string;
  description: string;
  durationWeeks: number;
  sessions: CoachPlanSession[];
  /** Day → session id, or "rest" */
  weeklySchedule: Record<WeekDay, string>;
  notes: string;
}

export interface CoachWorkoutPlan extends CoachWorkoutPlanBody {
  id: string;
  trainerId: number;
  traineeId: number;
  coachName: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ── Meal plan ────────────────────────────────────────────────

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CoachMealFood {
  foodName: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CoachMeal {
  /** 1..5 — matches the trainee's meal slots */
  mealNumber: number;
  name: string;
  time: string;
  foods: CoachMealFood[];
  notes: string;
}

export interface CoachMealPlanBody {
  name: string;
  trainingDay: MacroTargets;
  restDay: MacroTargets;
  meals: CoachMeal[];
  notes: string;
}

export interface CoachMealPlan extends CoachMealPlanBody {
  id: string;
  trainerId: number;
  traineeId: number;
  coachName: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ── Messages ─────────────────────────────────────────────────

export interface CoachMessage {
  id: string;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface CoachThread {
  peerId: number;
  peerName: string;
  peerEmail: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

// ── Progress (coach reads a trainee) ─────────────────────────

export interface TraineeProgress {
  trainee: { id: number; name: string; email: string | null; photosShared: boolean };
  workouts: Array<{
    id: string;
    date: string;
    sessionType: string;
    completed: boolean;
    durationMinutes: number | null;
    totalVolumeKg: number | null;
    exerciseCount: number;
  }>;
  workoutsLast7: number;
  workoutsLast30: number;
  bodyWeight: Array<{ date: string; weightKg: number | null; bodyFatPercent: number | null }>;
  nutrition: Array<{
    date: string;
    targetCalories: number | null;
    targetProtein: number | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealCount: number;
  }>;
  personalRecords: Array<{ exerciseName: string; weightKg: number; reps: number; date: string }>;
  streak: { currentStreak: number; bestStreak: number; lastWorkoutDate: string | null } | null;
  activeWorkoutPlan: { id: string; name: string; createdAt: string } | null;
  activeMealPlan: { id: string; name: string; createdAt: string } | null;
}

export function macroCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function emptyWorkoutPlan(): CoachWorkoutPlanBody {
  return {
    name: '',
    description: '',
    durationWeeks: 4,
    sessions: [],
    weeklySchedule: {
      Sunday: 'rest', Monday: 'rest', Tuesday: 'rest', Wednesday: 'rest',
      Thursday: 'rest', Friday: 'rest', Saturday: 'rest',
    },
    notes: '',
  };
}

export function emptyMealPlan(): CoachMealPlanBody {
  return {
    name: '',
    trainingDay: { calories: 2600, protein: 170, carbs: 300, fat: 75 },
    restDay: { calories: 2300, protein: 170, carbs: 230, fat: 75 },
    meals: [],
    notes: '',
  };
}
