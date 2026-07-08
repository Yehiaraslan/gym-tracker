/**
 * Anatomical muscle map — front + back humanoid figures with muscle regions
 * colored by training intensity (react-native-body-highlighter over the
 * app's muscle-group heatmap data).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Body from 'react-native-body-highlighter';
import type { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';

// App muscle groups → anatomical region slugs on the figure
const GROUP_TO_SLUGS: Record<string, Slug[]> = {
  Shoulders: ['deltoids'],
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Core: ['abs', 'obliques'],
  Quads: ['quadriceps'],
  Hamstrings: ['hamstring'],
  Glutes: ['gluteal'],
  Calves: ['calves'],
};

const LEVEL_ORDER = ['low', 'moderate', 'high', 'overtrained'];

type Props = {
  heatmapData: Record<string, { sets: number; intensity: string }>;
  /** per-intensity colors, must include a 'none' entry for the resting fill */
  intensityColors: Record<string, string>;
  scale?: number;
};

export function BodyMuscleMap({ heatmapData, intensityColors, scale = 0.85 }: Props) {
  const { data, palette } = useMemo(() => {
    const palette = LEVEL_ORDER.map(
      (lvl) => intensityColors[lvl] ?? intensityColors.high ?? '#22C55E',
    );
    const data: ExtendedBodyPart[] = [];
    for (const [group, slugs] of Object.entries(GROUP_TO_SLUGS)) {
      const entry = heatmapData[group];
      if (!entry) continue;
      const idx = LEVEL_ORDER.indexOf(entry.intensity);
      if (idx < 0) continue; // 'none' → leave at resting fill
      for (const slug of slugs) {
        data.push({ slug, intensity: idx + 1 });
      }
    }
    return { data, palette };
  }, [heatmapData, intensityColors]);

  const restingFill = intensityColors.none ?? '#374151';

  return (
    <View style={styles.row}>
      <View style={styles.figure}>
        <Body
          data={data}
          colors={palette}
          side="front"
          gender="male"
          scale={scale}
          defaultFill={restingFill}
          border="none"
        />
        <Text style={styles.caption}>Front</Text>
      </View>
      <View style={styles.figure}>
        <Body
          data={data}
          colors={palette}
          side="back"
          gender="male"
          scale={scale}
          defaultFill={restingFill}
          border="none"
        />
        <Text style={styles.caption}>Back</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
  },
  figure: {
    alignItems: 'center',
  },
  caption: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '600',
  },
});
