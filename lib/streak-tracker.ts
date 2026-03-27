import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncStreak } from './db-sync-fetch';
import { getSessionForDate, type SessionType } from './training-program';
import { getActiveSchedule } from './schedule-store';

const STREAK_DATA_KEY = 'gym_tracker_streak_data';

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastWorkoutDate: string | null; // ISO date string (YYYY-MM-DD)
  workoutDates: string[]; // Array of ISO date strings
}

const DEFAULT_STREAK_DATA: StreakData = {
  currentStreak: 0,
  bestStreak: 0,
  lastWorkoutDate: null,
  workoutDates: [],
};

/**
 * Get the current date as ISO string (YYYY-MM-DD)
 */
function getDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}

/**
 * Get the difference in days between two dates
 */
function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Load streak data from storage
 */
export async function getStreakData(): Promise<StreakData> {
  try {
    const data = await AsyncStorage.getItem(STREAK_DATA_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return DEFAULT_STREAK_DATA;
  } catch (error) {
    console.error('Error loading streak data:', error);
    return DEFAULT_STREAK_DATA;
  }
}

/**
 * Save streak data to storage
 */
async function saveStreakData(data: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving streak data:', error);
    throw error;
  }
  // Mirror to cloud DB — fire-and-forget
  syncStreak({
    currentStreak: data.currentStreak,
    bestStreak: data.bestStreak,
    lastWorkoutDate: data.lastWorkoutDate ?? new Date().toLocaleDateString('en-CA'),
    totalWorkouts: data.workoutDates.length,
  });
}

/**
 * Record a workout for today and update streak
 */
export async function recordWorkout(): Promise<StreakData> {
  const streakData = await getStreakData();
  const today = getDateString();

  // If already recorded today, return current data
  if (streakData.lastWorkoutDate === today) {
    return streakData;
  }

  // Add today to workout dates if not already present
  if (!streakData.workoutDates.includes(today)) {
    streakData.workoutDates.push(today);
    // Keep only last 365 days of data
    if (streakData.workoutDates.length > 365) {
      streakData.workoutDates = streakData.workoutDates.slice(-365);
    }
  }

  // Calculate new streak — only breaks if a TRAINING day was missed (rest days don't count)
  if (streakData.lastWorkoutDate === null) {
    // First workout ever
    streakData.currentStreak = 1;
  } else {
    const daysSinceLastWorkout = getDaysDifference(streakData.lastWorkoutDate, today);
    
    if (daysSinceLastWorkout <= 1) {
      // Same day or consecutive day — extend streak
      if (daysSinceLastWorkout === 1) streakData.currentStreak += 1;
    } else {
      // Check if any TRAINING days were missed between last workout and today
      const schedule = await getActiveSchedule();
      let missedTrainingDay = false;
      for (let i = 1; i < daysSinceLastWorkout; i++) {
        const checkDate = new Date(streakData.lastWorkoutDate + 'T12:00:00');
        checkDate.setDate(checkDate.getDate() + i);
        const dateStr = checkDate.toLocaleDateString('en-CA');
        const dayOfWeek = checkDate.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const sessionFromSchedule = schedule?.[dayNames[dayOfWeek] as keyof typeof schedule] as SessionType | undefined;
        const session = sessionFromSchedule || getSessionForDate(checkDate);
        if (session !== 'rest' && !streakData.workoutDates.includes(dateStr)) {
          missedTrainingDay = true;
          break;
        }
      }
      if (missedTrainingDay) {
        streakData.currentStreak = 1;
      } else {
        // Only rest days were skipped — streak continues
        streakData.currentStreak += 1;
      }
    }
  }

  // Update best streak if current is higher
  if (streakData.currentStreak > streakData.bestStreak) {
    streakData.bestStreak = streakData.currentStreak;
  }

  // Update last workout date
  streakData.lastWorkoutDate = today;

  await saveStreakData(streakData);
  return streakData;
}

/**
 * Check and update streak status (call on app open)
 * This handles the case where user missed days
 */
export async function checkStreakStatus(): Promise<StreakData> {
  const streakData = await getStreakData();
  
  if (streakData.lastWorkoutDate === null) {
    return streakData;
  }

  const today = getDateString();
  const daysSinceLastWorkout = getDaysDifference(streakData.lastWorkoutDate, today);

  // Only break streak if a TRAINING day was missed (rest days don't count)
  if (daysSinceLastWorkout > 1) {
    const schedule = await getActiveSchedule();
    let missedTrainingDay = false;
    for (let i = 1; i < daysSinceLastWorkout; i++) {
      const checkDate = new Date(streakData.lastWorkoutDate! + 'T12:00:00');
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toLocaleDateString('en-CA');
      const dayOfWeek = checkDate.getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const sessionFromSchedule = schedule?.[dayNames[dayOfWeek] as keyof typeof schedule] as SessionType | undefined;
      const session = sessionFromSchedule || getSessionForDate(checkDate);
      if (session !== 'rest' && !streakData.workoutDates.includes(dateStr)) {
        missedTrainingDay = true;
        break;
      }
    }
    if (missedTrainingDay) {
      streakData.currentStreak = 0;
      await saveStreakData(streakData);
    }
  }

  return streakData;
}

/**
 * Get motivational message based on streak
 */
export function getStreakMessage(streak: number): string {
  if (streak === 0) {
    return "Start your streak today!";
  } else if (streak === 1) {
    return "Great start! Keep it going!";
  } else if (streak < 7) {
    return `${streak} days strong! 💪`;
  } else if (streak < 14) {
    return `One week down! You're on fire! 🔥`;
  } else if (streak < 30) {
    return `${streak} days! Incredible dedication! 🏆`;
  } else if (streak < 60) {
    return `${streak} days! You're unstoppable! 🚀`;
  } else if (streak < 100) {
    return `${streak} days! Legend status! 👑`;
  } else {
    return `${streak} days! Absolute beast mode! 🦁`;
  }
}

/**
 * Get workouts in the last N days
 */
export async function getWorkoutsInLastDays(days: number): Promise<number> {
  const streakData = await getStreakData();
  const today = new Date();
  let count = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = getDateString(date);
    if (streakData.workoutDates.includes(dateString)) {
      count++;
    }
  }

  return count;
}

/**
 * Get weekly workout data for the last 4 weeks
 */
export async function getWeeklyWorkoutData(): Promise<{ week: string; count: number }[]> {
  const streakData = await getStreakData();
  const today = new Date();
  const weeks: { week: string; count: number }[] = [];

  for (let w = 3; w >= 0; w--) {
    let count = 0;
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (w * 7) - 6);
    
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateString = getDateString(date);
      if (streakData.workoutDates.includes(dateString)) {
        count++;
      }
    }

    weeks.push({
      week: w === 0 ? 'This Week' : w === 1 ? 'Last Week' : `${w + 1} Weeks Ago`,
      count,
    });
  }

  return weeks;
}

/**
 * Clear all streak data (for testing)
 */
export async function clearStreakData(): Promise<void> {
  await AsyncStorage.removeItem(STREAK_DATA_KEY);
}
