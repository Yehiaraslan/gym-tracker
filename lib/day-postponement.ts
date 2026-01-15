import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProgramDay } from './types';

interface PostponedDay {
  originalDate: string; // ISO date
  originalDayNumber: number; // 1-7
  postponedToDate: string; // ISO date
  reason?: string;
  createdAt: number;
}

interface MissedDay {
  date: string; // ISO date
  dayNumber: number; // 1-7
  weekNumber: number;
  reason?: string;
  createdAt: number;
}

const POSTPONED_DAYS_KEY = '@gym_tracker_postponed_days';
const MISSED_DAYS_KEY = '@gym_tracker_missed_days';

export async function postponeDay(
  originalDate: string,
  dayNumber: number,
  postponedToDate: string,
  reason?: string
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(POSTPONED_DAYS_KEY);
    const postponedDays: PostponedDay[] = stored ? JSON.parse(stored) : [];

    postponedDays.push({
      originalDate,
      originalDayNumber: dayNumber,
      postponedToDate,
      reason,
      createdAt: Date.now(),
    });

    await AsyncStorage.setItem(POSTPONED_DAYS_KEY, JSON.stringify(postponedDays));
  } catch (error) {
    console.error('Error postponing day:', error);
    throw error;
  }
}

export async function getPostponedDay(date: string): Promise<PostponedDay | null> {
  try {
    const stored = await AsyncStorage.getItem(POSTPONED_DAYS_KEY);
    if (!stored) return null;

    const postponedDays: PostponedDay[] = JSON.parse(stored);
    return postponedDays.find(d => d.postponedToDate === date) || null;
  } catch (error) {
    console.error('Error getting postponed day:', error);
    return null;
  }
}

export async function markDayAsMissed(
  date: string,
  dayNumber: number,
  weekNumber: number,
  reason?: string
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(MISSED_DAYS_KEY);
    const missedDays: MissedDay[] = stored ? JSON.parse(stored) : [];

    // Check if already marked as missed
    const exists = missedDays.some(d => d.date === date && d.dayNumber === dayNumber);
    if (exists) return;

    missedDays.push({
      date,
      dayNumber,
      weekNumber,
      reason,
      createdAt: Date.now(),
    });

    await AsyncStorage.setItem(MISSED_DAYS_KEY, JSON.stringify(missedDays));
  } catch (error) {
    console.error('Error marking day as missed:', error);
    throw error;
  }
}

export async function getMissedDays(): Promise<MissedDay[]> {
  try {
    const stored = await AsyncStorage.getItem(MISSED_DAYS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting missed days:', error);
    return [];
  }
}

export async function getMissedDaysForWeek(weekNumber: number): Promise<MissedDay[]> {
  try {
    const missedDays = await getMissedDays();
    return missedDays.filter(d => d.weekNumber === weekNumber);
  } catch (error) {
    console.error('Error getting missed days for week:', error);
    return [];
  }
}

export async function clearMissedDay(date: string, dayNumber: number): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(MISSED_DAYS_KEY);
    if (!stored) return;

    const missedDays: MissedDay[] = JSON.parse(stored);
    const filtered = missedDays.filter(d => !(d.date === date && d.dayNumber === dayNumber));

    await AsyncStorage.setItem(MISSED_DAYS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error clearing missed day:', error);
    throw error;
  }
}

export function getDayName(dayNumber: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayNumber - 1] || 'Unknown';
}

export function getNextAvailableDay(
  currentDate: string,
  daysToCheck: number = 7
): string {
  const current = new Date(currentDate);
  for (let i = 1; i <= daysToCheck; i++) {
    const nextDate = new Date(current);
    nextDate.setDate(nextDate.getDate() + i);
    return nextDate.toISOString().split('T')[0];
  }
  return currentDate;
}
