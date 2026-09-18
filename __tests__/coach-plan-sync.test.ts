import { describe, expect, it } from 'vitest';
import { coachPlanToProgram } from '../lib/coach-plan-sync';
import { mealPlanSchema, workoutPlanSchema } from '../server/coach-service';
import type { CoachMealPlan, CoachWorkoutPlan } from '../shared/coach-types';

const plan: CoachWorkoutPlan = {
  id: 'p1', trainerId: 1, traineeId: 2, coachName: 'Mohamad', status: 'active',
  createdAt: '2026-09-18T10:00:00.000Z', updatedAt: '2026-09-18T10:00:00.000Z',
  name: 'Lean Bulk', description: '', durationWeeks: 6, notes: '',
  sessions: [
    { id: 'push', name: 'Push', exercises: [{ name: 'Bench', sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180, notes: '', muscleGroup: 'upper', bodyPart: 'Chest', category: 'compound' }] },
    { id: 'legs', name: 'Legs', exercises: [{ name: 'Squat', sets: 4, repsMin: 6, repsMax: 8, restSeconds: 180, notes: '', muscleGroup: 'lower', bodyPart: 'Legs', category: 'compound' }] },
  ],
  weeklySchedule: { Sunday: 'push', Monday: 'rest', Tuesday: 'legs', Wednesday: 'rest', Thursday: 'push', Friday: 'legs', Saturday: 'rest' },
};

const meal: CoachMealPlan = {
  id: 'm1', trainerId: 1, traineeId: 2, coachName: 'Mohamad', status: 'active',
  createdAt: '2026-09-18T10:00:00.000Z', updatedAt: '2026-09-18T10:00:00.000Z',
  name: 'Cut', notes: '',
  trainingDay: { calories: 2600, protein: 180, carbs: 290, fat: 70 },
  restDay: { calories: 2300, protein: 180, carbs: 215, fat: 70 },
  meals: [],
};

describe('coachPlanToProgram', () => {
  it('maps sessions, names, schedule and duration onto the CustomProgram shape', () => {
    const p = coachPlanToProgram(plan, meal);
    expect(Object.keys(p.sessions)).toEqual(['push', 'legs']);
    expect(p.sessions.push[0].name).toBe('Bench');
    expect(p.sessionNames).toEqual({ push: 'Push', legs: 'Legs' });
    expect(p.weeklySchedule.Tuesday).toBe('legs');
    expect(p.durationWeeks).toBe(6);
    expect(p.createdAt).toBe(plan.createdAt);
    expect(p.generatedByZaki).toBe(false);
    expect(p.assignedByCoach).toEqual({ planId: 'p1', coachName: 'Mohamad' });
  });

  it('carries the meal plan targets when present, none otherwise', () => {
    expect(coachPlanToProgram(plan, meal).nutritionTargets).toEqual({ training: meal.trainingDay, rest: meal.restDay });
    expect(coachPlanToProgram(plan, null).nutritionTargets).toBeUndefined();
  });

  it('gives every session a distinct colour', () => {
    const p = coachPlanToProgram(plan);
    expect(new Set(Object.values(p.sessionColors)).size).toBe(2);
  });
});

describe('workoutPlanSchema', () => {
  const body = { name: plan.name, description: '', durationWeeks: 6, sessions: plan.sessions, weeklySchedule: plan.weeklySchedule, notes: '' };

  it('accepts a well-formed plan', () => {
    expect(workoutPlanSchema.safeParse(body).success).toBe(true);
  });
  it('rejects a schedule that points at a session that does not exist', () => {
    const r = workoutPlanSchema.safeParse({ ...body, weeklySchedule: { ...body.weeklySchedule, Monday: 'ghost' } });
    expect(r.success).toBe(false);
  });
  it('rejects an all-rest week', () => {
    const rest = Object.fromEntries(Object.keys(body.weeklySchedule).map((d) => [d, 'rest']));
    expect(workoutPlanSchema.safeParse({ ...body, weeklySchedule: rest }).success).toBe(false);
  });
  it('rejects duplicate session ids and empty sessions', () => {
    expect(workoutPlanSchema.safeParse({ ...body, sessions: [plan.sessions[0], { ...plan.sessions[1], id: 'push' }] }).success).toBe(false);
    expect(workoutPlanSchema.safeParse({ ...body, sessions: [{ id: 'x', name: 'X', exercises: [] }], weeklySchedule: { ...body.weeklySchedule, Sunday: 'x', Tuesday: 'x', Thursday: 'x', Friday: 'x' } }).success).toBe(false);
  });
});

describe('mealPlanSchema', () => {
  const body = { name: 'Cut', trainingDay: meal.trainingDay, restDay: meal.restDay, meals: [{ mealNumber: 1, name: 'B', time: '08:00', foods: [], notes: '' }], notes: '' };
  it('accepts a well-formed meal plan', () => {
    expect(mealPlanSchema.safeParse(body).success).toBe(true);
  });
  it('rejects a 6th meal slot and negative macros', () => {
    expect(mealPlanSchema.safeParse({ ...body, meals: [{ ...body.meals[0], mealNumber: 6 }] }).success).toBe(false);
    expect(mealPlanSchema.safeParse({ ...body, trainingDay: { ...meal.trainingDay, protein: -1 } }).success).toBe(false);
  });
});
