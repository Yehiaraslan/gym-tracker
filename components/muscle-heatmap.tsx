// ============================================================
// MUSCLE HEATMAP COMPONENT — Visual body silhouette heatmap
// Shows muscle groups as colored badges arranged in body shape
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { MuscleGroup, IntensityLevel } from '@/lib/muscle-heatmap';
import { MUSCLE_GROUPS } from '@/lib/muscle-heatmap';

interface MuscleHeatmapProps {
  heatmapData: Record<string, { sets: number; intensity: string }>;
  neglectedMuscles: MuscleGroup[];
}

const INTENSITY_COLORS: Record<IntensityLevel, string> = {
  none: '#374151',
  low: '#3B82F6',
  moderate: '#22C55E',
  high: '#F59E0B',
  overtrained: '#EF4444',
};

const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  none: 'None',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  overtrained: 'Overtrained',
};

export function MuscleHeatmap({ heatmapData, neglectedMuscles }: MuscleHeatmapProps) {
  const colors = useColors();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Title */}
      <Text style={[styles.title, { color: colors.cardForeground }]}>Muscle Activity Map</Text>

      {/* Body visualization with muscle groups arranged as badges */}
      <View style={styles.bodyContainer}>
        {/* Top: Shoulders */}
        <View style={styles.row}>
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Shoulders"
            data={heatmapData['Shoulders']}
          />
          <View style={styles.spacer} />
        </View>

        {/* Shoulders spacing */}
        <View style={{ height: 8 }} />

        {/* Second row: Chest, Back */}
        <View style={styles.row}>
          <MuscleBadge
            muscle="Chest"
            data={heatmapData['Chest']}
          />
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Back"
            data={heatmapData['Back']}
          />
        </View>

        {/* Chest/Back spacing */}
        <View style={{ height: 8 }} />

        {/* Third row: Biceps, Triceps */}
        <View style={styles.row}>
          <MuscleBadge
            muscle="Biceps"
            data={heatmapData['Biceps']}
          />
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Triceps"
            data={heatmapData['Triceps']}
          />
        </View>

        {/* Arms spacing */}
        <View style={{ height: 8 }} />

        {/* Fourth row: Core */}
        <View style={styles.row}>
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Core"
            data={heatmapData['Core']}
          />
          <View style={styles.spacer} />
        </View>

        {/* Core spacing */}
        <View style={{ height: 12 }} />

        {/* Fifth row: Quads, Glutes, Hamstrings */}
        <View style={styles.row}>
          <MuscleBadge
            muscle="Quads"
            data={heatmapData['Quads']}
          />
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Glutes"
            data={heatmapData['Glutes']}
          />
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Hamstrings"
            data={heatmapData['Hamstrings']}
          />
        </View>

        {/* Legs spacing */}
        <View style={{ height: 8 }} />

        {/* Bottom row: Calves */}
        <View style={styles.row}>
          <View style={styles.spacer} />
          <MuscleBadge
            muscle="Calves"
            data={heatmapData['Calves']}
          />
          <View style={styles.spacer} />
        </View>
      </View>

      {/* Legend */}
      <View style={[styles.legend, { borderTopColor: colors.cardMuted }]}>
        <Text style={[styles.legendTitle, { color: colors.cardForeground }]}>Intensity Legend</Text>
        <View style={styles.legendGrid}>
          {(Object.keys(INTENSITY_COLORS) as IntensityLevel[]).map((intensity) => (
            <View key={intensity} style={styles.legendItem}>
              <View
                style={[
                  styles.legendColor,
                  { backgroundColor: INTENSITY_COLORS[intensity] },
                ]}
              />
              <Text style={[styles.legendLabel, { color: colors.cardForeground }]}>
                {INTENSITY_LABELS[intensity]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Neglected muscles section */}
      {neglectedMuscles.length > 0 && (
        <View style={[styles.neglectedSection, { borderTopColor: colors.cardMuted }]}>
          <Text style={[styles.neglectedTitle, { color: colors.cardForeground }]}>
            Neglected Muscles
          </Text>
          <View style={styles.neglectedList}>
            {neglectedMuscles.map((muscle) => (
              <Text
                key={muscle}
                style={[styles.neglectedItem, { color: colors.cardMuted }]}
              >
                • {MUSCLE_GROUPS[muscle].label}
              </Text>
            ))}
          </View>
          <Text style={[styles.neglectedHint, { color: colors.cardMuted }]}>
            Consider adding exercises for these muscle groups
          </Text>
        </View>
      )}

      {/* Bottom spacing */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

interface MuscleBadgeProps {
  muscle: MuscleGroup;
  data: { sets: number; intensity: string };
}

function MuscleBadge({ muscle, data }: MuscleBadgeProps) {
  const colors = useColors();
  const intensity = data.intensity as IntensityLevel;
  const bgColor = INTENSITY_COLORS[intensity];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor: colors.cardForeground,
        },
      ]}
    >
      <Text style={[styles.badgeMuscle, { color: '#fff' }]}>
        {MUSCLE_GROUPS[muscle].label}
      </Text>
      <Text style={[styles.badgeSets, { color: '#fff' }]}>
        {Math.round(data.sets * 10) / 10}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  bodyContainer: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  badge: {
    minWidth: 90,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badgeMuscle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  badgeSets: {
    fontSize: 16,
    fontWeight: '700',
  },
  legend: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 16,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
  },
  neglectedSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 16,
  },
  neglectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  neglectedList: {
    marginBottom: 8,
  },
  neglectedItem: {
    fontSize: 12,
    lineHeight: 20,
  },
  neglectedHint: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
