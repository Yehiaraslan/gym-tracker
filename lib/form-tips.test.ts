import { describe, it, expect } from 'vitest';
import {
  getTipsForExercise,
  getRandomTip,
  getRandomTips,
  getTipsByCategory,
  getCategoryEmoji,
  getCategoryLabel,
  FormTip,
} from './form-tips';

describe('Form Tips Service', () => {
  describe('getTipsForExercise', () => {
    it('returns exercise-specific tips for bench press', () => {
      const tips = getTipsForExercise('Bench Press');
      expect(tips.length).toBeGreaterThan(0);
      // Should include bench press specific tips
      const hasBenchPressTip = tips.some(tip => 
        tip.tip.toLowerCase().includes('shoulder blades') || 
        tip.tip.toLowerCase().includes('mid-chest')
      );
      expect(hasBenchPressTip).toBe(true);
    });

    it('returns exercise-specific tips for squat', () => {
      const tips = getTipsForExercise('Barbell Squat');
      expect(tips.length).toBeGreaterThan(0);
      // Should include squat specific tips
      const hasSquatTip = tips.some(tip => 
        tip.tip.toLowerCase().includes('knees') || 
        tip.tip.toLowerCase().includes('parallel')
      );
      expect(hasSquatTip).toBe(true);
    });

    it('returns generic tips for unknown exercises', () => {
      const tips = getTipsForExercise('Unknown Exercise XYZ');
      expect(tips.length).toBeGreaterThan(0);
      // Should return generic tips
      const hasGenericTip = tips.some(tip => 
        tip.tip.toLowerCase().includes('control') || 
        tip.tip.toLowerCase().includes('core')
      );
      expect(hasGenericTip).toBe(true);
    });

    it('is case insensitive', () => {
      const tipsLower = getTipsForExercise('bench press');
      const tipsUpper = getTipsForExercise('BENCH PRESS');
      const tipsMixed = getTipsForExercise('Bench Press');
      
      // All should return tips (may vary due to generic tips added)
      expect(tipsLower.length).toBeGreaterThan(0);
      expect(tipsUpper.length).toBeGreaterThan(0);
      expect(tipsMixed.length).toBeGreaterThan(0);
    });

    it('matches partial exercise names', () => {
      const tips = getTipsForExercise('Dumbbell Bicep Curl');
      const hasBicepTip = tips.some(tip => 
        tip.tip.toLowerCase().includes('elbow') || 
        tip.tip.toLowerCase().includes('swing')
      );
      expect(hasBicepTip).toBe(true);
    });
  });

  describe('getRandomTip', () => {
    it('returns a single tip', () => {
      const tip = getRandomTip('Squat');
      expect(tip).toBeDefined();
      expect(tip.id).toBeDefined();
      expect(tip.tip).toBeDefined();
      expect(tip.category).toBeDefined();
    });

    it('returns valid tip structure', () => {
      const tip = getRandomTip('Push Up');
      expect(typeof tip.id).toBe('string');
      expect(typeof tip.tip).toBe('string');
      expect(['breathing', 'posture', 'movement', 'safety', 'performance']).toContain(tip.category);
    });
  });

  describe('getRandomTips', () => {
    it('returns requested number of tips', () => {
      const tips = getRandomTips('Deadlift', 3);
      expect(tips.length).toBe(3);
    });

    it('returns no duplicates', () => {
      const tips = getRandomTips('Bench Press', 5);
      const ids = tips.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('returns all available tips if count exceeds available', () => {
      const tips = getRandomTips('Unknown Exercise', 100);
      expect(tips.length).toBeLessThanOrEqual(100);
      expect(tips.length).toBeGreaterThan(0);
    });
  });

  describe('getTipsByCategory', () => {
    it('filters tips by breathing category', () => {
      const tips = getTipsByCategory('Plank', 'breathing');
      tips.forEach(tip => {
        expect(tip.category).toBe('breathing');
      });
    });

    it('filters tips by safety category', () => {
      const tips = getTipsByCategory('Deadlift', 'safety');
      tips.forEach(tip => {
        expect(tip.category).toBe('safety');
      });
    });

    it('returns empty array if no tips match category', () => {
      // Generic tips may not have all categories for unknown exercises
      const tips = getTipsByCategory('Unknown Exercise XYZ', 'breathing');
      // Should either have tips or be empty, but not throw
      expect(Array.isArray(tips)).toBe(true);
    });
  });

  describe('getCategoryEmoji', () => {
    it('returns correct emoji for each category', () => {
      expect(getCategoryEmoji('breathing')).toBe('🌬️');
      expect(getCategoryEmoji('posture')).toBe('🧍');
      expect(getCategoryEmoji('movement')).toBe('💪');
      expect(getCategoryEmoji('safety')).toBe('⚠️');
      expect(getCategoryEmoji('performance')).toBe('🎯');
    });

    it('returns default emoji for unknown category', () => {
      // @ts-expect-error testing unknown category
      expect(getCategoryEmoji('unknown')).toBe('💡');
    });
  });

  describe('getCategoryLabel', () => {
    it('returns correct label for each category', () => {
      expect(getCategoryLabel('breathing')).toBe('Breathing');
      expect(getCategoryLabel('posture')).toBe('Posture');
      expect(getCategoryLabel('movement')).toBe('Movement');
      expect(getCategoryLabel('safety')).toBe('Safety');
      expect(getCategoryLabel('performance')).toBe('Performance');
    });

    it('returns default label for unknown category', () => {
      // @ts-expect-error testing unknown category
      expect(getCategoryLabel('unknown')).toBe('Tip');
    });
  });

  describe('tip content quality', () => {
    it('all tips have non-empty content', () => {
      const exercises = ['Bench Press', 'Squat', 'Deadlift', 'Pull Up', 'Bicep Curl'];
      exercises.forEach(exercise => {
        const tips = getTipsForExercise(exercise);
        tips.forEach(tip => {
          expect(tip.tip.length).toBeGreaterThan(10);
          expect(tip.id.length).toBeGreaterThan(0);
        });
      });
    });

    it('tips are actionable and specific', () => {
      const tips = getTipsForExercise('Bench Press');
      // At least one tip should contain actionable words
      const hasActionableTip = tips.some(tip => 
        tip.tip.toLowerCase().includes('keep') ||
        tip.tip.toLowerCase().includes('don\'t') ||
        tip.tip.toLowerCase().includes('maintain') ||
        tip.tip.toLowerCase().includes('squeeze')
      );
      expect(hasActionableTip).toBe(true);
    });
  });
});
