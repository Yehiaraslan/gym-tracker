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
  TextInput,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getAllPRs,
  getRecentSplitWorkouts,
  getTrackedExerciseNames,
  getVolumeHistory,
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

const SCREEN_WIDTH = Dimensions.get('window').width;

type ProgressTab = 'overview' | 'history';

export default function ProgressScreen() {
  const colors = useColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProgressTab>('overview');

  // Data
  const [prs, setPrs] = useState<Record<string, { e1rm: number; weight: number; reps: number; date: string }>>({})
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [weeklyRecovery, setWeeklyRecovery] = useState<WeeklyRecoveryData[]>([]);
  const [nutrition, setNutrition] = useState<DailyNutrition[]>([]);
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);
  const [trackedExercises, setTrackedExercises] = useState<string[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [weeklyVolumeData, setWeeklyVolumeData] = useState<Record<string, { date: string; volume: number }[]>>({});

  const loadData = useCallback(async () => {
    try {
      const [prData, streakData, recent, rec, weekRec, nutri, recs, weekCount, exerciseNames,
        volUpperA, volLowerA, volUpperB, volLowerB] = await Promise.all([
        getAllPRs(),
        getStreakData(),
        getRecentSplitWorkouts(10),
        getTodayRecoveryData(),
        getWeeklyRecoveryData(),
        getRecentNutrition(7),
        getActiveRecommendations(),
        getWorkoutsInLastDays(7),
        getTrackedExerciseNames(),
        getVolumeHistory('upper-a'),
        getVolumeHistory('lower-a'),
        getVolumeHistory('upper-b'),
        getVolumeHistory('lower-b'),
      ]);
      setPrs(prData);
      setStreak(streakData);
      setRecentWorkouts(recent);
      setRecovery(rec);
      setWeeklyRecovery(weekRec);
      setNutrition(nutri);
      setRecommendations(recs);
      setWorkoutsThisWeek(weekCount);
      setTrackedExercises(exerciseNames);
      setWeeklyVolumeData({ 'upper-a': volUpperA, 'lower-a': volLowerA, 'upper-b': volUpperB, 'lower-b': volLowerB });
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

  // Filtered exercise list for History tab
  const filteredExercises = exerciseSearch.trim().length > 0
    ? trackedExercises.filter(n => n.toLowerCase().includes(exerciseSearch.toLowerCase()))
    : trackedExercises;

  // Map exercise names to PR e1RM for display
  const prMap = prs;

  return (
    <ScreenContainer className="flex-1">
      {/* Header + Tab switcher */}
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 0 }}>
        <Text className="text-2xl font-bold text-foreground">Progress</Text>
        <View style={{
          flexDirection: 'row',
          marginTop: 12,
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 4,
          gap: 4,
        }}>
          {(['overview', 'history'] as ProgressTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
                activeTab === tab && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                setActiveTab(tab);
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: activeTab === tab ? '#fff' : colors.muted,
              }}>
                {tab === 'overview' ? '📊 Overview' : '📋 Exercise History'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* History tab — searchable exercise list */}
      {activeTab === 'history' && (
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 12 }}>
          {/* Search bar */}
          <View style={[
            { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 },
            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
          ]}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, fontSize: 15, color: colors.foreground }}
              placeholder="Search exercises…"
              placeholderTextColor={colors.muted}
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {trackedExercises.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
              <Text style={{ fontSize: 40 }}>🏋️</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground, textAlign: 'center' }}>
                No workout history yet
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
                Complete a workout to start tracking your exercise history.
              </Text>
            </View>
          ) : filteredExercises.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>No exercises match your search.</Text>
          ) : (
            <FlatList
              data={filteredExercises}
              keyExtractor={item => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderItem={({ item: name }) => {
                const pr = prMap[name];
                return (
                  <TouchableOpacity
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        borderRadius: 14,
                        marginBottom: 8,
                        borderWidth: 0.5,
                      },
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/rep-history', params: { exercise: name, exerciseType: '' } });
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{name}</Text>
                      {pr && (
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                          PR: {pr.weight}kg × {pr.reps} reps · ~{Math.round(pr.e1rm)}kg e1RM
                        </Text>
                      )}
                    </View>
                    {pr && <Text style={{ fontSize: 14 }}>🏆</Text>}
                    <Text style={{ fontSize: 20, color: colors.muted, marginLeft: 8 }}>›</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Spacer to replace removed header */}
        <View style={{ height: 12 }} />

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

        {/* Weekly Volume Line Chart */}
        <WeeklyVolumeChart weeklyVolumeData={weeklyVolumeData} colors={colors} />

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
      )}
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

// ---- Weekly Volume Line Chart ----
const SESSION_LINE_COLORS: Record<string, string> = {
  'upper-a': '#6366F1',
  'lower-a': '#10B981',
  'upper-b': '#F59E0B',
  'lower-b': '#EF4444',
};
const SESSION_LINE_LABELS: Record<string, string> = {
  'upper-a': 'Upper A',
  'lower-a': 'Lower A',
  'upper-b': 'Upper B',
  'lower-b': 'Lower B',
};

function WeeklyVolumeChart({
  weeklyVolumeData,
  colors,
}: {
  weeklyVolumeData: Record<string, { date: string; volume: number }[]>;
  colors: ReturnType<typeof useColors>;
}) {
  const [tooltip, setTooltip] = useState<{ type: string; date: string; volume: number; x: number; y: number } | null>(null);

  const CHART_W = SCREEN_WIDTH - 48 - 32; // px-6 padding + card padding
  const CHART_H = 140;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 8;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 28;
  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  // Collect all sessions across types, sorted by date
  const allSeries = Object.entries(weeklyVolumeData).filter(([, pts]) => pts.length > 0);
  if (allSeries.length === 0) return null;

  // Build a unified date axis from all series
  const allDates = Array.from(
    new Set(allSeries.flatMap(([, pts]) => pts.map(p => p.date)))
  ).sort();

  if (allDates.length < 2) return null;

  // Global max volume for Y axis
  const allVolumes = allSeries.flatMap(([, pts]) => pts.map(p => p.volume));
  const maxVol = Math.max(...allVolumes, 1);

  // Map date → x position
  const dateToX = (date: string) => {
    const idx = allDates.indexOf(date);
    if (idx < 0) return -1;
    return PAD_LEFT + (idx / (allDates.length - 1)) * plotW;
  };
  const volToY = (vol: number) => PAD_TOP + plotH - (vol / maxVol) * plotH;

  // Y axis labels
  const yLabels = [0, Math.round(maxVol / 2), Math.round(maxVol)];

  // X axis labels (first, middle, last)
  const xLabelIndices = [0, Math.floor((allDates.length - 1) / 2), allDates.length - 1];

  // Tooltip display values
  const tooltipLabel = tooltip
    ? `${SESSION_LINE_LABELS[tooltip.type] ?? tooltip.type}  ·  ${new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}  ·  ${(tooltip.volume / 1000).toFixed(2)}t`
    : '';

  // Clamp tooltip box so it stays within chart width
  const TOOLTIP_W = 200;
  const tooltipLeft = tooltip ? Math.min(Math.max(0, tooltip.x - TOOLTIP_W / 2), CHART_W - TOOLTIP_W) : 0;
  const tooltipTop = tooltip ? Math.max(0, tooltip.y - 36) : 0;

  return (
    <View className="px-6 mt-5">
      <Text className="text-sm font-semibold text-foreground mb-3">Weekly Volume by Session Type</Text>
      <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        {/* Legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          {allSeries.map(([type]) => (
            <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: SESSION_LINE_COLORS[type] || colors.primary }} />
              <Text style={{ fontSize: 11, color: colors.muted }}>{SESSION_LINE_LABELS[type] ?? type}</Text>
            </View>
          ))}
        </View>
        {/* Chart container — relative for tooltip overlay */}
        <View style={{ position: 'relative' }}>
          <Svg width={CHART_W} height={CHART_H} onPress={() => setTooltip(null)}>
            {/* Y grid lines + labels */}
            {yLabels.map((v, i) => {
              const y = volToY(v);
              return (
                <React.Fragment key={i}>
                  <Line
                    x1={PAD_LEFT} y1={y} x2={CHART_W - PAD_RIGHT} y2={y}
                    stroke={colors.border} strokeWidth={0.5} strokeDasharray="3,3"
                  />
                  <SvgText
                    x={PAD_LEFT - 4} y={y + 4}
                    fontSize={9} fill={colors.muted} textAnchor="end"
                  >
                    {v >= 1000 ? `${(v / 1000).toFixed(0)}t` : `${v}`}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {/* X axis labels */}
            {xLabelIndices.map(idx => {
              const date = allDates[idx];
              if (!date) return null;
              const x = PAD_LEFT + (idx / (allDates.length - 1)) * plotW;
              const label = new Date(date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
              return (
                <SvgText
                  key={idx} x={x} y={CHART_H - 6}
                  fontSize={9} fill={colors.muted} textAnchor="middle"
                >
                  {label}
                </SvgText>
              );
            })}
            {/* Lines per session type */}
            {allSeries.map(([type, pts]) => {
              const lineColor = SESSION_LINE_COLORS[type] || colors.primary;
              const points = pts
                .map(p => {
                  const x = dateToX(p.date);
                  const y = volToY(p.volume);
                  return x >= 0 ? `${x},${y}` : null;
                })
                .filter(Boolean)
                .join(' ');
              if (!points) return null;
              return (
                <React.Fragment key={type}>
                  <Polyline
                    points={points}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {pts.map((p, i) => {
                    const x = dateToX(p.date);
                    const y = volToY(p.volume);
                    if (x < 0) return null;
                    const isActive = tooltip?.type === type && tooltip?.date === p.date;
                    return (
                      <React.Fragment key={i}>
                        {/* Larger invisible hit target */}
                        <Circle
                          cx={x} cy={y} r={12}
                          fill="transparent"
                          onPress={() => {
                            if (isActive) { setTooltip(null); }
                            else { setTooltip({ type, date: p.date, volume: p.volume, x, y }); }
                          }}
                        />
                        <Circle cx={x} cy={y} r={isActive ? 5 : 3} fill={lineColor} />
                        {isActive && <Circle cx={x} cy={y} r={8} fill={lineColor + '30'} />}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </Svg>
          {/* Tooltip overlay */}
          {tooltip && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: tooltipLeft,
                top: tooltipTop,
                width: TOOLTIP_W,
                backgroundColor: colors.foreground,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.background, fontWeight: '600', textAlign: 'center' }}>
                {tooltipLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
