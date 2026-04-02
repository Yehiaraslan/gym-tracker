import type { WorkoutLog, ExerciseLibraryEntry } from './types';

export interface VolumeBalanceResult {
  push: { sets: number; exercises: string[] };
  pull: { sets: number; exercises: string[] };
  legs: { sets: number; exercises: string[] };

  pushPullRatio: number; // ideally ~1.0
  upperLowerRatio: number; // ideally ~1.0

  alerts: VolumeAlert[];
  weeklyTrend: 'balanced' | 'push-dominant' | 'pull-dominant' | 'upper-dominant' | 'lower-dominant' | 'well-balanced';
}

export interface VolumeAlert {
  id: string;
  type: 'imbalance' | 'underdeveloped' | 'overtraining' | 'suggestion';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  emoji: string;
}

/**
 * Classifies an exercise into push, pull, or legs category
 */
function classifyExercise(
  exerciseName: string,
  library: ExerciseLibraryEntry[] | undefined
): 'push' | 'pull' | 'legs' | 'unknown' {
  if (!exerciseName) return 'unknown';

  // Try to find in library first
  if (library && library.length > 0) {
    const libraryEntry = library.find(
      (entry) => entry.name.toLowerCase() === exerciseName.toLowerCase()
    );

    if (libraryEntry) {
      const muscleGroup = libraryEntry.muscleGroup.toLowerCase();

      // Push: chest, shoulders, triceps
      if (muscleGroup === 'chest' || muscleGroup === 'shoulders' || muscleGroup === 'triceps') {
        return 'push';
      }

      // Pull: back, biceps
      if (muscleGroup === 'back' || muscleGroup === 'biceps') {
        return 'pull';
      }

      // Legs
      if (muscleGroup === 'legs') {
        return 'legs';
      }
    }
  }

  // Fallback to keyword matching
  const lower = exerciseName.toLowerCase();

  // Push keywords
  if (
    /bench|press|dip|overhead|lateral|raise|fly|pushdown|extension|pec|chest|shoulder|tricep|overhead/.test(
      lower
    )
  ) {
    return 'push';
  }

  // Pull keywords
  if (/row|pull|chin|curl|pulldown|lat|back|bicep|face pull|shrug/.test(lower)) {
    return 'pull';
  }

  // Legs keywords
  if (/squat|leg|lunge|deadlift|rdl|calf|hamstring|quad|glute|leg press|leg curl/.test(lower)) {
    return 'legs';
  }

  return 'unknown';
}

/**
 * Computes volume balance from workout logs
 * @param workoutLogs - Array of completed workout logs
 * @param exerciseLibrary - Optional exercise library for better classification
 * @param days - Number of days to look back (default 7)
 * @returns VolumeBalanceResult with alerts and metrics
 */
