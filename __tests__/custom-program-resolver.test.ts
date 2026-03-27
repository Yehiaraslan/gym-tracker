import { describe, it, expect } from 'vitest';
import { SESSION_NAMES, SESSION_COLORS } from '../lib/training-program';
import type { CustomProgram } from '../lib/custom-program-store';

/**
 * Test the dynamic session name/color resolver logic used across all screens.
 * This mirrors the inline resolver pattern: customProg?.sessionNames?.[st] || SESSION_NAMES[st] || st
 */

function resolveName(st: string, customProg: CustomProgram | null): string {
  if (customProg?.sessionNames?.[st]) return customProg.sessionNames[st];
  return SESSION_NAMES[st as keyof typeof SESSION_NAMES] || st;
}

function resolveColor(st: string, customProg: CustomProgram | null, fallback = '#0a7ea4'): string {
  if (customProg?.sessionColors?.[st]) return customProg.sessionColors[st];
  return SESSION_COLORS[st as keyof typeof SESSION_COLORS] || fallback;
}

const mockCustomProgram: CustomProgram = {
  name: 'Beginner Full Body 3x/week',
  description: 'A simple full body program',
  sessions: {
    'full-a': [],
    'full-b': [],
    'full-c': [],
  },
  sessionNames: {
    'full-a': 'Full Body A — Strength',
    'full-b': 'Full Body B — Hypertrophy',
    'full-c': 'Full Body C — Power',
  },
  sessionColors: {
    'full-a': '#3B82F6',
    'full-b': '#10B981',
    'full-c': '#8B5CF6',
  },
  weeklySchedule: {
    monday: 'full-a',
    tuesday: 'rest',
    wednesday: 'full-b',
    thursday: 'rest',
    friday: 'full-c',
    saturday: 'rest',
    sunday: 'rest',
  },
  createdAt: new Date().toISOString(),
  generatedByZaki: true,
};

describe('Dynamic Session Resolver', () => {
  describe('resolveName', () => {
    it('returns custom program session name when available', () => {
      expect(resolveName('full-a', mockCustomProgram)).toBe('Full Body A — Strength');
      expect(resolveName('full-b', mockCustomProgram)).toBe('Full Body B — Hypertrophy');
      expect(resolveName('full-c', mockCustomProgram)).toBe('Full Body C — Power');
    });

    it('falls back to default SESSION_NAMES for standard session types', () => {
      expect(resolveName('upper-a', null)).toBe(SESSION_NAMES['upper-a']);
      expect(resolveName('lower-a', null)).toBe(SESSION_NAMES['lower-a']);
      expect(resolveName('rest', null)).toBe(SESSION_NAMES['rest']);
    });

    it('falls back to default SESSION_NAMES when custom program has no matching session', () => {
      expect(resolveName('upper-a', mockCustomProgram)).toBe(SESSION_NAMES['upper-a']);
    });

    it('returns raw session ID when nothing matches', () => {
      expect(resolveName('unknown-session', null)).toBe('unknown-session');
      expect(resolveName('unknown-session', mockCustomProgram)).toBe('unknown-session');
    });

    it('handles rest session correctly', () => {
      expect(resolveName('rest', null)).toBe(SESSION_NAMES['rest']);
      expect(resolveName('rest', mockCustomProgram)).toBe(SESSION_NAMES['rest']);
    });
  });

  describe('resolveColor', () => {
    it('returns custom program session color when available', () => {
      expect(resolveColor('full-a', mockCustomProgram)).toBe('#3B82F6');
      expect(resolveColor('full-b', mockCustomProgram)).toBe('#10B981');
      expect(resolveColor('full-c', mockCustomProgram)).toBe('#8B5CF6');
    });

    it('falls back to default SESSION_COLORS for standard session types', () => {
      expect(resolveColor('upper-a', null)).toBe(SESSION_COLORS['upper-a']);
      expect(resolveColor('lower-a', null)).toBe(SESSION_COLORS['lower-a']);
    });

    it('falls back to default SESSION_COLORS when custom program has no matching session', () => {
      expect(resolveColor('upper-a', mockCustomProgram)).toBe(SESSION_COLORS['upper-a']);
    });

    it('returns fallback color when nothing matches', () => {
      expect(resolveColor('unknown-session', null)).toBe('#0a7ea4');
      expect(resolveColor('unknown-session', mockCustomProgram)).toBe('#0a7ea4');
    });

    it('handles rest session correctly', () => {
      expect(resolveColor('rest', null)).toBe(SESSION_COLORS['rest']);
    });
  });

  describe('Custom program structure', () => {
    it('has all required fields', () => {
      expect(mockCustomProgram.name).toBeTruthy();
      expect(mockCustomProgram.sessions).toBeTruthy();
      expect(mockCustomProgram.sessionNames).toBeTruthy();
      expect(mockCustomProgram.sessionColors).toBeTruthy();
      expect(mockCustomProgram.weeklySchedule).toBeTruthy();
      expect(mockCustomProgram.createdAt).toBeTruthy();
    });

    it('has matching session IDs across sessions, names, and colors', () => {
      const sessionIds = Object.keys(mockCustomProgram.sessions);
      const nameIds = Object.keys(mockCustomProgram.sessionNames);
      const colorIds = Object.keys(mockCustomProgram.sessionColors);
      expect(sessionIds.sort()).toEqual(nameIds.sort());
      expect(sessionIds.sort()).toEqual(colorIds.sort());
    });

    it('weekly schedule only references defined sessions or rest', () => {
      const validIds = [...Object.keys(mockCustomProgram.sessions), 'rest'];
      Object.values(mockCustomProgram.weeklySchedule).forEach(sessionId => {
        expect(validIds).toContain(sessionId);
      });
    });
  });
});
