/**
 * WHOOP API Service
 * 
 * Integrates with WHOOP API to fetch workout heart rate data.
 * Note: WHOOP API provides aggregated HR data (avg, max), not real-time streaming.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const WHOOP_TOKEN_KEY = 'gym_tracker_whoop_token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';

export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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

export interface WhoopHeartRateData {
  averageHeartRate: number;
  maxHeartRate: number;
  strain: number;
  kilojoules: number;
  durationMinutes: number;
  zones: {
    zone: number;
    label: string;
    minutes: number;
    percentage: number;
    color: string;
  }[];
  // Estimated HR curve for visualization (since WHOOP doesn't provide time-series)
  estimatedCurve: { time: number; hr: number }[];
}

/**
 * Save WHOOP tokens to storage
 */
export async function saveWhoopTokens(tokens: WhoopTokens): Promise<void> {
  await AsyncStorage.setItem(WHOOP_TOKEN_KEY, JSON.stringify(tokens));
}

/**
 * Get stored WHOOP tokens
 */
export async function getWhoopTokens(): Promise<WhoopTokens | null> {
  try {
    const data = await AsyncStorage.getItem(WHOOP_TOKEN_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear WHOOP tokens (logout)
 */
export async function clearWhoopTokens(): Promise<void> {
  await AsyncStorage.removeItem(WHOOP_TOKEN_KEY);
}

/**
 * Check if WHOOP is connected
 */
export async function isWhoopConnected(): Promise<boolean> {
  const tokens = await getWhoopTokens();
  if (!tokens) return false;
  // Check if token is expired
  return tokens.expiresAt > Date.now();
}

/**
 * Fetch recent workouts from WHOOP
 */
export async function fetchRecentWorkouts(
  accessToken: string,
  limit: number = 5
): Promise<WhoopWorkout[]> {
  try {
    const response = await fetch(
      `${WHOOP_API_BASE}/activity/workout?limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`WHOOP API error: ${response.status}`);
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Error fetching WHOOP workouts:', error);
    throw error;
  }
}

/**
 * Fetch a specific workout by ID
 */
export async function fetchWorkoutById(
  accessToken: string,
  workoutId: string
): Promise<WhoopWorkout | null> {
  try {
    const response = await fetch(
      `${WHOOP_API_BASE}/activity/workout/${workoutId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`WHOOP API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching WHOOP workout:', error);
    return null;
  }
}

/**
 * Get the most recent workout that overlaps with the given time range
 */
export async function findWorkoutInTimeRange(
  accessToken: string,
  startTime: Date,
  endTime: Date
): Promise<WhoopWorkout | null> {
  try {
    const workouts = await fetchRecentWorkouts(accessToken, 10);
    
    // Find workout that overlaps with our time range
    for (const workout of workouts) {
      const workoutStart = new Date(workout.start);
      const workoutEnd = new Date(workout.end);
      
      // Check if there's any overlap
      if (workoutStart <= endTime && workoutEnd >= startTime) {
        return workout;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding workout in time range:', error);
    return null;
  }
}

/**
 * Convert WHOOP workout to heart rate data with estimated curve
 */
export function processWhoopWorkout(workout: WhoopWorkout): WhoopHeartRateData | null {
  if (!workout.score) {
    return null;
  }

  const { score } = workout;
  const startTime = new Date(workout.start);
  const endTime = new Date(workout.end);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  // Calculate zone data
  const zones = calculateZones(score, durationMs);

  // Generate estimated HR curve based on zones and avg/max HR
  const estimatedCurve = generateEstimatedHRCurve(
    score.averageHeartRate,
    score.maxHeartRate,
    durationMinutes,
    zones
  );

  return {
    averageHeartRate: score.averageHeartRate,
    maxHeartRate: score.maxHeartRate,
    strain: score.strain,
    kilojoules: score.kilojoule,
    durationMinutes,
    zones,
    estimatedCurve,
  };
}

/**
 * Calculate heart rate zones from WHOOP data
 */
function calculateZones(
  score: NonNullable<WhoopWorkout['score']>,
  totalDurationMs: number
): WhoopHeartRateData['zones'] {
  const zoneData = [
    { zone: 0, label: 'Rest', milli: score.zoneZeroMilli || 0, color: '#94A3B8' },
    { zone: 1, label: 'Low', milli: score.zoneOneMilli || 0, color: '#22C55E' },
    { zone: 2, label: 'Moderate', milli: score.zoneTwoMilli || 0, color: '#EAB308' },
    { zone: 3, label: 'Hard', milli: score.zoneThreeMilli || 0, color: '#F97316' },
    { zone: 4, label: 'Very Hard', milli: score.zoneFourMilli || 0, color: '#EF4444' },
    { zone: 5, label: 'Max', milli: score.zoneFiveMilli || 0, color: '#DC2626' },
  ];

  return zoneData.map(z => ({
    zone: z.zone,
    label: z.label,
    minutes: Math.round(z.milli / 60000),
    percentage: totalDurationMs > 0 ? Math.round((z.milli / totalDurationMs) * 100) : 0,
    color: z.color,
  }));
}

/**
 * Generate an estimated heart rate curve for visualization
 * Since WHOOP doesn't provide time-series data, we create a plausible curve
 * based on average HR, max HR, and zone distribution
 */
function generateEstimatedHRCurve(
  avgHR: number,
  maxHR: number,
  durationMinutes: number,
  zones: WhoopHeartRateData['zones']
): { time: number; hr: number }[] {
  const points: { time: number; hr: number }[] = [];
  const numPoints = Math.min(durationMinutes, 60); // Max 60 data points
  
  // Estimate min HR (resting would be ~60, workout min probably avgHR - 20)
  const minHR = Math.max(60, avgHR - 30);
  
  // Create a curve that:
  // 1. Starts lower (warmup)
  // 2. Rises to peak around 60-70% through
  // 3. Drops slightly at the end (cooldown)
  
  for (let i = 0; i <= numPoints; i++) {
    const progress = i / numPoints; // 0 to 1
    const time = Math.round((progress * durationMinutes));
    
    let hr: number;
    
    if (progress < 0.15) {
      // Warmup phase - rising from min to avg
      const warmupProgress = progress / 0.15;
      hr = minHR + (avgHR - minHR) * warmupProgress;
    } else if (progress < 0.7) {
      // Main workout - oscillating around avg with peaks toward max
      const mainProgress = (progress - 0.15) / 0.55;
      const baseHR = avgHR;
      const variation = (maxHR - avgHR) * 0.7;
      // Add some variation with sine waves
      const wave = Math.sin(mainProgress * Math.PI * 4) * variation * 0.3;
      const trend = Math.sin(mainProgress * Math.PI) * variation * 0.5;
      hr = baseHR + wave + trend;
    } else if (progress < 0.85) {
      // Peak phase - highest intensity
      const peakProgress = (progress - 0.7) / 0.15;
      const peakHR = avgHR + (maxHR - avgHR) * 0.8;
      hr = peakHR + Math.sin(peakProgress * Math.PI) * (maxHR - peakHR);
    } else {
      // Cooldown phase - dropping back down
      const cooldownProgress = (progress - 0.85) / 0.15;
      const startHR = avgHR + (maxHR - avgHR) * 0.3;
      hr = startHR - (startHR - minHR - 10) * cooldownProgress;
    }
    
    // Clamp to reasonable range
    hr = Math.max(minHR, Math.min(maxHR, Math.round(hr)));
    
    points.push({ time, hr });
  }
  
  return points;
}

/**
 * Get demo heart rate data for testing without WHOOP connection
 */
export function getDemoHeartRateData(durationMinutes: number): WhoopHeartRateData {
  const avgHR = 135;
  const maxHR = 172;
  
  const zones: WhoopHeartRateData['zones'] = [
    { zone: 0, label: 'Rest', minutes: 2, percentage: 5, color: '#94A3B8' },
    { zone: 1, label: 'Low', minutes: 8, percentage: 20, color: '#22C55E' },
    { zone: 2, label: 'Moderate', minutes: 15, percentage: 35, color: '#EAB308' },
    { zone: 3, label: 'Hard', minutes: 12, percentage: 28, color: '#F97316' },
    { zone: 4, label: 'Very Hard', minutes: 4, percentage: 10, color: '#EF4444' },
    { zone: 5, label: 'Max', minutes: 1, percentage: 2, color: '#DC2626' },
  ];
  
  return {
    averageHeartRate: avgHR,
    maxHeartRate: maxHR,
    strain: 12.5,
    kilojoules: 850,
    durationMinutes,
    zones,
    estimatedCurve: generateEstimatedHRCurve(avgHR, maxHR, durationMinutes, zones),
  };
}
