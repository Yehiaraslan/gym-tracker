// ============================================================
// HOME SCREEN — Phy-style dark card dashboard
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getTodaySession,
  getSessionForDate,
  SESSION_NAMES,
  SESSION_COLORS,
  getMesocycleInfo,
  type SessionType,
} from '@/lib/training-program';
import {
  getRecentSplitWorkouts,
  type SplitWorkoutSession,
} from '@/lib/split-workout-store';
import { getMesocycleStartDate } from '@/lib/coach-engine';
import { getStreakData, type StreakData } from '@/lib/streak-tracker';
import { getTodayRecovery, type WhoopRecovery } from '@/lib/whoop-api';
import { getDailyNutrition, type DailyNutrition } from '@/lib/nutrition-store';
import { useGym } from '@/lib/gym-context';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DOT_COLORS: Record<SessionType, string> = {
  'upper-a': '#3B82F6',
  'lower-a': '#8B5CF6',
  'upper-b': '#06B6D4',
  'lower-b': '#10B981',
  rest: '#374151',
};

const SESSION_EMOJI: Record<SessionType, string> = {
  'upper-a': '💪',
  'lower-a': '🦵',
  'upper-b': '🏋️',
  'lower-b': '🔥',
  rest: '😴',
};

const SESSION_SUBTITLE: Record<SessionType, string> = {
  'upper-a': 'Chest · Back · Shoulders · Arms',
  'lower-a': 'Quads · Hamstrings · Glutes · Calves',
  'upper-b': 'Volume push/pull — hypertrophy focus',
  'lower-b': 'Volume legs — hypertrophy focus',
  rest: 'Recovery is where gains are made',
};

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { store } = useGym();

  const todaySession = getTodaySession();
  const isRest = todaySession === 'rest';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [streak, setStreak] = useState<StreakData | null>(null);
  const [meso, setMeso] = useState<{ daysUntilDeload: number; currentWeek: number; totalWeeks: number } | null>(null);
  const [recovery, setRecovery] = useState<WhoopRecovery | null>(null);
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);

  // Build this week's 7-day strip
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    const dayOfWeek = today.getDay();
    d.setDate(today.getDate() - dayOfWeek + i);
    return {
      date: d,
      label: DAY_LABELS[i],
      session: getSessionForDate(d),
      isToday: d.toISOString().split('T')[0] === todayStr,
    };
  });

  // Weekly weight average
  const recentWeights = [...store.weightEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);
  const avgWeight = recentWeights.length > 0
    ? (recentWeights.reduce((s, e) => s + e.weight, 0) / recentWeights.length).toFixed(1)
    : null;

  // Last night sleep
  const lastSleep = [...store.sleepEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const loadData = useCallback(async () => {
    try {
      const [streakData, startDate, recoveryData, nutritionData, workouts] = await Promise.all([
        getStreakData(),
        getMesocycleStartDate(),
        getTodayRecovery().catch(() => null),
        getDailyNutrition().catch(() => null),
        getRecentSplitWorkouts(7),
      ]);
      setStreak(streakData);
      const mesoInfo = getMesocycleInfo(startDate);
      setMeso({
        daysUntilDeload: mesoInfo.daysUntilDeload,
        currentWeek: mesoInfo.currentWeek,
        totalWeeks: mesoInfo.totalWeeks,
      });
      setRecovery(recoveryData);
      setNutrition(nutritionData);
      setRecentWorkouts(workouts);
    } catch (_) {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStartWorkout = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/split-workout', params: { sessionType: todaySession, date: todayStr } } as any);
  };

  const recoveryScore = recovery?.score?.recoveryScore ?? null;
  const recoveryColor = recoveryScore == null ? colors.muted
    : recoveryScore >= 67 ? '#22C55E'
    : recoveryScore >= 34 ? '#F59E0B'
    : '#EF4444';
  const hrv = recovery?.score?.hrv?.lastNightAverage ?? null;
  const rhr = recovery?.score?.rhrData?.lastNightAverage ?? null;

  const calConsumed = nutrition ? nutrition.meals.reduce((s, m) => s + m.calories, 0) : 0;
  const protConsumed = nutrition ? nutrition.meals.reduce((s, m) => s + m.protein, 0) : 0;
  const calTarget = nutrition?.targetCalories ?? 2750;
  const protTarget = nutrition?.targetProtein ?? 180;

  const bg = colors.background;
  const surf = colors.surface;
  const bord = colors.border;
  const fg = colors.foreground;
  const mut = colors.muted;
  const pri = colors.primary;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
      >
        {/* ── Header ── */}
        <View style={[s.row, { marginBottom: 16 }]}>
          <Text style={[s.headerName, { color: fg }]}>Yehia</Text>
          <TouchableOpacity
            style={[s.exportBtn, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/weekly-report' as any)}
          >
            <Text style={[s.exportText, { color: mut }]}>↓ Export</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero Card ── */}
        <TouchableOpacity
          activeOpacity={isRest ? 1 : 0.85}
          onPress={isRest ? undefined : handleStartWorkout}
          style={[s.heroCard, { backgroundColor: surf, borderColor: bord }]}
        >
          <View style={s.heroRow}>
            <Text style={s.heroEmoji}>{SESSION_EMOJI[todaySession]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { color: fg }]}>{SESSION_NAMES[todaySession]}</Text>
              <Text style={[s.heroSub, { color: mut }]}>{SESSION_SUBTITLE[todaySession]}</Text>
            </View>
          </View>
          {!isRest && (
            <View style={[s.startBtn, { backgroundColor: SESSION_COLORS[todaySession] }]}>
              <Text style={s.startBtnText}>Start Workout →</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Weekly Dot Strip ── */}
        <View style={[s.card, { backgroundColor: surf, borderColor: bord }]}>
          <View style={s.weekRow}>
            {weekDays.map((day, i) => {
              const isCompleted = recentWorkouts.some(w => w.date === day.date.toISOString().split('T')[0] && w.completed);
              const isTraining = day.session !== 'rest';
              return (
                <TouchableOpacity
                  key={i}
                  style={s.dayCol}
                  onPress={() => {
                    const d = day.date.toISOString().split('T')[0];
                    if (isTraining) {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: '/split-workout', params: { sessionType: day.session, date: d } } as any);
                    }
                  }}
                >
                  <Text style={[s.dayLabel, { color: day.isToday ? fg : mut, fontWeight: day.isToday ? '700' : '400' }]}>
                    {day.label}
                  </Text>
                  <View style={[
                    s.dayDot,
                    {
                      backgroundColor: isTraining ? DOT_COLORS[day.session] : 'transparent',
                      borderWidth: day.isToday ? 2 : 0,
                      borderColor: day.isToday ? fg : 'transparent',
                      opacity: isTraining ? 1 : 0.3,
                    },
                  ]} />
                  {isCompleted && (
                    <View style={[s.checkDot, { backgroundColor: '#22C55E' }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 2×2 Metric Grid ── */}
        <View style={s.grid}>
          {/* Weight Avg */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/body-measurements' as any)}
          >
            <View style={[s.metricIcon, { backgroundColor: '#3B82F620' }]}>
              <Text style={s.metricIconText}>⚖️</Text>
            </View>
            <Text style={[s.metricChevron, { color: mut }]}>›</Text>
            <Text style={[s.metricLabel, { color: mut }]}>Weekly Weight Avg</Text>
            <View style={s.metricValueRow}>
              {avgWeight
                ? <Text style={[s.metricValue, { color: fg }]}>{avgWeight}</Text>
                : <View style={[s.metricDash, { backgroundColor: pri }]} />}
              <Text style={[s.metricUnit, { color: mut }]}> kg</Text>
            </View>
            <Text style={[s.metricSub, { color: mut }]}>7-day rolling average</Text>
          </TouchableOpacity>

          {/* Sleep */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/(tabs)/sleep' as any)}
          >
            <View style={[s.metricIcon, { backgroundColor: '#8B5CF620' }]}>
              <Text style={s.metricIconText}>🌙</Text>
            </View>
            <Text style={[s.metricChevron, { color: mut }]}>›</Text>
            <Text style={[s.metricLabel, { color: mut }]}>Last Night's Sleep</Text>
            <View style={s.metricValueRow}>
              {lastSleep
                ? <Text style={[s.metricValue, { color: fg }]}>{lastSleep.durationHours.toFixed(1)}</Text>
                : <View style={[s.metricDash, { backgroundColor: pri }]} />}
              <Text style={[s.metricUnit, { color: mut }]}> hrs</Text>
            </View>
            <Text style={[s.metricSub, { color: mut }]}>
              {lastSleep ? `Quality: ${['', 'Terrible', 'Poor', 'Fair', 'Good', 'Excellent'][lastSleep.qualityRating]}` : 'Not logged'}
            </Text>
          </TouchableOpacity>

          {/* Streak */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/(tabs)/analytics' as any)}
          >
            <View style={[s.metricIcon, { backgroundColor: '#F59E0B20' }]}>
              <Text style={s.metricIconText}>🔥</Text>
            </View>
            <Text style={[s.metricChevron, { color: mut }]}>›</Text>
            <Text style={[s.metricLabel, { color: mut }]}>Workout Streak</Text>
            <View style={s.metricValueRow}>
              <Text style={[s.metricValueLg, { color: pri }]}>{streak?.currentStreak ?? 0}</Text>
              <Text style={[s.metricUnit, { color: mut }]}> days</Text>
            </View>
            <Text style={[s.metricSub, { color: mut }]}>
              {streak?.currentStreak ? `Best: ${streak.bestStreak}d` : 'Start your streak'}
            </Text>
          </TouchableOpacity>

          {/* Days to Deload */}
          <View style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}>
            <View style={[s.metricIcon, { backgroundColor: '#06B6D420' }]}>
              <Text style={s.metricIconText}>📅</Text>
            </View>
            <Text style={[s.metricLabel, { color: mut }]}>Days to Deload</Text>
            <View style={s.metricValueRow}>
              <Text style={[s.metricValueLg, { color: pri }]}>{meso?.daysUntilDeload ?? '—'}</Text>
              <Text style={[s.metricUnit, { color: mut }]}> days</Text>
            </View>
            <Text style={[s.metricSub, { color: mut }]}>
              {meso ? `Week ${meso.currentWeek}/${meso.totalWeeks}` : 'Loading...'}
            </Text>
          </View>
        </View>

        {/* ── Nutrition Summary ── */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: surf, borderColor: bord }]}
          onPress={() => router.push('/(tabs)/nutrition' as any)}
        >
          <View style={s.row}>
            <Text style={[s.sectionLabel, { color: mut }]}>TODAY'S NUTRITION</Text>
            <Text style={[s.link, { color: pri }]}>Today →</Text>
          </View>
          <View style={[s.row, { marginTop: 12, marginBottom: 4 }]}>
            <Text style={[s.macroLabel, { color: fg }]}>Calories</Text>
            <Text style={[s.macroValue, { color: '#F59E0B' }]}>{calConsumed}/{calTarget}kcal</Text>
          </View>
          <View style={[s.progressBar, { backgroundColor: bord }]}>
            <View style={[s.progressFill, { backgroundColor: '#F59E0B', width: `${Math.min((calConsumed / calTarget) * 100, 100)}%` as any }]} />
          </View>
          <View style={[s.row, { marginTop: 8, marginBottom: 4 }]}>
            <Text style={[s.macroLabel, { color: fg }]}>Protein</Text>
            <Text style={[s.macroValue, { color: '#3B82F6' }]}>{protConsumed}/{protTarget}g</Text>
          </View>
          <View style={[s.progressBar, { backgroundColor: bord }]}>
            <View style={[s.progressFill, { backgroundColor: '#3B82F6', width: `${Math.min((protConsumed / protTarget) * 100, 100)}%` as any }]} />
          </View>
        </TouchableOpacity>

        {/* ── WHOOP Recovery ── */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: surf, borderColor: recoveryScore != null ? recoveryColor + '50' : bord, borderWidth: 1 }]}
          onPress={() => router.push('/(tabs)/whoop' as any)}
        >
          <View style={s.row}>
            <View style={s.row}>
              <Text style={[s.whoopIcon, { color: recoveryColor }]}>♥︎ </Text>
              <Text style={[s.sectionLabel, { color: recoveryColor }]}>WHOOP RECOVERY</Text>
            </View>
            <Text style={[s.link, { color: mut }]}>›</Text>
          </View>
          <View style={[s.row, { marginTop: 12, alignItems: 'flex-end' }]}>
            <View>
              <Text style={[s.whoopScore, { color: recoveryColor }]}>
                {recoveryScore != null ? `${recoveryScore}%` : '—'}
              </Text>
              <Text style={[s.whoopStatus, { color: mut }]}>
                {recoveryScore == null ? 'Not connected'
                  : recoveryScore >= 67 ? 'Green — Train hard'
                  : recoveryScore >= 34 ? 'Yellow — Moderate'
                  : 'Red — Rest'}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.metricSub, { color: mut }]}>⚡ HRV</Text>
                <Text style={[s.whoopMetricVal, { color: fg }]}>{hrv != null ? `${Math.round(hrv)}ms` : '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.metricSub, { color: mut }]}>♥ RHR</Text>
                <Text style={[s.whoopMetricVal, { color: fg }]}>{rhr != null ? `${Math.round(rhr)}bpm` : '—'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerName: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  exportBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  exportText: { fontSize: 13, fontWeight: '500' },

  heroCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heroEmoji: { fontSize: 36, marginRight: 12 },
  heroTitle: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  heroSub: { fontSize: 13, lineHeight: 18 },
  startBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  startBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 12 },
  dayDot: { width: 9, height: 9, borderRadius: 5 },
  checkDot: { width: 4, height: 4, borderRadius: 2, marginTop: -2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metricCard: { width: '48%', borderRadius: 16, borderWidth: 1, padding: 14, position: 'relative' },
  metricIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  metricIconText: { fontSize: 18 },
  metricChevron: { position: 'absolute', top: 14, right: 14, fontSize: 18 },
  metricLabel: { fontSize: 12, marginBottom: 4 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  metricValue: { fontSize: 20, fontWeight: '700' },
  metricValueLg: { fontSize: 28, fontWeight: '700' },
  metricUnit: { fontSize: 13 },
  metricDash: { width: 20, height: 3, borderRadius: 2, marginBottom: 4 },
  metricSub: { fontSize: 11, marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  link: { fontSize: 13, fontWeight: '600' },
  macroLabel: { fontSize: 14 },
  macroValue: { fontSize: 14, fontWeight: '600' },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },

  whoopIcon: { fontSize: 14, fontWeight: '700' },
  whoopScore: { fontSize: 40, fontWeight: '800', lineHeight: 44 },
  whoopStatus: { fontSize: 13, marginTop: 2 },
  whoopMetricVal: { fontSize: 16, fontWeight: '700' },
});
