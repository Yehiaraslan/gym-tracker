// ============================================================
// SCHEDULE STORE
// Persists a user-editable training schedule in AsyncStorage.
// Falls back to the hardcoded WEEKLY_SCHEDULE when no override
// exists, so the app works out-of-the-box.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEEKLY_SCHEDULE, type SessionType } from './training-program';

const SCHEDULE_KEY = '@custom_schedule_v1';
const SCHEDULE_HISTORY_KEY = '@schedule_history_v1';
const MAX_HISTORY_ENTRIES = 20;

// ── Types ────────────────────────────────────────────────────

/**
 * A full 7-day schedule mapping day names to session types.
 * Days not listed default to 'rest'.
 */
export type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type CustomSchedule = Record<DayName, SessionType>;

export interface ScheduleOverride {
  /** ISO timestamp when this schedule was applied */
  appliedAt: string;
  /** Human-readable description of the schedule (e.g. "Every other day, 2 back-to-back") */
  description: string;
  /** The 7-day session map */
  schedule: CustomSchedule;
  /** Whether this was applied by Zaki (true) or manually (false) */
  appliedByZaki: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

const ALL_DAYS: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Build a full 7-day CustomSchedule from a partial map, filling gaps with 'rest' */
export function buildFullSchedule(partial: Partial<Record<DayName, SessionType>>): CustomSchedule {
  const full = {} as CustomSchedule;
  for (const day of ALL_DAYS) {
    full[day] = partial[day] ?? 'rest';
  }
  return full;
}

/** Convert the default WEEKLY_SCHEDULE to a CustomSchedule */
export function defaultSchedule(): CustomSchedule {
  return buildFullSchedule(WEEKLY_SCHEDULE as Partial<Record<DayName, SessionType>>);
}

// ── Storage API ──────────────────────────────────────────────

/** Load the active schedule override, or null if none has been set */
export async function loadScheduleOverride(): Promise<ScheduleOverride | null> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScheduleOverride;
  } catch {
    return null;
  }
}

/** Save a new schedule override (replaces any existing one) */
export async function saveScheduleOverride(override: ScheduleOverride): Promise<void> {
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(override));
}

/** Remove the schedule override, reverting to the hardcoded default */
export async function clearScheduleOverride(): Promise<void> {
  await AsyncStorage.removeItem(SCHEDULE_KEY);
}

/**
 * Get the active schedule — either the stored override or the default.
 * This is the single source of truth for "what session is on which day".
 */
export async function getActiveSchedule(): Promise<CustomSchedule> {
  const override = await loadScheduleOverride();
  return override?.schedule ?? defaultSchedule();
}

/**
 * Get today's session type from the active schedule.
 * Drop-in replacement for getTodaySession() from training-program.ts.
 */
export async function getTodaySessionFromSchedule(): Promise<SessionType> {
  const schedule = await getActiveSchedule();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as DayName;
  return schedule[today] ?? 'rest';
}

/**
 * Get the session for a specific date from the active schedule.
 */
export async function getSessionForDateFromSchedule(date: Date): Promise<SessionType> {
  const schedule = await getActiveSchedule();
  const day = date.toLocaleDateString('en-US', { weekday: 'long' }) as DayName;
  return schedule[day] ?? 'rest';
}

/**
 * Get the next 7 days of schedule starting from a given date.
 */
export async function getWeekScheduleFromStore(
  startDate: Date,
): Promise<{ date: Date; session: SessionType; dayName: string }[]> {
  const schedule = await getActiveSchedule();
  const result: { date: Date; session: SessionType; dayName: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }) as DayName;
    result.push({ date: d, session: schedule[dayName] ?? 'rest', dayName });
  }
  return result;
}

// ── Schedule Pattern Builders ─────────────────────────────────

/**
 * Build an "every other day" schedule starting from a given day.
 * Sessions are assigned in rotation from the provided session list.
 *
 * Example: startDay=Sunday, sessions=['upper-a','lower-a','upper-b','lower-b']
 * → Sun=upper-a, Mon=rest, Tue=lower-a, Wed=rest, Thu=upper-b, Fri=rest, Sat=lower-b
 */
