// ============================================================
// MUSCLE HEATMAP SCREEN
// Displays muscle activity over 7 and 30 day periods
// Shows muscle balance (push/pull/legs) breakdown
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { MuscleHeatmap } from '@/components/muscle-heatmap';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { EXERCISE_LIBRARY } from '@/lib/data/exercise-library';
import {
  computeMuscleHeatmap,
  getNeglectedMuscles,
  getMuscleBalance,
  type MuscleGroup,
} from '@/lib/muscle-heatmap';

type Period = '7d' | '30d';

export default function MuscleHeatmapScreen() {
  const router = useRouter();
  const colors = useColors();
  const { store } = useGym();
  const [period, setPeriod] = useState<Period>('7d');
  const [heatmapData, setHeatmapData] = useState<Record<string, { sets: number; intensity: string }> | null>(null);
  const [neglectedMuscles, setNeglectedMuscles] = useState<MuscleGroup[]>([]);
  const [balance, setBalance] = useState<{ pushSets: number; pullSets: number; legSets: number; ratio: string } | null>(null);

  useEffect(() => {
    const days = period === '7d' ? 7 : 30;
    const heatmap = computeMuscleHeatmap(store.workoutLogs, EXERCISE_LIBRARY, days);
    setHeatmapData(heatmap);
    setNeglectedMuscles(getNeglectedMuscles(heatmap));
    setBalance(getMuscleBalance(heatmap));
  }, [period, store.workoutLogs]);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.muted }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Muscle Heatmap</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Period toggle */}
        <View style={[styles.periodToggle, { backgroundColor: colors.surface }]}>
          <ToggleButton
            label="7 Days"
            active={period === '7d'}
            onPress={() => setPeriod('7d')}
            colors={colors}
          />
          <ToggleButton
            label="30 Days"
            active={period === '30d'}
            onPress={() => setPeriod('30d')}
            colors={colors}
          />
        </View>

        {/* Balance info card */}
        {balance && (
          <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.muted }]}>
            <Text style={[styles.balanceTitle, { color: colors.foreground }]}>
              Push/Pull/Legs Balance
            </Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: colors.muted }]}>Push</Text>
                <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                  {balance.pushSets}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: colors.muted }]}>Pull</Text>
                <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                  {balance.pullSets}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: colors.muted }]}>Legs</Text>
                <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                  {balance.legSets}
                </Text>
              </View>
            </View>
            <View style={[styles.ratioContainer, { borderTopColor: colors.muted }]}>
              <Text style={[styles.ratioLabel, { color: colors.muted }]}>Distribution</Text>
              <Text style={[styles.ratioValue, { color: colors.foreground }]}>
                {balance.ratio}
              </Text>
            </View>
          </View>
        )}

        {/* Heatmap component */}
        {heatmapData && (
          <MuscleHeatmap
            heatmapData={heatmapData}
            neglectedMuscles={neglectedMuscles}
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function ToggleButton({ label, active, onPress, colors }: ToggleButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.toggleButton,
        active && {
          backgroundColor: colors.primary,
        },
        !active && {
          backgroundColor: colors.muted,
        },
      ]}
    >
      <Text
        style={[
          styles.toggleLabel,
          {
            color: active ? '#fff' : colors.foreground,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  periodToggle: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  ratioContainer: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  ratioLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  ratioValue: {
    fontSize: 12,
    fontWeight: '500',
  },
});
