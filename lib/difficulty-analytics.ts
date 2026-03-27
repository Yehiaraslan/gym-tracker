import { DifficultyRating, ExerciseLog, WorkoutLog } from './types';

export interface DifficultyStats {
  exerciseId: string;
  exerciseName: string;
  totalAttempts: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  easyPercentage: number;
  mediumPercentage: number;
  hardPercentage: number;
  averageDifficulty: number; // 1=easy, 2=medium, 3=hard
  trend: 'improving' | 'stable' | 'declining'; // Based on recent 5 attempts
}

export interface DifficultyTrend {
  exerciseId: string;
  exerciseName: string;
  lastFiveRatings: DifficultyRating[];
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Calculate difficulty statistics for an exercise
 */
export function calculateDifficultyStats(
  exerciseId: string,
  exerciseName: string,
  logs: ExerciseLog[]
): DifficultyStats {
  const exerciseLogs = logs.filter(
    log => log.exerciseId === exerciseId && log.difficulty
  );

  const easyCount = exerciseLogs.filter(log => log.difficulty === 'easy').length;
  const mediumCount = exerciseLogs.filter(log => log.difficulty === 'medium').length;
  const hardCount = exerciseLogs.filter(log => log.difficulty === 'hard').length;
  const totalAttempts = exerciseLogs.length;

  const easyPercentage = totalAttempts > 0 ? (easyCount / totalAttempts) * 100 : 0;
  const mediumPercentage = totalAttempts > 0 ? (mediumCount / totalAttempts) * 100 : 0;
  const hardPercentage = totalAttempts > 0 ? (hardCount / totalAttempts) * 100 : 0;

  // Calculate average difficulty (1=easy, 2=medium, 3=hard)
  const difficultyValues = exerciseLogs.map(log => {
    if (log.difficulty === 'easy') return 1;
    if (log.difficulty === 'medium') return 2;
    return 3;
  });

  const averageDifficulty =
    difficultyValues.length > 0
      ? difficultyValues.reduce((a, b) => a + b, 0) / difficultyValues.length
      : 0;

  // Determine trend based on last 5 attempts
  const lastFive = exerciseLogs.slice(-5);
  let trend: 'improving' | 'stable' | 'declining' = 'stable';

  if (lastFive.length >= 3) {
    const firstHalf = lastFive.slice(0, Math.ceil(lastFive.length / 2));
    const secondHalf = lastFive.slice(Math.ceil(lastFive.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, log) => {
        if (log.difficulty === 'easy') return sum + 1;
        if (log.difficulty === 'medium') return sum + 2;
        return sum + 3;
      }, 0) / firstHalf.length;

    const secondAvg =
      secondHalf.reduce((sum, log) => {
        if (log.difficulty === 'easy') return sum + 1;
        if (log.difficulty === 'medium') return sum + 2;
        return sum + 3;
      }, 0) / secondHalf.length;

    if (secondAvg < firstAvg - 0.3) {
      trend = 'improving';
    } else if (secondAvg > firstAvg + 0.3) {
      trend = 'declining';
    }
  }

  return {
    exerciseId,
    exerciseName,
    totalAttempts,
    easyCount,
    mediumCount,
    hardCount,
    easyPercentage,
    mediumPercentage,
    hardPercentage,
    averageDifficulty,
    trend,
  };
}

/**
 * Get difficulty trend for an exercise
 */
export function getDifficultyTrend(
  exerciseId: string,
  exerciseName: string,
  logs: ExerciseLog[]
): DifficultyTrend {
  const exerciseLogs = logs
    .filter(log => log.exerciseId === exerciseId && log.difficulty)
    .slice(-5);

  const lastFiveRatings = exerciseLogs.map(log => log.difficulty!);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';

  if (lastFiveRatings.length >= 3) {
    const firstHalf = lastFiveRatings.slice(0, Math.ceil(lastFiveRatings.length / 2));
    const secondHalf = lastFiveRatings.slice(Math.ceil(lastFiveRatings.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, rating) => {
        if (rating === 'easy') return sum + 1;
        if (rating === 'medium') return sum + 2;
        return sum + 3;
      }, 0) / firstHalf.length;

    const secondAvg =
      secondHalf.reduce((sum, rating) => {
        if (rating === 'easy') return sum + 1;
        if (rating === 'medium') return sum + 2;
        return sum + 3;
      }, 0) / secondHalf.length;

    if (secondAvg < firstAvg - 0.3) {
      trend = 'improving';
    } else if (secondAvg > firstAvg + 0.3) {
      trend = 'declining';
    }
  }

  return {
    exerciseId,
    exerciseName,
    lastFiveRatings,
    trend,
  };
}

/**
 * Get all exercises that need attention (consistently hard)
 */
export function getExercisesThatNeedAttention(
  workoutLogs: WorkoutLog[]
): DifficultyStats[] {
  const allLogs: ExerciseLog[] = [];
  const exerciseMap = new Map<string, string>();

  workoutLogs.forEach(workout => {
    (workout.exercises ?? []).forEach(exercise => {
      allLogs.push(exercise);
      exerciseMap.set(exercise.exerciseId, exercise.exerciseName);
    });
  });

  const exerciseIds = Array.from(new Set(allLogs.map(log => log.exerciseId)));

  return exerciseIds
    .map(id => {
      const name = exerciseMap.get(id) || 'Unknown';
      return calculateDifficultyStats(id, name, allLogs);
    })
    .filter(stats => stats.hardPercentage >= 50 && stats.totalAttempts >= 3)
    .sort((a, b) => b.hardPercentage - a.hardPercentage);
}

/**
 * Get recommended exercises to focus on (improving trend)
 */
export function getRecommendedFocusExercises(
  workoutLogs: WorkoutLog[]
): DifficultyStats[] {
  const allLogs: ExerciseLog[] = [];
  const exerciseMap = new Map<string, string>();

  workoutLogs.forEach(workout => {
    (workout.exercises ?? []).forEach(exercise => {
      allLogs.push(exercise);
      exerciseMap.set(exercise.exerciseId, exercise.exerciseName);
    });
  });

  const exerciseIds = Array.from(new Set(allLogs.map(log => log.exerciseId)));

  return exerciseIds
    .map(id => {
      const name = exerciseMap.get(id) || 'Unknown';
      return calculateDifficultyStats(id, name, allLogs);
    })
    .filter(stats => stats.trend === 'improving' && stats.totalAttempts >= 3)
    .sort((a, b) => b.easyPercentage - a.easyPercentage);
}
