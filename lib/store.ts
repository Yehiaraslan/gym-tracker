import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Exercise, 
  ProgramDay, 
  WorkoutLog, 
  AppSettings, 
  GymStore,
  generateId,
  DayExercise,
  BodyMeasurement,
  WarmupCooldownExercise,
  WarmupCooldownConfig
} from './types';

const STORAGE_KEY = '@gym_tracker_data';

// Default initial state
const defaultState: GymStore = {
  exercises: [],
  programDays: [],
  workoutLogs: [],
  bodyMeasurements: [],
  warmupCooldown: {
    warmupExercises: [],
    cooldownExercises: [],
  },
  settings: {
    cycleStartDate: new Date().toLocaleDateString('en-CA'),
    currentCycle: 1,
  },
  nutritionLogs: [],
  sleepEntries: [],
  weightEntries: [],
  mesocycle: {
    id: 'meso-1',
    startDate: new Date().toLocaleDateString('en-CA'),
    currentWeek: 1,
    totalWeeks: 5,
    isDeload: false,
  },
  coachRecommendations: [],
  xpState: {
    totalXP: 0,
    level: 'Beginner' as const,
    workoutsCompleted: 0,
    perfectWeeks: 0,
    prsHit: 0,
  },
  personalRecords: [],
};

// Load data from AsyncStorage
export async function loadStore(): Promise<GymStore> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as GymStore;
      // Ensure all fields exist (for backwards compatibility)
      return {
        exercises: parsed.exercises || [],
        programDays: parsed.programDays || [],
        workoutLogs: parsed.workoutLogs || [],
        bodyMeasurements: parsed.bodyMeasurements || [],
        warmupCooldown: parsed.warmupCooldown || defaultState.warmupCooldown,
        settings: parsed.settings || defaultState.settings,
        nutritionLogs: parsed.nutritionLogs || [],
        sleepEntries: parsed.sleepEntries || [],
        weightEntries: parsed.weightEntries || [],
        mesocycle: parsed.mesocycle || defaultState.mesocycle,
        coachRecommendations: parsed.coachRecommendations || [],
        xpState: parsed.xpState || defaultState.xpState,
        personalRecords: parsed.personalRecords || [],
      };
    }
    return defaultState;
  } catch (error) {
    console.error('Error loading store:', error);
    return defaultState;
  }
}

// Save data to AsyncStorage
export async function saveStore(store: GymStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('Error saving store:', error);
  }
}

// Exercise CRUD operations
export function addExercise(
  store: GymStore,
  name: string,
  videoUrl: string,
  defaultRestSeconds: number = 90,
  defaultReps: string = '8-12',
  notes: string = '',
  exerciseType: 'reps' | 'duration' = 'reps',
  bodyPart: 'Legs' | 'Arms' | 'Chest' | 'Back' | 'Shoulders' | 'Core' | 'Cardio' | 'Other' = 'Other',
  defaultDuration?: number
): GymStore {
  const exercise: Exercise = {
    id: generateId(),
    name,
    videoUrl,
    defaultRestSeconds,
    defaultReps,
    defaultDuration,
    exerciseType,
    bodyPart,
    notes,
    createdAt: Date.now(),
  };
  return {
    ...store,
    exercises: [...store.exercises, exercise],
  };
}

export function updateExercise(
  store: GymStore, 
  id: string, 
  updates: Partial<Omit<Exercise, 'id' | 'createdAt'>>
): GymStore {
  return {
    ...store,
    exercises: store.exercises.map(ex => 
      ex.id === id ? { ...ex, ...updates } : ex
    ),
  };
}

export function deleteExercise(store: GymStore, id: string): GymStore {
  return {
    ...store,
    exercises: store.exercises.filter(ex => ex.id !== id),
    // Also remove from program days
    programDays: store.programDays.map(day => ({
      ...day,
      exercises: day.exercises.filter(ex => ex.exerciseId !== id),
    })),
  };
}

