// ============================================================
// MUSCLE HEATMAP — Calculate muscle group activity from workouts
// Maps exercises to muscle groups and computes intensity levels
// ============================================================

import type { WorkoutLog, ExerciseLibraryEntry } from './types';

// Define all muscle groups we track
export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core';

export type IntensityLevel = 'none' | 'low' | 'moderate' | 'high' | 'overtrained';

export interface HeatmapEntry {
  sets: number;
  intensity: IntensityLevel;
}

export type MuscleHeatmap = Record<MuscleGroup, HeatmapEntry>;

export interface BalanceMetrics {
  pushSets: number;
  pullSets: number;
  legSets: number;
  ratio: string;
}

// Muscle group display info
export const MUSCLE_GROUPS: Record<MuscleGroup, { label: string; category: 'push' | 'pull' | 'legs' }> = {
  'Chest': { label: 'Chest', category: 'push' },
  'Back': { label: 'Back', category: 'pull' },
  'Shoulders': { label: 'Shoulders', category: 'push' },
  'Biceps': { label: 'Biceps', category: 'pull' },
  'Triceps': { label: 'Triceps', category: 'push' },
  'Quads': { label: 'Quads', category: 'legs' },
  'Hamstrings': { label: 'Hamstrings', category: 'legs' },
  'Glutes': { label: 'Glutes', category: 'legs' },
  'Calves': { label: 'Calves', category: 'legs' },
  'Core': { label: 'Core', category: 'push' },
};

// Map detailed muscle names to our muscle groups
const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  // Chest
  'Pectoralis Major (Lower)': 'Chest',
  'Pectoralis Major (Sternal)': 'Chest',
  'Pectoralis Minor': 'Chest',
  'Pectoralis': 'Chest',

  // Back
  'Latissimus Dorsi': 'Back',
  'Lats': 'Back',
  'Rhomboids': 'Back',
  'Rhomboid Major': 'Back',
  'Rhomboid Minor': 'Back',
  'Middle Trapezius': 'Back',
  'Trapezius': 'Back',
  'Traps': 'Back',

  // Shoulders
  'Anterior Deltoid': 'Shoulders',
  'Lateral Deltoid': 'Shoulders',
  'Rear Deltoid': 'Shoulders',
  'Deltoids': 'Shoulders',
  'Deltoid': 'Shoulders',

  // Biceps
  'Biceps Brachii': 'Biceps',
  'Biceps': 'Biceps',

  // Triceps
  'Triceps Brachii': 'Triceps',
  'Triceps': 'Triceps',

  // Quads
  'Quadriceps': 'Quads',
  'Quads': 'Quads',
  'Rectus Femoris': 'Quads',
  'Vastus Lateralis': 'Quads',
  'Vastus Medialis': 'Quads',
  'Vastus Intermedius': 'Quads',

  // Hamstrings
  'Hamstrings': 'Hamstrings',
  'Biceps Femoris': 'Hamstrings',
  'Semitendinosus': 'Hamstrings',
  'Semimembranosus': 'Hamstrings',

  // Glutes
  'Gluteus Maximus': 'Glutes',
  'Glutes': 'Glutes',
  'Gluteus Medius': 'Glutes',
  'Gluteus Minimus': 'Glutes',

  // Calves
  'Calves': 'Calves',
  'Calf': 'Calves',
  'Gastrocnemius': 'Calves',
  'Soleus': 'Calves',

  // Core
  'Core': 'Core',
  'Rectus Abdominis': 'Core',
  'Abs': 'Core',
  'Abdominals': 'Core',
  'Obliques': 'Core',
  'Serratus Anterior': 'Core',
  'Transverse Abdominis': 'Core',
};

/**
 * Map a muscle name to a muscle group
 */
function mapMuscleToGroup(muscleName: string): MuscleGroup | null {
  // Direct match
  if (muscleName in MUSCLE_TO_GROUP) {
    return MUSCLE_TO_GROUP[muscleName];
  }

  // Fuzzy match: check if muscle name contains any known group name
  const nameLower = muscleName.toLowerCase();
  for (const [muscleKey, group] of Object.entries(MUSCLE_TO_GROUP)) {
    if (nameLower.includes(muscleKey.toLowerCase())) {
      return group;
    }
  }

  return null;
}