export function buildEveryOtherDaySchedule(
  startDay: DayName,
  sessions: SessionType[],
): CustomSchedule {
  const partial: Partial<Record<DayName, SessionType>> = {};
  const startIdx = ALL_DAYS.indexOf(startDay);
  let sessionIdx = 0;
  for (let i = 0; i < 7; i++) {
    const dayIdx = (startIdx + i) % 7;
    const day = ALL_DAYS[dayIdx];
    if (i % 2 === 0 && sessionIdx < sessions.length) {
      partial[day] = sessions[sessionIdx++];
    } else {
      partial[day] = 'rest';
    }
  }
  return buildFullSchedule(partial);
}

/**
 * Build a schedule with two back-to-back sessions on specified days.
 * The remaining days are rest.
 *
 * Example: pairDays=[['Monday','Tuesday'], ['Thursday','Friday']]
 * sessions=['upper-a','lower-a','upper-b','lower-b']
 * → Mon=upper-a, Tue=lower-a, Thu=upper-b, Fri=lower-b
 */
export function buildBackToBackSchedule(
  pairDays: [DayName, DayName][],
  sessions: SessionType[],
): CustomSchedule {
  const partial: Partial<Record<DayName, SessionType>> = {};
  let sessionIdx = 0;
  for (const [day1, day2] of pairDays) {
    if (sessionIdx < sessions.length) partial[day1] = sessions[sessionIdx++];
    if (sessionIdx < sessions.length) partial[day2] = sessions[sessionIdx++];
  }
  return buildFullSchedule(partial);
}

// ── Schedule Serializer (for Zaki prompt) ────────────────────

/** Format a CustomSchedule as a compact string for Zaki's prompt */
export function scheduleToString(schedule: CustomSchedule): string {
  return ALL_DAYS.map(day => `${day.slice(0, 3)}: ${schedule[day]}`).join(' | ');
}

/** Format a CustomSchedule as a human-readable table for the UI */
export function scheduleToDisplayRows(schedule: CustomSchedule): { day: string; session: SessionType }[] {
  return ALL_DAYS.map(day => ({ day, session: schedule[day] }));
}

// ── Schedule History Log ──────────────────────────────────────

export interface ScheduleHistoryEntry {
  /** ISO timestamp when this schedule was applied */
  appliedAt: string;
  /** Human-readable description */
  description: string;
  /** The 7-day session map at time of application */
  schedule: CustomSchedule;
  /** Whether Zaki applied this (true) or it was reset to default (false) */
  appliedByZaki: boolean;
  /** Optional weight suggestions Zaki provided */
  weightSuggestions?: string;
}

/** Load the full schedule history log (newest first) */
export async function loadScheduleHistory(): Promise<ScheduleHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScheduleHistoryEntry[];
  } catch {
    return [];
  }
}

/** Append a new entry to the schedule history log */
export async function appendScheduleHistory(entry: ScheduleHistoryEntry): Promise<void> {
  try {
    const existing = await loadScheduleHistory();
    const updated = [entry, ...existing].slice(0, MAX_HISTORY_ENTRIES);
    await AsyncStorage.setItem(SCHEDULE_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Save a new schedule override AND append it to the history log.
 * This is the preferred way to apply a schedule change.
 */
export async function applyScheduleWithHistory(
  override: ScheduleOverride,
  weightSuggestions?: string,
): Promise<void> {
  await saveScheduleOverride(override);
  await appendScheduleHistory({
    appliedAt: override.appliedAt,
    description: override.description,
    schedule: override.schedule,
    appliedByZaki: override.appliedByZaki,
    weightSuggestions,
  });
}

/**
 * Reset to the default schedule and log the reset event.
 */
export async function resetToDefaultSchedule(): Promise<void> {
  await clearScheduleOverride();
  await appendScheduleHistory({
    appliedAt: new Date().toISOString(),
    description: 'Reset to default schedule (Sun/Mon/Wed/Thu)',
    schedule: defaultSchedule(),
    appliedByZaki: false,
  });
}
