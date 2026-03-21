// ============================================================
// XP & Level System — Gamification Engine
// Adapted from hypertrophy-tracker
// ============================================================
import { XPState, PlayerLevel } from './types';

// Level thresholds
const LEVEL_THRESHOLDS: { level: PlayerLevel; minXP: number; icon: string }[] = [
  { level: 'Beginner', minXP: 0, icon: '🌱' },
  { level: 'Novice', minXP: 500, icon: '🏋️' },
  { level: 'Intermediate', minXP: 2000, icon: '💪' },
  { level: 'Advanced', minXP: 5000, icon: '🔥' },
  { level: 'Elite', minXP: 10000, icon: '⚡' },
  { level: 'Legend', minXP: 25000, icon: '👑' },
];

// XP rewards
export const XP_REWARDS = {
  WORKOUT_COMPLETED: 100,
  PERFECT_WEEK: 300, // 4 workouts in a week
  PR_HIT: 200,
  NUTRITION_LOGGED: 25,
  SLEEP_LOGGED: 25,
  WEIGHT_LOGGED: 15,
  STREAK_7_DAYS: 500,
  STREAK_30_DAYS: 2000,
  FIRST_WORKOUT: 250,
} as const;

// Calculate level from XP
export function getLevelFromXP(xp: number): PlayerLevel {
  let currentLevel: PlayerLevel = 'Beginner';
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.minXP) {
      currentLevel = threshold.level;
    }
  }
  return currentLevel;
}

// Get level info
export function getLevelInfo(level: PlayerLevel) {
  const info = LEVEL_THRESHOLDS.find(t => t.level === level);
  const index = LEVEL_THRESHOLDS.findIndex(t => t.level === level);
  const nextLevel = index < LEVEL_THRESHOLDS.length - 1 ? LEVEL_THRESHOLDS[index + 1] : null;
  
  return {
    level,
    icon: info?.icon || '🌱',
    currentMinXP: info?.minXP || 0,
    nextLevelXP: nextLevel?.minXP || null,
    nextLevel: nextLevel?.level || null,
  };
}

// Calculate progress to next level (0-100%)
export function getLevelProgress(xpState: XPState): number {
  const info = getLevelInfo(xpState.level);
  if (!info.nextLevelXP) return 100; // Max level
  
  const xpInLevel = xpState.totalXP - info.currentMinXP;
  const xpNeeded = info.nextLevelXP - info.currentMinXP;
  
  return Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
}

// Add XP and return updated state
export function addXP(state: XPState, amount: number, reason: string): XPState {
  const newTotal = state.totalXP + amount;
  const newLevel = getLevelFromXP(newTotal);
  
  return {
    ...state,
    totalXP: newTotal,
    level: newLevel,
  };
}

// Award XP for completing a workout
export function awardWorkoutXP(state: XPState): XPState {
  let updated = addXP(state, XP_REWARDS.WORKOUT_COMPLETED, 'Workout completed');
  updated = { ...updated, workoutsCompleted: updated.workoutsCompleted + 1 };
  
  // First workout bonus
  if (updated.workoutsCompleted === 1) {
    updated = addXP(updated, XP_REWARDS.FIRST_WORKOUT, 'First workout!');
  }
  
  return updated;
}

// Award XP for hitting a PR
export function awardPRXP(state: XPState): XPState {
  const updated = addXP(state, XP_REWARDS.PR_HIT, 'New PR!');
  return { ...updated, prsHit: updated.prsHit + 1 };
}

// Award XP for perfect week (4 workouts)
export function awardPerfectWeekXP(state: XPState): XPState {
  const updated = addXP(state, XP_REWARDS.PERFECT_WEEK, 'Perfect week!');
  return { ...updated, perfectWeeks: updated.perfectWeeks + 1 };
}

// Get all level thresholds for display
export function getAllLevels() {
  return LEVEL_THRESHOLDS;
}
