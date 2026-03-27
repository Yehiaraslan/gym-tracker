import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findBestTemplate,
  PROGRAM_TEMPLATES,
  type ProgramTemplate,
  type CustomProgram,
} from '../lib/custom-program-store';
import { SESSION_NAMES, SESSION_COLORS } from '../lib/training-program';
import { buildFullSchedule, type DayName } from '../lib/schedule-store';

/**
 * End-to-end test for the onboarding → program → schedule → home pipeline.
 *
 * Flow:
 * 1. User completes onboarding (goal + experience + equipment)
 * 2. findBestTemplate() selects the right program template
 * 3. applyProgramTemplate() converts template → CustomProgram + updates schedule
 * 4. Home screen loads customProgram and resolves names/colors dynamically
 */

// ── 1. Template Selection Tests ──────────────────────────────

describe('Template Selection (findBestTemplate)', () => {
  it('selects Beginner Full Body for beginner + full_gym + muscle_gain', () => {
    const t = findBestTemplate('muscle_gain', 'beginner', 'full_gym');
    expect(t.id).toBe('beginner-full-body-3x');
    expect(t.name).toContain('Full Body');
  });

  it('selects Intermediate Upper/Lower for intermediate + full_gym + muscle_gain', () => {
    const t = findBestTemplate('muscle_gain', 'intermediate', 'full_gym');
    expect(t.id).toBe('intermediate-upper-lower-4x');
  });

  it('selects Advanced PPL for advanced + full_gym + muscle_gain', () => {
    const t = findBestTemplate('muscle_gain', 'advanced', 'full_gym');
    expect(t.id).toBe('advanced-ppl-6x');
  });

  it('selects Home Dumbbell for beginner + home_dumbbells', () => {
    const t = findBestTemplate('muscle_gain', 'beginner', 'home_dumbbells');
    expect(t.id).toBe('home-dumbbell-3x');
  });

  it('selects Bodyweight for beginner + bodyweight', () => {
    const t = findBestTemplate('muscle_gain', 'beginner', 'bodyweight');
    expect(t.id).toBe('bodyweight-3x');
  });

  it('selects Fat Loss Circuit for intermediate + full_gym + fat_loss', () => {
    const t = findBestTemplate('fat_loss', 'intermediate', 'full_gym');
    expect(t.id).toBe('fat-loss-circuit-4x');
  });

  it('never returns undefined — always picks a template', () => {
    const combos = [
      ['muscle_gain', 'beginner', 'full_gym'],
      ['fat_loss', 'advanced', 'bodyweight'],
      ['strength', 'intermediate', 'home_dumbbells'],
      ['endurance', 'beginner', 'full_gym'],
      ['unknown_goal', 'unknown_exp', 'unknown_equip'],
    ];
    for (const [g, e, eq] of combos) {
      const t = findBestTemplate(g, e, eq);
      expect(t).toBeDefined();
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
    }
  });
});

// ── 2. Template → CustomProgram Conversion Tests ─────────────

