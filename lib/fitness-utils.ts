// ============================================================
// FITNESS UTILITIES — 1RM, Deload, Progression Logic
// ============================================================

/**
 * Epley formula: estimates 1-rep max from weight and rep count.
 * 1RM = weight × (1 + reps / 30)
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/**
 * Best estimated 1RM from an array of sets.
 */
export function bestEpley1RM(sets: { weight: number; reps: number }[]): number {
  return sets
    .filter(s => s.weight > 0 && s.reps > 0)
    .reduce((best, s) => {
      const rm = epley1RM(s.weight, s.reps);
      return rm > best ? rm : best;
    }, 0);
}

/**
 * Rounds weight to nearest practical increment (default 2.5 kg).
 */
export function roundToIncrement(weight: number, increment = 2.5): number {
  return Math.round(weight / increment) * increment;
}

/**
 * Deload weight: 70% of working weight, rounded to 2.5 kg.
 */
export function deloadWeight(workingWeightKg: number): number {
  return roundToIncrement(workingWeightKg * 0.7);
}

/**
 * Suggested weight for next session based on context.
 *
 * Logic:
 * - If deload week → 70% of last weight, rounded to 2.5kg
 * - If last RPE was 10 (max effort) → keep same weight
 * - If hit top of rep range for 2+ consecutive sessions → +2.5kg upper / +5kg lower
 * - If hit top of rep range once → +2.5kg upper / +2.5kg lower
 * - Otherwise → same weight as last session
 */
export function suggestWeight(params: {
  lastWeight: number;
  lastReps: number;
  lastRPE?: number;
  targetRepsMax: number;
  muscleGroup: 'upper' | 'lower';
  isDeload: boolean;
  consecutiveTopRangeSessions: number; // how many sessions in a row hit top of range
}): { weight: number; reason: string } {
  const { lastWeight, lastReps, lastRPE, targetRepsMax, muscleGroup, isDeload, consecutiveTopRangeSessions } = params;

  if (isDeload) {
    return {
      weight: deloadWeight(lastWeight),
      reason: `Deload: 70% of ${lastWeight}kg`,
    };
  }

  if (lastRPE === 10) {
    return {
      weight: lastWeight,
      reason: 'RPE 10 last session — maintain weight',
    };
  }

  const increment = muscleGroup === 'upper' ? 2.5 : 5;

  if (consecutiveTopRangeSessions >= 2) {
    return {
      weight: roundToIncrement(lastWeight + increment),
      reason: `Hit ${targetRepsMax} reps ${consecutiveTopRangeSessions}x → +${increment}kg`,
    };
  }

  if (lastReps >= targetRepsMax) {
    const smallIncrement = 2.5;
    return {
      weight: roundToIncrement(lastWeight + smallIncrement),
      reason: `Hit top of range (${lastReps}/${targetRepsMax}) → +${smallIncrement}kg`,
    };
  }

  return {
    weight: lastWeight,
    reason: 'Maintain — still building in rep range',
  };
}

/**
 * Calculate warm-up sets at 40%, 60%, 80% of working weight.
 */
export function getWarmupSets(workingWeight: number): { pct: number; weight: number; reps: number }[] {
  if (workingWeight <= 20) return [];
  return [
    { pct: 40, weight: roundToIncrement(workingWeight * 0.4), reps: 10 },
    { pct: 60, weight: roundToIncrement(workingWeight * 0.6), reps: 5 },
    { pct: 80, weight: roundToIncrement(workingWeight * 0.8), reps: 3 },
  ];
}

/**
 * Volume load for a set of exercises.
 */
export function calculateVolumeLoad(sets: { weight: number; reps: number }[]): number {
  return sets.reduce((total, s) => total + s.weight * s.reps, 0);
}

/**
 * RPE descriptions.
 */
export const RPE_LABELS: Record<number, { label: string; color: string }> = {
  6: { label: 'Very Easy', color: '#10B981' },
  7: { label: 'Easy', color: '#10B981' },
  8: { label: 'Moderate', color: '#3B82F6' },
  9: { label: 'Hard', color: '#F59E0B' },
  10: { label: 'Max Effort', color: '#EF4444' },
};

export const RPE_VALUES = [6, 7, 8, 9, 10] as const;
