/**
 * Readiness/Fatigue Score Calculator
 * Computes a 0-100 readiness score by combining sleep, recovery, nutrition, and training load
 */

export interface ReadinessInput {
  // Sleep (from SleepEntry)
  sleepDurationHours: number | null;
  sleepQuality: number | null; // 1-5

  // Recovery (from WHOOP if available)
  whoopRecoveryScore: number | null; // 0-100
  hrv: number | null;
  rhr: number | null;

  // Nutrition (from DailyNutrition)
  caloriesVsTarget: number | null; // ratio, e.g. 0.9 = 90% of target
  proteinVsTarget: number | null;

  // Training load
  workoutsLast7Days: number;
  totalVolumeLast7Days: number; // total kg * reps
  totalVolumePrevious7Days: number; // for comparison
  currentStreak: number;
}

export interface ReadinessBreakdown {
  sleep: { score: number; weight: number; detail: string };
  recovery: { score: number; weight: number; detail: string };
  nutrition: { score: number; weight: number; detail: string };
  trainingLoad: { score: number; weight: number; detail: string };
}

export interface ReadinessResult {
  score: number; // 0-100
  label: 'Fully Ready' | 'Good to Go' | 'Moderate' | 'Fatigued' | 'Exhausted';
  emoji: string;
  color: string;
  breakdown: ReadinessBreakdown;
  recommendation: string;
}

/**
 * Calculate sleep score (25% weight)
 * 8+ hours & quality 4+ = 100
 * 7h & quality 3 = 70
 * <6h or quality ≤2 = 30
 * null = 50 (neutral)
 */
function calculateSleepScore(
  durationHours: number | null,
  quality: number | null
): { score: number; detail: string } {
  if (durationHours === null || quality === null) {
    return { score: 50, detail: 'No sleep data' };
  }

  if (durationHours >= 8 && quality >= 4) {
    return { score: 100, detail: `${durationHours.toFixed(1)}h, quality ${quality}/5 - excellent` };
  }

  if (durationHours >= 7 && quality >= 3) {
    return { score: 70, detail: `${durationHours.toFixed(1)}h, quality ${quality}/5 - good` };
  }

  if (durationHours < 6 || quality <= 2) {
    return { score: 30, detail: `${durationHours?.toFixed(1) || '?'}h, quality ${quality}/5 - poor` };
  }

  // 6-7 hours with moderate quality
  return { score: 55, detail: `${durationHours.toFixed(1)}h, quality ${quality}/5 - fair` };
}

/**
 * Calculate recovery score (30% weight)
 * Use WHOOP recovery score directly if available
 * If null, use 50 (neutral)
 */
function calculateRecoveryScore(whoopScore: number | null): {
  score: number;
  detail: string;
} {
  if (whoopScore === null) {
    return { score: 50, detail: 'No WHOOP data - neutral' };
  }

  if (whoopScore >= 85) {
    return { score: 100, detail: `WHOOP ${whoopScore} - exceptional` };
  }

  if (whoopScore >= 70) {
    return { score: 85, detail: `WHOOP ${whoopScore} - excellent` };
  }

  if (whoopScore >= 55) {
    return { score: 70, detail: `WHOOP ${whoopScore} - good` };
  }

  if (whoopScore >= 40) {
    return { score: 50, detail: `WHOOP ${whoopScore} - fair` };
  }

  return { score: 30, detail: `WHOOP ${whoopScore} - poor` };
}

/**
 * Calculate nutrition score (20% weight)
 * Meeting 90%+ of calorie & protein targets = 100
 * 70-90% = 70
 * <70% = 40
 * null = 50 (neutral)
 */
function calculateNutritionScore(
  caloriesRatio: number | null,
  proteinRatio: number | null
): { score: number; detail: string } {
  if (caloriesRatio === null || proteinRatio === null) {
    return { score: 50, detail: 'No nutrition data' };
  }

  const avgRatio = (caloriesRatio + proteinRatio) / 2;

  if (avgRatio >= 0.9) {
    return {
      score: 100,
      detail: `Calories ${(caloriesRatio * 100).toFixed(0)}%, Protein ${(proteinRatio * 100).toFixed(0)}% - excellent`,
    };
  }

  if (avgRatio >= 0.7) {
    return {
      score: 70,
      detail: `Calories ${(caloriesRatio * 100).toFixed(0)}%, Protein ${(proteinRatio * 100).toFixed(0)}% - good`,
    };
  }

  return {
    score: 40,
    detail: `Calories ${(caloriesRatio * 100).toFixed(0)}%, Protein ${(proteinRatio * 100).toFixed(0)}% - insufficient`,
  };
}