/**
 * Get intensity level from set count
 * Thresholds: 0 = none, 1-4 = low, 5-10 = moderate, 11-16 = high, 17+ = overtrained
 */
function getIntensity(sets: number): IntensityLevel {
  if (sets === 0) return 'none';
  if (sets <= 4) return 'low';
  if (sets <= 10) return 'moderate';
  if (sets <= 16) return 'high';
  return 'overtrained';
}

/**
 * Compute muscle heatmap from workout logs
 * Looks at the last `days` days and accumulates sets per muscle group
 * Primary muscles = full set count, secondary = 0.5x set count
 */
export function computeMuscleHeatmap(
  workoutLogs: WorkoutLog[],
  exerciseLibrary: ExerciseLibraryEntry[],
  days: number = 7
): MuscleHeatmap {
  const heatmap = {} as MuscleHeatmap;

  // Initialize all muscle groups with 0 sets
  Object.keys(MUSCLE_GROUPS).forEach((muscle) => {
    heatmap[muscle as MuscleGroup] = { sets: 0, intensity: 'none' };
  });

  // Calculate cutoff date
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Process each workout
  for (const workout of workoutLogs) {
    const workoutDate = new Date(workout.date);
    if (workoutDate < cutoffDate) continue;

    // Process each exercise in the workout
    for (const exerciseLog of workout.exercises) {
      // Find the exercise in the library
      const libEntry = exerciseLibrary.find(
        (lib) => lib.name.toLowerCase() === exerciseLog.exerciseName.toLowerCase()
      );

      if (!libEntry) continue;

      const setCount = exerciseLog.sets.length;

      // Add primary muscles (full set count)
      for (const muscleName of libEntry.primaryMuscles) {
        const group = mapMuscleToGroup(muscleName);
        if (group) {
          heatmap[group].sets += setCount;
        }
      }

      // Add secondary muscles (0.5x set count)
      for (const muscleName of libEntry.secondaryMuscles) {
        const group = mapMuscleToGroup(muscleName);
        if (group) {
          heatmap[group].sets += setCount * 0.5;
        }
      }
    }
  }

  // Calculate intensity levels
  Object.keys(heatmap).forEach((muscle) => {
    const entry = heatmap[muscle as MuscleGroup];
    entry.intensity = getIntensity(entry.sets);
  });

  return heatmap;
}

/**
 * Get list of neglected muscles (0 sets in the period)
 */
export function getNeglectedMuscles(heatmap: MuscleHeatmap): MuscleGroup[] {
  return Object.entries(heatmap)
    .filter(([, entry]) => entry.sets === 0)
    .map(([muscle]) => muscle as MuscleGroup);
}

/**
 * Get push/pull/leg balance metrics
 */
export function getMuscleBalance(heatmap: MuscleHeatmap): BalanceMetrics {
  let pushSets = 0;
  let pullSets = 0;
  let legSets = 0;

  Object.entries(heatmap).forEach(([muscle, entry]) => {
    const category = MUSCLE_GROUPS[muscle as MuscleGroup].category;
    switch (category) {
      case 'push':
        pushSets += entry.sets;
        break;
      case 'pull':
        pullSets += entry.sets;
        break;
      case 'legs':
        legSets += entry.sets;
        break;
    }
  });

  // Calculate ratio description
  const total = pushSets + pullSets + legSets;
  let ratio = 'Balanced';

  if (total === 0) {
    ratio = 'No data';
  } else {
    const pushPct = Math.round((pushSets / total) * 100);
    const pullPct = Math.round((pullSets / total) * 100);
    const legPct = Math.round((legSets / total) * 100);

    ratio = `Push: ${pushPct}% | Pull: ${pullPct}% | Legs: ${legPct}%`;
  }

  return {
    pushSets: Math.round(pushSets * 10) / 10,
    pullSets: Math.round(pullSets * 10) / 10,
    legSets: Math.round(legSets * 10) / 10,
    ratio,
  };
}
