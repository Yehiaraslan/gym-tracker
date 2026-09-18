// Hero figures shown at the top of each onboarding step.
// Generated 3D-style écorché renders (chroma-keyed to transparent PNG via
// scripts/key-figure.py) live in assets/images/onboarding/.
// A null entry falls back to the SVG body-highlighter figure in FigureHero.
import type { ImageSourcePropType } from 'react-native';

export type FigureKey =
  | 'chest' | 'shoulders' | 'abs' | 'traps' | 'biceps' | 'lats' | 'neck' | 'quads'
  | 'male' | 'female';

export const FIGURES: Record<FigureKey, ImageSourcePropType | null> = {
  chest: require('@/assets/images/onboarding/chest.png'),
  shoulders: require('@/assets/images/onboarding/shoulders.png'),
  abs: require('@/assets/images/onboarding/abs.png'),
  traps: require('@/assets/images/onboarding/traps.png'),
  biceps: require('@/assets/images/onboarding/biceps.png'),
  lats: require('@/assets/images/onboarding/lats.png'),
  neck: require('@/assets/images/onboarding/neck.png'),
  quads: require('@/assets/images/onboarding/quads.png'),
  male: require('@/assets/images/onboarding/male.png'),
  female: require('@/assets/images/onboarding/female.png'),
};