// Program day operations
export function setProgramDay(
  store: GymStore,
  weekNumber: number,
  dayNumber: number,
  exercises: DayExercise[],
  isRestDay: boolean = false
): GymStore {
  const existingIndex = store.programDays.findIndex(
    d => d.weekNumber === weekNumber && d.dayNumber === dayNumber
  );
  
  const newDay: ProgramDay = {
    weekNumber,
    dayNumber,
    exercises,
    isRestDay,
  };
  
  if (existingIndex >= 0) {
    const newDays = [...store.programDays];
    newDays[existingIndex] = newDay;
    return { ...store, programDays: newDays };
  }
  
  return {
    ...store,
    programDays: [...store.programDays, newDay],
  };
}

export function getProgramDay(
  store: GymStore,
  weekNumber: number,
  dayNumber: number
): ProgramDay | undefined {
  return store.programDays.find(
    d => d.weekNumber === weekNumber && d.dayNumber === dayNumber
  );
}

// Workout log operations
export function addWorkoutLog(store: GymStore, log: WorkoutLog): GymStore {
  return {
    ...store,
    workoutLogs: [...store.workoutLogs, log],
  };
}

export function updateWorkoutLog(
  store: GymStore, 
  id: string, 
  updates: Partial<WorkoutLog>
): GymStore {
  return {
    ...store,
    workoutLogs: store.workoutLogs.map(log => 
      log.id === id ? { ...log, ...updates } : log
    ),
  };
}

// Get last weight used for an exercise
export function getLastWeight(
  store: GymStore,
  exerciseId: string
): number | null {
  // Find the most recent completed workout with this exercise
  const sortedLogs = [...store.workoutLogs]
    .filter(log => log.isCompleted)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  
  for (const log of sortedLogs) {
    const exerciseLog = log.exercises.find(ex => ex.exerciseId === exerciseId);
    if (exerciseLog && exerciseLog.sets.length > 0) {
      // Return the weight from the first set
      return exerciseLog.sets[0].weight;
    }
  }
  
  return null;
}

// Get best weight ever for an exercise
export function getBestWeight(
  store: GymStore,
  exerciseId: string
): number | null {
  let bestWeight: number | null = null;
  
  for (const log of store.workoutLogs) {
    if (!log.isCompleted) continue;
    const exerciseLog = log.exercises.find(ex => ex.exerciseId === exerciseId);
    if (exerciseLog) {
      for (const set of exerciseLog.sets) {
        if (bestWeight === null || set.weight > bestWeight) {
          bestWeight = set.weight;
        }
      }
    }
  }
  
  return bestWeight;
}

// Get weight history for an exercise
export function getWeightHistory(
  store: GymStore,
  exerciseId: string
): { date: string; weight: number; reps: number }[] {
  const history: { date: string; weight: number; reps: number }[] = [];
  
  const sortedLogs = [...store.workoutLogs]
    .filter(log => log.isCompleted)
    .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
  
  for (const log of sortedLogs) {
    const exerciseLog = log.exercises.find(ex => ex.exerciseId === exerciseId);
    if (exerciseLog && exerciseLog.sets.length > 0) {
      // Use the max weight from all sets
      const maxSet = exerciseLog.sets.reduce((max, set) => 
        set.weight > max.weight ? set : max
      );
      history.push({
        date: log.date,
        weight: maxSet.weight,
        reps: maxSet.reps,
      });
    }
  }
  
  return history;
}

// Settings operations
export function updateSettings(
  store: GymStore,
  updates: Partial<AppSettings>
): GymStore {
  return {
    ...store,
    settings: { ...store.settings, ...updates },
  };
}


// Body measurement operations
export function addBodyMeasurement(
  store: GymStore,
  measurement: Omit<BodyMeasurement, 'id' | 'createdAt'>
): GymStore {
  const newMeasurement: BodyMeasurement = {
    ...measurement,
    id: generateId(),
    createdAt: Date.now(),
  };
  return {
    ...store,
    bodyMeasurements: [...store.bodyMeasurements, newMeasurement],
  };
}

