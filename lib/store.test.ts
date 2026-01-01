import { describe, it, expect, beforeEach } from 'vitest';
import {
  addExercise,
  updateExercise,
  deleteExercise,
  setProgramDay,
  getProgramDay,
  addWorkoutLog,
  updateWorkoutLog,
  getLastWeight,
  getBestWeight,
  getWeightHistory,
  updateSettings,
} from './store';
import { GymStore, WorkoutLog, generateId } from './types';

// Default empty store for testing
const createEmptyStore = (): GymStore => ({
  exercises: [],
  programDays: [],
  workoutLogs: [],
  bodyMeasurements: [],
  warmupCooldown: {
    warmupExercises: [],
    cooldownExercises: [],
  },
  settings: {
    cycleStartDate: '2024-01-01',
    currentCycle: 1,
  },
});

describe('Exercise Operations', () => {
  let store: GymStore;

  beforeEach(() => {
    store = createEmptyStore();
  });

  it('should add a new exercise', () => {
    const newStore = addExercise(store, 'Bench Press', 'https://youtube.com/test', 90);
    
    expect(newStore.exercises).toHaveLength(1);
    expect(newStore.exercises[0].name).toBe('Bench Press');
    expect(newStore.exercises[0].videoUrl).toBe('https://youtube.com/test');
    expect(newStore.exercises[0].defaultRestSeconds).toBe(90);
    expect(newStore.exercises[0].id).toBeDefined();
  });

  it('should update an existing exercise', () => {
    let newStore = addExercise(store, 'Bench Press', '', 90);
    const exerciseId = newStore.exercises[0].id;
    
    newStore = updateExercise(newStore, exerciseId, { 
      name: 'Incline Bench Press',
      videoUrl: 'https://youtube.com/updated',
    });
    
    expect(newStore.exercises[0].name).toBe('Incline Bench Press');
    expect(newStore.exercises[0].videoUrl).toBe('https://youtube.com/updated');
    expect(newStore.exercises[0].defaultRestSeconds).toBe(90); // Unchanged
  });

  it('should delete an exercise', () => {
    let newStore = addExercise(store, 'Bench Press', '', 90);
    newStore = addExercise(newStore, 'Squat', '', 120);
    const exerciseId = newStore.exercises[0].id;
    
    newStore = deleteExercise(newStore, exerciseId);
    
    expect(newStore.exercises).toHaveLength(1);
    expect(newStore.exercises[0].name).toBe('Squat');
  });

  it('should remove exercise from program days when deleted', () => {
    let newStore = addExercise(store, 'Bench Press', '', 90);
    const exerciseId = newStore.exercises[0].id;
    
    newStore = setProgramDay(newStore, 1, 1, [
      { exerciseId, sets: 3, reps: '8-10', restSeconds: 90, order: 0 }
    ]);
    
    expect(newStore.programDays[0].exercises).toHaveLength(1);
    
    newStore = deleteExercise(newStore, exerciseId);
    
    expect(newStore.programDays[0].exercises).toHaveLength(0);
  });
});

describe('Program Day Operations', () => {
  let store: GymStore;

  beforeEach(() => {
    store = createEmptyStore();
    store = addExercise(store, 'Bench Press', '', 90);
  });

  it('should set a program day', () => {
    const exerciseId = store.exercises[0].id;
    const newStore = setProgramDay(store, 1, 1, [
      { exerciseId, sets: 3, reps: '8-10', restSeconds: 90, order: 0 }
    ]);
    
    expect(newStore.programDays).toHaveLength(1);
    expect(newStore.programDays[0].weekNumber).toBe(1);
    expect(newStore.programDays[0].dayNumber).toBe(1);
    expect(newStore.programDays[0].exercises).toHaveLength(1);
  });

  it('should update existing program day', () => {
    const exerciseId = store.exercises[0].id;
    let newStore = setProgramDay(store, 1, 1, [
      { exerciseId, sets: 3, reps: '8-10', restSeconds: 90, order: 0 }
    ]);
    
    newStore = setProgramDay(newStore, 1, 1, [
      { exerciseId, sets: 4, reps: '6-8', restSeconds: 120, order: 0 }
    ]);
    
    expect(newStore.programDays).toHaveLength(1);
    expect(newStore.programDays[0].exercises[0].sets).toBe(4);
    expect(newStore.programDays[0].exercises[0].reps).toBe('6-8');
  });

  it('should get program day', () => {
    const exerciseId = store.exercises[0].id;
    const newStore = setProgramDay(store, 2, 3, [
      { exerciseId, sets: 3, reps: '8-10', restSeconds: 90, order: 0 }
    ]);
    
    const programDay = getProgramDay(newStore, 2, 3);
    
    expect(programDay).toBeDefined();
    expect(programDay?.weekNumber).toBe(2);
    expect(programDay?.dayNumber).toBe(3);
  });

  it('should return undefined for non-existent program day', () => {
    const programDay = getProgramDay(store, 5, 5);
    expect(programDay).toBeUndefined();
  });
});

