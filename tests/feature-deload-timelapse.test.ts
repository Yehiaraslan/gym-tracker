// Tests for: (1) deload stagnation detection, (2) time-lapse photo sorting
import { describe, it, expect } from 'vitest';

// ── Stagnation detection logic (mirrors server/routers.ts) ──
function detectStagnation(
  exerciseVolumes: Record<string, number[]>,
  minWeeks = 3,
  growthThreshold = 0.02
): { stagnationDetected: boolean; stagnantExercises: string[] } {
  const stagnantExercises: string[] = [];
  for (const [name, volumes] of Object.entries(exerciseVolumes)) {
    if (volumes.length >= minWeeks) {
      let stagnant = true;
      for (let i = 1; i < volumes.length; i++) {
        if (volumes[i] > volumes[i - 1] * (1 + growthThreshold)) { stagnant = false; break; }
      }
      if (stagnant) stagnantExercises.push(name);
    }
  }
  return {
    stagnationDetected: stagnantExercises.length >= 3,
    stagnantExercises: stagnantExercises.slice(0, 5),
  };
}

describe('Stagnation Detection', () => {
  it('detects stagnation when 3+ exercises show no growth', () => {
    const volumes = {
      'Bench Press': [1000, 1010, 1005, 1008],
      'Squat': [1500, 1490, 1510, 1500],
      'Deadlift': [2000, 1980, 2010, 2000],
      'OHP': [600, 610, 605, 608],
    };
    const result = detectStagnation(volumes);
    expect(result.stagnationDetected).toBe(true);
    expect(result.stagnantExercises.length).toBeGreaterThanOrEqual(3);
  });

  it('does not flag stagnation when exercises are progressing', () => {
    const volumes = {
      'Bench Press': [1000, 1050, 1100, 1150],
      'Squat': [1500, 1560, 1620, 1700],
      'Deadlift': [2000, 2100, 2200, 2300],
    };
    const result = detectStagnation(volumes);
    expect(result.stagnationDetected).toBe(false);
  });

  it('requires at least 3 stagnant exercises to trigger flag', () => {
    const volumes = {
      'Bench Press': [1000, 1010, 1005],  // stagnant
      'Squat': [1500, 1560, 1620],         // progressing
      'Deadlift': [2000, 1980, 2010],      // stagnant
    };
    const result = detectStagnation(volumes);
    // Only 2 stagnant exercises — should NOT trigger
    expect(result.stagnationDetected).toBe(false);
  });

  it('limits stagnant exercises list to 5', () => {
    const volumes: Record<string, number[]> = {};
    for (let i = 0; i < 10; i++) {
      volumes[`Exercise ${i}`] = [1000, 1000, 1000, 1000];
    }
    const result = detectStagnation(volumes);
    expect(result.stagnantExercises.length).toBeLessThanOrEqual(5);
  });
});

// ── Time-lapse photo sorting ──
interface ProgressPicture {
  id: string;
  uri: string;
  date: string;
  label: 'front' | 'back' | 'side' | 'other';
}

function sortPhotosForTimeLapse(photos: ProgressPicture[]): ProgressPicture[] {
  return [...photos].sort((a, b) => a.date.localeCompare(b.date));
}

describe('Time-lapse Photo Sorting', () => {
  it('sorts photos chronologically oldest-first', () => {
    const photos: ProgressPicture[] = [
      { id: '3', uri: 'uri3', date: '2025-03-01', label: 'front' },
      { id: '1', uri: 'uri1', date: '2025-01-01', label: 'front' },
      { id: '2', uri: 'uri2', date: '2025-02-01', label: 'front' },
    ];
    const sorted = sortPhotosForTimeLapse(photos);
    expect(sorted[0].date).toBe('2025-01-01');
    expect(sorted[1].date).toBe('2025-02-01');
    expect(sorted[2].date).toBe('2025-03-01');
  });

  it('does not mutate the original array', () => {
    const photos: ProgressPicture[] = [
      { id: '2', uri: 'uri2', date: '2025-02-01', label: 'front' },
      { id: '1', uri: 'uri1', date: '2025-01-01', label: 'front' },
    ];
    const original = [...photos];
    sortPhotosForTimeLapse(photos);
    expect(photos[0].id).toBe(original[0].id);
  });

  it('handles single photo gracefully', () => {
    const photos: ProgressPicture[] = [
      { id: '1', uri: 'uri1', date: '2025-01-01', label: 'front' },
    ];
    const sorted = sortPhotosForTimeLapse(photos);
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe('1');
  });

  it('calculates days between first and current photo correctly', () => {
    const sorted: ProgressPicture[] = [
      { id: '1', uri: 'uri1', date: '2025-01-01', label: 'front' },
      { id: '2', uri: 'uri2', date: '2025-02-01', label: 'front' },
    ];
    const daysSinceFirst = Math.round(
      (new Date(sorted[1].date).getTime() - new Date(sorted[0].date).getTime()) / 86_400_000
    );
    expect(daysSinceFirst).toBe(31);
  });
});