export function updateBodyMeasurement(
  store: GymStore,
  id: string,
  updates: Partial<Omit<BodyMeasurement, 'id' | 'createdAt'>>
): GymStore {
  return {
    ...store,
    bodyMeasurements: store.bodyMeasurements.map(m =>
      m.id === id ? { ...m, ...updates } : m
    ),
  };
}

export function deleteBodyMeasurement(store: GymStore, id: string): GymStore {
  return {
    ...store,
    bodyMeasurements: store.bodyMeasurements.filter(m => m.id !== id),
  };
}

export function getBodyMeasurementHistory(store: GymStore): BodyMeasurement[] {
  return [...store.bodyMeasurements].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// Warm-up/Cool-down operations
export function addWarmupExercise(
  store: GymStore,
  exercise: Omit<WarmupCooldownExercise, 'id' | 'order'>
): GymStore {
  const newExercise: WarmupCooldownExercise = {
    ...exercise,
    id: generateId(),
    order: store.warmupCooldown.warmupExercises.length,
  };
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      warmupExercises: [...store.warmupCooldown.warmupExercises, newExercise],
    },
  };
}

export function addCooldownExercise(
  store: GymStore,
  exercise: Omit<WarmupCooldownExercise, 'id' | 'order'>
): GymStore {
  const newExercise: WarmupCooldownExercise = {
    ...exercise,
    id: generateId(),
    order: store.warmupCooldown.cooldownExercises.length,
  };
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      cooldownExercises: [...store.warmupCooldown.cooldownExercises, newExercise],
    },
  };
}

export function updateWarmupExercise(
  store: GymStore,
  id: string,
  updates: Partial<Omit<WarmupCooldownExercise, 'id'>>
): GymStore {
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      warmupExercises: store.warmupCooldown.warmupExercises.map(ex =>
        ex.id === id ? { ...ex, ...updates } : ex
      ),
    },
  };
}

export function updateCooldownExercise(
  store: GymStore,
  id: string,
  updates: Partial<Omit<WarmupCooldownExercise, 'id'>>
): GymStore {
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      cooldownExercises: store.warmupCooldown.cooldownExercises.map(ex =>
        ex.id === id ? { ...ex, ...updates } : ex
      ),
    },
  };
}

export function deleteWarmupExercise(store: GymStore, id: string): GymStore {
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      warmupExercises: store.warmupCooldown.warmupExercises
        .filter(ex => ex.id !== id)
        .map((ex, index) => ({ ...ex, order: index })),
    },
  };
}

export function deleteCooldownExercise(store: GymStore, id: string): GymStore {
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      cooldownExercises: store.warmupCooldown.cooldownExercises
        .filter(ex => ex.id !== id)
        .map((ex, index) => ({ ...ex, order: index })),
    },
  };
}

export function reorderWarmupExercises(
  store: GymStore,
  exerciseIds: string[]
): GymStore {
  const reordered = exerciseIds
    .map((id, index) => {
      const ex = store.warmupCooldown.warmupExercises.find(e => e.id === id);
      return ex ? { ...ex, order: index } : null;
    })
    .filter((ex): ex is WarmupCooldownExercise => ex !== null);
  
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      warmupExercises: reordered,
    },
  };
}

export function reorderCooldownExercises(
  store: GymStore,
  exerciseIds: string[]
): GymStore {
  const reordered = exerciseIds
    .map((id, index) => {
      const ex = store.warmupCooldown.cooldownExercises.find(e => e.id === id);
      return ex ? { ...ex, order: index } : null;
    })
    .filter((ex): ex is WarmupCooldownExercise => ex !== null);
  
  return {
    ...store,
    warmupCooldown: {
      ...store.warmupCooldown,
      cooldownExercises: reordered,
    },
  };
}
