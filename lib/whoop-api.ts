/**
 * WHOOP API Service
 * 
 * Fetches real workout and recovery data from WHOOP API.
 */

import { getValidAccessToken } from './whoop-oauth';

const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';

export interface WhoopRecovery {
  id: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  dayStart: string;
  dayEnd: string;
  score: {
    recoveryScore: number;
    rhrData: {
      lastNightAverage: number;
      lastNightFiveMinLow: number;
      lastNightTenMinLow: number;
    };
    hrv: {
      lastNightAverage: number;
      lastNightFiveMinLow: number;
      lastNightTenMinLow: number;
    };
    sleepData: {
      sleepDurationMs: number;
      sleepQualityPercentage: number;
    };
  } | null;
}

export interface WhoopWorkout {
  id: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  start: string;
  end: string;
  timezoneOffset: string;
  sportId: number;
  scoreState: string;
  score: {
    strain: number;
    averageHeartRate: number;
    maxHeartRate: number;
    kilojoule: number;
    percentRecorded: number;
    distanceMeters?: number;
    altitudeGainMeters?: number;
    altitudeLossMeters?: number;
    zoneZeroMilli?: number;
    zoneOneMilli?: number;
    zoneTwoMilli?: number;
    zoneThreeMilli?: number;
    zoneFourMilli?: number;
    zoneFiveMilli?: number;
  } | null;
}

/**
 * Fetch today's recovery data from WHOOP
 */
export async function getTodayRecovery(): Promise<WhoopRecovery | null> {
  try {
    const token = await getValidAccessToken();
    if (!token) return null;

    const today = new Date();
    const startDate = today.toLocaleDateString('en-CA');

    const response = await fetch(
      `${WHOOP_API_BASE}/recovery?start=${startDate}T00:00:00Z&end=${startDate}T23:59:59Z`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch recovery: ${response.status}`);
    }

    const data = await response.json();
    return data.records?.[0] || null;
  } catch (error) {
    console.error('Error fetching recovery data:', error);
    return null;
  }
}

/**
 * Fetch recovery data for a specific date range
 */
export async function getRecoveryRange(
  startDate: string,
  endDate: string
): Promise<WhoopRecovery[]> {
  try {
    const token = await getValidAccessToken();
    if (!token) return [];

    const response = await fetch(
      `${WHOOP_API_BASE}/recovery?start=${startDate}T00:00:00Z&end=${endDate}T23:59:59Z`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch recovery range: ${response.status}`);
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Error fetching recovery range:', error);
    return [];
  }
}

/**
 * Fetch today's workouts from WHOOP
 */
export async function getTodayWorkouts(): Promise<WhoopWorkout[]> {
  try {
    const token = await getValidAccessToken();
    if (!token) return [];

    const today = new Date();
    const startDate = today.toLocaleDateString('en-CA');

    const response = await fetch(
      `${WHOOP_API_BASE}/workout?start=${startDate}T00:00:00Z&end=${startDate}T23:59:59Z`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch workouts: ${response.status}`);
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return [];
  }
}

/**
 * Fetch workouts for a specific date range
 */
export async function getWorkoutRange(
  startDate: string,
  endDate: string
): Promise<WhoopWorkout[]> {
  try {
    const token = await getValidAccessToken();
    if (!token) return [];

    const response = await fetch(
      `${WHOOP_API_BASE}/workout?start=${startDate}T00:00:00Z&end=${endDate}T23:59:59Z`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch workout range: ${response.status}`);
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Error fetching workout range:', error);
    return [];
  }
}

/**
 * Get recovery score interpretation
 */
export function getRecoveryStatus(score: number): {
  status: 'excellent' | 'good' | 'fair' | 'poor';
  color: string;
  message: string;
} {
  if (score >= 67) {
    return {
      status: 'excellent',
      color: '#22C55E',
      message: 'Excellent recovery - Ready for intense training',
    };
  }
  if (score >= 50) {
    return {
      status: 'good',
      color: '#3B82F6',
      message: 'Good recovery - Ready for training',
    };
  }
  if (score >= 33) {
    return {
      status: 'fair',
      color: '#F59E0B',
      message: 'Fair recovery - Light training recommended',
    };
  }
  return {
    status: 'poor',
    color: '#EF4444',
    message: 'Poor recovery - Rest day recommended',
  };
}

/**
 * Check if rest day is recommended based on recovery
 */
export function shouldRecommendRest(recoveryScore: number): boolean {
  return recoveryScore < 33;
}

/**
 * Get strain level interpretation
 */
export function getStrainLevel(strain: number): {
  level: 'light' | 'moderate' | 'high' | 'very_high';
  color: string;
  message: string;
} {
  if (strain <= 2) {
    return {
      level: 'light',
      color: '#94A3B8',
      message: 'Light workout',
    };
  }
  if (strain <= 4) {
    return {
      level: 'moderate',
      color: '#3B82F6',
      message: 'Moderate workout',
    };
  }
  if (strain <= 7) {
    return {
      level: 'high',
      color: '#F59E0B',
      message: 'High strain workout',
    };
  }
  return {
    level: 'very_high',
    color: '#EF4444',
    message: 'Very high strain workout',
  };
}
