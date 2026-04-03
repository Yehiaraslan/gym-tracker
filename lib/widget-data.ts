import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { loadStore } from './store';
import { getStreakData } from './streak-tracker';
import { getActiveSchedule } from './schedule-store';
import { computeReadiness } from './readiness-score';
import { SESSION_NAMES, type SessionType } from './training-program';

const WIDGET_DATA_KEY = '@gym_widget_data';

export interface WidgetData {
  // Today's workout info
  todaySession: string; // e.g., "Upper A" or "Rest Day"
  todayEmoji: string;

  // Streak
  currentStreak: number;
  streakEmoji: string; // 🔥

  // Quick stats
  workoutsThisWeek: number;
  weeklyTarget: number; // usually 4

  // Last workout
  lastWorkoutDate: string;
  lastWorkoutType: string;

  // Readiness (if available)
  readinessScore: number | null;
  readinessLabel: string;
  readinessEmoji: string;

  // Next workout
  nextWorkoutDay: string; // e.g., "Tomorrow" or "Monday"
  nextWorkoutType: string;

  updatedAt: string; // ISO timestamp
}

/**
 * Get the session emoji based on session type
 */
function getSessionEmoji(session: SessionType | string): string {
  if (session === 'rest') return '😴';
  if (session === 'upper-a' || session === 'upper-b') return '💪';
  if (session === 'lower-a' || session === 'lower-b') return '🦵';
  return '🏋️';
}

/**
 * Get the session display name
 */
function getSessionName(session: SessionType | string): string {
  if (session === 'rest') return 'Rest Day';
  if (session === 'upper-a') return 'Upper A';
  if (session === 'upper-b') return 'Upper B';
  if (session === 'lower-a') return 'Lower A';
  if (session === 'lower-b') return 'Lower B';
  return session || 'Rest Day';
}

/**
 * Get today's session from the active schedule
 */
async function getTodaySession(): Promise<{ session: SessionType | string; name: string; emoji: string }> {
  try {
    const schedule = await getActiveSchedule();
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek] as keyof typeof schedule;
    const session = (schedule?.[dayName] || 'rest') as SessionType | string;

    return {
      session,
      name: getSessionName(session),
      emoji: getSessionEmoji(session),
    };
  } catch (error) {
    console.error('Error getting today session:', error);
    return { session: 'rest', name: 'Rest Day', emoji: '😴' };
  }
}

/**
 * Get next workout day and type
 */
async function getNextWorkout(): Promise<{ day: string; type: string }> {
  try {
    const schedule = await getActiveSchedule();
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Look ahead up to 7 days for next non-rest session
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + i);
      const nextDayOfWeek = nextDate.getDay();
      const nextDayName = dayNames[nextDayOfWeek] as keyof typeof schedule;
      const nextSession = (schedule?.[nextDayName] || 'rest') as SessionType | string;

      if (nextSession !== 'rest') {
        // Determine label
        let dayLabel = 'in ' + i + ' days';
        if (i === 1) dayLabel = 'Tomorrow';
        else if (i === 2) dayLabel = 'In 2 days';
        else if (i === 3) dayLabel = 'In 3 days';
        else if (nextDayOfWeek === 0) dayLabel = 'Sunday';
        else if (nextDayOfWeek === 1) dayLabel = 'Monday';
        else if (nextDayOfWeek === 2) dayLabel = 'Tuesday';
        else if (nextDayOfWeek === 3) dayLabel = 'Wednesday';
        else if (nextDayOfWeek === 4) dayLabel = 'Thursday';
        else if (nextDayOfWeek === 5) dayLabel = 'Friday';
        else if (nextDayOfWeek === 6) dayLabel = 'Saturday';

        return {
          day: dayLabel,
          type: getSessionName(nextSession),
        };
      }
    }

    return { day: 'Unknown', type: 'TBD' };
  } catch (error) {
    console.error('Error getting next workout:', error);
    return { day: 'Unknown', type: 'TBD' };
  }
}

/**
 * Count workouts in the current week (Sunday to Saturday)
 */
