import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormTip } from './form-tips';

const FAVORITE_TIPS_KEY = 'gym_tracker_favorite_tips';

export interface FavoriteTip {
  tip: FormTip;
  exerciseName: string;
  savedAt: number;
}

/**
 * Get all favorite tips from storage
 */
export async function getFavoriteTips(): Promise<FavoriteTip[]> {
  try {
    const data = await AsyncStorage.getItem(FAVORITE_TIPS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading favorite tips:', error);
    return [];
  }
}

/**
 * Save a tip to favorites
 */
export async function saveFavoriteTip(tip: FormTip, exerciseName: string): Promise<void> {
  try {
    const favorites = await getFavoriteTips();
    
    // Check if already favorited
    if (favorites.some(f => f.tip.id === tip.id)) {
      return;
    }
    
    const newFavorite: FavoriteTip = {
      tip,
      exerciseName,
      savedAt: Date.now(),
    };
    
    favorites.push(newFavorite);
    await AsyncStorage.setItem(FAVORITE_TIPS_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving favorite tip:', error);
    throw error;
  }
}

/**
 * Remove a tip from favorites
 */
export async function removeFavoriteTip(tipId: string): Promise<void> {
  try {
    const favorites = await getFavoriteTips();
    const filtered = favorites.filter(f => f.tip.id !== tipId);
    await AsyncStorage.setItem(FAVORITE_TIPS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing favorite tip:', error);
    throw error;
  }
}

/**
 * Toggle a tip's favorite status
 */
export async function toggleFavoriteTip(tip: FormTip, exerciseName: string): Promise<boolean> {
  try {
    const favorites = await getFavoriteTips();
    const isFavorited = favorites.some(f => f.tip.id === tip.id);
    
    if (isFavorited) {
      await removeFavoriteTip(tip.id);
      return false;
    } else {
      await saveFavoriteTip(tip, exerciseName);
      return true;
    }
  } catch (error) {
    console.error('Error toggling favorite tip:', error);
    throw error;
  }
}

/**
 * Check if a tip is favorited
 */
export async function isTipFavorited(tipId: string): Promise<boolean> {
  try {
    const favorites = await getFavoriteTips();
    return favorites.some(f => f.tip.id === tipId);
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
}

/**
 * Clear all favorite tips
 */
export async function clearFavoriteTips(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FAVORITE_TIPS_KEY);
  } catch (error) {
    console.error('Error clearing favorite tips:', error);
    throw error;
  }
}

/**
 * Get favorite tips grouped by exercise
 */
export async function getFavoriteTipsByExercise(): Promise<Record<string, FavoriteTip[]>> {
  const favorites = await getFavoriteTips();
  return favorites.reduce((acc, fav) => {
    if (!acc[fav.exerciseName]) {
      acc[fav.exerciseName] = [];
    }
    acc[fav.exerciseName].push(fav);
    return acc;
  }, {} as Record<string, FavoriteTip[]>);
}
