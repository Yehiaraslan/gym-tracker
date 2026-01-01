/**
 * Exercise Cache Service
 * 
 * Caches exercise GIFs and instructions locally for offline access.
 * Uses AsyncStorage for metadata and FileSystem for GIF files.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoSearchResult } from './exercise-video-service';

const CACHE_KEY = '@gym_tracker_exercise_cache';
const CACHE_METADATA_KEY = '@gym_tracker_cache_metadata';
const CACHE_DIR = `${FileSystem.cacheDirectory}exercise_gifs/`;

export interface CachedExercise {
  exerciseId: string;
  exerciseName: string;
  gifUrl: string;
  localGifPath: string | null;
  bodyPart: string;
  target: string;
  equipment: string;
  instructions: string[];
  cachedAt: number;
  lastAccessed: number;
}

export interface CacheMetadata {
  totalSize: number;
  itemCount: number;
  lastUpdated: number;
}

/**
 * Initialize cache directory
 */
async function ensureCacheDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

/**
 * Get all cached exercises
 */
export async function getCachedExercises(): Promise<Record<string, CachedExercise>> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    console.error('Error reading exercise cache:', error);
    return {};
  }
}

/**
 * Get a specific cached exercise by ID
 */
export async function getCachedExercise(exerciseId: string): Promise<CachedExercise | null> {
  const cache = await getCachedExercises();
  const exercise = cache[exerciseId];
  
  if (exercise) {
    // Update last accessed time
    exercise.lastAccessed = Date.now();
    cache[exerciseId] = exercise;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }
  
  return exercise || null;
}

/**
 * Cache an exercise with its GIF and instructions
 */
export async function cacheExercise(exercise: VideoSearchResult): Promise<CachedExercise> {
  await ensureCacheDir();
  
  const cache = await getCachedExercises();
  const now = Date.now();
  
  // Download GIF to local storage
  let localGifPath: string | null = null;
  try {
    const fileName = `${exercise.exerciseId}.gif`;
    localGifPath = `${CACHE_DIR}${fileName}`;
    
    // Check if already downloaded
    const fileInfo = await FileSystem.getInfoAsync(localGifPath);
    if (!fileInfo.exists) {
      // Download the GIF
      const downloadResult = await FileSystem.downloadAsync(
        exercise.gifUrl,
        localGifPath
      );
      
      if (downloadResult.status !== 200) {
        console.warn('Failed to download GIF:', downloadResult.status);
        localGifPath = null;
      }
    }
  } catch (error) {
    console.error('Error downloading GIF:', error);
    localGifPath = null;
  }
  
  const cachedExercise: CachedExercise = {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    gifUrl: exercise.gifUrl,
    localGifPath,
    bodyPart: exercise.bodyPart,
    target: exercise.target,
    equipment: exercise.equipment,
    instructions: exercise.instructions,
    cachedAt: now,
    lastAccessed: now,
  };
  
  cache[exercise.exerciseId] = cachedExercise;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  
  // Update metadata
  await updateCacheMetadata();
  
  return cachedExercise;
}

/**
 * Cache multiple exercises at once
 */
export async function cacheExercises(exercises: VideoSearchResult[]): Promise<void> {
  for (const exercise of exercises) {
    await cacheExercise(exercise);
  }
}

/**
 * Get exercise from cache or fetch and cache it
 */
export async function getOrCacheExercise(
  exercise: VideoSearchResult
): Promise<CachedExercise> {
  const cached = await getCachedExercise(exercise.exerciseId);
  
  if (cached) {
    return cached;
  }
  
  return cacheExercise(exercise);
}

/**
 * Remove a specific exercise from cache
 */
export async function removeCachedExercise(exerciseId: string): Promise<void> {
  const cache = await getCachedExercises();
  const exercise = cache[exerciseId];
  
  if (exercise) {
    // Delete local GIF file if exists
    if (exercise.localGifPath) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(exercise.localGifPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(exercise.localGifPath);
        }
      } catch (error) {
        console.error('Error deleting cached GIF:', error);
      }
    }
    
    delete cache[exerciseId];
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    await updateCacheMetadata();
  }
}

/**
 * Clear all cached exercises
 */
export async function clearExerciseCache(): Promise<void> {
  try {
    // Delete all cached GIF files
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
    
    // Clear AsyncStorage cache
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_METADATA_KEY);
  } catch (error) {
    console.error('Error clearing exercise cache:', error);
    throw error;
  }
}

/**
 * Update cache metadata (size, count)
 */
async function updateCacheMetadata(): Promise<CacheMetadata> {
  const cache = await getCachedExercises();
  const itemCount = Object.keys(cache).length;
  
  let totalSize = 0;
  
  // Calculate total size of cached GIFs
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (dirInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += fileInfo.size || 0;
        }
      }
    }
  } catch (error) {
    console.error('Error calculating cache size:', error);
  }
  
  const metadata: CacheMetadata = {
    totalSize,
    itemCount,
    lastUpdated: Date.now(),
  };
  
  await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  return metadata;
}

/**
 * Get cache metadata
 */
export async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Error reading cache metadata:', error);
  }
  
  return updateCacheMetadata();
}

/**
 * Format bytes to human readable string
 */
export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if an exercise is cached
 */
export async function isExerciseCached(exerciseId: string): Promise<boolean> {
  const cache = await getCachedExercises();
  return exerciseId in cache;
}

/**
 * Get the best available GIF URL (local or remote)
 */
export async function getBestGifUrl(exerciseId: string, remoteUrl: string): Promise<string> {
  const cached = await getCachedExercise(exerciseId);
  
  if (cached?.localGifPath) {
    // Check if local file still exists
    try {
      const fileInfo = await FileSystem.getInfoAsync(cached.localGifPath);
      if (fileInfo.exists) {
        return cached.localGifPath;
      }
    } catch (error) {
      console.error('Error checking local GIF:', error);
    }
  }
  
  return remoteUrl;
}

/**
 * Prune old cache entries (keep most recently accessed)
 */
export async function pruneCache(maxItems: number = 50): Promise<number> {
  const cache = await getCachedExercises();
  const entries = Object.entries(cache);
  
  if (entries.length <= maxItems) {
    return 0;
  }
  
  // Sort by last accessed (oldest first)
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  
  // Remove oldest entries
  const toRemove = entries.slice(0, entries.length - maxItems);
  let removed = 0;
  
  for (const [exerciseId] of toRemove) {
    await removeCachedExercise(exerciseId);
    removed++;
  }
  
  return removed;
}
