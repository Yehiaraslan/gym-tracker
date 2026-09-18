// Focus-muscle keys (profile-store) → react-native-body-highlighter slugs.
// Each entry also says which side of the figure shows it best.
import type { Slug } from 'react-native-body-highlighter';
import type { FocusMuscle } from '@/lib/profile-store';

export interface MuscleSpec {
  slugs: Slug[];
  side: 'front' | 'back';
}

export const MUSCLE_SPECS: Record<FocusMuscle, MuscleSpec> = {
  chest: { slugs: ['chest'], side: 'front' },
  triceps: { slugs: ['triceps'], side: 'back' },
  lats: { slugs: ['upper-back'], side: 'back' },
  biceps: { slugs: ['biceps'], side: 'front' },
  shoulders: { slugs: ['deltoids'], side: 'front' },
  abs: { slugs: ['abs', 'obliques'], side: 'front' },
  quads: { slugs: ['quadriceps'], side: 'front' },
  hamstrings: { slugs: ['hamstring'], side: 'back' },
  glutes: { slugs: ['gluteal'], side: 'back' },
  calves: { slugs: ['calves'], side: 'back' },
  back: { slugs: ['upper-back', 'lower-back', 'trapezius'], side: 'back' },
  forearms: { slugs: ['forearm'], side: 'front' },
};

export const ALL_FOCUS_MUSCLES = Object.keys(MUSCLE_SPECS) as FocusMuscle[];

/** Slugs visible on a given side for a set of focus muscles. */
export function slugsForSide(muscles: FocusMuscle[], side: 'front' | 'back'): Slug[] {
  const out = new Set<Slug>();
  for (const m of muscles) {
    const spec = MUSCLE_SPECS[m];
    if (!spec) continue;
    // deltoids / trapezius / abs appear on both figures, the rest only on their own side
    for (const s of spec.slugs) {
      const bothSides = s === 'deltoids' || s === 'trapezius' || s === 'obliques' || s === 'calves' || s === 'forearm';
      if (spec.side === side || bothSides) out.add(s);
    }
  }
  return [...out];
}
