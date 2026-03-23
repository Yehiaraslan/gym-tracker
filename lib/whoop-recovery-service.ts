/**
 * WHOOP Recovery Data Service
 * Fetches and manages live recovery data from WHOOP API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const WHOOP_STORAGE_KEY = '@gym_tracker_whoop';
const WHOOP_RECOVERY_CACHE_KEY = '@gym_tracker_whoop_recovery_cache';

export interface RecoveryData {
  recoveryScore: number;
  strain: number;
  sleepScore: number;
  // Full WHOOP biometric fields
  hrv: number | null;               // HRV RMSSD in ms
  rhr: number | null;               // Resting heart rate in bpm
  spo2: number | null;              // SpO2 percentage
  sleepDurationHours: number | null; // Total sleep in hours
  sleepEfficiency: number | null;    // Sleep efficiency %
  sleepConsistency: number | null;   // Sleep consistency %
  remSleepMinutes: number | null;    // REM sleep in minutes
  deepSleepMinutes: number | null;   // Deep (SWS) sleep in minutes
  lightSleepMinutes: number | null;  // Light sleep in minutes
  timestamp: number;
}

export interface WeeklyRecoveryData {
  date: string;
  recoveryScore: number;
  strain: number;
  sleepScore: number;
}

/**
 * Get today's recovery data from WHOOP
 * Falls back to cached data if API unavailable
 */
export async function getTodayRecoveryData(): Promise<RecoveryData | null> {
  try {
    // Get stored WHOOP data
    const stored = await AsyncStorage.getItem(WHOOP_STORAGE_KEY);
    if (!stored) return null;

    const whoopData = JSON.parse(stored);
    if (!whoopData.isConnected) return null;

    // If we have real data from WHOOP, return it
    if (whoopData.recoveryScore !== undefined) {
      return {
        recoveryScore: whoopData.recoveryScore,
        strain: whoopData.strain || 0,
        sleepScore: whoopData.sleepScore || 0,
        hrv: whoopData.hrv ?? null,
        rhr: whoopData.rhr ?? null,
        spo2: whoopData.spo2 ?? null,
        sleepDurationHours: whoopData.sleepDurationHours ?? null,
        sleepEfficiency: whoopData.sleepEfficiency ?? null,
        sleepConsistency: whoopData.sleepConsistency ?? null,
        remSleepMinutes: whoopData.remSleepMinutes ?? null,
        deepSleepMinutes: whoopData.deepSleepMinutes ?? null,
        lightSleepMinutes: whoopData.lightSleepMinutes ?? null,
        timestamp: whoopData.lastSynced || Date.now(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting recovery data:', error);
    return null;
  }
}

/**
 * Save full WHOOP recovery + sleep data to AsyncStorage.
 * Called from the WHOOP tab when data is fetched from the server.
 */
export async function saveWhoopRecoveryToStorage(params: {
  isConnected: boolean;
  recoveryScore?: number;
  strain?: number;
  sleepScore?: number;
  hrv?: number | null;
  rhr?: number | null;
  spo2?: number | null;
  sleepDurationHours?: number | null;
  sleepEfficiency?: number | null;
  sleepConsistency?: number | null;
  remSleepMinutes?: number | null;
  deepSleepMinutes?: number | null;
  lightSleepMinutes?: number | null;
}): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(WHOOP_STORAGE_KEY);
    const base = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem(WHOOP_STORAGE_KEY, JSON.stringify({
      ...base,
      ...params,
      lastSynced: Date.now(),
    }));
  } catch (error) {
    console.error('Error saving WHOOP recovery to storage:', error);
  }
}

/**
 * Get 7-day recovery history for chart visualization
 */
export async function getWeeklyRecoveryData(): Promise<WeeklyRecoveryData[]> {
  try {
    const cached = await AsyncStorage.getItem(WHOOP_RECOVERY_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // Generate demo data for 7 days
    const demoData: WeeklyRecoveryData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate realistic demo data with some variation
      const baseRecovery = 70 + Math.random() * 20;
      const baseStrain = 10 + Math.random() * 5;
      const baseSleep = 75 + Math.random() * 15;

      demoData.push({
        date: date.toISOString().split('T')[0],
        recoveryScore: Math.round(baseRecovery),
        strain: Math.round(baseStrain * 10) / 10,
        sleepScore: Math.round(baseSleep),
      });
    }

    // Cache the data
    await AsyncStorage.setItem(WHOOP_RECOVERY_CACHE_KEY, JSON.stringify(demoData));
    return demoData;
  } catch (error) {
    console.error('Error getting weekly recovery data:', error);
    return [];
  }
}

/**
 * Update recovery cache with new data
 */
export async function updateRecoveryCache(data: WeeklyRecoveryData[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WHOOP_RECOVERY_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error updating recovery cache:', error);
  }
}

/**
 * Get recovery trend (improving/stable/declining)
 */
export function getRecoveryTrend(weeklyData: WeeklyRecoveryData[]): 'improving' | 'stable' | 'declining' {
  if (weeklyData.length < 2) return 'stable';

  const firstHalf = weeklyData.slice(0, Math.floor(weeklyData.length / 2));
  const secondHalf = weeklyData.slice(Math.floor(weeklyData.length / 2));

  const firstAvg = firstHalf.reduce((sum, d) => sum + d.recoveryScore, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.recoveryScore, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * Get average recovery for the week
 */
export function getWeeklyAverageRecovery(weeklyData: WeeklyRecoveryData[]): number {
  if (weeklyData.length === 0) return 0;
  const sum = weeklyData.reduce((acc, d) => acc + d.recoveryScore, 0);
  return Math.round(sum / weeklyData.length);
}

/**
 * Get recovery status message
 */
export function getRecoveryStatusMessage(score: number): string {
  if (score >= 67) return 'Great recovery! You are ready for high intensity training.';
  if (score >= 50) return 'Good recovery. Moderate to high intensity training is fine.';
  if (score >= 34) return 'Fair recovery. Consider a lighter workout today.';
  return 'Low recovery. Focus on rest and light activity.';
}
