/**
 * Client-side exercise how-to lookup.
 * Asks the backend (bundled free-exercise-db) and caches results locally so
 * repeat views are instant and work offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';

export type HowtoData = {
  found: boolean;
  matchedName?: string;
  images?: string[];
  instructions?: string[];
  primaryMuscles?: string[];
  equipment?: string | null;
  level?: string;
};

const CACHE_PREFIX = '@howto_cache_v1:';
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

function cacheKey(name: string): string {
  return CACHE_PREFIX + name.trim().toLowerCase();
}

export async function getExerciseHowto(name: string): Promise<HowtoData> {
  const key = cacheKey(name);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as { at: number; data: HowtoData };
      if (Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
    }
  } catch {
    // cache miss/corrupt — fall through to network
  }

  const data = (await trpcClient.zaki.exerciseHowto.query({ name })) as HowtoData;
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // cache write failure is non-fatal
  }
  return data;
}
