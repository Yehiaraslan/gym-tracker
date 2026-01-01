/**
 * Exercise Video Service
 * 
 * Automatically fetches high-quality form demonstration GIFs for exercises
 * using the ExerciseDB API (via RapidAPI).
 * Includes local caching for offline access.
 */

import {
  getCachedExercise,
  cacheExercise,
  getCachedExercises,
  CachedExercise,
} from './exercise-cache';

export interface ExerciseDBResult {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  secondaryMuscles: string[];
  instructions: string[];
}

export interface VideoSearchResult {
  exerciseId: string;
  exerciseName: string;
  gifUrl: string;
  bodyPart: string;
  target: string;
  equipment: string;
  instructions: string[];
}

// Common exercise name mappings to ExerciseDB search terms
const EXERCISE_NAME_MAPPINGS: Record<string, string> = {
  // Chest
  'bench press': 'barbell bench press',
  'incline bench': 'incline barbell bench press',
  'dumbbell press': 'dumbbell bench press',
  'chest fly': 'dumbbell fly',
  'push up': 'push-up',
  'pushup': 'push-up',
  'push-up': 'push-up',
  
  // Back
  'pull up': 'pull-up',
  'pullup': 'pull-up',
  'pull-up': 'pull-up',
  'lat pulldown': 'cable lat pulldown',
  'row': 'barbell bent over row',
  'bent over row': 'barbell bent over row',
  'deadlift': 'barbell deadlift',
  
  // Shoulders
  'overhead press': 'barbell overhead press',
  'shoulder press': 'dumbbell shoulder press',
  'lateral raise': 'dumbbell lateral raise',
  'front raise': 'dumbbell front raise',
  
  // Arms
  'bicep curl': 'dumbbell bicep curl',
  'curl': 'dumbbell curl',
  'tricep extension': 'dumbbell tricep extension',
  'tricep pushdown': 'cable pushdown',
  'skull crusher': 'ez barbell lying triceps extension',
  
  // Legs
  'squat': 'barbell squat',
  'back squat': 'barbell squat',
  'front squat': 'barbell front squat',
  'leg press': 'sled leg press',
  'lunge': 'dumbbell lunge',
  'leg curl': 'lever lying leg curl',
  'leg extension': 'lever leg extension',
  'calf raise': 'standing calf raise',
  'rdl': 'barbell romanian deadlift',
  'romanian deadlift': 'barbell romanian deadlift',
  'hip thrust': 'barbell hip thrust',
  
  // Core
  'crunch': 'crunch',
  'plank': 'plank',
  'sit up': 'sit-up',
  'situp': 'sit-up',
  'leg raise': 'lying leg raise',
};

/**
 * Get the best search term for an exercise name
 */
function getSearchTerm(exerciseName: string): string {
  const normalized = exerciseName.toLowerCase().trim();
  return EXERCISE_NAME_MAPPINGS[normalized] || normalized;
}

/**
 * Search for exercises by name using ExerciseDB API
 */
export async function searchExercises(
  exerciseName: string,
  apiKey: string,
  limit: number = 5
): Promise<ExerciseDBResult[]> {
  const searchTerm = getSearchTerm(exerciseName);
  const encodedName = encodeURIComponent(searchTerm);
  
  const url = `https://exercisedb.p.rapidapi.com/exercises/name/${encodedName}?limit=${limit}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
    });
    
    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data as ExerciseDBResult[];
  } catch (error) {
    console.error('Error searching exercises:', error);
    throw error;
  }
}

/**
 * Get the GIF URL for an exercise
 */
export function getExerciseGifUrl(
  exerciseId: string,
  apiKey: string,
  resolution: '180' | '360' | '720' | '1080' = '360'
): string {
  return `https://exercisedb.p.rapidapi.com/image?exerciseId=${exerciseId}&resolution=${resolution}&rapidapi-key=${apiKey}`;
}

/**
 * Search for exercise and get video/GIF result
 * Automatically caches results for offline access
 */
