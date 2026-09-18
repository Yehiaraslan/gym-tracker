// ============================================================
// COACH PLAN SYNC — trainee side
// Pulls the active plans the coach assigned to me and applies
// them locally: the workout plan becomes the active custom
// program (so Home/Workout/Calendar pick it up unchanged), the
// meal plan is stored and drives nutrition targets + meal slots.
// Idempotent: a plan is applied once per plan id.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachMealPlan, CoachWorkoutPlan, MacroTargets } from '@/shared/coach-types';
import {
  archiveProgram, loadCustomProgram, saveCustomProgram, type CustomProgram,
} from './custom-program-store';
import { applyScheduleWithHistory, buildFullSchedule, type DayName } from './schedule-store';
import type { ProgramExercise, SessionType } from './training-program';
import type { BodyPart } from './types';

const APPLIED_WORKOUT_KEY = '@coach_workout_plan_applied_v1';
const MEAL_PLAN_KEY = '@coach_meal_plan_v1';

const SESSION_COLORS_POOL = ['#2EBFBF', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6'];

// ── Conversion ───────────────────────────────────────────────

/** Pure: coach plan → the CustomProgram shape the rest of the app already understands. */
export function coachPlanToProgram(plan: CoachWorkoutPlan, meal?: CoachMealPlan | null): CustomProgram {
  const sessions: Record<string, ProgramExercise[]> = {};
  const sessionNames: Record<string, string> = {};
  const sessionColors: Record<string, string> = {};
  plan.sessions.forEach((s, i) => {
    sessions[s.id] = s.exercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      repsMin: e.repsMin,
      repsMax: e.repsMax,
      restSeconds: e.restSeconds,
      notes: e.notes ?? '',
      muscleGroup: e.muscleGroup,
      bodyPart: (e.bodyPart || 'Other') as BodyPart,
      category: e.category,
    }));
    sessionNames[s.id] = s.name;
    sessionColors[s.id] = SESSION_COLORS_POOL[i % SESSION_COLORS_POOL.length];
  });
  return {
    name: plan.name,
    description: plan.description || `Set by Coach ${plan.coachName}`,
    sessions,
    sessionNames,
    sessionColors,
    weeklySchedule: { ...plan.weeklySchedule },
    nutritionTargets: meal
      ? { training: meal.trainingDay, rest: meal.restDay }
      : undefined,
    createdAt: plan.createdAt,
    generatedByZaki: false,
    durationWeeks: plan.durationWeeks,
    assignedByCoach: { planId: plan.id, coachName: plan.coachName },
  };
}

// ── Local state ──────────────────────────────────────────────

export async function loadCoachMealPlan(): Promise<CoachMealPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(MEAL_PLAN_KEY);
    return raw ? (JSON.parse(raw) as CoachMealPlan) : null;
  } catch {
    return null;
  }
}

/** Targets for today when a coach meal plan is active; null otherwise. */
export async function getCoachTargets(isTrainingDay: boolean): Promise<MacroTargets | null> {
  const plan = await loadCoachMealPlan();
  if (!plan) return null;
  return isTrainingDay ? plan.trainingDay : plan.restDay;
}

async function appliedWorkoutPlanId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(APPLIED_WORKOUT_KEY); } catch { return null; }
}

// ── Sync ─────────────────────────────────────────────────────

export interface CoachSyncResult {
  workoutPlan: CoachWorkoutPlan | null;
  mealPlan: CoachMealPlan | null;
  appliedWorkout: boolean;
  appliedMeal: boolean;
}

/**
 * Fetch my plans and apply anything new. Safe to call on every Home focus:
 * network failure → returns nulls and leaves local state untouched.
 */
export async function syncCoachPlans(): Promise<CoachSyncResult> {
  const none: CoachSyncResult = { workoutPlan: null, mealPlan: null, appliedWorkout: false, appliedMeal: false };
  let plans: { workoutPlan: CoachWorkoutPlan | null; mealPlan: CoachMealPlan | null };
  try {
    const { trpcClient } = await import('./trpc');
    plans = await trpcClient.coach.myPlans.query();
  } catch {
    return none;
  }

  let appliedWorkout = false;
  let appliedMeal = false;

  // Meal plan first so the program conversion can carry its targets.
  if (plans.mealPlan) {
    const current = await loadCoachMealPlan();
    if (!current || current.id !== plans.mealPlan.id) {
      await AsyncStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(plans.mealPlan));
      appliedMeal = true;
    }
  } else {
    // Coach withdrew / link ended → stop enforcing their targets.
    const current = await loadCoachMealPlan();
    if (current) await AsyncStorage.removeItem(MEAL_PLAN_KEY);
  }

  if (plans.workoutPlan) {
    const applied = await appliedWorkoutPlanId();
    if (applied !== plans.workoutPlan.id) {
      const existing = await loadCustomProgram();
      if (existing) await archiveProgram(existing);
      const program = coachPlanToProgram(plans.workoutPlan, plans.mealPlan);
      await saveCustomProgram(program);
      const schedule = buildFullSchedule(program.weeklySchedule as Partial<Record<DayName, SessionType>>);
      await applyScheduleWithHistory({
        appliedAt: new Date().toISOString(),
        description: `Plan from Coach ${plans.workoutPlan.coachName}: ${plans.workoutPlan.name}`,
        schedule,
        appliedByZaki: false,
      });
      await AsyncStorage.setItem(APPLIED_WORKOUT_KEY, plans.workoutPlan.id);
      appliedWorkout = true;
    }
  }

  return { workoutPlan: plans.workoutPlan, mealPlan: plans.mealPlan, appliedWorkout, appliedMeal };
}
