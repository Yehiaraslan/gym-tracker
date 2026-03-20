// ============================================================
// PR BOARD — All-time personal records per exercise
// ============================================================

import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { getAllPRs, get1RMHistory } from '@/lib/split-workout-store';
import { PROGRAM_SESSIONS, SESSION_NAMES, SESSION_COLORS, type SessionType } from '@/lib/training-program';

interface PREntry {
  exerciseName: string;
  e1rm: number;
  weight: number;
  reps: number;
  date: string;
  sessionType: SessionType;
  muscleGroup: 'upper' | 'lower';
}

export default function PRBoardScreen() {
  const colors = useColors();
  const router = useRouter();
  const [prs, setPrs] = useState<PREntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'upper' | 'lower'>('all');
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [exerciseHistory, setExerciseHistory] = useState<{ date: string; e1rm: number }[]>([]);

  useEffect(() => {
    (async () => {
      const allPRs = await getAllPRs();

      // Map PRs to include session info
      const entries: PREntry[] = [];
      for (const [sessionType, exercises] of Object.entries(PROGRAM_SESSIONS)) {
        for (const ex of exercises) {
          const pr = allPRs[ex.name];
          if (pr) {
            entries.push({
              exerciseName: ex.name,
              ...pr,
              sessionType: sessionType as SessionType,
              muscleGroup: ex.muscleGroup,
            });
          }
        }
      }

      // Sort by e1rm descending
      entries.sort((a, b) => b.e1rm - a.e1rm);
      setPrs(entries);
    })();
  }, []);

  const handleExpandExercise = async (name: string) => {
    if (expandedExercise === name) {
      setExpandedExercise(null);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedExercise(name);
    const history = await get1RMHistory(name);
    setExerciseHistory(history);
  };

  const filtered = filter === 'all' ? prs : prs.filter(p => p.muscleGroup === filter);

  // Group by muscle group for display
  const topCompound = filtered.filter(p => {
    const session = p.sessionType !== 'rest' ? PROGRAM_SESSIONS[p.sessionType] : undefined;
    const ex = session?.find((e: any) => e.name === p.exerciseName);
    return ex?.category === 'compound';
  }).slice(0, 5);

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <IconSymbol name="chevron.left" size={24} color={colors.muted} />
          </TouchableOpacity>
          <View className="flex-row items-center">
            <Text style={{ fontSize: 28 }}>🏆</Text>
            <Text className="text-2xl font-bold text-foreground ml-2">PR Board</Text>
          </View>
          <Text className="text-sm text-muted mt-1">
            {prs.length} exercises tracked · Best estimated 1RMs
          </Text>
        </View>

        {/* Filter tabs */}
        <View className="px-6 mb-4">
          <View className="flex-row" style={{ gap: 8 }}>
            {[
              { key: 'all' as const, label: 'All' },
              { key: 'upper' as const, label: 'Upper' },
              { key: 'lower' as const, label: 'Lower' },
            ].map(f => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                className="px-4 py-2 rounded-xl"
                style={{
                  backgroundColor: filter === f.key ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: filter === f.key ? colors.primary : colors.border,
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: filter === f.key ? '#FFFFFF' : colors.muted }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top compounds */}
        {topCompound.length > 0 && (
          <View className="px-6 mb-4">
            <Text className="text-xs font-medium text-muted mb-3" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Top Compound Lifts
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {topCompound.map((pr, i) => (
                <View
                  key={pr.exerciseName}
                  className="flex-1 rounded-2xl p-4"
                  style={{
                    backgroundColor: i === 0 ? '#F59E0B' + '15' : colors.surface,
                    borderWidth: 1,
                    borderColor: i === 0 ? '#F59E0B' + '40' : colors.border,
                    minWidth: '45%',
                  }}
                >
                  {i === 0 && <Text style={{ fontSize: 20 }}>👑</Text>}
                  <Text className="text-xs text-muted mt-1" numberOfLines={1}>{pr.exerciseName}</Text>
                  <Text className="text-2xl font-bold text-foreground mt-0.5">{pr.e1rm}</Text>
                  <Text className="text-xs text-muted">kg est. 1RM</Text>
                  <Text className="text-xs text-muted mt-1">{pr.weight}kg × {pr.reps}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* All PRs list */}
        <View className="px-6">
          <Text className="text-xs font-medium text-muted mb-3" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            All Records ({filtered.length})
          </Text>

          {filtered.length === 0 ? (
            <View className="items-center py-12">
              <Text style={{ fontSize: 48 }}>🏋️</Text>
              <Text className="text-base font-semibold text-foreground mt-4">No PRs Yet</Text>
              <Text className="text-sm text-muted text-center mt-1">
                Complete your first Upper/Lower split workout to start tracking PRs
              </Text>
            </View>
          ) : (
            filtered.map((pr, i) => {
              const sessionColor = SESSION_COLORS[pr.sessionType];
              const isExpanded = expandedExercise === pr.exerciseName;

              return (
                <TouchableOpacity
                  key={pr.exerciseName}
                  onPress={() => handleExpandExercise(pr.exerciseName)}
                  activeOpacity={0.7}
                  className="mb-2"
                >
                  <View
                    className="rounded-xl overflow-hidden"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                  >
                    <View className="flex-row items-center px-4 py-3">
                      {/* Rank */}
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center mr-3"
                        style={{
                          backgroundColor: i < 3 ? '#F59E0B' + '20' : colors.border + '50',
                        }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: i < 3 ? '#F59E0B' : colors.muted }}
                        >
                          {i + 1}
                        </Text>
                      </View>

                      {/* Exercise info */}
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">{pr.exerciseName}</Text>
                        <View className="flex-row items-center mt-0.5" style={{ gap: 6 }}>
                          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: sessionColor }} />
                          <Text className="text-xs text-muted">
                            {pr.weight}kg × {pr.reps} · {new Date(pr.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      </View>

                      {/* 1RM */}
                      <View className="items-end">
                        <Text className="text-lg font-bold" style={{ color: sessionColor }}>
                          {pr.e1rm}
                        </Text>
                        <Text className="text-xs text-muted">kg 1RM</Text>
                      </View>
                    </View>

                    {/* Expanded history */}
                    {isExpanded && exerciseHistory.length > 0 && (
                      <View className="px-4 pb-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text className="text-xs text-muted mt-2 mb-2">1RM History</Text>
                        <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                          {exerciseHistory.slice(-10).map((h, hi) => (
                            <View
                              key={hi}
                              className="px-2 py-1 rounded-lg"
                              style={{
                                backgroundColor: h.e1rm === pr.e1rm ? '#F59E0B' + '20' : colors.border + '30',
                              }}
                            >
                              <Text className="text-xs" style={{ color: h.e1rm === pr.e1rm ? '#F59E0B' : colors.muted }}>
                                {h.date.slice(5)} · {h.e1rm}kg
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