export function computeVolumeBalance(
  workoutLogs: WorkoutLog[],
  exerciseLibrary: ExerciseLibraryEntry[] = [],
  days: number = 7
): VolumeBalanceResult {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Filter logs within the time window
  const recentLogs = workoutLogs.filter((log) => {
    const logDate = new Date(log.date);
    return logDate >= cutoffDate && log.isCompleted;
  });

  // Initialize volume counters
  const pushExercises = new Set<string>();
  const pullExercises = new Set<string>();
  const legExercises = new Set<string>();

  let pushSets = 0;
  let pullSets = 0;
  let legsSets = 0;

  // Aggregate sets and exercises
  for (const log of recentLogs) {
    for (const exercise of log.exercises) {
      const category = classifyExercise(exercise.exerciseName, exerciseLibrary);
      const completedSets = exercise.sets.length || exercise.targetSets;

      if (category === 'push') {
        pushSets += completedSets;
        pushExercises.add(exercise.exerciseName);
      } else if (category === 'pull') {
        pullSets += completedSets;
        pullExercises.add(exercise.exerciseName);
      } else if (category === 'legs') {
        legsSets += completedSets;
        legExercises.add(exercise.exerciseName);
      }
    }
  }

  // Calculate ratios
  const pushPullRatio = pushSets > 0 && pullSets > 0 ? pushSets / pullSets : pushSets > 0 ? pushSets : pullSets > 0 ? 0 : 1;
  const upperTotal = pushSets + pullSets;
  const upperLowerRatio = upperTotal > 0 && legsSets > 0 ? upperTotal / legsSets : upperTotal > 0 ? upperTotal : legsSets > 0 ? 0 : 1;

  // Generate alerts
  const alerts: VolumeAlert[] = [];

  // Check for no training in any category
  if (pushSets === 0) {
    alerts.push({
      id: 'no-push',
      type: 'underdeveloped',
      severity: 'critical',
      title: 'No Push Training',
      message: `No push exercises (chest, shoulders, triceps) in the last ${days} days. Add some upper body pressing!`,
      emoji: '💪',
    });
  }

  if (pullSets === 0) {
    alerts.push({
      id: 'no-pull',
      type: 'underdeveloped',
      severity: 'critical',
      title: 'No Pull Training',
      message: `No pull exercises (back, biceps) in the last ${days} days. Add some rows or pull-ups!`,
      emoji: '🎯',
    });
  }

  if (legsSets === 0) {
    alerts.push({
      id: 'no-legs',
      type: 'underdeveloped',
      severity: 'critical',
      title: 'Leg Day Missing',
      message: `No leg training in the last ${days} days. Don't skip leg day!`,
      emoji: '🦵',
    });
  }

  // Check Push/Pull imbalance
  if (pushSets > 0 && pullSets > 0) {
    if (pushPullRatio > 2.0 || pushPullRatio < 0.5) {
      alerts.push({
        id: 'severe-push-pull-imbalance',
        type: 'imbalance',
        severity: 'critical',
        title: 'Severe Push/Pull Imbalance',
        message: `Push:Pull ratio is ${pushPullRatio.toFixed(2)}:1. This imbalance increases injury risk.`,
        emoji: '⚠️',
      });
    } else if (pushPullRatio > 1.5 || pushPullRatio < 0.67) {
      alerts.push({
        id: 'push-pull-imbalance',
        type: 'imbalance',
        severity: 'warning',
        title: 'Push/Pull Imbalance',
        message: `Push:Pull ratio is ${pushPullRatio.toFixed(2)}:1. Try to maintain closer to 1:1.`,
        emoji: '⚖️',
      });
    }
  }

  // Check Upper/Lower imbalance
  if (upperTotal > 0 && legsSets > 0) {
    if (upperLowerRatio > 2.0) {
      alerts.push({
        id: 'upper-dominant',
        type: 'imbalance',
        severity: 'warning',
        title: 'Upper Body Dominant',
        message: `Upper:Lower ratio is ${upperLowerRatio.toFixed(2)}:1. Add more leg volume.`,
        emoji: '🦵',
      });
    } else if (upperLowerRatio < 0.5) {
      alerts.push({
        id: 'lower-dominant',
        type: 'imbalance',
        severity: 'warning',
        title: 'Lower Body Dominant',
        message: `Upper:Lower ratio is ${upperLowerRatio.toFixed(2)}:1. Add more upper body work.`,
        emoji: '💪',
      });
    }
  }

  // Check for overtraining
  if (pushSets > 30) {
    alerts.push({
      id: 'high-push-volume',
      type: 'overtraining',
      severity: 'info',
      title: 'High Push Volume',
      message: `${pushSets} push sets in ${days} days. Monitor recovery!`,
      emoji: '⚡',
    });
  }

  if (pullSets > 30) {
    alerts.push({
      id: 'high-pull-volume',
      type: 'overtraining',
      severity: 'info',
      title: 'High Pull Volume',
      message: `${pullSets} pull sets in ${days} days. Monitor recovery!`,
      emoji: '⚡',
    });
  }

  if (legsSets > 30) {
    alerts.push({
      id: 'high-legs-volume',
      type: 'overtraining',
      severity: 'info',
      title: 'High Leg Volume',
      message: `${legsSets} leg sets in ${days} days. Monitor recovery!`,
      emoji: '⚡',
    });
  }

  // Determine weekly trend
  let weeklyTrend: VolumeBalanceResult['weeklyTrend'] = 'well-balanced';

  if (pushSets === 0 || pullSets === 0 || legsSets === 0) {
    weeklyTrend = 'balanced'; // Incomplete training
  } else if (pushPullRatio > 1.5) {
    weeklyTrend = 'push-dominant';
  } else if (pushPullRatio < 0.67) {
    weeklyTrend = 'pull-dominant';
  } else if (upperLowerRatio > 1.5) {
    weeklyTrend = 'upper-dominant';
  } else if (upperLowerRatio < 0.67) {
    weeklyTrend = 'lower-dominant';
  }

  return {
    push: {
      sets: pushSets,
      exercises: Array.from(pushExercises),
    },
    pull: {
      sets: pullSets,
      exercises: Array.from(pullExercises),
    },
    legs: {
      sets: legsSets,
      exercises: Array.from(legExercises),
    },
    pushPullRatio,
    upperLowerRatio,
    alerts,
    weeklyTrend,
  };
}

/**
 * Gets a one-line suggestion based on the volume balance result
 */
export function getBalanceSuggestion(result: VolumeBalanceResult): string {
  const criticalAlert = result.alerts.find((a) => a.severity === 'critical');
  if (criticalAlert) {
    return criticalAlert.message;
  }

  const warningAlert = result.alerts.find((a) => a.severity === 'warning');
  if (warningAlert) {
    return warningAlert.message;
  }

  if (result.weeklyTrend === 'well-balanced') {
    return 'Your training volume is perfectly balanced! Keep it up!';
  }

  if (result.weeklyTrend === 'push-dominant') {
    return 'Great push volume! Consider adding more pull exercises.';
  }

  if (result.weeklyTrend === 'pull-dominant') {
    return 'Solid pull work! Balance it with more pressing movements.';
  }

  if (result.weeklyTrend === 'upper-dominant') {
    return 'Upper body is strong! Make sure to include leg training.';
  }

  if (result.weeklyTrend === 'lower-dominant') {
    return 'Excellent leg volume! Add more upper body work for balance.';
  }

  return 'Keep tracking your volume for better insights.';
}
