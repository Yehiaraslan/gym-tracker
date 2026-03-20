// ============================================================
// WEEKLY REPORT CARD — Auto-generated performance summary
// ============================================================

import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { getRecentSplitWorkouts, getAllPRs, type SplitWorkoutSession } from '@/lib/split-workout-store';
import { getRecentSleep, getWeightEntries, type SleepEntry, type WeightEntry } from '@/lib/coach-engine';
import { calculateVolumeLoad, epley1RM } from '@/lib/fitness-utils';
import { SESSION_NAMES, SESSION_COLORS, type SessionType } from '@/lib/training-program';

interface WeeklyStats {
  workoutsCompleted: number;
  workoutsPlanned: number;
  totalVolume: number;
  avgVolume: number;
  prsHit: number;
  avgSleep: number | null;
  sleepTarget: boolean;
  weightDelta: number | null;
  avgRPE: number | null;
  grade: string;
  gradeColor: string;
  sessions: { type: SessionType; date: string; volume: number; duration: number }[];
}

function calculateGrade(stats: WeeklyStats): { grade: string; color: string } {
  let score = 0;

  // Workout completion (40% weight)
  const completionRate = stats.workoutsPlanned > 0 ? stats.workoutsCompleted / stats.workoutsPlanned : 0;
  score += completionRate * 40;

  // PRs (20% weight)
  score += Math.min(stats.prsHit * 10, 20);

  // Sleep (20% weight)
  if (stats.avgSleep !== null) {
    if (stats.avgSleep >= 7.5) score += 20;
    else if (stats.avgSleep >= 7) score += 15;
    else if (stats.avgSleep >= 6.5) score += 10;
    else score += 5;
  }

  // RPE management (10% weight) - ideal is 7-8.5 average
  if (stats.avgRPE !== null) {
    if (stats.avgRPE >= 7 && stats.avgRPE <= 8.5) score += 10;
    else if (stats.avgRPE >= 6 && stats.avgRPE <= 9) score += 7;
    else score += 3;
  }

  // Weight trend (10% weight) - small positive gain is ideal
  if (stats.weightDelta !== null) {
    if (stats.weightDelta > 0 && stats.weightDelta <= 0.3) score += 10;
    else if (stats.weightDelta > 0 && stats.weightDelta <= 0.5) score += 8;
    else score += 4;
  }

  if (score >= 90) return { grade: 'A+', color: '#10B981' };
  if (score >= 80) return { grade: 'A', color: '#10B981' };
  if (score >= 70) return { grade: 'B+', color: '#3B82F6' };
  if (score >= 60) return { grade: 'B', color: '#3B82F6' };
  if (score >= 50) return { grade: 'C+', color: '#F59E0B' };
  if (score >= 40) return { grade: 'C', color: '#F59E0B' };
  return { grade: 'D', color: '#EF4444' };
}

