// ============================================================
// CUSTOM EXERCISES STORE
// Stores exercises dynamically created by Zaki AI Coach.
// These exercises extend the default PROGRAM_SESSIONS library.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProgramExercise } from './training-program';

const CUSTOM_EXERCISES_KEY = '@custom_exercises';
const CUSTOM_SESSIONS_KEY = '@custom_sessions';

/** A custom exercise created by Zaki, with optional video/instructions */
export interface CustomExercise extends ProgramExercise {
  id: string;
  gifUrl?: string;
  instructions?: string[];
  videoUrl?: string;
  createdBy: 'zaki' | 'user';
  createdAt: string;
}

/** A custom session (e.g., "Cardio", "Mobility") added by Zaki */
export interface CustomSession {
  id: string;
  name: string;
  displayName: string;
  exercises: CustomExercise[];
  dayOfWeek?: string; // e.g., "Friday"
  createdAt: string;
}

// ── Custom Exercises CRUD ──

export async function getCustomExercises(): Promise<CustomExercise[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addCustomExercise(exercise: Omit<CustomExercise, 'id' | 'createdAt'>): Promise<CustomExercise> {
  const existing = await getCustomExercises();
  const newEx: CustomExercise = {
    ...exercise,
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  existing.push(newEx);
  await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(existing));
  return newEx;
}

export async function removeCustomExercise(id: string): Promise<void> {
  const existing = await getCustomExercises();
  const filtered = existing.filter(e => e.id !== id);
  await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(filtered));
}

// ── Custom Sessions CRUD ──

export async function getCustomSessions(): Promise<CustomSession[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addCustomSession(session: Omit<CustomSession, 'id' | 'createdAt'>): Promise<CustomSession> {
  const existing = await getCustomSessions();
  const newSession: CustomSession = {
    ...session,
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  existing.push(newSession);
  await AsyncStorage.setItem(CUSTOM_SESSIONS_KEY, JSON.stringify(existing));
  return newSession;
}

export async function removeCustomSession(id: string): Promise<void> {
  const existing = await getCustomSessions();
  const filtered = existing.filter(s => s.id !== id);
  await AsyncStorage.setItem(CUSTOM_SESSIONS_KEY, JSON.stringify(filtered));
}

// ── Helpers ──

/**
 * Get all exercises for a session type, merging default program with custom exercises.
 * Custom exercises added to a specific session type are appended to the default list.
 */
export async function getExercisesForSession(
  sessionType: string,
  defaultExercises: ProgramExercise[]
): Promise<ProgramExercise[]> {
  const customExercises = await getCustomExercises();
  // Custom exercises that were added to this specific session
  const sessionCustom = customExercises.filter(
    (e: any) => e.sessionType === sessionType
  );
  return [...defaultExercises, ...sessionCustom];
}

/**
 * Parse Zaki's response for exercise creation commands.
 * Zaki outputs JSON blocks like:
 * ```json
 * {"action":"add_exercise","name":"Treadmill Run","sets":1,"repsMin":1,"repsMax":1,"restSeconds":60,"notes":"20 min steady state","muscleGroup":"lower","bodyPart":"cardio","category":"compound","sessionType":"cardio","instructions":["Warm up 5 min","Run at moderate pace","Cool down 5 min"]}
 * ```
 */
export function parseExerciseCommands(text: string): Array<{
  action: 'add_exercise' | 'add_session';
  data: any;
}> {
  const commands: Array<{ action: 'add_exercise' | 'add_session'; data: any }> = [];
  
  const normalize = (parsed: any) => {
    if (!parsed || !parsed.action) return null;
    if (parsed.action !== 'add_exercise' && parsed.action !== 'add_session') return null;
    // If data is nested under a 'data' key, use it; otherwise treat the whole object as data
    const data = parsed.data ?? parsed;
    return { action: parsed.action as 'add_exercise' | 'add_session', data };
  };

  // Match JSON blocks in code fences
  const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  let match;
  
  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const cmd = normalize(parsed);
      if (cmd) commands.push(cmd);
    } catch {
      // Not valid JSON, skip
    }
  }
  
  // Also try inline JSON (without code fences)
  const inlineJsonRegex = /\{[^{}]*"action"\s*:\s*"(add_exercise|add_session)"[^{}]*\}/g;
  while ((match = inlineJsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[0]);
      const cmd = normalize(parsed);
      // Avoid duplicates from code fence matches
      if (cmd && !commands.some(c => c.data?.name === cmd.data?.name)) {
        commands.push(cmd);
      }
    } catch {
      // Not valid JSON, skip
    }
  }
  
  return commands;
}
