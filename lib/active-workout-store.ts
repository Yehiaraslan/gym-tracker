// ============================================================
// ACTIVE WORKOUT STORE
// Persists in-progress workout state to AsyncStorage so the
// user can navigate away and resume without losing progress.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SplitExerciseLog } from './split-workout-store';
import type { SessionType } from './training-program';

const KEY = '@gym_active_workout';

export interface ActiveWorkoutState {
  sessionType: SessionType;
  isDeload: boolean;
  started: boolean;
  startTime: string; // ISO string
  exerciseLogs: SplitExerciseLog[];
  activeExerciseIndex: number;
  elapsed: number; // seconds at last save
  savedAt: string; // ISO string — used to detect stale sessions
}

/** Save the current workout state. Call after every set logged. */
export async function saveActiveWorkout(state: ActiveWorkoutState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: new Date().toISOString() }));
  } catch (e) {
    console.warn('[ActiveWorkout] Failed to save:', e);
  }
}

/** Load a previously saved workout. Returns null if none exists or it's stale (>8 hours). */
export async function loadActiveWorkout(): Promise<ActiveWorkoutState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const state: ActiveWorkoutState = JSON.parse(raw);
    // Discard sessions older than 8 hours — they're abandoned
    const savedAt = new Date(state.savedAt).getTime();
    if (Date.now() - savedAt > 8 * 60 * 60 * 1000) {
      await clearActiveWorkout();
      return null;
    }
    return state;
  } catch (e) {
    console.warn('[ActiveWorkout] Failed to load:', e);
    return null;
  }
}

/** Clear the active workout (call after finishing or abandoning). */
export async function clearActiveWorkout(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn('[ActiveWorkout] Failed to clear:', e);
  }
}

/** Check if there is a resumable workout for a given session type. */
export async function hasResumableWorkout(sessionType?: SessionType): Promise<ActiveWorkoutState | null> {
  const state = await loadActiveWorkout();
  if (!state || !state.started) return null;
  if (sessionType && state.sessionType !== sessionType) return null;
  return state;
}