export default function WeeklyReportScreen() {
  const colors = useColors();
  const router = useRouter();
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      // Get this week's workouts
      const allWorkouts = await getRecentSplitWorkouts(30);
      const weekWorkouts = allWorkouts.filter(w => w.date >= weekAgoStr && w.completed);

      // Sessions breakdown
      const sessions = weekWorkouts.map(w => ({
        type: w.sessionType,
        date: w.date,
        volume: w.totalVolume || 0,
        duration: w.durationMinutes || 0,
      }));

      // Total volume
      const totalVolume = weekWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

      // PRs this week
      const allPRs = await getAllPRs();
      const weekPRs = Object.values(allPRs).filter(pr => pr.date >= weekAgoStr);

      // Sleep
      const sleepEntries = await getRecentSleep(7);
      const avgSleep = sleepEntries.length > 0
        ? sleepEntries.reduce((sum, e) => sum + e.durationHours, 0) / sleepEntries.length
        : null;

      // Weight
      const weightEntries = await getWeightEntries();
      const recentWeights = weightEntries.filter(e => e.date >= weekAgoStr);
      const prevWeights = weightEntries.filter(e => {
        const twoWeeksAgo = new Date(now);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        return e.date >= twoWeeksAgo.toISOString().split('T')[0] && e.date < weekAgoStr;
      });
      const avgRecent = recentWeights.length > 0 ? recentWeights.reduce((s, e) => s + e.weightKg, 0) / recentWeights.length : null;
      const avgPrev = prevWeights.length > 0 ? prevWeights.reduce((s, e) => s + e.weightKg, 0) / prevWeights.length : null;
      const weightDelta = avgRecent && avgPrev ? avgRecent - avgPrev : null;

      // RPE
      const allRPEs: number[] = [];
      weekWorkouts.forEach(w => w.exercises.forEach(ex => ex.sets.forEach(s => {
        if (s.rpe && !s.isWarmup) allRPEs.push(s.rpe);
      })));
      const avgRPE = allRPEs.length > 0 ? allRPEs.reduce((a, b) => a + b, 0) / allRPEs.length : null;

      const baseStats: WeeklyStats = {
        workoutsCompleted: weekWorkouts.length,
        workoutsPlanned: 4, // 4-day split
        totalVolume,
        avgVolume: weekWorkouts.length > 0 ? totalVolume / weekWorkouts.length : 0,
        prsHit: weekPRs.length,
        avgSleep,
        sleepTarget: avgSleep !== null && avgSleep >= 7.5,
        weightDelta,
        avgRPE,
        grade: '',
        gradeColor: '',
        sessions,
      };

      const { grade, color } = calculateGrade(baseStats);
      setStats({ ...baseStats, grade, gradeColor: color });
    })();
  }, []);

  if (!stats) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading report...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <IconSymbol name="chevron.left" size={24} color={colors.muted} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">📋 Weekly Report</Text>
          <Text className="text-sm text-muted mt-1">Last 7 days performance</Text>
        </View>

        {/* Grade card */}
        <View className="mx-6 mb-4">
          <View
            className="rounded-2xl p-6 items-center"
            style={{ backgroundColor: stats.gradeColor + '10', borderWidth: 2, borderColor: stats.gradeColor + '40' }}
          >
            <Text className="text-6xl font-black" style={{ color: stats.gradeColor }}>
              {stats.grade}
            </Text>
            <Text className="text-base text-foreground font-semibold mt-2">Weekly Grade</Text>
            <Text className="text-sm text-muted mt-1">
              {stats.workoutsCompleted}/{stats.workoutsPlanned} workouts · {stats.prsHit} PRs
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <View className="px-6 mb-4">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {[
              { label: 'Workouts', value: `${stats.workoutsCompleted}/${stats.workoutsPlanned}`, color: stats.workoutsCompleted >= stats.workoutsPlanned ? '#10B981' : '#F59E0B', icon: '🏋️' },
              { label: 'Total Volume', value: `${(stats.totalVolume / 1000).toFixed(1)}t`, color: '#3B82F6', icon: '📊' },
              { label: 'PRs Hit', value: `${stats.prsHit}`, color: '#F59E0B', icon: '🏆' },
              { label: 'Avg Sleep', value: stats.avgSleep ? `${stats.avgSleep.toFixed(1)}h` : '—', color: stats.sleepTarget ? '#10B981' : '#EF4444', icon: '😴' },
              { label: 'Avg RPE', value: stats.avgRPE ? stats.avgRPE.toFixed(1) : '—', color: stats.avgRPE && stats.avgRPE <= 8.5 ? '#3B82F6' : '#F59E0B', icon: '💪' },
              { label: 'Weight Δ', value: stats.weightDelta !== null ? `${stats.weightDelta > 0 ? '+' : ''}${stats.weightDelta.toFixed(1)}kg` : '—', color: stats.weightDelta !== null && stats.weightDelta > 0 ? '#10B981' : '#6B7280', icon: '⚖️' },
            ].map(stat => (
              <View
                key={stat.label}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  width: '48%',
                  flexGrow: 1,
                }}
              >
                <Text style={{ fontSize: 20 }}>{stat.icon}</Text>
                <Text className="text-xs text-muted mt-2">{stat.label}</Text>
                <Text className="text-xl font-bold mt-0.5" style={{ color: stat.color }}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sessions breakdown */}
        {stats.sessions.length > 0 && (
          <View className="px-6 mb-4">
            <Text className="text-xs font-medium text-muted mb-3" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Sessions This Week
            </Text>
            {stats.sessions.map((s, i) => (
              <View
                key={i}
                className="flex-row items-center rounded-xl p-3 mb-2"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <View className="w-2 h-8 rounded-full mr-3" style={{ backgroundColor: SESSION_COLORS[s.type] }} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">{SESSION_NAMES[s.type]}</Text>
                  <Text className="text-xs text-muted">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {s.duration > 0 ? ` · ${s.duration}m` : ''}
                  </Text>
                </View>
                <Text className="text-sm font-semibold" style={{ color: SESSION_COLORS[s.type] }}>
                  {s.volume > 0 ? `${(s.volume / 1000).toFixed(1)}t` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick insights */}
        <View className="px-6 mb-4">
          <Text className="text-xs font-medium text-muted mb-3" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Insights
          </Text>
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            {stats.workoutsCompleted < stats.workoutsPlanned && (
              <View className="flex-row items-start mb-3">
                <Text style={{ fontSize: 14 }}>⚠️</Text>
                <Text className="text-sm text-foreground ml-2 flex-1">
                  Missed {stats.workoutsPlanned - stats.workoutsCompleted} workout(s) this week. Consistency is key for hypertrophy.
                </Text>
              </View>
            )}
            {stats.avgSleep !== null && stats.avgSleep < 7 && (
              <View className="flex-row items-start mb-3">
                <Text style={{ fontSize: 14 }}>😴</Text>
                <Text className="text-sm text-foreground ml-2 flex-1">
                  Sleep averaging {stats.avgSleep.toFixed(1)}h. Aim for 7.5h+ — recovery is where gains happen.
                </Text>
              </View>
            )}
            {stats.avgRPE !== null && stats.avgRPE > 9 && (
              <View className="flex-row items-start mb-3">
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text className="text-sm text-foreground ml-2 flex-1">
                  Average RPE is {stats.avgRPE.toFixed(1)} — you're pushing very hard. Consider a deload if fatigue accumulates.
                </Text>
              </View>
            )}
            {stats.prsHit > 0 && (
              <View className="flex-row items-start">
                <Text style={{ fontSize: 14 }}>🏆</Text>
                <Text className="text-sm text-foreground ml-2 flex-1">
                  {stats.prsHit} new PR{stats.prsHit > 1 ? 's' : ''} this week! Progressive overload is working.
                </Text>
              </View>
            )}
            {stats.workoutsCompleted >= stats.workoutsPlanned && stats.sleepTarget && stats.prsHit > 0 && (
              <View className="flex-row items-start">
                <Text style={{ fontSize: 14 }}>⭐</Text>
                <Text className="text-sm text-foreground ml-2 flex-1">
                  Perfect week — training, sleep, and progression all on point. Keep this up!
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
