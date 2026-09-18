// Top-of-step anatomy figure with one muscle group lit up.
// Uses the generated render when available, otherwise the SVG body.
import React from 'react';
import { Image, View } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { Slug } from 'react-native-body-highlighter';
import { FIGURES, type FigureKey } from './figures';

const FALLBACK: Record<FigureKey, { slugs: Slug[]; side: 'front' | 'back' }> = {
  chest: { slugs: ['chest'], side: 'front' },
  shoulders: { slugs: ['deltoids'], side: 'front' },
  abs: { slugs: ['abs'], side: 'front' },
  traps: { slugs: ['trapezius', 'upper-back'], side: 'back' },
  biceps: { slugs: ['biceps'], side: 'front' },
  lats: { slugs: ['upper-back'], side: 'back' },
  neck: { slugs: ['neck', 'trapezius'], side: 'front' },
  quads: { slugs: ['quadriceps'], side: 'front' },
  male: { slugs: [], side: 'front' },
  female: { slugs: [], side: 'front' },
};

type Props = {
  figure: FigureKey;
  gender?: 'male' | 'female' | '' | 'other';
  height?: number;
  accent: string;
  base: string;
  border: string;
};

export function FigureHero({ figure, gender, height = 200, accent, base, border }: Props) {
  const src = FIGURES[figure];
  if (src) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={src} style={{ height, width: height * 0.66 }} resizeMode="contain" />
      </View>
    );
  }
  const fb = FALLBACK[figure];
  const g = figure === 'female' ? 'female' : figure === 'male' ? 'male' : gender === 'female' ? 'female' : 'male';
  // body-highlighter's native height at scale 1 is ~420px
  const scale = height / 420;
  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Body
        data={fb.slugs.map((slug) => ({ slug, intensity: 1 }))}
        colors={[accent]}
        defaultFill={base}
        defaultStroke={border}
        gender={g}
        side={fb.side}
        scale={scale}
        border="none"
      />
    </View>
  );
}
