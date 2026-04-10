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
import Svg, { Polyline, Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import {
  computeMuscleHeatmap,
  MUSCLE_GROUPS,
  type MuscleGroup,
  type MuscleHeatmap,
  type IntensityLevel,
} from '@/lib/muscle-heatmap';
import { getSplitWorkouts } from '@/lib/split-workout-store';
import { EXERCISE_LIBRARY } from '@/lib/data/exercise-library';
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
  getDeloadWeekDates,
  get1RMHistory,
  getVolumeHeatmapData,
  detectPerformanceDecline,
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
import { loadCustomProgram, type CustomProgram } from '@/lib/custom-program-store';

const SCREEN_WIDTH = Dimensions.get('window').width;

type ProgressTab = 'overview' | 'history';

export default function ProgressScreen() {
  const colors = useColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProgressTab>('overview');
  const [customProg, setCustomProg] = useState<CustomProgram | null>(null);
  useEffect(() => { loadCustomProgram().then(setCustomProg); }, []);
  const resolveName = (st: string) => customProg?.sessionNames?.[st] || SESSION_NAMES[st as keyof typeof SESSION_NAMES] || st;
  const resolveColor = (st: string) => customProg?.sessionColors?.[st] || SESSION_COLORS[st as keyof typeof SESSION_COLORS] || colors.primary;

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
  const [volumeDateRange, setVolumeDateRange] = useState<28 | 56 | undefined>(28);
  const [deloadDates, setDeloadDates] = useState<string[]>([]);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [performanceDecline, setPerformanceDecline] = useState<{ declining: boolean; pct: number; sessions: number } | null>(null);
  // Muscle group volume heatmap
  const [muscleHeatmap, setMuscleHeatmap] = useState<MuscleHeatmap | null>(null);
  const [muscleHeatmapDays, setMuscleHeatmapDays] = useState<7 | 14 | 30>(7);

  // Strength Progression Chart state
  // Multi-exercise overlay state
  const [pinnedExercises, setPinnedExercises] = useState<string[]>([]);
  const [pinnedHistories, setPinnedHistories] = useState<Record<string, { date: string; e1rm: number }[]>>({});
  const [strengthRange, setStrengthRange] = useState<28 | 84 | 168 | 0>(0);
  const [strengthLoading, setStrengthLoading] = useState(false);
  const [strengthSearch, setStrengthSearch] = useState('');
  const [showExPicker, setShowExPicker] = useState(false);

  const handlePinExercise = async (name: string) => {
    if (pinnedExercises.includes(name)) {
      // Unpin
      setPinnedExercises(prev => prev.filter(e => e !== name));
      setPinnedHistories(prev => { const n = { ...prev }; delete n[name]; return n; });
      return;
    }
    if (pinnedExercises.length >= MAX_PINNED) return;
    setStrengthLoading(true);
    setShowExPicker(false);
    setStrengthSearch('');
    try {
      const hist = await get1RMHistory(name);
      setPinnedExercises(prev => [...prev, name]);
      setPinnedHistories(prev => ({ ...prev, [name]: hist }));
    } finally {
      setStrengthLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [prData, streakData, recent, rec, weekRec, nutri, recs, weekCount, exerciseNames,
        volUpperA, volLowerA, volUpperB, volLowerB, deloadDatesList, heatmap, decline] = await Promise.all([
        getAllPRs(),
        getStreakData(),
        getRecentSplitWorkouts(10),
        getTodayRecoveryData(),
        getWeeklyRecoveryData(),
        getRecentNutrition(7),
        getActiveRecommendations(),
        getWorkoutsInLastDays(7),
        getTrackedExerciseNames(),
        getVolumeHistory('upper-a', volumeDateRange),
        getVolumeHistory('lower-a', volumeDateRange),
        getVolumeHistory('upper-b', volumeDateRange),
        getVolumeHistory('lower-b', volumeDateRange),
        getDeloadWeekDates(),
        getVolumeHeatmapData(12),
        detectPerformanceDecline(),
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
      setDeloadDates(deloadDatesList);
      setHeatmapData(heatmap);
      setPerformanceDecline(decline);
      // Compute muscle group heatmap from split workouts
      try {
        const allWorkouts = await getSplitWorkouts();
        // Convert SplitWorkoutSession[] to WorkoutLog[] shape expected by computeMuscleHeatmap
        const workoutLogs = allWorkouts.map(w => ({
          id: w.id,
          date: w.date,
          exercises: w.exercises.map(ex => ({
            exerciseName: ex.exerciseName,
            sets: ex.sets.map(s => ({ weight: s.weightKg, reps: s.reps })),
          })),
        })) as any[];
        const hm = computeMuscleHeatmap(workoutLogs, EXERCISE_LIBRARY as any, muscleHeatmapDays);
        setMuscleHeatmap(hm);
      } catch {}
    } catch (e) {
      console.error('Failed to load progress data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [volumeDateRange, muscleHeatmapDays]);

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
  const todayNutrition = nutrition.find(n => n.date === new Date().toLocaleDateString('en-CA'));
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
        <Text className="text-2xl font-bold text-cardForeground">Progress</Text>
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
                color: activeTab === tab ? '#fff' : colors.cardMuted,
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
            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder },
          ]}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={{ flex: 1, fontSize: 15, color: colors.cardForeground }}
              placeholder="Search exercises…"
              placeholderTextColor={colors.cardMuted}
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          {trackedExercises.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 8 }}>
              <Text style={{ fontSize: 40 }}>🏋️</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.cardForeground, textAlign: 'center' }}>
                No workout history yet
              </Text>
              <Text style={{ fontSize: 14, color: colors.cardMuted, textAlign: 'center', lineHeight: 20 }}>
                Complete a workout to start tracking your exercise history.
              </Text>
            </View>
          ) : filteredExercises.length === 0 ? (
            <Text style={{ color: colors.cardMuted, textAlign: 'center', marginTop: 40 }}>No exercises match your search.</Text>
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
                      { backgroundColor: colors.surface, borderColor: colors.cardBorder },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/rep-history', params: { exercise: name, exerciseType: '' } });
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.cardForeground }}>{name}</Text>
                      {pr && (
                        <Text style={{ fontSize: 12, color: colors.cardMuted, marginTop: 2 }}>
                          PR: {pr.weight}kg × {pr.reps} reps · ~{Math.round(pr.e1rm)}kg e1RM
                        </Text>
                      )}
                    </View>
                    {pr && <Text style={{ fontSize: 14 }}>🏆</Text>}
                    <Text style={{ fontSize: 20, color: colors.cardMuted, marginLeft: 8 }}>›</Text>
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
          <Text className="text-sm font-semibold text-cardForeground mb-3">Training Readiness</Text>
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
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
                  <Text className="text-base font-semibold text-cardForeground">
                    {getReadinessLabel(readinessScore)}
                  </Text>
                  <Text className="text-xs text-cardMuted">
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
                color={recovery ? getRecoveryColor(recovery.recoveryScore) : colors.cardMuted}
                progress={recovery ? recovery.recoveryScore / 100 : 0}
                colors={colors}
              />
              <ReadinessRow
                label="Sleep"
                value={recovery ? `${Math.round(recovery.sleepScore)}%` : 'No data'}
                color={recovery ? getRecoveryColor(recovery.sleepScore) : colors.cardMuted}
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
          <Text className="text-sm font-semibold text-cardForeground mb-3">Today's Protein</Text>
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-2xl font-bold text-cardForeground">{todayMacros.protein}g</Text>
              <Text className="text-sm text-cardMuted">/ {proteinTarget}g target</Text>
            </View>
            <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: colors.cardBorder }}>
              <View
                className="h-full rounded-full"
                style={{
                  width: `${proteinPercent}%`,
                  backgroundColor: proteinPercent >= 80 ? '#10B981' : proteinPercent >= 50 ? '#F59E0B' : '#EF4444',
                }}
              />
            </View>
            <Text className="text-xs text-cardMuted mt-2">
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
            <Text className="text-sm font-semibold text-cardForeground mb-3">Sleep & Recovery</Text>
            <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View className="flex-row items-center mb-3">
                <IconSymbol name="bed.double.fill" size={20} color="#8B5CF6" />
                <Text className="text-sm font-medium text-cardForeground ml-2">Sleep Score: {Math.round(recovery.sleepScore)}%</Text>
              </View>
              <Text className="text-xs text-cardMuted leading-relaxed">
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
        <WeeklyVolumeChart
          weeklyVolumeData={weeklyVolumeData}
          colors={colors}
          dateRange={volumeDateRange}
          onDateRangeChange={(range) => { setVolumeDateRange(range); }}
          deloadDates={deloadDates}
        />

        {/* Strength Progression Chart — Multi-Exercise Overlay */}
        <StrengthProgressionChart
          trackedExercises={trackedExercises}
          pinnedExercises={pinnedExercises}
          pinnedHistories={pinnedHistories}
          onTogglePin={handlePinExercise}
          dateRange={strengthRange}
          onDateRangeChange={setStrengthRange}
          loading={strengthLoading}
          colors={colors}
          showPicker={showExPicker}
          onTogglePicker={() => setShowExPicker(v => !v)}
          exerciseSearch={strengthSearch}
          onSearchChange={setStrengthSearch}
        />

        {/* Personal Records */}
        {prList.length > 0 && (
          <View className="px-6 mt-5">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text className="text-sm font-semibold text-cardForeground">Personal Records</Text>
              <TouchableOpacity
                onPress={() => router.push('/pr-board')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={{ fontSize: 12, color: '#C8F53C', fontWeight: '600' }}>View All</Text>
                <Text style={{ fontSize: 12, color: '#C8F53C' }}>›</Text>
              </TouchableOpacity>
            </View>
            <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
              {prList.slice(0, 5).map(([name, pr], i) => (
                <View
                  key={name}
                  className="flex-row items-center px-4 py-3"
                  style={i < Math.min(prList.length, 5) - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.cardBorder } : {}}
                >
                  <Text style={{ fontSize: 16, marginRight: 10 }}>🏆</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-cardForeground">{name}</Text>
                    <Text className="text-xs text-cardMuted">
                      {pr.weight}kg x {pr.reps} reps · {new Date(pr.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-bold" style={{ color: '#F59E0B' }}>~{Math.round(pr.e1rm)}kg</Text>
                    <Text className="text-xs text-cardMuted">est. 1RM</Text>
                  </View>
                </View>
              ))}
              {prList.length > 5 && (
                <TouchableOpacity
                  onPress={() => router.push('/pr-board')}
                  style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.cardBorder }}
                >
                  <Text style={{ fontSize: 13, color: '#C8F53C', fontWeight: '600' }}>View all {prList.length} PRs →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Coach Recommendations */}
        {recommendations.length > 0 && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-cardForeground mb-3">Coach Insights</Text>
            {recommendations.slice(0, 3).map((rec, i) => {
              const catIcon: Record<string, string> = { nutrition: '🍗', training: '🏋️', recovery: '😴', overload: '📈' };
              return (
                <View
                  key={i}
                  className="rounded-xl p-3 mb-2"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
                >
                  <Text className="text-sm font-medium text-cardForeground">
                    {catIcon[rec.type] || '💡'} {rec.message}
                  </Text>
                  <Text className="text-xs text-cardMuted mt-1 leading-relaxed">{rec.actionable}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Workouts */}
        {recentWorkouts.length > 0 && (
          <View className="px-6 mt-5">
            <Text className="text-sm font-semibold text-cardForeground mb-3">Recent Workouts</Text>
            <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
              {recentWorkouts.slice(0, 5).map((w, i) => {
                const sColor = resolveColor(w.sessionType);
                return (
                  <View
                    key={w.id}
                    className="flex-row items-center px-4 py-3"
                    style={i < Math.min(recentWorkouts.length, 5) - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.cardBorder } : {}}
                  >
                    <View
                      style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: sColor, marginRight: 12 }}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-cardForeground">
                        {resolveName(w.sessionType)}
                      </Text>
                      <Text className="text-xs text-cardMuted">
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

        {/* Muscle Group Volume Heatmap */}
        <MuscleGroupHeatmap
          heatmap={muscleHeatmap}
          days={muscleHeatmapDays}
          onChangeDays={(d: 7 | 14 | 30) => setMuscleHeatmapDays(d)}
          colors={colors}
        />

        {/* Volume Heatmap */}
        <VolumeHeatmap data={heatmapData} colors={colors} />
        {/* Smart Deload Banner */}
        {performanceDecline?.declining && (
          <View className="px-6 mt-4">
            <View
              style={{
                backgroundColor: '#2A1A00',
                borderWidth: 1,
                borderColor: '#F59E0B',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B', marginBottom: 2 }}>
                  Performance Declining
                </Text>
                <Text style={{ fontSize: 12, color: '#D97706', lineHeight: 18 }}>
                  Your last 3 sessions show a {performanceDecline.pct}% volume drop. A deload week may help you recover and come back stronger.
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* Program History Link */}
        <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => router.push('/program-history' as any)}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>📋</Text>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.cardForeground }}>Program History</Text>
                <Text style={{ fontSize: 12, color: colors.cardMuted, marginTop: 2 }}>Past mesocycles · PRs · Volume per block</Text>
              </View>
            </View>
            <Text style={{ fontSize: 20, color: '#C8F53C', fontWeight: '600' }}>›</Text>
          </TouchableOpacity>
        </View>
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
    <View className="flex-1 rounded-2xl p-3 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
      <IconSymbol name={icon} size={20} color={iconColor} />
      <Text className="text-xl font-bold text-cardForeground mt-1">{value}</Text>
      <Text className="text-xs text-cardMuted">{label}</Text>
      {sublabel && <Text className="text-xs text-cardMuted" style={{ fontSize: 10 }}>{sublabel}</Text>}
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
        <Text className="text-xs text-cardMuted">{label}</Text>
        <Text className="text-xs font-medium" style={{ color }}>{value}</Text>
      </View>
      <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.cardBorder }}>
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
  dateRange,
  onDateRangeChange,
  deloadDates = [],
}: {
  weeklyVolumeData: Record<string, { date: string; volume: number }[]>;
  colors: ReturnType<typeof useColors>;
  dateRange?: 28 | 56 | undefined;
  onDateRangeChange?: (range: 28 | 56 | undefined) => void;
  deloadDates?: string[];
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text className="text-sm font-semibold text-cardForeground">Weekly Volume by Session Type</Text>
        {/* Date range selector */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {([28, 56, undefined] as (28 | 56 | undefined)[]).map((r) => {
            const label = r === 28 ? '4w' : r === 56 ? '8w' : 'All';
            const active = dateRange === r;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => onDateRangeChange?.(r)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.cardBorder,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: active ? '700' : '400', color: active ? '#fff' : colors.cardMuted }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
        {/* Legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          {allSeries.map(([type]) => (
            <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: SESSION_LINE_COLORS[type] || colors.primary }} />
              <Text style={{ fontSize: 11, color: colors.cardMuted }}>{SESSION_LINE_LABELS[type] ?? type}</Text>
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
                    stroke={colors.cardBorder} strokeWidth={0.5} strokeDasharray="3,3"
                  />
                  <SvgText
                    x={PAD_LEFT - 4} y={y + 4}
                    fontSize={9} fill={colors.cardMuted} textAnchor="end"
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
                  fontSize={9} fill={colors.cardMuted} textAnchor="middle"
                >
                  {label}
                </SvgText>
              );
            })}
            {/* Deload week vertical annotations */}
            {deloadDates.map(date => {
              const x = dateToX(date);
              if (x < 0) return null;
              return (
                <React.Fragment key={`deload-${date}`}>
                  <Line
                    x1={x} y1={PAD_TOP} x2={x} y2={CHART_H - PAD_BOTTOM}
                    stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7}
                  />
                  <SvgText
                    x={x + 3} y={PAD_TOP + 10}
                    fontSize={8} fill="#F59E0B" fontWeight="bold"
                  >
                    DELOAD
                  </SvgText>
                </React.Fragment>
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
                backgroundColor: colors.cardForeground,
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

// ---- Strength Progression Chart (Multi-Exercise Overlay) ----

const STRENGTH_RANGE_LABELS: { label: string; value: 28 | 84 | 168 | 0 }[] = [
  { label: '4W', value: 28 },
  { label: '12W', value: 84 },
  { label: '6M', value: 168 },
  { label: 'All', value: 0 },
];

const CHART_ACCENT = '#6366F1';
// Up to 3 pinned exercises — each gets a distinct color
const OVERLAY_COLORS = ['#6366F1', '#10B981', '#F59E0B'];
const MAX_PINNED = 3;

function StrengthProgressionChart({
  trackedExercises,
  pinnedExercises,
  pinnedHistories,
  onTogglePin,
  dateRange,
  onDateRangeChange,
  loading,
  colors,
  showPicker,
  onTogglePicker,
  exerciseSearch,
  onSearchChange,
}: {
  trackedExercises: string[];
  pinnedExercises: string[];
  pinnedHistories: Record<string, { date: string; e1rm: number }[]>;
  onTogglePin: (name: string) => void;
  dateRange: 28 | 84 | 168 | 0;
  onDateRangeChange: (r: 28 | 84 | 168 | 0) => void;
  loading: boolean;
  colors: ReturnType<typeof useColors>;
  showPicker: boolean;
  onTogglePicker: () => void;
  exerciseSearch: string;
  onSearchChange: (v: string) => void;
}) {
  const CHART_W = SCREEN_WIDTH - 48;
  const CHART_H = 180;
  const PAD_L = 44;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  // Normalize toggle: % of best 1RM vs absolute kg
  const [normalized, setNormalized] = useState(false);

  // Filter each pinned exercise by date range
  const cutoff = dateRange === 0
    ? null
    : new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const filteredSeries = pinnedExercises.map(name => {
    const hist = pinnedHistories[name] ?? [];
    return {
      name,
      data: cutoff ? hist.filter(p => p.date >= cutoff) : hist,
    };
  });

  // Per-series best e1RM for normalization
  const seriesBests = filteredSeries.map(s => s.data.length > 0 ? Math.max(...s.data.map(p => p.e1rm)) : 1);

  // Normalized series: each point expressed as % of that exercise's best e1RM
  const normalizedSeries = filteredSeries.map((s, si) => ({
    ...s,
    data: s.data.map(p => ({ date: p.date, e1rm: (p.e1rm / seriesBests[si]) * 100 })),
  }));

  const displaySeries = normalized ? normalizedSeries : filteredSeries;

  // Compute global Y range across all pinned exercises
  const allPoints = displaySeries.flatMap(s => s.data);
  const hasData = allPoints.length >= 2;
  const globalMin = hasData ? Math.min(...allPoints.map(p => p.e1rm)) : 0;
  const globalMax = hasData ? Math.max(...allPoints.map(p => p.e1rm)) : (normalized ? 100 : 100);
  const globalRange = globalMax - globalMin || 1;
  const padded = { min: Math.max(0, globalMin - globalRange * 0.1), max: globalMax + globalRange * 0.1 };

  // Collect all unique dates across all series for X-axis
  const allDates = Array.from(new Set(allPoints.map(p => p.date))).sort();
  const toX = (date: string) => {
    const idx = allDates.indexOf(date);
    return allDates.length > 1
      ? PAD_L + (idx / (allDates.length - 1)) * plotW
      : PAD_L + plotW / 2;
  };
  const toY = (v: number) => PAD_T + plotH - ((v - padded.min) / (padded.max - padded.min)) * plotH;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PAD_T + plotH * (1 - t),
    label: normalized
      ? `${Math.round(padded.min + (padded.max - padded.min) * t)}%`
      : `${Math.round(padded.min + (padded.max - padded.min) * t)}`,
  }));

  // X-axis labels (first, middle, last)
  const xLabels: { x: number; label: string }[] = [];
  if (allDates.length >= 2) {
    const fmt = (d: string) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    };
    xLabels.push({ x: toX(allDates[0]), label: fmt(allDates[0]) });
    if (allDates.length > 2) {
      const mid = allDates[Math.floor(allDates.length / 2)];
      xLabels.push({ x: toX(mid), label: fmt(mid) });
    }
    xLabels.push({ x: toX(allDates[allDates.length - 1]), label: fmt(allDates[allDates.length - 1]) });
  }

  const filteredExList = exerciseSearch.trim()
    ? trackedExercises.filter(n => n.toLowerCase().includes(exerciseSearch.toLowerCase()))
    : trackedExercises;

  return (
    <View style={{ marginHorizontal: 24, marginTop: 20 }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.cardForeground }}>Strength Progression</Text>
        <Text style={{ fontSize: 11, color: colors.cardMuted }}>Estimated 1RM (Epley)</Text>
      </View>

      {/* Pinned exercise chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {pinnedExercises.map((name, idx) => (
          <TouchableOpacity
            key={name}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: OVERLAY_COLORS[idx] + '22',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1.5,
              borderColor: OVERLAY_COLORS[idx],
              gap: 6,
            }}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTogglePin(name);
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OVERLAY_COLORS[idx] }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: OVERLAY_COLORS[idx] }} numberOfLines={1}>{name}</Text>
            <Text style={{ fontSize: 12, color: OVERLAY_COLORS[idx] }}>×</Text>
          </TouchableOpacity>
        ))}
        {pinnedExercises.length < MAX_PINNED && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: showPicker ? CHART_ACCENT : colors.cardBorder,
              gap: 4,
            }}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTogglePicker();
            }}
          >
            <Text style={{ fontSize: 14, color: CHART_ACCENT, fontWeight: '700' }}>+</Text>
            <Text style={{ fontSize: 12, color: colors.cardMuted }}>Add exercise</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Exercise picker dropdown */}
      {showPicker && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginBottom: 10,
          maxHeight: 260,
          overflow: 'hidden',
        }}>
          <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
            <TextInput
              style={{
                backgroundColor: colors.background,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 14,
                color: colors.cardForeground,
              }}
              placeholder="Search exercises…"
              placeholderTextColor={colors.cardMuted}
              value={exerciseSearch}
              onChangeText={onSearchChange}
              autoFocus
              returnKeyType="search"
            />
          </View>
          {trackedExercises.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.cardMuted, fontSize: 13 }}>No workout history yet</Text>
            </View>
          ) : filteredExList.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.cardMuted, fontSize: 13 }}>No matches</Text>
            </View>
          ) : (
            <FlatList
              data={filteredExList}
              keyExtractor={item => item}
              style={{ maxHeight: 200 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const pinIdx = pinnedExercises.indexOf(item);
                const isPinned = pinIdx >= 0;
                const isMaxed = pinnedExercises.length >= MAX_PINNED && !isPinned;
                return (
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.cardBorder,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isMaxed ? 0.4 : 1,
                    }}
                    onPress={() => {
                      if (isMaxed) return;
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onTogglePin(item);
                    }}
                  >
                    <Text style={{ fontSize: 14, color: colors.cardForeground, flex: 1 }} numberOfLines={1}>{item}</Text>
                    {isPinned && (
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: OVERLAY_COLORS[pinIdx] }} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Chart card */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: 12,
      }}>
        {/* Controls row: date range pills + normalize toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {STRENGTH_RANGE_LABELS.map(({ label, value }) => (
            <TouchableOpacity
              key={label}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: dateRange === value ? CHART_ACCENT : colors.background,
                borderWidth: 1,
                borderColor: dateRange === value ? CHART_ACCENT : colors.cardBorder,
              }}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDateRangeChange(value);
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: dateRange === value ? '#fff' : colors.cardMuted }}>{label}</Text>
            </TouchableOpacity>
          ))}
          </View>
          {/* Normalize toggle */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: normalized ? CHART_ACCENT + '22' : colors.background,
              borderWidth: 1,
              borderColor: normalized ? CHART_ACCENT : colors.cardBorder,
              marginLeft: 6,
              gap: 4,
            }}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setNormalized(v => !v);
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: normalized ? CHART_ACCENT : colors.cardMuted }}>%</Text>
          </TouchableOpacity>
        </View>

        {/* Loading state */}
        {loading && (
          <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={CHART_ACCENT} />
          </View>
        )}

        {/* Empty state — no exercises pinned */}
        {!loading && pinnedExercises.length === 0 && (
          <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ fontSize: 28 }}>📈</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.cardForeground }}>Pin up to 3 exercises</Text>
            <Text style={{ fontSize: 12, color: colors.cardMuted, textAlign: 'center' }}>
              Tap “+ Add exercise” to compare strength trends side by side
            </Text>
          </View>
        )}

        {/* Empty state — exercises pinned but no data */}
        {!loading && pinnedExercises.length > 0 && !hasData && (
          <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ fontSize: 28 }}>🏋️</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.cardForeground }}>Not enough data yet</Text>
            <Text style={{ fontSize: 12, color: colors.cardMuted, textAlign: 'center' }}>
              Complete at least 2 sessions to see the trend
            </Text>
          </View>
        )}

        {/* Multi-line chart */}
        {!loading && hasData && (
          <>
            <Svg width={CHART_W} height={CHART_H}>
              {/* Y-axis grid lines + labels */}
              {yTicks.map((tick, i) => (
                <React.Fragment key={i}>
                  <Line
                    x1={PAD_L}
                    y1={tick.y}
                    x2={CHART_W - PAD_R}
                    y2={tick.y}
                    stroke={colors.cardBorder}
                    strokeWidth={0.5}
                    strokeDasharray="3,3"
                  />
                  <SvgText
                    x={PAD_L - 4}
                    y={tick.y + 4}
                    fontSize={9}
                    fill={colors.cardMuted}
                    textAnchor="end"
                  >
                    {tick.label}
                  </SvgText>
                </React.Fragment>
              ))}

              {/* X-axis baseline */}
              <Line
                x1={PAD_L}
                y1={PAD_T + plotH}
                x2={CHART_W - PAD_R}
                y2={PAD_T + plotH}
                stroke={colors.cardBorder}
                strokeWidth={0.5}
              />

              {/* X-axis labels */}
              {xLabels.map((xl, i) => (
                <SvgText
                  key={i}
                  x={xl.x}
                  y={CHART_H - 4}
                  fontSize={9}
                  fill={colors.cardMuted}
                  textAnchor="middle"
                >
                  {xl.label}
                </SvgText>
              ))}

              {/* One line per pinned exercise */}
              {displaySeries.map((series, sIdx) => {
                const color = OVERLAY_COLORS[sIdx];
                const pts = series.data.length >= 2
                  ? series.data.map(p => `${toX(p.date)},${toY(p.e1rm)}`).join(' ')
                  : '';
                const prPoint = series.data.length > 0
                  ? series.data.reduce((best, p) => p.e1rm > best.e1rm ? p : best)
                  : null;
                return (
                  <React.Fragment key={series.name}>
                    {pts ? (
                      <Polyline
                        points={pts}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : null}
                    {series.data.map((p, i) => (
                      <Circle
                        key={i}
                        cx={toX(p.date)}
                        cy={toY(p.e1rm)}
                        r={series.data.length > 30 ? 2 : 3}
                        fill={prPoint && p.e1rm === prPoint.e1rm ? '#F59E0B' : color}
                        stroke={colors.surface}
                        strokeWidth={1}
                      />
                    ))}
                    {prPoint && (
                      <SvgText
                        x={toX(prPoint.date)}
                        y={toY(prPoint.e1rm) - 7}
                        fontSize={8}
                        fill="#F59E0B"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        PR
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Per-exercise stats row */}
            {filteredSeries.map((series, sIdx) => {
              const color = OVERLAY_COLORS[sIdx];
              const d = series.data;
              if (d.length < 2) return null;
              const best = d.reduce((b, p) => p.e1rm > b.e1rm ? p : b);
              const delta = d[d.length - 1].e1rm - d[0].e1rm;
              const deltaPercent = d[0].e1rm > 0 ? ((delta / d[0].e1rm) * 100) : 0;
              return (
                <View
                  key={series.name}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: sIdx === 0 ? 10 : 6,
                    paddingTop: sIdx === 0 ? 10 : 6,
                    borderTopWidth: sIdx === 0 ? 0.5 : 0,
                    borderTopColor: colors.cardBorder,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1.5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                    <Text style={{ fontSize: 11, color: colors.cardForeground, flex: 1 }} numberOfLines={1}>{series.name}</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>{`~${Math.round(best.e1rm)}kg`}</Text>
                    <Text style={{ fontSize: 9, color: colors.cardMuted }}>Best</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.cardForeground }}>{`~${Math.round(d[d.length - 1].e1rm)}kg`}</Text>
                    <Text style={{ fontSize: 9, color: colors.cardMuted }}>Now</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: delta >= 0 ? '#10B981' : '#EF4444' }}>
                      {delta >= 0 ? '+' : ''}{Math.round(deltaPercent)}%
                    </Text>
                    <Text style={{ fontSize: 9, color: colors.cardMuted }}>Gain</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </View>
  );
}

// ============================================================
// VOLUME HEATMAP — 12-week GitHub-style training calendar
// Each cell is colored by total volume lifted that day
// ============================================================
function VolumeHeatmap({
  data,
  colors,
}: {
  data: Record<string, number>;
  colors: ReturnType<typeof useColors>;
}) {
  const WEEKS = 12;
  const CELL = 20;
  const GAP = 3;
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Build grid: 12 columns (weeks) × 7 rows (Mon-Sun)
  const today = new Date();
  // Find the most recent Sunday as the end anchor
  const endDate = new Date(today);
  // Shift to end of current week (Sunday)
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  endDate.setDate(today.getDate() + (6 - dayOfWeek));

  const cells: { date: string; vol: number; col: number; row: number }[] = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - w * 7 - (6 - d));
      const key = date.toLocaleDateString('en-CA');
      const vol = data[key] ?? 0;
      cells.push({ date: key, vol, col: WEEKS - 1 - w, row: d });
    }
  }

  const maxVol = Math.max(...Object.values(data), 1);

  const getColor = (vol: number) => {
    if (vol === 0) return colors.surface;
    const intensity = vol / maxVol;
    if (intensity < 0.25) return '#1A3A1A';
    if (intensity < 0.5) return '#2D6A2D';
    if (intensity < 0.75) return '#5AAD5A';
    return '#C8F53C';
  };

  const totalWorkouts = Object.values(data).filter(v => v > 0).length;
  const totalVol = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <View className="px-6 mt-5">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.cardForeground }}>Training Volume — Last 12 Weeks</Text>
        <Text style={{ fontSize: 11, color: colors.cardMuted }}>{totalWorkouts} sessions</Text>
      </View>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: 14,
        }}
      >
        {/* Day labels */}
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <View style={{ width: 16 }} />
          {DAY_LABELS.map((l, i) => (
            <Text
              key={i}
              style={{
                width: CELL,
                marginRight: GAP,
                fontSize: 9,
                color: colors.cardMuted,
                textAlign: 'center',
              }}
            >
              {l}
            </Text>
          ))}
        </View>
        {/* Grid — columns = weeks, rows = days */}
        <View style={{ flexDirection: 'row' }}>
          {Array.from({ length: WEEKS }).map((_, col) => (
            <View key={col} style={{ marginRight: GAP }}>
              {Array.from({ length: 7 }).map((_, row) => {
                const cell = cells.find(c => c.col === col && c.row === row);
                return (
                  <View
                    key={row}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 4,
                      backgroundColor: cell ? getColor(cell.vol) : colors.surface,
                      marginBottom: GAP,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
        {/* Legend */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
          <Text style={{ fontSize: 9, color: colors.cardMuted, marginRight: 4 }}>Less</Text>
          {['#1A3A1A', '#2D6A2D', '#5AAD5A', '#C8F53C'].map((c, i) => (
            <View key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c }} />
          ))}
          <Text style={{ fontSize: 9, color: colors.cardMuted, marginLeft: 4 }}>More</Text>
        </View>
        {/* Summary row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#C8F53C' }}>{totalWorkouts}</Text>
            <Text style={{ fontSize: 10, color: colors.cardMuted }}>Sessions</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#C8F53C' }}>{(totalVol / 1000).toFixed(1)}t</Text>
            <Text style={{ fontSize: 10, color: colors.cardMuted }}>Total Volume</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#C8F53C' }}>
              {totalWorkouts > 0 ? Math.round(totalVol / totalWorkouts / 1000 * 10) / 10 : 0}t
            </Text>
            <Text style={{ fontSize: 10, color: colors.cardMuted }}>Avg/Session</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---- Muscle Group Volume Heatmap ----
const INTENSITY_COLORS: Record<IntensityLevel, string> = {
  none: '#1A1D1A',
  low: '#1A3A1A',
  moderate: '#2D6A2D',
  high: '#5AAD5A',
  overtrained: '#C8F53C',
};
const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  none: 'None',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  overtrained: 'Peak',
};

// Body region layout — each entry maps to a muscle group
const BODY_REGIONS: { group: MuscleGroup; label: string; row: number; col: number }[] = [
  { group: 'Shoulders', label: 'Shoulders', row: 0, col: 1 },
  { group: 'Chest',     label: 'Chest',     row: 1, col: 0 },
  { group: 'Biceps',    label: 'Biceps',    row: 1, col: 2 },
  { group: 'Core',      label: 'Core',      row: 2, col: 1 },
  { group: 'Triceps',   label: 'Triceps',   row: 2, col: 2 },
  { group: 'Back',      label: 'Back',      row: 2, col: 0 },
  { group: 'Quads',     label: 'Quads',     row: 3, col: 0 },
  { group: 'Glutes',    label: 'Glutes',    row: 3, col: 1 },
  { group: 'Hamstrings',label: 'Hams',      row: 3, col: 2 },
  { group: 'Calves',    label: 'Calves',    row: 4, col: 1 },
];

function MuscleGroupHeatmap({
  heatmap,
  days,
  onChangeDays,
  colors,
}: {
  heatmap: MuscleHeatmap | null;
  days: 7 | 14 | 30;
  onChangeDays: (d: 7 | 14 | 30) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const CELL_SIZE = 90;
  const CELL_GAP = 8;
  const COLS = 3;
  const ROWS = 5;

  return (
    <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: 16,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.cardForeground }}>Muscle Volume Map</Text>
            <Text style={{ fontSize: 11, color: colors.cardMuted, marginTop: 2 }}>Sets per muscle group</Text>
          </View>
          {/* Day range toggle */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([7, 14, 30] as const).map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => onChangeDays(d)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: days === d ? '#C8F53C' : colors.background,
                  borderWidth: 1,
                  borderColor: days === d ? '#C8F53C' : colors.cardBorder,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: days === d ? '#000' : colors.cardMuted }}>
                  {d}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Grid */}
        {heatmap ? (
          <View style={{ gap: CELL_GAP }}>
            {Array.from({ length: ROWS }).map((_, row) => (
              <View key={row} style={{ flexDirection: 'row', gap: CELL_GAP }}>
                {Array.from({ length: COLS }).map((_, col) => {
                  const region = BODY_REGIONS.find(r => r.row === row && r.col === col);
                  if (!region) {
                    return <View key={col} style={{ flex: 1, height: 64 }} />;
                  }
                  const entry = heatmap[region.group];
                  const bgColor = INTENSITY_COLORS[entry.intensity];
                  const textColor = entry.intensity === 'none' ? colors.cardMuted : entry.intensity === 'overtrained' ? '#000' : '#E2E8F0';
                  return (
                    <View
                      key={col}
                      style={{
                        flex: 1,
                        height: 64,
                        borderRadius: 12,
                        backgroundColor: bgColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: entry.intensity === 'none' ? colors.cardBorder : bgColor,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: textColor }}>{region.label}</Text>
                      <Text style={{ fontSize: 10, color: textColor, opacity: 0.8, marginTop: 2 }}>
                        {Math.round(entry.sets)} sets
                      </Text>
                      <Text style={{ fontSize: 9, color: textColor, opacity: 0.6, marginTop: 1 }}>
                        {INTENSITY_LABELS[entry.intensity]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ color: colors.cardMuted, fontSize: 13 }}>No workout data yet</Text>
          </View>
        )}

        {/* Legend */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          {(Object.entries(INTENSITY_COLORS) as [IntensityLevel, string][]).map(([level, color]) => (
            <View key={level} style={{ alignItems: 'center', gap: 3 }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: color, borderWidth: 1, borderColor: colors.cardBorder }} />
              <Text style={{ fontSize: 8, color: colors.cardMuted }}>{INTENSITY_LABELS[level]}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