async function getWorkoutsThisWeek(): Promise<number> {
  try {
    const streakData = await getStreakData();
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Get start of week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    let count = 0;
    for (let i = 0; i <= dayOfWeek; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateString = date.toLocaleDateString('en-CA');
      if (streakData.workoutDates.includes(dateString)) {
        count++;
      }
    }

    return count;
  } catch (error) {
    console.error('Error getting workouts this week:', error);
    return 0;
  }
}

/**
 * Get readiness score and label (simplified)
 */
async function getReadinessData(): Promise<{ score: number | null; label: string; emoji: string }> {
  try {
    const store = await loadStore();

    // Get sleep data from last entry
    let sleepDurationHours: number | null = null;
    let sleepQuality: number | null = null;

    if (store.sleepEntries && store.sleepEntries.length > 0) {
      const lastSleep = store.sleepEntries[store.sleepEntries.length - 1];
      sleepDurationHours = lastSleep.durationHours || null;
      sleepQuality = lastSleep.qualityRating || null;
    }

    // Get workouts last 7 days
    const streakData = await getStreakData();
    const today = new Date();
    let workoutsLast7 = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toLocaleDateString('en-CA');
      if (streakData.workoutDates.includes(dateString)) {
        workoutsLast7++;
      }
    }

    // Compute readiness (simplified inputs)
    const readinessResult = computeReadiness({
      sleepDurationHours,
      sleepQuality,
      whoopRecoveryScore: null,
      hrv: null,
      rhr: null,
      caloriesVsTarget: null,
      proteinVsTarget: null,
      workoutsLast7Days: workoutsLast7,
      totalVolumeLast7Days: 0,
      totalVolumePrevious7Days: 0,
      currentStreak: streakData.currentStreak,
    });

    return {
      score: readinessResult.score,
      label: readinessResult.label,
      emoji: readinessResult.emoji,
    };
  } catch (error) {
    console.error('Error getting readiness data:', error);
    return { score: null, label: 'Unknown', emoji: '❓' };
  }
}

/**
 * Save widget data to shared storage (accessible by widget extensions)
 */
export async function updateWidgetData(): Promise<WidgetData> {
  try {
    const [todayData, streakData, workoutsThisWeek, nextWorkout, readinessData] = await Promise.all([
      getTodaySession(),
      getStreakData(),
      getWorkoutsThisWeek(),
      getNextWorkout(),
      getReadinessData(),
    ]);

    const widgetData: WidgetData = {
      todaySession: todayData.name,
      todayEmoji: todayData.emoji,
      currentStreak: streakData.currentStreak,
      streakEmoji: '🔥',
      workoutsThisWeek,
      weeklyTarget: 4,
      lastWorkoutDate: streakData.lastWorkoutDate || 'Never',
      lastWorkoutType: 'Last Workout',
      readinessScore: readinessData.score,
      readinessLabel: readinessData.label,
      readinessEmoji: readinessData.emoji,
      nextWorkoutDay: nextWorkout.day,
      nextWorkoutType: nextWorkout.type,
      updatedAt: new Date().toISOString(),
    };

    // Save to AsyncStorage (accessible by both app and widget on same device)
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));

    // Push update to the native Android home screen widget
    if (Platform.OS === 'android') {
      try {
        const { requestWidgetUpdate } = require('react-native-android-widget');
        const { GymStatsWidget } = require('@/widgets/gym-stats-widget');
        const React = require('react');
        await requestWidgetUpdate({
          widgetName: 'GymStats',
          renderWidget: () => React.createElement(GymStatsWidget, { data: widgetData }),
        });
      } catch {
        // Silently fail if widget update fails (e.g., no widget placed yet)
      }
    }

    return widgetData;
  } catch (error) {
    console.error('Error updating widget data:', error);
    throw error;
  }
}

/**
 * Get cached widget data
 */
export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (data) {
      return JSON.parse(data) as WidgetData;
    }
    return null;
  } catch (error) {
    console.error('Error getting widget data:', error);
    return null;
  }
}
