/**
 * Workout Pre-Download Service
 * 
 * Downloads all exercise GIFs for a scheduled workout before going to the gym
 * to ensure offline access during the workout.
 */

import { findExerciseVideo, VideoSearchResult } from './exercise-video-service';
import { cacheExercise, getCachedExercise, CachedExercise } from './exercise-cache';
import { Exercise, DayExercise } from './types';

export interface DownloadProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
  status: 'idle' | 'downloading' | 'complete' | 'error';
  results: DownloadResult[];
}

export interface DownloadResult {
  exerciseId: string;
  exerciseName: string;
  success: boolean;
  cached: boolean;
  error?: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Pre-download all exercise GIFs for a workout day
 */
export async function predownloadWorkoutGifs(
  exercises: Exercise[],
  dayExercises: DayExercise[],
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<DownloadProgress> {
  const progress: DownloadProgress = {
    total: dayExercises.length,
    completed: 0,
    failed: 0,
    current: null,
    status: 'downloading',
    results: [],
  };

  if (!apiKey) {
    progress.status = 'error';
    progress.results = dayExercises.map(de => {
      const exercise = exercises.find(e => e.id === de.exerciseId);
      return {
        exerciseId: de.exerciseId,
        exerciseName: exercise?.name || 'Unknown',
        success: false,
        cached: false,
        error: 'No API key configured',
      };
    });
    progress.failed = dayExercises.length;
    onProgress?.(progress);
    return progress;
  }

  for (const dayExercise of dayExercises) {
    const exercise = exercises.find(e => e.id === dayExercise.exerciseId);
    if (!exercise) {
      progress.failed++;
      progress.results.push({
        exerciseId: dayExercise.exerciseId,
        exerciseName: 'Unknown',
        success: false,
        cached: false,
        error: 'Exercise not found',
      });
      continue;
    }

    progress.current = exercise.name;
    onProgress?.(progress);

    try {
      // Check if already cached
      const cached = await getCachedExercise(exercise.id);
      if (cached && cached.localGifPath) {
        progress.completed++;
        progress.results.push({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          success: true,
          cached: true,
        });
        onProgress?.(progress);
        continue;
      }

      // Fetch and cache the exercise
      const videoResult = await findExerciseVideo(exercise.name, apiKey);
      if (videoResult) {
        // Cache will download the GIF
        await cacheExercise({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          gifUrl: videoResult.gifUrl,
          bodyPart: videoResult.bodyPart,
          target: videoResult.target,
          equipment: videoResult.equipment,
          instructions: videoResult.instructions,
        });
        
        progress.completed++;
        progress.results.push({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          success: true,
          cached: false,
        });
      } else {
        progress.failed++;
        progress.results.push({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          success: false,
          cached: false,
          error: 'Exercise not found in database',
        });
      }
    } catch (error) {
      progress.failed++;
      progress.results.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        success: false,
        cached: false,
        error: error instanceof Error ? error.message : 'Download failed',
      });
    }

    onProgress?.(progress);
  }

  progress.current = null;
  progress.status = progress.failed === progress.total ? 'error' : 'complete';
  onProgress?.(progress);

  return progress;
}

/**
 * Check which exercises are already cached for a workout
 */
export async function checkWorkoutCacheStatus(
  exercises: Exercise[],
  dayExercises: DayExercise[]
): Promise<{ cached: number; total: number; uncached: string[] }> {
  let cached = 0;
  const uncached: string[] = [];

  for (const dayExercise of dayExercises) {
    const exercise = exercises.find(e => e.id === dayExercise.exerciseId);
    if (!exercise) continue;

    const cachedExercise = await getCachedExercise(exercise.id);
    if (cachedExercise && cachedExercise.localGifPath) {
      cached++;
    } else {
      uncached.push(exercise.name);
    }
  }

  return {
    cached,
    total: dayExercises.length,
    uncached,
  };
}
