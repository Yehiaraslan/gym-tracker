import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  GymStore, 
  Exercise, 
  ProgramDay, 
  WorkoutLog, 
  AppSettings,
  DayExercise,
  calculateCycleInfo,
  BodyMeasurement,
  WarmupCooldownExercise,
} from './types';
import {
  loadStore,
  saveStore,
  addExercise as addExerciseToStore,
  updateExercise as updateExerciseInStore,
  deleteExercise as deleteExerciseFromStore,
  setProgramDay as setProgramDayInStore,
  getProgramDay as getProgramDayFromStore,
  addWorkoutLog as addWorkoutLogToStore,
  updateWorkoutLog as updateWorkoutLogInStore,
  getLastWeight as getLastWeightFromStore,
  getBestWeight as getBestWeightFromStore,
  getWeightHistory as getWeightHistoryFromStore,
  updateSettings as updateSettingsInStore,
  addBodyMeasurement as addBodyMeasurementToStore,
  updateBodyMeasurement as updateBodyMeasurementInStore,
  deleteBodyMeasurement as deleteBodyMeasurementFromStore,
  getBodyMeasurementHistory as getBodyMeasurementHistoryFromStore,
  addWarmupExercise as addWarmupExerciseToStore,
  addCooldownExercise as addCooldownExerciseToStore,
  updateWarmupExercise as updateWarmupExerciseInStore,
  updateCooldownExercise as updateCooldownExerciseInStore,
  deleteWarmupExercise as deleteWarmupExerciseFromStore,
  deleteCooldownExercise as deleteCooldownExerciseFromStore,
} from './store';

interface GymContextType {
  // State
  store: GymStore;
  isLoading: boolean;
  currentCycleInfo: { cycle: number; week: number; day: number };
  
  // Exercise operations
  addExercise: (name: string, videoUrl: string, defaultRestSeconds: number, defaultReps: string, notes: string) => Promise<void>;
  updateExercise: (id: string, updates: Partial<Omit<Exercise, 'id' | 'createdAt'>>) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  getExerciseById: (id: string) => Exercise | undefined;
  
  // Program operations
  setProgramDay: (weekNumber: number, dayNumber: number, exercises: DayExercise[], isRestDay?: boolean) => Promise<void>;
  getProgramDay: (weekNumber: number, dayNumber: number) => ProgramDay | undefined;
  getTodayProgram: () => ProgramDay | undefined;
  
  // Workout log operations
  addWorkoutLog: (log: WorkoutLog) => Promise<void>;
  updateWorkoutLog: (id: string, updates: Partial<WorkoutLog>) => Promise<void>;
  
  // Weight tracking
  getLastWeight: (exerciseId: string) => number | null;
  getBestWeight: (exerciseId: string) => number | null;
  getWeightHistory: (exerciseId: string) => { date: string; weight: number; reps: number }[];
  
  // Settings
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  
  // Body measurements
  addBodyMeasurement: (measurement: Omit<BodyMeasurement, 'id' | 'createdAt'>) => Promise<void>;
  updateBodyMeasurement: (id: string, updates: Partial<Omit<BodyMeasurement, 'id' | 'createdAt'>>) => Promise<void>;
  deleteBodyMeasurement: (id: string) => Promise<void>;
  getBodyMeasurementHistory: () => BodyMeasurement[];
  
  // Warm-up/Cool-down
  addWarmupExercise: (exercise: Omit<WarmupCooldownExercise, 'id' | 'order'>) => Promise<void>;
  addCooldownExercise: (exercise: Omit<WarmupCooldownExercise, 'id' | 'order'>) => Promise<void>;
  updateWarmupExercise: (id: string, updates: Partial<Omit<WarmupCooldownExercise, 'id'>>) => Promise<void>;
  updateCooldownExercise: (id: string, updates: Partial<Omit<WarmupCooldownExercise, 'id'>>) => Promise<void>;
  deleteWarmupExercise: (id: string) => Promise<void>;
  deleteCooldownExercise: (id: string) => Promise<void>;
  
  // Refresh
  refresh: () => Promise<void>;
}

const GymContext = createContext<GymContextType | null>(null);