/**
 * Calculate training load score (25% weight)
 * Compares volume last 7 days to previous 7 days
 * Ratio >1.3 = overtrained (30)
 * 1.0-1.3 = moderate (70)
 * 0.7-1.0 = well-managed (90)
 * <0.7 = detraining risk (60)
 * Also factors in workouts/week (4 ideal = 100, 5+ = 70, ≤2 = 60)
 */
function calculateTrainingLoadScore(
  workoutsLast7Days: number,
  volumeLast7Days: number,
  volumePrevious7Days: number
): { score: number; detail: string } {
  // Calculate volume ratio
  let volumeScore = 70; // default
  let volumeDetail = 'volume tracking unavailable';

  if (volumePrevious7Days > 0) {
    const volumeRatio = volumeLast7Days / volumePrevious7Days;

    if (volumeRatio > 1.3) {
      volumeScore = 30;
      volumeDetail = `Volume up ${((volumeRatio - 1) * 100).toFixed(0)}% - overtraining risk`;
    } else if (volumeRatio >= 1.0 && volumeRatio <= 1.3) {
      volumeScore = 70;
      volumeDetail = `Volume up ${((volumeRatio - 1) * 100).toFixed(0)}% - moderate increase`;
    } else if (volumeRatio >= 0.7 && volumeRatio < 1.0) {
      volumeScore = 90;
      volumeDetail = `Volume down ${((1 - volumeRatio) * 100).toFixed(0)}% - well-managed`;
    } else if (volumeRatio < 0.7) {
      volumeScore = 60;
      volumeDetail = `Volume down ${((1 - volumeRatio) * 100).toFixed(0)}% - detraining risk`;
    }
  }

  // Adjust for workout frequency
  let frequencyScore = 70; // default
  if (workoutsLast7Days === 4) {
    frequencyScore = 100;
  } else if (workoutsLast7Days >= 5) {
    frequencyScore = 70;
  } else if (workoutsLast7Days <= 2) {
    frequencyScore = 60;
  }

  // Blend volume and frequency
  const blendedScore = Math.round((volumeScore + frequencyScore) / 2);
  const detail = `${workoutsLast7Days} workouts - ${volumeDetail}`;

  return { score: blendedScore, detail };
}

/**
 * Compute overall readiness score
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const sleep = calculateSleepScore(input.sleepDurationHours, input.sleepQuality);
  const recovery = calculateRecoveryScore(input.whoopRecoveryScore);
  const nutrition = calculateNutritionScore(input.caloriesVsTarget, input.proteinVsTarget);
  const trainingLoad = calculateTrainingLoadScore(
    input.workoutsLast7Days,
    input.totalVolumeLast7Days,
    input.totalVolumePrevious7Days
  );

  // Weights: sleep (25%), recovery (30%), nutrition (20%), training load (25%)
  const weights = {
    sleep: 0.25,
    recovery: 0.3,
    nutrition: 0.2,
    trainingLoad: 0.25,
  };

  const score = Math.round(
    sleep.score * weights.sleep +
      recovery.score * weights.recovery +
      nutrition.score * weights.nutrition +
      trainingLoad.score * weights.trainingLoad
  );

  // Determine label and emoji based on score
  let label: 'Fully Ready' | 'Good to Go' | 'Moderate' | 'Fatigued' | 'Exhausted';
  let emoji: string;
  let color: string;
  let recommendation: string;

  if (score >= 85) {
    label = 'Fully Ready';
    emoji = '🟢';
    color = '#22C55E';
    recommendation = 'You are well-rested and fueled. Push hard in the gym today!';
  } else if (score >= 70) {
    label = 'Good to Go';
    emoji = '💪';
    color = '#3B82F6';
    recommendation = 'You are in good shape. Proceed with your planned workout.';
  } else if (score >= 50) {
    label = 'Moderate';
    emoji = '🟡';
    color = '#F59E0B';
    recommendation = 'You are moderately fatigued. Consider reducing volume or intensity slightly.';
  } else if (score >= 30) {
    label = 'Fatigued';
    emoji = '🟠';
    color = '#F97316';
    recommendation = 'You are quite fatigued. Consider a lighter session, focus on recovery, or rest today.';
  } else {
    label = 'Exhausted';
    emoji = '🔴';
    color = '#EF4444';
    recommendation = 'You are extremely fatigued. Take a full rest day and focus on sleep, nutrition, and recovery.';
  }

  return {
    score,
    label,
    emoji,
    color,
    breakdown: {
      sleep: { ...sleep, weight: weights.sleep },
      recovery: { ...recovery, weight: weights.recovery },
      nutrition: { ...nutrition, weight: weights.nutrition },
      trainingLoad: { ...trainingLoad, weight: weights.trainingLoad },
    },
    recommendation,
  };
}
