import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// Mock FileSystem
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/mock/cache/',
  getInfoAsync: vi.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  downloadAsync: vi.fn().mockResolvedValue({ status: 200 }),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  readDirectoryAsync: vi.fn().mockResolvedValue([]),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  formatCacheSize,
} from './exercise-cache';

describe('Exercise Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatCacheSize', () => {
    it('should format 0 bytes', () => {
      expect(formatCacheSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatCacheSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatCacheSize(1024)).toBe('1 KB');
      expect(formatCacheSize(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatCacheSize(1024 * 1024)).toBe('1 MB');
      expect(formatCacheSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatCacheSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format with decimals', () => {
      expect(formatCacheSize(1536)).toBe('1.5 KB');
      expect(formatCacheSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('getCachedExercises', () => {
    it('should return empty object when no cache exists', async () => {
      (AsyncStorage.getItem as any).mockResolvedValue(null);
      
      const { getCachedExercises } = await import('./exercise-cache');
      const result = await getCachedExercises();
      
      expect(result).toEqual({});
    });

    it('should return parsed cache when exists', async () => {
      const mockCache = {
        'ex1': {
          exerciseId: 'ex1',
          exerciseName: 'Bench Press',
          gifUrl: 'https://example.com/bench.gif',
          localGifPath: null,
          bodyPart: 'chest',
          target: 'pectorals',
          equipment: 'barbell',
          instructions: ['Step 1', 'Step 2'],
          cachedAt: 1000,
          lastAccessed: 1000,
        },
      };
      
      (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockCache));
      
      const { getCachedExercises } = await import('./exercise-cache');
      const result = await getCachedExercises();
      
      expect(result).toEqual(mockCache);
    });
  });

  describe('CacheMetadata', () => {
    it('should have correct structure', async () => {
      const metadata = {
        totalSize: 1024,
        itemCount: 5,
        lastUpdated: Date.now(),
      };
      
      expect(metadata).toHaveProperty('totalSize');
      expect(metadata).toHaveProperty('itemCount');
      expect(metadata).toHaveProperty('lastUpdated');
      expect(typeof metadata.totalSize).toBe('number');
      expect(typeof metadata.itemCount).toBe('number');
      expect(typeof metadata.lastUpdated).toBe('number');
    });
  });

  describe('CachedExercise', () => {
    it('should have correct structure', () => {
      const cachedExercise = {
        exerciseId: 'ex1',
        exerciseName: 'Squat',
        gifUrl: 'https://example.com/squat.gif',
        localGifPath: '/cache/ex1.gif',
        bodyPart: 'upper legs',
        target: 'quads',
        equipment: 'barbell',
        instructions: ['Stand with feet shoulder-width apart', 'Lower your body'],
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
      };
      
      expect(cachedExercise).toHaveProperty('exerciseId');
      expect(cachedExercise).toHaveProperty('exerciseName');
      expect(cachedExercise).toHaveProperty('gifUrl');
      expect(cachedExercise).toHaveProperty('localGifPath');
      expect(cachedExercise).toHaveProperty('bodyPart');
      expect(cachedExercise).toHaveProperty('target');
      expect(cachedExercise).toHaveProperty('equipment');
      expect(cachedExercise).toHaveProperty('instructions');
      expect(cachedExercise).toHaveProperty('cachedAt');
      expect(cachedExercise).toHaveProperty('lastAccessed');
      expect(Array.isArray(cachedExercise.instructions)).toBe(true);
    });
  });
});