export async function findExerciseVideo(
  exerciseName: string,
  apiKey: string,
  useCache: boolean = true
): Promise<VideoSearchResult | null> {
  try {
    const results = await searchExercises(exerciseName, apiKey, 1);
    
    if (results.length === 0) {
      // Try with original name if mapping didn't work
      const originalResults = await searchExercises(exerciseName.toLowerCase(), apiKey, 1);
      if (originalResults.length === 0) {
        return null;
      }
      results.push(...originalResults);
    }
    
    const exercise = results[0];
    const gifUrl = getExerciseGifUrl(exercise.id, apiKey);
    
    const result: VideoSearchResult = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      gifUrl,
      bodyPart: exercise.bodyPart,
      target: exercise.target,
      equipment: exercise.equipment,
      instructions: exercise.instructions,
    };
    
    // Cache the result for offline access
    if (useCache) {
      try {
        await cacheExercise(result);
      } catch (cacheError) {
        console.warn('Failed to cache exercise:', cacheError);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error finding exercise video:', error);
    return null;
  }
}

/**
 * Get multiple exercise suggestions for a search term
 * Automatically caches results for offline access
 */
export async function getExerciseSuggestions(
  exerciseName: string,
  apiKey: string,
  limit: number = 5,
  useCache: boolean = true
): Promise<VideoSearchResult[]> {
  try {
    const results = await searchExercises(exerciseName, apiKey, limit);
    
    const suggestions = results.map(exercise => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      gifUrl: getExerciseGifUrl(exercise.id, apiKey),
      bodyPart: exercise.bodyPart,
      target: exercise.target,
      equipment: exercise.equipment,
      instructions: exercise.instructions,
    }));
    
    // Cache all results for offline access
    if (useCache) {
      for (const suggestion of suggestions) {
        try {
          await cacheExercise(suggestion);
        } catch (cacheError) {
          console.warn('Failed to cache exercise:', cacheError);
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error getting exercise suggestions:', error);
    
    // Try to return cached results if API fails
    try {
      const cached = await getCachedExercises();
      const searchTerm = exerciseName.toLowerCase();
      const cachedResults = Object.values(cached)
        .filter(ex => ex.exerciseName.toLowerCase().includes(searchTerm))
        .slice(0, limit)
        .map(ex => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          gifUrl: ex.localGifPath || ex.gifUrl,
          bodyPart: ex.bodyPart,
          target: ex.target,
          equipment: ex.equipment,
          instructions: ex.instructions,
        }));
      
      if (cachedResults.length > 0) {
        console.log('Returning cached results due to API error');
        return cachedResults;
      }
    } catch (cacheError) {
      console.error('Error reading cache:', cacheError);
    }
    
    return [];
  }
}

/**
 * Curated list of popular exercises with pre-defined ExerciseDB IDs
 * This allows the app to work without API calls for common exercises
 */
export const CURATED_EXERCISES: Record<string, { id: string; name: string }> = {
  // These IDs are from ExerciseDB - update as needed
  'bench press': { id: '0025', name: 'Barbell Bench Press' },
  'squat': { id: '0043', name: 'Barbell Full Squat' },
  'deadlift': { id: '0032', name: 'Barbell Deadlift' },
  'pull-up': { id: '0651', name: 'Pull-up' },
  'push-up': { id: '0662', name: 'Push-up' },
  'shoulder press': { id: '0405', name: 'Dumbbell Shoulder Press' },
  'bicep curl': { id: '0294', name: 'Dumbbell Biceps Curl' },
  'tricep extension': { id: '0860', name: 'Dumbbell Triceps Extension' },
  'lat pulldown': { id: '0160', name: 'Cable Lat Pulldown' },
  'leg press': { id: '0738', name: 'Sled Leg Press' },
  'lunge': { id: '0334', name: 'Dumbbell Lunge' },
  'romanian deadlift': { id: '0085', name: 'Barbell Romanian Deadlift' },
  'calf raise': { id: '1386', name: 'Standing Calf Raise' },
  'plank': { id: '0628', name: 'Plank' },
  'crunch': { id: '0262', name: 'Crunch' },
};

/**
 * Get a curated exercise GIF URL without API call
 * Falls back to search if not in curated list
 */
export function getCuratedExerciseGifUrl(
  exerciseName: string,
  apiKey: string
): string | null {
  const normalized = exerciseName.toLowerCase().trim();
  const curated = CURATED_EXERCISES[normalized];
  
  if (curated) {
    return getExerciseGifUrl(curated.id, apiKey);
  }
  
  return null;
}

/**
 * Check if ExerciseDB API key is valid
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const url = 'https://exercisedb.p.rapidapi.com/exercises?limit=1';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
    });
    
    return response.ok;
  } catch {
    return false;
  }
}
