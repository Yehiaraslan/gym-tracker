// ============================================================
// PROGRESS TAB — Performance tracking, PRs, volume trends,
// and intelligent recommendations (sleep, protein, readiness)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import {
  getAllPRs,
  getRecentSplitWorkouts,
  type SplitWorkoutSession,
} from '@/lib/split-workout-store';
import {
  getStreakData,
  getWorkoutsInLastDays,
  type StreakData,
} from '@/lib/streak-tracker';
import {
  getTodayRecoveryData,
  getWeeklyRecoveryData,
  getRecoveryTrend,
  getWeeklyAverageRecovery,
  type RecoveryData,
  type WeeklyRecoveryData,
} from '@/lib/whoop-recovery-service';
import { getRecentNutrition, getMacroTotals, type DailyNutrition } from '@/lib/nutrition-store';
import { getActiveRecommendations, type CoachRecommendation } from '@/lib/coach-engine';
import { NUTRITION_TARGETS, SLEEP_TARGETS, SESSION_NAMES, SESSION_COLORS, type SessionType } from '@/lib/training-program';

export default function ProgressScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [prs, setPrs] = useState<Record<string, { e1rm: number; weight: number; reps: number; date: string }>>({});
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [weeklyRecovery, setWeeklyRecovery] = useState<WeeklyRecoveryData[]>([]);
  const [nutrition, setNutrition] = useState<DailyNutrition[]>([]);
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [prData, streakData, recent, rec, weekRec, nutri, recs, weekCount] = await Promise.all([
        getAllPRs(),
        getStreakData(),
        getRecentSplitWorkouts(10),
        getTodayRecoveryData(),
        getWeeklyRecoveryData(),
        getRecentNutrition(7),
        getActiveRecommendations(),
        getWorkoutsInLastDays(7),
      ]);
      setPrs(prData);
      setStreak(streakData);
      setRecentWorkouts(recent);
      setRecovery(rec);
      setWeeklyRecovery(weekRec);
      setNutrition(nutri);
      setRecommendations(recs);
      setWorkoutsThisWeek(weekCount);
    } catch (e) {
      console.error('Failed to load progress data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  // Derived data
  const prList = Object.entries(prs).sort((a, b) => b[1].e1rm - a[1].e1rm);
  const recoveryTrend = weeklyRecovery.length > 0 ? getRecoveryTrend(weeklyRecovery) : 'stable';
  const avgRecovery = weeklyRecovery.length > 0 ? getWeeklyAverageRecovery(weeklyRecovery) : null;

  // Protein tracking
  const todayNutrition = nutrition.find(n => n.date === new Date().toISOString().split('T')[0]);
  const todayMacros = todayNutrition ? getMacroTotals(todayNutrition.meals) : { protein: 0, carbs: 0, fat: 0, calories: 0 };
  const proteinTarget = NUTRITION_TARGETS.training.protein;
  const proteinPercent = Math.min(100, Math.round((todayMacros.protein / proteinTarget) * 100));

  // Training readiness score (composite)
  const readinessScore = calculateReadiness(recovery, avgRecovery, streak, workoutsThisWeek);

  // Volume trend from recent workouts
  const recentVolumes = recentWorkouts
    .filter(w => w.totalVolume && w.totalVolume > 0)
    .slice(0, 5)
    .reverse();

  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">Progress</Text>
          <Text className="text-sm text-muted mt-1">Performance tracking & insights</Text>
        </View>

        {/* Quick Stats Row */}
        <View className="px-6 mt-4">
          <View className="flex-row" style={{ gap: 10 }}>
            <StatCard
              icon="flame.fill"
              iconColor="#FF6B35"
              value={streak?.currentStreak?.toString() || '0'}
              label="Day Streak"
              sublabel={streak?.bestStreak ? `Best: ${streak.bestStreak}` : undefined}
              colors={colors}
            />
            <StatCard
              icon="dumbbell.fill"
              iconColor={colors.primary}
              value={workoutsThisWeek.toString()}
              label="This Week"
              sublabel="of 4 target"
              colors={colors}
            />
            <StatCard
              icon="trophy.fill"
              iconColor="#F59E0B"
              value={prList.length.toString()}
              label="PRs"
              sublabel="All time"
              colors={colors}
            />
          </View>
        </View>

        {/* Training Readiness */}
        <View className="px-6 mt-5">
          <Text className="text-sm font-semibold text-foreground mb-3">Training Readiness</Text>
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: getReadinessColor(readinessScore) + '20' }}
                >
                  <Text className="text-lg font-bold" style={{ color: getReadinessColor(readinessScore) }}>
                    {readinessScore}
                  </Text>
                </View>
                <View>
                  <Text className="text-base font-semibold text-foreground">
                    {getReadinessLabel(readinessScore)}
                  </Text>
                  <Text className="text-xs text-muted">
                    {getReadinessAdvice(readinessScore)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Readiness breakdown */}
            <View style={{ gap: 8 }}>
              <ReadinessRow
                label="Recovery"
                value={recovery ? `${Math.round(recovery.recoveryScore)}%` : 'No data'}
                color={recovery ? getRecoveryColor(recovery.recoveryScore) : colors.muted}
                progress={recovery ? recovery.recoveryScore / 100 : 0}
                colors={colors}
              />
              <ReadinessRow
                label="Sleep"
                value={recovery ? `${Math.round(recovery.sleepScore)}%` : 'No data'}
                color={recovery ? getRecoveryColor(recovery.sleepScore) : colors.muted}
                progress={recovery ? recovery.sleepScore / 100 : 0}
                colors={colors}
              />
              <ReadinessRow
                label="Weekly Load"
                value={`${workoutsThisWeek}/4 sessions`}
                color={workoutsThisWeek <= 4 ? '#10B981' : '#F59E0B'}
                progress={Math.min(1, workoutsThisWeek / 4)}
                colors={colors}
              />
            </View>
          </View>
        </View>

        {/* Protein Tracker */}
        <View className="px-6 mt-5">
          <Text className="text-sm font-semibold text-foreground mb-3">Today's Protein</Text>
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-2xl font-bold text-foreground">{todayMacros.protein}g</Text>
              <Text className="text-sm text-muted">/ {proteinTarget}g target</Text>
            </View>
            <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
              <View
                className="h-full rounded-full"
                style={{
                  width: `${proteinPercent}%`,
                  backgroundColor: proteinPercent >= 80 ? '#10B981' : proteinPercent >= 50 ? '#F59E0B' : '#EF4444',
                }}
              />
            </View>
            <Text className="text-xs text-muted mt-2">
              {proteinPercent >= 80
                ? 'On track for your protein goal'
                : proteinPercent >= 50
                  ? 'Need more protein — aim for high-protein meals'
                  : 'Protein intake is low — prioritize protein-rich foods'}
            </Text>
          </View>
        </View>

        {/* Sleep Optimization */}
        {recovery && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-foreground mb-3">Sleep & Recovery</Text>
            <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <View className="flex-row items-center mb-3">
                <IconSymbol name="bed.double.fill" size={20} color="#8B5CF6" />
                <Text className="text-sm font-medium text-foreground ml-2">Sleep Score: {Math.round(recovery.sleepScore)}%</Text>
              </View>
              <Text className="text-xs text-muted leading-relaxed">
                {recovery.sleepScore >= 80
                  ? `Great sleep quality. Your target is ${SLEEP_TARGETS.durationHours}h (${SLEEP_TARGETS.bedtime}–${SLEEP_TARGETS.wakeTime}). Keep this up for optimal recovery.`
                  : recovery.sleepScore >= 60
                    ? `Sleep could be better. Aim for ${SLEEP_TARGETS.durationHours}h by getting to bed by ${SLEEP_TARGETS.bedtime}. Consider limiting screen time 30min before bed.`
                    : `Poor sleep detected. This impacts recovery and performance. Prioritize getting to bed by ${SLEEP_TARGETS.bedtime} and aim for ${SLEEP_TARGETS.durationHours}h. Avoid caffeine after 2 PM.`}
              </Text>
              {recoveryTrend !== 'stable' && (
                <View className="mt-2 rounded-lg p-2" style={{ backgroundColor: recoveryTrend === 'improving' ? '#10B98110' : '#EF444410' }}>
                  <Text className="text-xs" style={{ color: recoveryTrend === 'improving' ? '#10B981' : '#EF4444' }}>
                    {recoveryTrend === 'improving'
                      ? 'Recovery trend is improving — your sleep habits are paying off'
                      : 'Recovery trend is declining — consider extra rest or adjusting training volume'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Volume Trend */}
        {recentVolumes.length > 1 && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-foreground mb-3">Volume Trend</Text>
            <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <View className="flex-row items-end" style={{ height: 80, gap: 6 }}>
                {recentVolumes.map((w, i) => {
                  const maxVol = Math.max(...recentVolumes.map(v => v.totalVolume || 1));
                  const height = ((w.totalVolume || 0) / maxVol) * 70;
                  const sColor = SESSION_COLORS[w.sessionType as SessionType] || colors.primary;
                  return (
                    <View key={i} className="flex-1 items-center">
                      <View
                        style={{
                          width: '100%',
                          height: Math.max(4, height),
                          borderRadius: 4,
                          backgroundColor: sColor,
                        }}
                      />
                      <Text className="text-xs text-muted mt-1" style={{ fontSize: 9 }}>
                        {new Date(w.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {recentVolumes.length >= 2 && (() => {
                const latest = recentVolumes[recentVolumes.length - 1].totalVolume || 0;
                const prev = recentVolumes[recentVolumes.length - 2].totalVolume || 1;
                const delta = ((latest - prev) / prev) * 100;
                return (
                  <Text className="text-xs text-muted mt-3">
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% volume change from previous session
                  </Text>
                );
              })()}
            </View>
          </View>
        )}

        {/* Personal Records */}
        {prList.length > 0 && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-foreground mb-3">Personal Records</Text>
            <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              {prList.slice(0, 8).map(([name, pr], i) => (
                <View
                  key={name}
                  className="flex-row items-center px-4 py-3"
                  style={i < Math.min(prList.length, 8) - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}}
                >
                  <Text style={{ fontSize: 16, marginRight: 10 }}>🏆</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{name}</Text>
                    <Text className="text-xs text-muted">
                      {pr.weight}kg x {pr.reps} reps · {new Date(pr.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-bold" style={{ color: '#F59E0B' }}>~{Math.round(pr.e1rm)}kg</Text>
                    <Text className="text-xs text-muted">est. 1RM</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Coach Recommendations */}
        {recommendations.length > 0 && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-foreground mb-3">Coach Insights</Text>
            {recommendations.slice(0, 3).map((rec, i) => {
              const catIcon: Record<string, string> = { nutrition: '🍗', training: '🏋️', recovery: '😴', overload: '📈' };
              return (
                <View
                  key={i}
                  className="rounded-xl p-3 mb-2"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text className="text-sm font-medium text-foreground">
                    {catIcon[rec.type] || '💡'} {rec.message}
                  </Text>
                  <Text className="text-xs text-muted mt-1 leading-relaxed">{rec.actionable}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Workouts */}
        {recentWorkouts.length > 0 && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-foreground mb-3">Recent Workouts</Text>
            <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              {recentWorkouts.slice(0, 5).map((w, i) => {
                const sColor = SESSION_COLORS[w.sessionType as SessionType] || colors.primary;
                return (
                  <View
                    key={w.id}
                    className="flex-row items-center px-4 py-3"
                    style={i < Math.min(recentWorkouts.length, 5) - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}}
                  >
                    <View
                      style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: sColor, marginRight: 12 }}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">
                        {SESSION_NAMES[w.sessionType as SessionType] || w.sessionType}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(w.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {w.durationMinutes ? ` · ${w.durationMinutes}m` : ''}
                      </Text>
                    </View>
                    {w.totalVolume ? (
                      <Text className="text-sm font-semibold" style={{ color: sColor }}>
                        {(w.totalVolume / 1000).toFixed(1)}t
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

// ---- Helper Components ----

function StatCard({
  icon,
  iconColor,
  value,
  label,
  sublabel,
  colors,
}: {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  iconColor: string;
  value: string;
  label: string;
  sublabel?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View className="flex-1 rounded-2xl p-3 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <IconSymbol name={icon} size={20} color={iconColor} />
      <Text className="text-xl font-bold text-foreground mt-1">{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
      {sublabel && <Text className="text-xs text-muted" style={{ fontSize: 10 }}>{sublabel}</Text>}
    </View>
  );
}

function ReadinessRow({
  label,
  value,
  color,
  progress,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  progress: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-muted">{label}</Text>
        <Text className="text-xs font-medium" style={{ color }}>{value}</Text>
      </View>
      <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
        <View className="h-full rounded-full" style={{ width: `${Math.max(2, progress * 100)}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

// ---- Helper Functions ----

function calculateReadiness(
  recovery: RecoveryData | null,
  avgRecovery: number | null,
  streak: StreakData | null,
  workoutsThisWeek: number,
): number {
  let score = 70; // baseline

  if (recovery) {
    // Recovery contributes 40%
    score = recovery.recoveryScore * 0.4;
    // Sleep contributes 30%
    score += recovery.sleepScore * 0.3;
  }

  // Training load contributes 20%
  if (workoutsThisWeek <= 4) {
    score += 20;
  } else if (workoutsThisWeek === 5) {
    score += 10;
  } else {
    score += 5;
  }

  // Consistency contributes 10%
  if (streak && streak.currentStreak >= 3) {
    score += 10;
  } else if (streak && streak.currentStreak >= 1) {
    score += 5;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

function getReadinessColor(score: number): string {
  if (score >= 67) return '#10B981';
  if (score >= 34) return '#F59E0B';
  return '#EF4444';
}

function getReadinessLabel(score: number): string {
  if (score >= 80) return 'Peak Readiness';
  if (score >= 67) return 'Good to Train';
  if (score >= 50) return 'Moderate Readiness';
  if (score >= 34) return 'Consider Light Session';
  return 'Rest Recommended';
}

function getReadinessAdvice(score: number): string {
  if (score >= 80) return 'Push hard today — your body is primed';
  if (score >= 67) return 'Normal training intensity recommended';
  if (score >= 50) return 'Reduce volume or intensity slightly';
  if (score >= 34) return 'Light session or active recovery';
  return 'Take a rest day for optimal recovery';
}

function getRecoveryColor(score: number): string {
  if (score >= 67) return '#10B981';
  if (score >= 34) return '#F59E0B';
  return '#EF4444';
}
