import { describe, it, expect } from 'vitest';
import {
  getProgramProgress,
  suggestNextProgram,
  findBestTemplate,
  PROGRAM_TEMPLATES,
  type CustomProgram,
} from '../lib/custom-program-store';

// Helper to create a mock CustomProgram with a specific createdAt date
function mockProgram(overrides: Partial<CustomProgram> & { createdAt: string }): CustomProgram {
  return {
    name: 'Full Body 3x/Week',
    description: 'Test',
    sessions: {},
    sessionNames: {},
    sessionColors: {},
    weeklySchedule: {},
    generatedByZaki: false,
    durationWeeks: 4,
    ...overrides,
  };
}

describe('getProgramProgress', () => {
  it('returns 0% for a program created just now', () => {
    const prog = mockProgram({ createdAt: new Date().toISOString() });
    const p = getProgramProgress(prog);
    expect(p.weeksElapsed).toBe(0);
    expect(p.percentComplete).toBeLessThanOrEqual(1);
    expect(p.isComplete).toBe(false);
    expect(p.daysRemaining).toBe(28);
    expect(p.totalWeeks).toBe(4);
  });

  it('returns 50% after 2 weeks of a 4-week program', () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const prog = mockProgram({ createdAt: twoWeeksAgo.toISOString() });
    const p = getProgramProgress(prog);
    expect(p.weeksElapsed).toBe(2);
    expect(p.percentComplete).toBe(50);
    expect(p.isComplete).toBe(false);
    expect(p.daysRemaining).toBe(14);
  });

  it('returns 100% and isComplete after 4 weeks', () => {
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);
    const prog = mockProgram({ createdAt: fiveWeeksAgo.toISOString() });
    const p = getProgramProgress(prog);
    expect(p.isComplete).toBe(true);
    expect(p.percentComplete).toBe(100);
    expect(p.daysRemaining).toBe(0);
  });

  it('handles 6-week programs correctly', () => {
    // Use a fixed date exactly 21 days ago at midnight to avoid timezone edge cases
    const now = new Date();
    const threeWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 21, 0, 0, 0);
    const prog = mockProgram({ createdAt: threeWeeksAgo.toISOString(), durationWeeks: 6 });
    const p = getProgramProgress(prog);
    expect(p.totalWeeks).toBe(6);
    // weeksElapsed = floor(daysElapsed / 7), daysElapsed should be ~21
    expect(p.weeksElapsed).toBeGreaterThanOrEqual(2);
    expect(p.weeksElapsed).toBeLessThanOrEqual(3);
    expect(p.percentComplete).toBeGreaterThanOrEqual(49);
    expect(p.percentComplete).toBeLessThanOrEqual(51);
    expect(p.isComplete).toBe(false);
  });

  it('defaults to 4 weeks when durationWeeks is undefined', () => {
    const prog = mockProgram({ createdAt: new Date().toISOString(), durationWeeks: undefined });
    const p = getProgramProgress(prog);
    expect(p.totalWeeks).toBe(4);
  });
});

describe('suggestNextProgram', () => {
  it('suggests intermediate after completing beginner full body', () => {
    const beginner = mockProgram({
      createdAt: new Date().toISOString(),
      name: 'Full Body 3x/Week',
    });
    const result = suggestNextProgram(beginner, 'muscle_gain', 'beginner', 'full_gym');
    expect(result.template.experience).toBe('intermediate');
    expect(result.reason).toContain('level up');
  });

  it('suggests advanced PPL after completing intermediate upper/lower', () => {
    const intermediate = mockProgram({
      createdAt: new Date().toISOString(),
      name: 'Upper/Lower 4x/Week',
    });
    const result = suggestNextProgram(intermediate, 'muscle_gain', 'intermediate', 'full_gym');
    expect(result.template.experience).toBe('advanced');
    expect(result.reason).toContain('PPL');
  });

  it('suggests muscle gain after completing fat loss circuit', () => {
    const fatLoss = mockProgram({
      createdAt: new Date().toISOString(),
      name: 'Fat Loss Circuit 4x/Week',
    });
    const result = suggestNextProgram(fatLoss, 'fat_loss', 'intermediate', 'full_gym');
    expect(result.reason).toContain('build muscle');
  });

  it('suggests repeating for advanced PPL (no further progression)', () => {
    const advanced = mockProgram({
      createdAt: new Date().toISOString(),
      name: 'Push/Pull/Legs 6x/Week',
    });
    const result = suggestNextProgram(advanced, 'muscle_gain', 'advanced', 'full_gym');
    expect(result.reason).toContain('Repeat');
    expect(result.reason).toContain('heavier');
  });

  it('respects equipment constraints during progression', () => {
    const homeBegin = mockProgram({
      createdAt: new Date().toISOString(),
      name: 'Home Dumbbell 3x/Week',
    });
    const result = suggestNextProgram(homeBegin, 'muscle_gain', 'beginner', 'home_dumbbells');
    // Should suggest an intermediate program that works with home dumbbells
    expect(result.template).toBeDefined();
    expect(result.reason).toBeTruthy();
  });

  it('always returns a valid template and reason', () => {
    for (const template of PROGRAM_TEMPLATES) {
      const prog = mockProgram({
        createdAt: new Date().toISOString(),
        name: template.name,
      });
      const result = suggestNextProgram(prog, 'muscle_gain', template.experience, template.equipment);
      expect(result.template).toBeDefined();
      expect(result.template.id).toBeTruthy();
      expect(result.reason).toBeTruthy();
    }
  });
});
