import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getFavoriteTips,
  saveFavoriteTip,
  removeFavoriteTip,
  toggleFavoriteTip,
  isTipFavorited,
  clearFavoriteTips,
  getFavoriteTipsByExercise,
  FavoriteTip,
} from './favorite-tips';
import { FormTip } from './form-tips';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

describe('favorite-tips', () => {
  const mockTip: FormTip = {
    id: 'tip-1',
    tip: 'Keep your core tight',
    category: 'posture',
  };

  const mockTip2: FormTip = {
    id: 'tip-2',
    tip: 'Breathe out on the way up',
    category: 'breathing',
  };

  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe('getFavoriteTips', () => {
    it('should return empty array when no favorites exist', async () => {
      const favorites = await getFavoriteTips();
      expect(favorites).toEqual([]);
    });

    it('should return stored favorites', async () => {
      const storedFavorites: FavoriteTip[] = [
        { tip: mockTip, exerciseName: 'Squat', savedAt: Date.now() },
      ];
      mockStorage['gym_tracker_favorite_tips'] = JSON.stringify(storedFavorites);

      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].tip.id).toBe('tip-1');
    });
  });

  describe('saveFavoriteTip', () => {
    it('should save a new favorite tip', async () => {
      await saveFavoriteTip(mockTip, 'Squat');

      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].tip.id).toBe('tip-1');
      expect(favorites[0].exerciseName).toBe('Squat');
    });

    it('should not duplicate already favorited tips', async () => {
      await saveFavoriteTip(mockTip, 'Squat');
      await saveFavoriteTip(mockTip, 'Squat');

      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(1);
    });
  });

  describe('removeFavoriteTip', () => {
    it('should remove a favorite tip by id', async () => {
      await saveFavoriteTip(mockTip, 'Squat');
      await saveFavoriteTip(mockTip2, 'Bench Press');

      await removeFavoriteTip('tip-1');

      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].tip.id).toBe('tip-2');
    });
  });

  describe('toggleFavoriteTip', () => {
    it('should add tip when not favorited', async () => {
      const result = await toggleFavoriteTip(mockTip, 'Squat');

      expect(result).toBe(true);
      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(1);
    });

    it('should remove tip when already favorited', async () => {
      await saveFavoriteTip(mockTip, 'Squat');

      const result = await toggleFavoriteTip(mockTip, 'Squat');

      expect(result).toBe(false);
      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(0);
    });
  });

  describe('isTipFavorited', () => {
    it('should return true for favorited tip', async () => {
      await saveFavoriteTip(mockTip, 'Squat');

      const result = await isTipFavorited('tip-1');
      expect(result).toBe(true);
    });

    it('should return false for non-favorited tip', async () => {
      const result = await isTipFavorited('tip-1');
      expect(result).toBe(false);
    });
  });

  describe('clearFavoriteTips', () => {
    it('should clear all favorite tips', async () => {
      await saveFavoriteTip(mockTip, 'Squat');
      await saveFavoriteTip(mockTip2, 'Bench Press');

      await clearFavoriteTips();

      const favorites = await getFavoriteTips();
      expect(favorites).toHaveLength(0);
    });
  });

  describe('getFavoriteTipsByExercise', () => {
    it('should group favorites by exercise name', async () => {
      await saveFavoriteTip(mockTip, 'Squat');
      await saveFavoriteTip(mockTip2, 'Bench Press');

      const grouped = await getFavoriteTipsByExercise();

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['Squat']).toHaveLength(1);
      expect(grouped['Bench Press']).toHaveLength(1);
    });

    it('should return empty object when no favorites', async () => {
      const grouped = await getFavoriteTipsByExercise();
      expect(grouped).toEqual({});
    });
  });
});