export function GymProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<GymStore>({
    exercises: [],
    programDays: [],
    workoutLogs: [],
    bodyMeasurements: [],
    warmupCooldown: {
      warmupExercises: [],
      cooldownExercises: [],
    },
    settings: {
      cycleStartDate: new Date().toISOString().split('T')[0],
      currentCycle: 1,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  // Calculate current cycle info
  const currentCycleInfo = calculateCycleInfo(store.settings.cycleStartDate);

  // Load data on mount
  useEffect(() => {
    loadStore().then(data => {
      setStore(data);
      setIsLoading(false);
    });
  }, []);

  // Save helper
  const updateAndSave = useCallback(async (newStore: GymStore) => {
    setStore(newStore);
    await saveStore(newStore);
  }, []);

  // Exercise operations
  const addExercise = useCallback(async (name: string, videoUrl: string, defaultRestSeconds: number, defaultReps: string, notes: string) => {
    const newStore = addExerciseToStore(store, name, videoUrl, defaultRestSeconds, defaultReps, notes);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const updateExercise = useCallback(async (id: string, updates: Partial<Omit<Exercise, 'id' | 'createdAt'>>) => {
    const newStore = updateExerciseInStore(store, id, updates);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const deleteExercise = useCallback(async (id: string) => {
    const newStore = deleteExerciseFromStore(store, id);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const getExerciseById = useCallback((id: string) => {
    return store.exercises.find(ex => ex.id === id);
  }, [store.exercises]);

  // Program operations
  const setProgramDay = useCallback(async (
    weekNumber: number, 
    dayNumber: number, 
    exercises: DayExercise[],
    isRestDay: boolean = false
  ) => {
    const newStore = setProgramDayInStore(store, weekNumber, dayNumber, exercises, isRestDay);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const getProgramDay = useCallback((weekNumber: number, dayNumber: number) => {
    return getProgramDayFromStore(store, weekNumber, dayNumber);
  }, [store]);

  const getTodayProgram = useCallback(() => {
    return getProgramDayFromStore(store, currentCycleInfo.week, currentCycleInfo.day);
  }, [store, currentCycleInfo]);

  // Workout log operations
  const addWorkoutLog = useCallback(async (log: WorkoutLog) => {
    const newStore = addWorkoutLogToStore(store, log);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const updateWorkoutLog = useCallback(async (id: string, updates: Partial<WorkoutLog>) => {
    const newStore = updateWorkoutLogInStore(store, id, updates);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  // Weight tracking
  const getLastWeight = useCallback((exerciseId: string) => {
    return getLastWeightFromStore(store, exerciseId);
  }, [store]);

  const getBestWeight = useCallback((exerciseId: string) => {
    return getBestWeightFromStore(store, exerciseId);
  }, [store]);

  const getWeightHistory = useCallback((exerciseId: string) => {
    return getWeightHistoryFromStore(store, exerciseId);
  }, [store]);

  // Settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newStore = updateSettingsInStore(store, updates);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  // Body measurements
  const addBodyMeasurement = useCallback(async (measurement: Omit<BodyMeasurement, 'id' | 'createdAt'>) => {
    const newStore = addBodyMeasurementToStore(store, measurement);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const updateBodyMeasurement = useCallback(async (id: string, updates: Partial<Omit<BodyMeasurement, 'id' | 'createdAt'>>) => {
    const newStore = updateBodyMeasurementInStore(store, id, updates);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const deleteBodyMeasurement = useCallback(async (id: string) => {
    const newStore = deleteBodyMeasurementFromStore(store, id);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const getBodyMeasurementHistory = useCallback(() => {
    return getBodyMeasurementHistoryFromStore(store);
  }, [store]);

  // Warm-up/Cool-down
  const addWarmupExercise = useCallback(async (exercise: Omit<WarmupCooldownExercise, 'id' | 'order'>) => {
    const newStore = addWarmupExerciseToStore(store, exercise);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const addCooldownExercise = useCallback(async (exercise: Omit<WarmupCooldownExercise, 'id' | 'order'>) => {
    const newStore = addCooldownExerciseToStore(store, exercise);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const updateWarmupExercise = useCallback(async (id: string, updates: Partial<Omit<WarmupCooldownExercise, 'id'>>) => {
    const newStore = updateWarmupExerciseInStore(store, id, updates);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const updateCooldownExercise = useCallback(async (id: string, updates: Partial<Omit<WarmupCooldownExercise, 'id'>>) => {
    const newStore = updateCooldownExerciseInStore(store, id, updates);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const deleteWarmupExercise = useCallback(async (id: string) => {
    const newStore = deleteWarmupExerciseFromStore(store, id);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  const deleteCooldownExercise = useCallback(async (id: string) => {
    const newStore = deleteCooldownExerciseFromStore(store, id);
    await updateAndSave(newStore);
  }, [store, updateAndSave]);

  // Refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await loadStore();
    setStore(data);
    setIsLoading(false);
  }, []);

  const value: GymContextType = {
    store,
    isLoading,
    currentCycleInfo,
    addExercise,
    updateExercise,
    deleteExercise,
    getExerciseById,
    setProgramDay,
    getProgramDay,
    getTodayProgram,
    addWorkoutLog,
    updateWorkoutLog,
    getLastWeight,
    getBestWeight,
    getWeightHistory,
    updateSettings,
    addBodyMeasurement,
    updateBodyMeasurement,
    deleteBodyMeasurement,
    getBodyMeasurementHistory,
    addWarmupExercise,
    addCooldownExercise,
    updateWarmupExercise,
    updateCooldownExercise,
    deleteWarmupExercise,
    deleteCooldownExercise,
    refresh,
  };

  return (
    <GymContext.Provider value={value}>
      {children}
    </GymContext.Provider>
  );
}

export function useGym(): GymContextType {
  const context = useContext(GymContext);
  if (!context) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
}
