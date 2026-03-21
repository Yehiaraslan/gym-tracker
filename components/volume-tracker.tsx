// ============================================================
// VOLUME TRACKER — Session volume, sets progress, muscle status
// ============================================================

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { SplitSetLog } from '@/lib/split-workout-store';

interface ExerciseVolumeData {
  exerciseName: string;
  muscleGroup: string;
  completedSets: SplitSetLog[];
  targetSets: number;
}

interface VolumeTrackerProps {
  exercises: ExerciseVolumeData[];
  previousSessionVolume?: number;
}

function getFatigueStatus(completed: number, target: number) {
  const ratio = target > 0 ? completed / target : 0;
  if (ratio === 0) return { label: 'Fresh', color: '#10B981', bg: '#10B98110', icon: '🟢' };
  if (ratio < 0.5) return { label: 'Warming Up', color: '#3B82F6', bg: '#3B82F610', icon: '🔵' };
  if (ratio < 1) return { label: 'Working', color: '#F59E0B', bg: '#F59E0B10', icon: '🟡' };
  return { label: 'Done', color: '#6B7280', bg: '#6B728015', icon: '✅' };
}

export function VolumeTracker({ exercises, previousSessionVolume }: VolumeTrackerProps) {
  const colors = useColors();

  const totalVolume = useMemo(() => {
    return exercises.reduce((total, ex) =>
      total + ex.completedSets.reduce((exT, s) => exT + s.weightKg * s.reps, 0), 0);
  }, [exercises]);

  const totalSetsCompleted = exercises.reduce((t, ex) => t + ex.completedSets.length, 0);
  const totalSetsTarget = exercises.reduce((t, ex) => t + ex.targetSets, 0);
  const progress = totalSetsTarget > 0 ? Math.min(1, totalSetsCompleted / totalSetsTarget) : 0;

  const volumeDelta = previousSessionVolume
    ? ((totalVolume - previousSessionVolume) / previousSessionVolume) * 100
    : null;

  const muscleGroups = useMemo(() => {
    const groups: Record<string, { completed: number; target: number }> = {};
    exercises.forEach(ex => {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = { completed: 0, target: 0 };
      groups[ex.muscleGroup].completed += ex.completedSets.length;
      groups[ex.muscleGroup].target += ex.targetSets;
    });
    return groups;
  }, [exercises]);

  if (totalSetsCompleted === 0) return null;

  return (
    <View
      className="rounded-2xl p-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      {/* Volume header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Text className="text-sm font-semibold text-foreground">📊 Session Volume</Text>
        </View>
        <View className="items-end">
          <Text className="text-lg font-bold text-foreground">
            {totalVolume.toLocaleString()} <Text className="text-xs text-muted font-normal">kg</Text>
          </Text>
          {volumeDelta !== null && (
            <Text
              className="text-xs font-medium"
              style={{ color: volumeDelta > 0 ? '#10B981' : volumeDelta < 0 ? '#EF4444' : colors.muted }}
            >
              {volumeDelta > 0 ? '+' : ''}{volumeDelta.toFixed(1)}% vs last
            </Text>
          )}
        </View>
      </View>

      {/* Sets progress bar */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-xs text-muted">Sets completed</Text>
          <Text className="text-xs font-medium text-foreground">{totalSetsCompleted} / {totalSetsTarget}</Text>
        </View>
        <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
          <View
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
      </View>

      {/* Muscle group status */}
      <Text className="text-xs text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
        Muscle Status
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {Object.entries(muscleGroups).map(([muscle, { completed, target }]) => {
          const status = getFatigueStatus(completed, target);
          return (
            <View
              key={muscle}
              className="flex-row items-center px-3 py-2 rounded-xl"
              style={{ backgroundColor: status.bg, borderWidth: 1, borderColor: status.color + '30' }}
            >
              <Text style={{ fontSize: 12 }}>{status.icon}</Text>
              <Text className="text-xs font-medium ml-1.5" style={{ color: status.color }}>
                {muscle}
              </Text>
              <Text className="text-xs ml-1.5" style={{ color: colors.muted }}>
                {completed}/{target}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Volume milestone */}
      <View
        className="flex-row items-center rounded-xl px-3 py-2 mt-4"
        style={{ backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '15' }}
      >
        <Text className="text-xs" style={{ color: colors.muted }}>
          {totalVolume >= 10000
            ? <Text style={{ color: '#10B981', fontWeight: '600' }}>💪 10,000kg+ — elite volume!</Text>
            : totalVolume >= 5000
              ? <Text style={{ color: colors.primary, fontWeight: '600' }}>🔥 5,000kg+ — great work</Text>
              : <Text>Keep pushing — {(5000 - totalVolume).toLocaleString()}kg to 5,000kg</Text>
          }
        </Text>
      </View>
    </View>
  );
}
