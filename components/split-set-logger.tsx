// ============================================================
// SPLIT SET LOGGER — Enhanced set input with RPE, 1RM, suggestions
// ============================================================

import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, TextInput, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RPESelector } from '@/components/rpe-selector';
import { useColors } from '@/hooks/use-colors';
import { epley1RM, RPE_LABELS } from '@/lib/fitness-utils';
import type { SplitSetLog } from '@/lib/split-workout-store';
import * as Haptics from 'expo-haptics';

interface SplitSetLoggerProps {
  setNumber: number;
  targetRepsMin: number;
  targetRepsMax: number;
  previousSet?: SplitSetLog;
  suggestedWeight?: number;
  suggestedReason?: string;
  isDeload: boolean;
  isWarmup?: boolean;
  isCompleted: boolean;
  completedSet?: SplitSetLog;
  showProgressionHint: boolean;
  onComplete: (weight: number, reps: number, rpe?: number) => void;
}

export function SplitSetLogger({
  setNumber,
  targetRepsMin,
  targetRepsMax,
  previousSet,
  suggestedWeight,
  suggestedReason,
  isDeload,
  isWarmup = false,
  isCompleted,
  completedSet,
  showProgressionHint,
  onComplete,
}: SplitSetLoggerProps) {
  const colors = useColors();
  const defaultWeight = suggestedWeight ?? previousSet?.weightKg ?? 0;
  const [weight, setWeight] = useState(defaultWeight.toString());
  const [reps, setReps] = useState((targetRepsMin || 1).toString());
  const [rpe, setRpe] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (suggestedWeight !== undefined) {
      setWeight(suggestedWeight.toString());
    }
  }, [suggestedWeight]);

  const weightNum = parseFloat(weight) || 0;
  const repsNum = parseInt(reps) || 0;
  const liveE1RM = weightNum > 0 && repsNum > 0 ? epley1RM(weightNum, repsNum) : null;

  const adjustWeight = (delta: number) => {
    const newW = Math.max(0, Math.round((weightNum + delta) * 10) / 10);
    setWeight(newW.toString());
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const adjustReps = (delta: number) => {
    const newR = Math.max(1, repsNum + delta);
    setReps(newR.toString());
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleComplete = () => {
    if (weightNum <= 0) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete(weightNum, repsNum, rpe ?? undefined);
  };

  // ---- Completed state ----
  if (isCompleted && completedSet) {
    const hitTop = completedSet.reps >= targetRepsMax;
    const completedE1RM = epley1RM(completedSet.weightKg, completedSet.reps);
    const prevE1RM = previousSet ? epley1RM(previousSet.weightKg, previousSet.reps) : null;
    const isPR = prevE1RM !== null && completedE1RM > prevE1RM;
    const rpeInfo = completedSet.rpe ? RPE_LABELS[completedSet.rpe] : null;

    return (
      <View
        className="flex-row items-center rounded-xl p-3"
        style={{
          backgroundColor: isWarmup
            ? colors.cardBorder + '30'
            : isPR
              ? '#F59E0B15'
              : '#10B98115',
          borderWidth: 1,
          borderColor: isWarmup
            ? colors.cardBorder
            : isPR
              ? '#F59E0B40'
              : '#10B98130',
        }}
      >
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3"
          style={{
            backgroundColor: isWarmup ? colors.cardBorder : isPR ? '#F59E0B25' : '#10B98125',
          }}
        >
          {isWarmup ? (
            <Text style={{ fontSize: 14 }}>🔥</Text>
          ) : isPR ? (
            <Text style={{ fontSize: 14 }}>⚡</Text>
          ) : (
            <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
          )}
        </View>

        <View className="flex-1">
          <Text className="text-xs text-cardMuted">
            {isWarmup ? `Warm-up ${setNumber}` : `Set ${setNumber}`}
          </Text>
          <View className="flex-row items-center flex-wrap mt-0.5" style={{ gap: 6 }}>
            <Text className="text-sm font-semibold text-cardForeground">
              {completedSet.weightKg}kg × {completedSet.reps}
            </Text>
            {hitTop && !isWarmup && (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#10B98120' }}>
                <Text className="text-xs font-medium" style={{ color: '#10B981' }}>TOP ✓</Text>
              </View>
            )}
            {!isWarmup && (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isPR ? '#F59E0B20' : colors.cardBorder }}>
                <Text className="text-xs" style={{ color: isPR ? '#F59E0B' : colors.cardMuted }}>
                  ~{completedE1RM}kg 1RM{isPR ? ' 🏆' : ''}
                </Text>
              </View>
            )}
            {rpeInfo && (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: rpeInfo.color + '20' }}>
                <Text className="text-xs font-medium" style={{ color: rpeInfo.color }}>RPE {completedSet.rpe}</Text>
              </View>
            )}
          </View>
        </View>

        {previousSet && !isWarmup && (
          <View className="items-end ml-2">
            <Text className="text-xs text-cardMuted">Prev</Text>
            <Text className="text-xs text-cardMuted">{previousSet.weightKg}×{previousSet.reps}</Text>
          </View>
        )}
      </View>
    );
  }

  // ---- Input state ----
  return (
    <View
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isWarmup ? colors.cardBorder + '80' : colors.cardBorder,
      }}
    >
      {/* Header (tap to expand) */}
      <TouchableOpacity
        className="flex-row items-center justify-between px-4 py-3"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          <View
            className="w-8 h-8 rounded-full items-center justify-center mr-3"
            style={{
              backgroundColor: isWarmup ? '#F97316' + '20' : colors.primary + '20',
              borderWidth: 1,
              borderColor: isWarmup ? '#F97316' + '40' : colors.primary + '40',
            }}
          >
            {isWarmup ? (
              <Text style={{ fontSize: 12 }}>🔥</Text>
            ) : (
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>{setNumber}</Text>
            )}
          </View>
          <View>
            {isWarmup ? (
              <Text className="text-xs font-medium" style={{ color: '#F97316' }}>
                Warm-up · {weightNum}kg × {repsNum}
              </Text>
            ) : (
              <Text className="text-xs text-cardMuted">
                Target: {targetRepsMin === 0 ? 'Max hold' : `${targetRepsMin}–${targetRepsMax} reps`}
                {isDeload ? '  DELOAD' : ''}
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center" style={{ gap: 8 }}>
          {showProgressionHint && (
            <Text className="text-xs font-medium" style={{ color: '#10B981' }}>+2.5kg?</Text>
          )}
          {previousSet && !isWarmup && (
            <Text className="text-xs text-cardMuted">Prev: {previousSet.weightKg}×{previousSet.reps}</Text>
          )}
          <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} size={14} color={colors.cardMuted} />
        </View>
      </TouchableOpacity>

      {/* Expanded input */}
      {expanded && (
        <View className="px-4 pb-4" style={{ borderTopWidth: 1, borderTopColor: colors.cardBorder }}>

          {/* Auto-progression hint */}
          {showProgressionHint && (
            <View
              className="flex-row items-center rounded-xl px-3 py-2 mt-3"
              style={{ backgroundColor: '#10B981' + '10', borderWidth: 1, borderColor: '#10B981' + '25' }}
            >
              <IconSymbol name="arrow.up.circle.fill" size={14} color="#10B981" />
              <Text className="text-xs ml-2 flex-1" style={{ color: '#10B981' }}>
                Top of range last session — consider <Text className="font-bold">+2.5kg</Text>
              </Text>
              <TouchableOpacity
                onPress={() => adjustWeight(2.5)}
                className="px-3 py-1 rounded-lg"
                style={{ backgroundColor: '#10B981' + '20' }}
              >
                <Text className="text-xs font-medium" style={{ color: '#10B981' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Weight suggestion reason */}
          {suggestedReason && !showProgressionHint && (
            <View
              className="rounded-xl px-3 py-2 mt-3"
              style={{ backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '20' }}
            >
              <Text className="text-xs" style={{ color: colors.primary }}>💡 {suggestedReason}</Text>
            </View>
          )}

          {/* Weight input */}
          <Text className="text-xs font-medium text-cardMuted mt-4 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Weight (kg)
          </Text>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => adjustWeight(-2.5)}
              className="w-14 h-14 rounded-xl items-center justify-center"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
            >
              <Text className="text-lg font-bold text-cardForeground">−</Text>
            </TouchableOpacity>
            <View className="flex-1">
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                className="h-14 rounded-xl text-center text-xl font-bold text-cardForeground"
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
                placeholderTextColor={colors.cardMuted}
              />
            </View>
            <TouchableOpacity
              onPress={() => adjustWeight(2.5)}
              className="w-14 h-14 rounded-xl items-center justify-center"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
            >
              <Text className="text-lg font-bold text-cardForeground">+</Text>
            </TouchableOpacity>
          </View>

          {/* Quick weight buttons */}
          <View className="flex-row mt-2" style={{ gap: 8 }}>
            {[-5, -2.5, 2.5, 5].map(delta => (
              <TouchableOpacity
                key={delta}
                onPress={() => adjustWeight(delta)}
                className="flex-1 py-2 rounded-lg items-center"
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
              >
                <Text className="text-xs text-cardMuted">{delta > 0 ? '+' : ''}{delta}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reps input */}
          <Text className="text-xs font-medium text-cardMuted mt-4 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {targetRepsMin === 0 ? 'Hold Time (sec)' : 'Reps Completed'}
          </Text>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => adjustReps(-1)}
              className="w-14 h-14 rounded-xl items-center justify-center"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
            >
              <Text className="text-lg font-bold text-cardForeground">−</Text>
            </TouchableOpacity>
            <View className="flex-1">
              <TextInput
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                className="h-14 rounded-xl text-center text-xl font-bold text-cardForeground"
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
                placeholderTextColor={colors.cardMuted}
              />
            </View>
            <TouchableOpacity
              onPress={() => adjustReps(1)}
              className="w-14 h-14 rounded-xl items-center justify-center"
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}
            >
              <Text className="text-lg font-bold text-cardForeground">+</Text>
            </TouchableOpacity>
          </View>

          {/* Quick rep buttons */}
          {targetRepsMin > 0 && (
            <View className="flex-row mt-2" style={{ gap: 8 }}>
              {[targetRepsMin, targetRepsMin + 1, targetRepsMax - 1, targetRepsMax]
                .filter((v, i, arr) => arr.indexOf(v) === i && v > 0)
                .map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => { setReps(r.toString()); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    className="flex-1 py-2 rounded-lg items-center"
                    style={{
                      backgroundColor: repsNum === r ? colors.primary + '20' : colors.background,
                      borderWidth: 1,
                      borderColor: repsNum === r ? colors.primary + '40' : colors.cardBorder,
                    }}
                  >
                    <Text className="text-xs font-medium" style={{ color: repsNum === r ? colors.primary : colors.cardMuted }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* RPE selector (not for warmups) */}
          {!isWarmup && (
            <View className="mt-4">
              <RPESelector value={rpe} onChange={setRpe} />
            </View>
          )}

          {/* Live 1RM preview */}
          {liveE1RM !== null && !isWarmup && (
            <View
              className="flex-row items-center rounded-xl px-3 py-2 mt-4"
              style={{ backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '20' }}
            >
              <Text className="text-xs" style={{ color: colors.primary }}>
                ⚡ Estimated 1RM: <Text className="font-bold">{liveE1RM}kg</Text>
              </Text>
              {previousSet && (() => {
                const prevRM = epley1RM(previousSet.weightKg, previousSet.reps);
                const diff = liveE1RM - prevRM;
                return diff !== 0 ? (
                  <Text
                    className="text-xs font-semibold ml-auto"
                    style={{ color: diff > 0 ? '#10B981' : '#EF4444' }}
                  >
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)} vs prev
                  </Text>
                ) : null;
              })()}
            </View>
          )}

          {/* Complete button */}
          <TouchableOpacity
            onPress={handleComplete}
            className="mt-4 py-4 rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: isWarmup ? '#F97316' : colors.primary }}
            disabled={weightNum <= 0}
          >
            <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-base ml-2">
              {isWarmup ? 'Log Warm-up' : `Log Set ${setNumber}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