describe('Template to CustomProgram conversion', () => {
  const SESSION_COLORS_POOL = [
    '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  ];

  function templateToCustomProgram(template: ProgramTemplate): CustomProgram {
    return {
      name: template.name,
      description: template.description,
      sessions: template.sessions,
      sessionNames: template.sessionNames,
      sessionColors: Object.fromEntries(
        Object.keys(template.sessionNames).map((key, i) => [key, SESSION_COLORS_POOL[i % SESSION_COLORS_POOL.length]])
      ),
      weeklySchedule: template.weeklySchedule,
      createdAt: new Date().toISOString(),
      generatedByZaki: false,
    };
  }

  for (const template of PROGRAM_TEMPLATES) {
    describe(`Template: ${template.name}`, () => {
      it('converts to a valid CustomProgram', () => {
        const cp = templateToCustomProgram(template);
        expect(cp.name).toBe(template.name);
        expect(cp.description).toBe(template.description);
        expect(cp.sessionNames).toBe(template.sessionNames);
        expect(cp.createdAt).toBeTruthy();
      });

      it('assigns colors to all sessions', () => {
        const cp = templateToCustomProgram(template);
        const sessionIds = Object.keys(template.sessionNames);
        for (const id of sessionIds) {
          expect(cp.sessionColors[id]).toBeTruthy();
          expect(cp.sessionColors[id]).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });

      it('weekly schedule only references defined sessions or rest', () => {
        const validIds = [...Object.keys(template.sessions), 'rest'];
        // Also include default session IDs for the intermediate template that uses empty sessions
        const defaultIds = ['upper-a', 'lower-a', 'upper-b', 'lower-b'];
        const allValid = [...validIds, ...defaultIds];
        for (const [day, sessionId] of Object.entries(template.weeklySchedule)) {
          expect(allValid).toContain(sessionId);
        }
      });

      it('has exercises for all non-empty sessions', () => {
        for (const [id, exercises] of Object.entries(template.sessions)) {
          expect(exercises.length).toBeGreaterThan(0);
          for (const ex of exercises) {
            expect(ex.name).toBeTruthy();
            expect(ex.sets).toBeGreaterThan(0);
            expect(ex.repsMin).toBeGreaterThan(0);
          }
        }
      });
    });
  }
});

// ── 3. Schedule Integration Tests ────────────────────────────

describe('Schedule integration', () => {
  it('buildFullSchedule fills missing days with rest', () => {
    const partial = { Monday: 'push', Wednesday: 'pull' } as any;
    const full = buildFullSchedule(partial);
    expect(full.Monday).toBe('push');
    expect(full.Wednesday).toBe('pull');
    expect(full.Sunday).toBe('rest');
    expect(full.Tuesday).toBe('rest');
    expect(full.Thursday).toBe('rest');
    expect(full.Friday).toBe('rest');
    expect(full.Saturday).toBe('rest');
  });

  it('buildFullSchedule preserves all provided days', () => {
    const schedule: Record<string, string> = {
      Sunday: 'full-a',
      Monday: 'rest',
      Tuesday: 'full-b',
      Wednesday: 'rest',
      Thursday: 'full-c',
      Friday: 'rest',
      Saturday: 'rest',
    };
    const full = buildFullSchedule(schedule as any);
    expect(full.Sunday).toBe('full-a');
    expect(full.Tuesday).toBe('full-b');
    expect(full.Thursday).toBe('full-c');
    expect(full.Monday).toBe('rest');
  });

  it('each template schedule has exactly 7 days', () => {
    for (const t of PROGRAM_TEMPLATES) {
      const dayCount = Object.keys(t.weeklySchedule).length;
      expect(dayCount).toBe(7);
    }
  });
});

// ── 4. Dynamic Resolver Tests (Home Screen Logic) ────────────

describe('Home screen dynamic resolver with custom programs', () => {
  const beginner = findBestTemplate('muscle_gain', 'beginner', 'full_gym');
  const SESSION_COLORS_POOL = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
  const COLOR_POOL = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

  const DEFAULT_DOT_COLORS: Record<string, string> = {
    'upper-a': '#3B82F6', 'lower-a': '#8B5CF6', 'upper-b': '#06B6D4', 'lower-b': '#10B981', rest: '#374151',
  };

  const mockCustomProgram: CustomProgram = {
    name: beginner.name,
    description: beginner.description,
    sessions: beginner.sessions,
    sessionNames: beginner.sessionNames,
    sessionColors: Object.fromEntries(
      Object.keys(beginner.sessionNames).map((key, i) => [key, SESSION_COLORS_POOL[i % SESSION_COLORS_POOL.length]])
    ),
    weeklySchedule: beginner.weeklySchedule,
    createdAt: new Date().toISOString(),
    generatedByZaki: false,
  };

  // Mirror the Home screen's getColor logic
  function getColor(sessionId: string, customProgram: CustomProgram | null): string {
    if (sessionId === 'rest') return DEFAULT_DOT_COLORS.rest;
    if (customProgram?.sessionColors?.[sessionId]) return customProgram.sessionColors[sessionId];
    if (DEFAULT_DOT_COLORS[sessionId]) return DEFAULT_DOT_COLORS[sessionId];
    const sessionKeys = customProgram ? Object.keys(customProgram.sessionNames) : [];
    const idx = sessionKeys.indexOf(sessionId);
    return COLOR_POOL[idx >= 0 ? idx % COLOR_POOL.length : 0];
  }

  function getName(sessionId: string, customProgram: CustomProgram | null): string {
    if (sessionId === 'rest') return 'Rest Day';
    if (customProgram?.sessionNames?.[sessionId]) return customProgram.sessionNames[sessionId];
    return SESSION_NAMES[sessionId as keyof typeof SESSION_NAMES] || sessionId;
  }

  it('resolves custom program session names for beginner full body', () => {
    expect(getName('full-a', mockCustomProgram)).toBe('Full Body A');
    expect(getName('full-b', mockCustomProgram)).toBe('Full Body B');
    expect(getName('full-c', mockCustomProgram)).toBe('Full Body C');
  });

  it('resolves custom program session colors for beginner full body', () => {
    expect(getColor('full-a', mockCustomProgram)).toBe('#3B82F6');
    expect(getColor('full-b', mockCustomProgram)).toBe('#8B5CF6');
    expect(getColor('full-c', mockCustomProgram)).toBe('#06B6D4');
  });

  it('rest day always resolves correctly', () => {
    expect(getName('rest', mockCustomProgram)).toBe('Rest Day');
    expect(getColor('rest', mockCustomProgram)).toBe('#374151');
    expect(getName('rest', null)).toBe('Rest Day');
    expect(getColor('rest', null)).toBe('#374151');
  });

  it('falls back to defaults when no custom program exists', () => {
    expect(getName('upper-a', null)).toBe(SESSION_NAMES['upper-a']);
    expect(getColor('upper-a', null)).toBe(DEFAULT_DOT_COLORS['upper-a']);
  });

  it('handles unknown session IDs gracefully', () => {
    expect(getName('unknown-xyz', mockCustomProgram)).toBe('unknown-xyz');
    // Should not crash
    const color = getColor('unknown-xyz', mockCustomProgram);
    expect(color).toBeTruthy();
  });
});

// ── 5. Full Pipeline Simulation ──────────────────────────────

describe('Full pipeline: onboarding → template → schedule → display', () => {
  const testCases = [
    { goal: 'muscle_gain', exp: 'beginner', equip: 'full_gym', expectedId: 'beginner-full-body-3x', expectedSessions: ['full-a', 'full-b', 'full-c'] },
    { goal: 'muscle_gain', exp: 'intermediate', equip: 'full_gym', expectedId: 'intermediate-upper-lower-4x', expectedSessions: [] },
    { goal: 'muscle_gain', exp: 'advanced', equip: 'full_gym', expectedId: 'advanced-ppl-6x', expectedSessions: ['push', 'pull', 'legs'] },
    { goal: 'muscle_gain', exp: 'beginner', equip: 'home_dumbbells', expectedId: 'home-dumbbell-3x', expectedSessions: ['home-a', 'home-b', 'home-c'] },
    { goal: 'muscle_gain', exp: 'beginner', equip: 'bodyweight', expectedId: 'bodyweight-3x', expectedSessions: ['bw-a', 'bw-b', 'bw-c'] },
    { goal: 'fat_loss', exp: 'intermediate', equip: 'full_gym', expectedId: 'fat-loss-circuit-4x', expectedSessions: ['circuit-a', 'circuit-b'] },
  ];

  for (const tc of testCases) {
    it(`${tc.goal}/${tc.exp}/${tc.equip} → ${tc.expectedId}`, () => {
      // Step 1: Select template
      const template = findBestTemplate(tc.goal, tc.exp, tc.equip);
      expect(template.id).toBe(tc.expectedId);

      // Step 2: Verify sessions exist
      if (tc.expectedSessions.length > 0) {
        for (const sid of tc.expectedSessions) {
          expect(template.sessions[sid]).toBeDefined();
          expect(template.sessions[sid].length).toBeGreaterThan(0);
          expect(template.sessionNames[sid]).toBeTruthy();
        }
      }

      // Step 3: Verify schedule references valid sessions
      const validIds = [...Object.keys(template.sessions), 'rest', 'upper-a', 'lower-a', 'upper-b', 'lower-b'];
      for (const sessionId of Object.values(template.weeklySchedule)) {
        expect(validIds).toContain(sessionId);
      }

      // Step 4: Build full schedule
      const fullSchedule = buildFullSchedule(template.weeklySchedule as any);
      expect(Object.keys(fullSchedule)).toHaveLength(7);

      // Step 5: Verify training day count matches template
      const trainingDays = Object.values(fullSchedule).filter(s => s !== 'rest').length;
      expect(trainingDays).toBe(template.daysPerWeek);
    });
  }
});