describe('Workout Log Operations', () => {
  let store: GymStore;
  let exerciseId: string;

  beforeEach(() => {
    store = createEmptyStore();
    store = addExercise(store, 'Bench Press', '', 90);
    exerciseId = store.exercises[0].id;
  });

  it('should add a workout log', () => {
    const log: WorkoutLog = {
      id: generateId(),
      date: '2024-01-15',
      cycleNumber: 1,
      weekNumber: 1,
      dayNumber: 1,
      exercises: [{
        exerciseId,
        exerciseName: 'Bench Press',
        targetSets: 3,
        targetReps: '8-10',
        sets: [
          { setNumber: 1, weight: 60, reps: 10, completedAt: Date.now() }
        ],
      }],
      startedAt: Date.now(),
      completedAt: Date.now(),
      isCompleted: true,
    };

    const newStore = addWorkoutLog(store, log);
    
    expect(newStore.workoutLogs).toHaveLength(1);
    expect(newStore.workoutLogs[0].exercises[0].sets[0].weight).toBe(60);
  });

  it('should update a workout log', () => {
    const log: WorkoutLog = {
      id: 'test-log-id',
      date: '2024-01-15',
      cycleNumber: 1,
      weekNumber: 1,
      dayNumber: 1,
      exercises: [],
      startedAt: Date.now(),
      completedAt: null,
      isCompleted: false,
    };

    let newStore = addWorkoutLog(store, log);
    newStore = updateWorkoutLog(newStore, 'test-log-id', { 
      isCompleted: true,
      completedAt: Date.now(),
    });
    
    expect(newStore.workoutLogs[0].isCompleted).toBe(true);
    expect(newStore.workoutLogs[0].completedAt).toBeDefined();
  });
});

describe('Weight Tracking', () => {
  let store: GymStore;
  let exerciseId: string;

  beforeEach(() => {
    store = createEmptyStore();
    store = addExercise(store, 'Bench Press', '', 90);
    exerciseId = store.exercises[0].id;
  });

  it('should get last weight for exercise', () => {
    const log1: WorkoutLog = {
      id: 'log1',
      date: '2024-01-15',
      cycleNumber: 1,
      weekNumber: 1,
      dayNumber: 1,
      exercises: [{
        exerciseId,
        exerciseName: 'Bench Press',
        targetSets: 3,
        targetReps: '8-10',
        sets: [{ setNumber: 1, weight: 60, reps: 10, completedAt: 1000 }],
      }],
      startedAt: 1000,
      completedAt: 2000,
      isCompleted: true,
    };

    const log2: WorkoutLog = {
      id: 'log2',
      date: '2024-01-22',
      cycleNumber: 1,
      weekNumber: 2,
      dayNumber: 1,
      exercises: [{
        exerciseId,
        exerciseName: 'Bench Press',
        targetSets: 3,
        targetReps: '8-10',
        sets: [{ setNumber: 1, weight: 65, reps: 10, completedAt: 3000 }],
      }],
      startedAt: 3000,
      completedAt: 4000,
      isCompleted: true,
    };

    let newStore = addWorkoutLog(store, log1);
    newStore = addWorkoutLog(newStore, log2);
    
    const lastWeight = getLastWeight(newStore, exerciseId);
    expect(lastWeight).toBe(65);
  });

  it('should return null when no weight history', () => {
    const lastWeight = getLastWeight(store, exerciseId);
    expect(lastWeight).toBeNull();
  });

  it('should get best weight for exercise', () => {
    const log1: WorkoutLog = {
      id: 'log1',
      date: '2024-01-15',
      cycleNumber: 1,
      weekNumber: 1,
      dayNumber: 1,
      exercises: [{
        exerciseId,
        exerciseName: 'Bench Press',
        targetSets: 3,
        targetReps: '8-10',
        sets: [
          { setNumber: 1, weight: 60, reps: 10, completedAt: 1000 },
          { setNumber: 2, weight: 70, reps: 8, completedAt: 1100 },
          { setNumber: 3, weight: 65, reps: 9, completedAt: 1200 },
        ],
      }],
      startedAt: 1000,
      completedAt: 2000,
      isCompleted: true,
    };

    const newStore = addWorkoutLog(store, log1);
    const bestWeight = getBestWeight(newStore, exerciseId);
    
    expect(bestWeight).toBe(70);
  });

  it('should get weight history for exercise', () => {
    const log1: WorkoutLog = {
      id: 'log1',
      date: '2024-01-15',
      cycleNumber: 1,
      weekNumber: 1,
      dayNumber: 1,
      exercises: [{
        exerciseId,
        exerciseName: 'Bench Press',
        targetSets: 3,
        targetReps: '8-10',
        sets: [{ setNumber: 1, weight: 60, reps: 10, completedAt: 1000 }],
      }],
      startedAt: 1000,
      completedAt: 2000,
      isCompleted: true,
    };

    const log2: WorkoutLog = {
      id: 'log2',
      date: '2024-01-22',
      cycleNumber: 1,
      weekNumber: 2,
      dayNumber: 1,
      exercises: [{
        exerciseId,
        exerciseName: 'Bench Press',
        targetSets: 3,
        targetReps: '8-10',
        sets: [{ setNumber: 1, weight: 65, reps: 10, completedAt: 3000 }],
      }],
      startedAt: 3000,
      completedAt: 4000,
      isCompleted: true,
    };

    let newStore = addWorkoutLog(store, log1);
    newStore = addWorkoutLog(newStore, log2);
    
    const history = getWeightHistory(newStore, exerciseId);
    
    expect(history).toHaveLength(2);
    expect(history[0].weight).toBe(60);
    expect(history[1].weight).toBe(65);
  });
});

describe('Settings Operations', () => {
  it('should update settings', () => {
    const store = createEmptyStore();
    const newStore = updateSettings(store, { 
      cycleStartDate: '2024-06-01',
      currentCycle: 2,
    });
    
    expect(newStore.settings.cycleStartDate).toBe('2024-06-01');
    expect(newStore.settings.currentCycle).toBe(2);
  });

  it('should partially update settings', () => {
    const store = createEmptyStore();
    const newStore = updateSettings(store, { cycleStartDate: '2024-06-01' });
    
    expect(newStore.settings.cycleStartDate).toBe('2024-06-01');
    expect(newStore.settings.currentCycle).toBe(1); // Unchanged
  });
});
