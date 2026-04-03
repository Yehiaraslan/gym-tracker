// ============================================================
// HOME SCREEN — Phy-style dark card dashboard
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View, TouchableOpacity, ScrollView, Platform, StyleSheet, Image, Modal, Dimensions, RefreshControl, TextInput, FlatList } from 'react-native';
import { loadUserProfile, type UserProfile } from '@/lib/profile-store';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getTodaySession,
  getSessionForDate,
  SESSION_NAMES,
  SESSION_COLORS,
  getMesocycleInfo,
  getMissedSessions,
  PROGRAM_SESSIONS,
  type SessionType,
} from '@/lib/training-program';
import { loadCustomProgram, getProgramProgress, suggestNextProgram, type CustomProgram } from '@/lib/custom-program-store';
import {
  getTodaySessionFromSchedule,
  getWeekScheduleFromStore,
  getActiveSchedule,
} from '@/lib/schedule-store';
import {
  getRecentSplitWorkouts,
  type SplitWorkoutSession,
} from '@/lib/split-workout-store';
import { getMesocycleStartDate } from '@/lib/coach-engine';
import { getStreakData, type StreakData } from '@/lib/streak-tracker';
import { getDailyNutrition, type DailyNutrition } from '@/lib/nutrition-store';
import { useGym } from '@/lib/gym-context';
import { WhoopReconnectBanner } from '@/components/whoop-reconnect-banner';
import { loadPinSyncState, type PinSyncState } from '@/lib/pin-sync-store';
import { trpc } from '@/lib/trpc';
import { getDeviceId } from '@/lib/device-id';
import { useAuth } from '@/hooks/use-auth';
import { hasResumableWorkout, type ActiveWorkoutState } from '@/lib/active-workout-store';
import {
  getAllPRs,
  getTrackedExerciseNames,
  getVolumeHistory,
  getDeloadWeekDates,
} from '@/lib/split-workout-store';
import {
  getTodayRecoveryData,
  getWeeklyRecoveryData,
  getRecoveryTrend,
  getWeeklyAverageRecovery,
  type RecoveryData,
  type WeeklyRecoveryData,
} from '@/lib/whoop-recovery-service';
import { getRecentNutrition, getMacroTotals } from '@/lib/nutrition-store';
import { getActiveRecommendations, type CoachRecommendation } from '@/lib/coach-engine';
import { getWorkoutsInLastDays } from '@/lib/streak-tracker';
import { NUTRITION_TARGETS } from '@/lib/training-program';
import Svg, { Polyline, Line, Circle, Text as SvgText, Path, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
const SCREEN_WIDTH = Dimensions.get('window').width;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Default lookup tables for the hardcoded Upper/Lower split
const DEFAULT_DOT_COLORS: Record<string, string> = {
  'upper-a': '#3B82F6',
  'lower-a': '#8B5CF6',
  'upper-b': '#06B6D4',
  'lower-b': '#10B981',
  rest: '#374151',
};

const DEFAULT_SESSION_EMOJI: Record<string, string> = {
  'upper-a': '💪',
  'lower-a': '🦵',
  'upper-b': '🏋️',
  'lower-b': '🔥',
  rest: '😴',
};

const DEFAULT_SESSION_SUBTITLE: Record<string, string> = {
  'upper-a': 'Chest · Back · Shoulders · Arms',
  'lower-a': 'Quads · Hamstrings · Glutes · Calves',
  'upper-b': 'Volume push/pull — hypertrophy focus',
  'lower-b': 'Volume legs — hypertrophy focus',
  rest: 'Recovery is where gains are made',
};

// Auto-assign emoji based on session name keywords
function guessSessionEmoji(sessionId: string, sessionName?: string): string {
  const lower = (sessionName || sessionId).toLowerCase();
  if (lower.includes('push')) return '💪';
  if (lower.includes('pull')) return '🦶';
  if (lower.includes('leg')) return '🦵';
  if (lower.includes('upper')) return '🏋️';
  if (lower.includes('lower')) return '🔥';
  if (lower.includes('full') || lower.includes('body')) return '💪';
  if (lower.includes('circuit')) return '⚡';
  if (lower.includes('home')) return '🏠';
  if (lower.includes('rest')) return '😴';
  return '🏋️';
}

// Auto-generate subtitle from exercises in a session
function guessSessionSubtitle(sessionId: string, program: CustomProgram | null): string {
  if (sessionId === 'rest') return 'Recovery is where gains are made';
  if (!program?.sessions?.[sessionId]) return '';
  const exercises = program.sessions[sessionId];
  const bodyParts = [...new Set(exercises.map(e => e.bodyPart).filter(Boolean))];
  return bodyParts.slice(0, 4).join(' \u00b7 ') || `${exercises.length} exercises`;
}

// Color pool for custom sessions that don't have a preset color
const COLOR_POOL = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { store } = useGym();
  const { user: authUser } = useAuth();

  // Async schedule: loads override from AsyncStorage on focus, falls back to default.
  // Initial state is 'rest' until the async loadSchedule() resolves with the real value
  // (which reads Zaki's schedule override from AsyncStorage).
  const [todaySession, setTodaySession] = useState<SessionType>('rest');
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [scheduleWeek, setScheduleWeek] = useState<{ date: Date; session: SessionType; dayName: string }[] | null>(null);
  const isRest = todaySession === 'rest';
  const today = new Date();
  // Use local date string to avoid UTC offset issues (e.g., Dubai UTC+4 at 2am shows wrong day with ISO)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [streak, setStreak] = useState<StreakData | null>(null);
  const [meso, setMeso] = useState<{ daysUntilDeload: number; currentWeek: number; totalWeeks: number } | null>(null);
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [missedSessions, setMissedSessions] = useState<Array<{ date: string; sessionType: SessionType; sessionName: string; daysAgo: number }>>([]);
  const [dismissedMakeup, setDismissedMakeup] = useState<Set<string>>(new Set());
  const [previewDay, setPreviewDay] = useState<{ date: string; session: SessionType; label: string } | null>(null);
  const [syncState, setSyncState] = useState<PinSyncState | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [resumableWorkout, setResumableWorkout] = useState<ActiveWorkoutState | null>(null);

  // Progress tab data merged into Home
  const [prs, setPrs] = useState<Record<string, { e1rm: number; weight: number; reps: number; date: string }>>({});
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [weeklyRecovery, setWeeklyRecovery] = useState<WeeklyRecoveryData[]>([]);
  const [recentNutrition, setRecentNutrition] = useState<DailyNutrition[]>([]);
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Custom program state — loaded on focus, used for dynamic display names/colors
  const [customProgram, setCustomProgram] = useState<CustomProgram | null>(null);

  // Load deviceId once on mount
  useEffect(() => { getDeviceId().then(setDeviceId); }, []);

  // WHOOP data via tRPC server (v2 API — snake_case fields)
  const whoopStatusQ = trpc.whoop.status.useQuery(
    { deviceId: deviceId! },
    { enabled: !!deviceId, staleTime: 60_000, retry: 1 }
  );
  const whoopConnected = whoopStatusQ.data?.connected ?? false;
  const whoopRecoveryQ = trpc.whoop.recovery.useQuery(
    { deviceId: deviceId!, days: 7 },
    { enabled: !!deviceId && whoopConnected, staleTime: 60_000, retry: 1 }
  );
  const whoopSleepQ = trpc.whoop.sleep.useQuery(
    { deviceId: deviceId!, days: 7 },
    { enabled: !!deviceId && whoopConnected, staleTime: 60_000, retry: 1 }
  );

  // Build this week's 7-day strip (uses schedule override if set, else default)
  const weekDays = (scheduleWeek ?? Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    return { date: d, session: getSessionForDate(d), dayName: DAY_LABELS[i] };
  })).map((day, i) => ({
    date: day.date,
    label: DAY_LABELS[i],
    session: day.session,
    isToday: `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}` === todayStr,
  }));

  // Weekly weight average
  const recentWeights = [...store.weightEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);
  const avgWeight = recentWeights.length > 0
    ? (recentWeights.reduce((s, e) => s + e.weight, 0) / recentWeights.length).toFixed(1)
    : null;

  // Last night sleep (local log)
  const lastSleep = [...store.sleepEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const loadSchedule = useCallback(async () => {
    try {
      const [session, week] = await Promise.all([
        getTodaySessionFromSchedule(),
        getWeekScheduleFromStore(new Date()),
      ]);
      setTodaySession(session);
      setScheduleWeek(week);
    } catch (_) {} finally {
      setScheduleLoaded(true);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [streakData, startDate, nutritionData, workouts, prData, rec, weekRec, nutri7, recs, weekCount, resumable] = await Promise.all([
        getStreakData(),
        getMesocycleStartDate(),
        getDailyNutrition().catch(() => null),
        getRecentSplitWorkouts(10),
        getAllPRs(),
        getTodayRecoveryData().catch(() => null),
        getWeeklyRecoveryData().catch(() => []),
        getRecentNutrition(7).catch(() => []),
        getActiveRecommendations().catch(() => []),
        getWorkoutsInLastDays(7).catch(() => 0),
        hasResumableWorkout(),
      ]);
      setStreak(streakData);
      const mesoInfo = getMesocycleInfo(startDate);
      setMeso({
        daysUntilDeload: mesoInfo.daysUntilDeload,
        currentWeek: mesoInfo.currentWeek,
        totalWeeks: mesoInfo.totalWeeks,
      });
      setNutrition(nutritionData);
      setRecentWorkouts(workouts);
      setPrs(prData);
      setRecovery(rec);
      setWeeklyRecovery(weekRec);
      setRecentNutrition(nutri7);
      setRecommendations(recs);
      setWorkoutsThisWeek(weekCount);
      setResumableWorkout(resumable);
      // Detect missed sessions in the last 7 days (using Zaki's schedule override if set)
      const completedDates = workouts.filter(w => w.completed).map(w => w.date);
      const activeSchedule = await getActiveSchedule();
      const missed = getMissedSessions(completedDates, 7, activeSchedule as Record<string, SessionType>);
      setMissedSessions(missed);
    } catch (_) {}
    setRefreshing(false);
  }, []);

  // Reload every time the tab comes into focus so nutrition/workout data is always fresh
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadSchedule();
      loadUserProfile().then(setUserProfile);
      loadPinSyncState().then(setSyncState);
      loadCustomProgram().then(setCustomProgram);
    }, [loadData, loadSchedule])
  );

  // ── Dynamic lookups that adapt to custom programs ──
  const getColor = (sessionId: string): string => {
    if (sessionId === 'rest') return DEFAULT_DOT_COLORS.rest;
    // Check custom program colors first
    if (customProgram?.sessionColors?.[sessionId]) return customProgram.sessionColors[sessionId];
    // Fall back to defaults
    if (DEFAULT_DOT_COLORS[sessionId]) return DEFAULT_DOT_COLORS[sessionId];
    // Auto-assign from color pool based on session index
    const sessionKeys = customProgram ? Object.keys(customProgram.sessionNames) : [];
    const idx = sessionKeys.indexOf(sessionId);
    return COLOR_POOL[idx >= 0 ? idx % COLOR_POOL.length : 0];
  };

  const getName = (sessionId: string): string => {
    if (sessionId === 'rest') return 'Rest Day';
    if (customProgram?.sessionNames?.[sessionId]) return customProgram.sessionNames[sessionId];
    return SESSION_NAMES[sessionId as keyof typeof SESSION_NAMES] || sessionId;
  };

  const getEmoji = (sessionId: string): string => {
    if (DEFAULT_SESSION_EMOJI[sessionId]) return DEFAULT_SESSION_EMOJI[sessionId];
    return guessSessionEmoji(sessionId, customProgram?.sessionNames?.[sessionId]);
  };

  const getSubtitle = (sessionId: string): string => {
    if (DEFAULT_SESSION_SUBTITLE[sessionId]) return DEFAULT_SESSION_SUBTITLE[sessionId];
    return guessSessionSubtitle(sessionId, customProgram);
  };

  const handleStartWorkout = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/split-workout', params: { sessionType: todaySession, date: todayStr } } as any);
  };

  // Check if today's workout is already completed
  const todayDone = !isRest && recentWorkouts.some(w => w.date === todayStr && w.completed);

  // WHOOP v2 API: snake_case fields (recovery_score, hrv_rmssd_milli, resting_heart_rate)
  const latestRecoveryRecord = (whoopRecoveryQ.data?.records as any[])?.find(
    (r: any) => r.score_state === 'SCORED' && r.score != null
  );
  const recoveryScore: number | null = latestRecoveryRecord?.score?.recovery_score != null
    ? Math.round(latestRecoveryRecord.score.recovery_score) : null;
  const hrv: number | null = latestRecoveryRecord?.score?.hrv_rmssd_milli != null
    ? Math.round(latestRecoveryRecord.score.hrv_rmssd_milli) : null;
  const rhr: number | null = latestRecoveryRecord?.score?.resting_heart_rate != null
    ? Math.round(latestRecoveryRecord.score.resting_heart_rate) : null;
  const recoveryColor = recoveryScore == null ? colors.muted
    : recoveryScore >= 67 ? '#22C55E'
    : recoveryScore >= 34 ? '#F59E0B'
    : '#EF4444';

  // WHOOP sleep data from sleep endpoint (v2)
  const latestSleepRecord = (whoopSleepQ.data?.records as any[])?.find(
    (r: any) => r.nap === false && r.score_state === 'SCORED' && r.score != null
  );
  const whoopSleepHrs: number | null = latestSleepRecord?.score?.stage_summary != null
    ? Math.round((
        (latestSleepRecord.score.stage_summary.total_light_sleep_time_milli ?? 0)
        + (latestSleepRecord.score.stage_summary.total_slow_wave_sleep_time_milli ?? 0)
        + (latestSleepRecord.score.stage_summary.total_rem_sleep_time_milli ?? 0)
      ) / 3_600_000 * 10) / 10
    : null;
  const whoopSleepQuality: number | null = latestSleepRecord?.score?.sleep_performance_percentage ?? null;

  // Low recovery warning: show when WHOOP recovery < 33%, workout not done, not a rest day
  const showLowRecoveryWarning = recoveryScore != null && recoveryScore < 33 && !todayDone && !isRest;

  const calConsumed = nutrition ? nutrition.meals.reduce((s, m) => s + m.calories, 0) : 0;
  const protConsumed = nutrition ? nutrition.meals.reduce((s, m) => s + m.protein, 0) : 0;
  const calTarget = nutrition?.targetCalories ?? 2750;
  const protTarget = nutrition?.targetProtein ?? 180;

  const bg = colors.background;
  const surf = colors.surface;
  const bord = (colors as any).cardBorder ?? colors.border;
  const fg = (colors as any).cardForeground ?? colors.foreground;   // dark text inside white cards
  const mut = (colors as any).cardMuted ?? colors.muted;             // grey secondary inside white cards
  const screenFg = colors.foreground;                                // white text on navy background
  const screenMut = colors.muted;                                    // soft blue-white on navy
  const pri = colors.primary;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); loadSchedule(); }} tintColor={pri} />}
      >
        {/* ── WHOOP Reconnect Banner (shown when token expired) ── */}
        <WhoopReconnectBanner />
        {/* ── Profile Completeness Nudge ── */}
        {userProfile && (!userProfile.name || !userProfile.dateOfBirth || !userProfile.heightCm || !userProfile.weightKg || !userProfile.fitnessGoal) && (
          <TouchableOpacity
            style={[s.warningBanner, { backgroundColor: '#3B82F615', borderColor: '#3B82F6', marginBottom: 8 }]}
            onPress={() => router.push('/profile' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.warningIcon}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { color: '#3B82F6' }]}>Complete your profile</Text>
              <Text style={[s.warningSub, { color: screenMut }]}>Zaki needs your height, weight & goal for personalised coaching</Text>
            </View>
            <Text style={{ color: '#3B82F6', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}
        {/* ── Header with gradient backdrop ── */}
        <View style={{ marginHorizontal: -16, marginTop: -8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, marginBottom: 8 }}>
          <Svg width={SCREEN_WIDTH} height={100} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <SvgGradient id="headerGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.12" />
                <Stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
              </SvgGradient>
            </Defs>
            <Rect x="0" y="0" width={SCREEN_WIDTH} height={100} fill="url(#headerGrad)" />
          </Svg>
          <View style={[s.row, { alignItems: 'center' }]}>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} activeOpacity={0.85} style={s.avatarBtn}>
            {userProfile?.profilePhotoUri ? (
              <Image source={{ uri: userProfile.profilePhotoUri }} style={[s.avatarImg, { borderColor: pri }]} />
            ) : (
              <View style={[s.avatarPlaceholder, { backgroundColor: surf, borderColor: bord }]}>
                <Text style={s.avatarEmoji}>👤</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.headerName, { color: screenFg }]}>{authUser?.name || userProfile?.name || 'Athlete'}</Text>
            {userProfile?.fitnessGoal ? (
              <Text style={{ color: screenMut, fontSize: 12, textTransform: 'capitalize' }}>{userProfile.fitnessGoal.replace('_', ' ')}</Text>
            ) : null}
          </View>
          {/* Sync status pill */}
          <TouchableOpacity
            style={[s.syncPill, {
              backgroundColor: syncState?.linked ? '#22C55E15' : surf,
              borderColor: syncState?.linked ? '#22C55E40' : bord,
              marginRight: 6,
            }]}
            onPress={() => router.push('/pin-sync' as any)}
            activeOpacity={0.7}
          >
            <View style={[s.syncDotSmall, { backgroundColor: syncState?.linked ? '#22C55E' : '#94A3B8' }]} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/progress-pictures' as any)}
          >
            <Text style={{ fontSize: 16 }}>📸</Text>
          </TouchableOpacity>
          </View>
        </View>

        {/* ── Missed Session Banner (only last missed) ── */}
        {(() => {
          const visible = missedSessions.filter(m => !dismissedMakeup.has(m.date));
          if (visible.length === 0) return null;
          const last = visible[0]; // most recent missed
          return (
            <View style={[s.warningBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B', marginBottom: 8 }]}>
              <Text style={s.warningIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.warningTitle, { color: '#F59E0B' }]}>
                  Missed: {last.sessionName} ({last.daysAgo === 1 ? 'yesterday' : `${last.daysAgo} days ago`})
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/split-workout', params: { sessionType: last.sessionType, date: last.date } } as any);
                  }}
                >
                  <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                    Make it up today →
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {
                  // Dismiss all missed sessions at once
                  const allDates = new Set(visible.map(m => m.date));
                  setDismissedMakeup(prev => new Set([...prev, ...allDates]));
                }}
                style={{ padding: 4 }}
              >
                <Text style={{ color: screenMut, fontSize: 11 }}>{visible.length > 1 ? `Dismiss All (${visible.length})` : '✕'}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Low Recovery Warning ── */}
        {showLowRecoveryWarning && (
          <View style={[s.warningBanner, { backgroundColor: '#EF444415', borderColor: '#EF4444', marginBottom: 8 }]}>
            <Text style={s.warningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { color: '#EF4444' }]}>Low Recovery ({recoveryScore}%)</Text>
              <Text style={[s.warningSub, { color: screenMut }]}>Your body needs rest — deload mode uses 70% weight & half sets</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push({ pathname: '/split-workout', params: { sessionType: todaySession, date: todayStr, deload: 'true' } } as any);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>🏳️ Switch to Deload</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#EF444430', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
                  onPress={handleStartWorkout}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>Train Anyway</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Program Progression Banner ── */}
        {(() => {
          if (!customProgram) return null;
          const progress = getProgramProgress(customProgram);
          if (!progress.isComplete) {
            // Show progress bar for active program
            return (
              <View style={[s.card, { backgroundColor: surf, borderColor: bord, padding: 14, marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: fg, fontSize: 14, fontWeight: '600' }}>{customProgram.name}</Text>
                  <Text style={{ color: mut, fontSize: 12 }}>Week {Math.min(progress.weeksElapsed + 1, progress.totalWeeks)}/{progress.totalWeeks}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: bord, overflow: 'hidden' }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: pri, width: `${progress.percentComplete}%` }} />
                </View>
                <Text style={{ color: mut, fontSize: 11, marginTop: 6 }}>
                  {progress.daysRemaining} days remaining
                </Text>
              </View>
            );
          }
          // Program complete — show upgrade banner
          const suggestion = suggestNextProgram(
            customProgram,
            userProfile?.fitnessGoal || 'muscle_gain',
            userProfile?.experienceLevel || 'intermediate',
            userProfile?.equipment || 'full_gym',
          );
          return (
            <View style={[s.warningBanner, { backgroundColor: '#22C55E15', borderColor: '#22C55E', marginBottom: 8 }]}>
              <Text style={s.warningIcon}>🌟</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.warningTitle, { color: '#22C55E' }]}>Program Complete!</Text>
                <Text style={[s.warningSub, { color: screenMut }]}>{suggestion.reason}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/program-setup' as any);
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '700' }}>
                    Switch to {suggestion.template.name} →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* ── 7-Day Week Strip ── */}
        <View style={[s.card, { backgroundColor: surf, borderColor: bord, paddingVertical: 12 }]}>
          <View style={s.weekRow}>
            {weekDays.map((d, i) => {
              const dateStr = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`;
              const isCompleted = recentWorkouts.some(w => w.date === dateStr && w.completed);
              const dotColor = getColor(d.session);
              return (
                <TouchableOpacity
                  key={i}
                  style={s.dayCol}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (!d.isToday) {
                      setPreviewDay({ date: dateStr, session: d.session, label: d.label });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dayLabel, { color: d.isToday ? fg : mut, fontWeight: d.isToday ? '700' : '400' }]}>{/* fg/mut = cardForeground/cardMuted inside white card */}
                    {d.label}
                  </Text>
                  <View style={[s.dayDot, { backgroundColor: d.isToday ? pri : dotColor, opacity: d.session === 'rest' ? 0.4 : 1 }]} />
                  {isCompleted && <View style={[s.checkDot, { backgroundColor: '#22C55E' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {/* ── This Week’s Plan row ── */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: bord, marginTop: 8 }}>
            {weekDays.map((d, i) => {
              const defaultShort: Record<string, string> = {
                'upper-a': 'UA', 'lower-a': 'LA', 'upper-b': 'UB', 'lower-b': 'LB', 'rest': '—',
              };
              // Generate abbreviation from session name if not in defaults
              const short: Record<string, string> = { ...defaultShort };
              if (!short[d.session]) {
                // Take first letter of each word, uppercase, max 3 chars
                short[d.session] = d.session.split(/[-_ ]+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 3) || d.session.slice(0, 2).toUpperCase();
              }
              const color = d.session === 'rest' ? mut : getColor(d.session);
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: d.isToday ? '800' : '500', color, letterSpacing: 0.3 }}>
                    {short[d.session] ?? d.session}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Day Preview Modal ── */}
        <Modal visible={!!previewDay} transparent animationType="fade" onRequestClose={() => setPreviewDay(null)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center' }} onPress={() => setPreviewDay(null)} activeOpacity={1}>
            <View style={{ backgroundColor: surf, borderRadius: 20, padding: 24, width: '80%', borderWidth: 1, borderColor: bord }}>
              {previewDay && (
                <>
                  <Text style={{ color: fg, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>{previewDay.label}</Text>
                  <Text style={{ color: mut, fontSize: 14, marginBottom: 16 }}>{getName(previewDay.session)}</Text>
                  <Text style={{ color: mut, fontSize: 13 }}>{getSubtitle(previewDay.session)}</Text>
                  <TouchableOpacity
                    style={{ marginTop: 20, backgroundColor: pri, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                    onPress={() => {
                      setPreviewDay(null);
                      router.push({ pathname: '/split-workout', params: { sessionType: previewDay.session, date: previewDay.date } } as any);
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Start This Session</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Resume Workout Banner ── */}
        {resumableWorkout && (
          <TouchableOpacity
            style={[s.warningBanner, { backgroundColor: '#3B82F615', borderColor: '#3B82F6', marginBottom: 8 }]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: '/split-workout', params: { sessionType: resumableWorkout.sessionType, date: todayStr } } as any);
            }}
            activeOpacity={0.8}
          >
            <Text style={s.warningIcon}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { color: '#3B82F6' }]}>In-Progress: {getName(resumableWorkout.sessionType)}</Text>
              <Text style={[s.warningSub, { color: mut }]}>
                {resumableWorkout.exerciseLogs.filter(e => e.sets.length > 0).length} exercises started · {Math.round(resumableWorkout.elapsed / 60)}min elapsed
              </Text>
            </View>
            <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Resume</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Today's Session Hero ── */}
        <TouchableOpacity
          style={[s.heroCard, { backgroundColor: surf, borderColor: getColor(todaySession) + '40', overflow: 'hidden', padding: 0 }]}
          onPress={handleStartWorkout}
          activeOpacity={0.85}
        >
          {/* Gradient background */}
          <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <SvgGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={getColor(todaySession)} stopOpacity="0.15" />
                <Stop offset="1" stopColor={getColor(todaySession)} stopOpacity="0.03" />
              </SvgGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx="16" fill="url(#heroGrad)" />
          </Svg>
          <View style={{ padding: 20 }}>
            <View style={s.heroRow}>
              <Text style={[s.heroEmoji, { fontSize: 48, marginRight: 14 }]}>{getEmoji(todaySession)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroTitle, { color: fg, fontSize: 22, fontWeight: '800' }]}>{getName(todaySession)}</Text>
                <Text style={[s.heroSub, { color: mut, fontSize: 14 }]}>{getSubtitle(todaySession)}</Text>
              </View>
            </View>
            {!isRest && (
              <TouchableOpacity
                style={[s.startBtn, {
                  backgroundColor: todayDone ? '#22C55E' : getColor(todaySession),
                  shadowColor: todayDone ? '#22C55E' : getColor(todaySession),
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  elevation: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                }]}
                onPress={handleStartWorkout}
              >
                <Text style={[s.startBtnText, { fontSize: 16 }]}>{todayDone ? '✓ Completed — Start Again' : 'Start Workout'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* ── Metrics Grid ── */}
        <View style={s.grid}>
          {/* Weekly Weight Avg */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/(tabs)/analytics' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.metricChevron}>›</Text>
            <View style={[s.metricIcon, { backgroundColor: '#3B82F620' }]}>
              <Text style={s.metricIconText}>⚖️</Text>
            </View>
            <Text style={[s.metricLabel, { color: mut }]}>Weekly Weight Avg</Text>
            <View style={s.metricValueRow}>
              {avgWeight ? (
                <>
                  <Text style={[s.metricValue, { color: fg }]}>{avgWeight}</Text>
                  <Text style={[s.metricUnit, { color: mut }]}> kg</Text>
                </>
              ) : (
                <View style={[s.metricDash, { backgroundColor: bord }]} />
              )}
            </View>
            <Text style={[s.metricSub, { color: mut }]}>7-day rolling average</Text>
          </TouchableOpacity>

          {/* Last Night's Sleep */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/(tabs)/sleep' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.metricChevron}>›</Text>
            <View style={[s.metricIcon, { backgroundColor: '#8B5CF620' }]}>
              <Text style={s.metricIconText}>🌙</Text>
            </View>
            <Text style={[s.metricLabel, { color: mut }]}>Last Night's Sleep</Text>
            {whoopSleepHrs != null ? (
              <>
                <View style={s.metricValueRow}>
                  <Text style={[s.metricValue, { color: fg }]}>{whoopSleepHrs}</Text>
                  <Text style={[s.metricUnit, { color: mut }]}> hrs</Text>
                </View>
                {whoopSleepQuality != null && (
                  <Text style={[s.metricSub, { color: mut }]}>{Math.round(whoopSleepQuality)}% performance</Text>
                )}
              </>
            ) : lastSleep ? (
              <>
                <View style={s.metricValueRow}>
                  <Text style={[s.metricValue, { color: fg }]}>{lastSleep.durationHours}</Text>
                  <Text style={[s.metricUnit, { color: mut }]}> hrs</Text>
                </View>
                <Text style={[s.metricSub, { color: mut }]}>Manually logged</Text>
              </>
            ) : (
              <>
                <View style={[s.metricDash, { backgroundColor: bord }]} />
                <Text style={[s.metricSub, { color: mut }]}>Not logged</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Workout Streak */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: (streak?.currentStreak ?? 0) >= 3 ? '#F59E0B30' : bord }]}
            onPress={() => router.push('/(tabs)/history' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.metricChevron}>›</Text>
            <View style={[s.metricIcon, { backgroundColor: '#F59E0B20' }]}>
              <Text style={s.metricIconText}>🔥</Text>
            </View>
            <Text style={[s.metricLabel, { color: mut }]}>Workout Streak</Text>
            <View style={s.metricValueRow}>
              <Text style={[s.metricValueLg, {
                color: (streak?.currentStreak ?? 0) >= 3 ? '#F59E0B' : pri,
                ...(Platform.OS === 'ios' && (streak?.currentStreak ?? 0) >= 3 ? { textShadowColor: '#F59E0B40', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } } : {}),
              }]}>{streak?.currentStreak ?? 0}</Text>
              <Text style={[s.metricUnit, { color: mut }]}> days</Text>
            </View>
            <Text style={[s.metricSub, { color: mut }]}>Best: {streak?.bestStreak ?? 0}d</Text>
          </TouchableOpacity>

          {/* Days to Deload */}
          <TouchableOpacity
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/(tabs)/calendar' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.metricChevron}>›</Text>
            <View style={[s.metricIcon, { backgroundColor: '#10B98120' }]}>
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
          </TouchableOpacity>
        </View>

        {/* ── Deload Countdown Banner (weeks 4-5 only) ── */}
        {meso && meso.currentWeek >= 4 && (
          <TouchableOpacity
            style={[
              s.deloadBanner,
              meso.daysUntilDeload === 0
                ? { backgroundColor: '#EF444420', borderColor: '#EF4444' }
                : meso.daysUntilDeload <= 3
                ? { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }
                : { backgroundColor: '#10B98120', borderColor: '#10B981' },
            ]}
            onPress={() => router.push('/ai-coaching-dashboard' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.deloadBannerEmoji}>
              {meso.daysUntilDeload === 0 ? '🔴' : meso.daysUntilDeload <= 3 ? '🟠' : '🟡'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[
                s.deloadBannerTitle,
                { color: meso.daysUntilDeload === 0 ? '#EF4444' : meso.daysUntilDeload <= 3 ? '#F59E0B' : '#10B981' },
              ]}>
                {meso.daysUntilDeload === 0
                  ? 'Deload Week — Active Now'
                  : `Deload in ${meso.daysUntilDeload} day${meso.daysUntilDeload !== 1 ? 's' : ''}`}
              </Text>
              <Text style={[s.deloadBannerSub, { color: screenMut }]}>
                {meso.daysUntilDeload === 0
                  ? 'Week 5/5 · 70% weight & half sets today'
                  : `Week ${meso.currentWeek}/${meso.totalWeeks} · Prepare to back off soon`}
              </Text>
            </View>
            <Text style={[s.deloadBannerArrow, { color: screenMut }]}>›</Text>
          </TouchableOpacity>
        )}
        {/* ── AI Form Coach Banner ── */}
        <TouchableOpacity
          style={[s.coachCard, { backgroundColor: '#1A1F2E', borderColor: '#3B82F640', overflow: 'hidden' }]}
          onPress={() => router.push('/(tabs)/coach' as any)}
          activeOpacity={0.8}
        >
          {/* Gradient accent stripe */}
          <Svg width="100%" height={2} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <SvgGradient id="coachAccent" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#3B82F6" stopOpacity="1" />
                <Stop offset="1" stopColor="#8B5CF6" stopOpacity="1" />
              </SvgGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="2" fill="url(#coachAccent)" />
          </Svg>
          <View style={s.coachLeft}>
            <View style={[s.coachIconWrap, { backgroundColor: '#3B82F620' }]}>
              <Text style={s.coachIcon}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.coachTitle, { color: '#FFFFFF' }]}>AI Form Coach</Text>
              <Text style={[s.coachSub, { color: '#94A3B8' }]}>Pose detection · Rep counting · Form score</Text>
            </View>
          </View>
          <View style={[s.coachBadge, { backgroundColor: '#3B82F620' }]}>
            <Text style={[s.coachBadgeText, { color: '#3B82F6' }]}>Open →</Text>
          </View>
        </TouchableOpacity>

        {/* ── Nutrition Summary ── */}
        <TouchableOpacity
          style={[s.card, { backgroundColor: surf, borderColor: bord }]}
          onPress={() => router.push('/(tabs)/nutrition' as any)}
        >
          <View style={s.row}>
            <SectionHeader icon="🍎" title="TODAY'S NUTRITION" accent="#F59E0B" colors={colors} />
            <Text style={[s.link, { color: pri }]}>Today →</Text>
          </View>
          {/* Macro rings */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, marginBottom: 12 }}>
            <MacroRing consumed={calConsumed} target={calTarget} color="#F59E0B" label={`${calConsumed}/${calTarget} kcal`} />
            <MacroRing consumed={protConsumed} target={protTarget} color="#3B82F6" label={`${protConsumed}/${protTarget}g prot`} />
          </View>
          <View style={[s.row, { marginBottom: 4 }]}>
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
            <SectionHeader icon="♥︎" title="WHOOP RECOVERY" accent={recoveryColor} colors={colors} />
            <Text style={[s.link, { color: mut }]}>›</Text>
          </View>
          <View style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
            {recoveryScore != null ? (
              <ProgressRing score={recoveryScore} color={recoveryColor} size={80} strokeWidth={8} />
            ) : (
              <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: bord, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: mut }}>{whoopConnected ? '…' : '—'}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[s.whoopStatus, { color: mut, marginBottom: 8 }]}>
                {!whoopConnected ? 'Tap to connect WHOOP'
                  : recoveryScore == null ? 'Fetching data…'
                  : recoveryScore >= 67 ? 'Green — Train hard'
                  : recoveryScore >= 34 ? 'Yellow — Moderate'
                  : 'Red — Rest'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View>
                  <Text style={[s.metricSub, { color: mut }]}>⚡ HRV</Text>
                  <Text style={[s.whoopMetricVal, { color: fg }]}>{hrv != null ? `${hrv}ms` : '—'}</Text>
                </View>
                <View>
                  <Text style={[s.metricSub, { color: mut }]}>♥ RHR</Text>
                  <Text style={[s.whoopMetricVal, { color: fg }]}>{rhr != null ? `${rhr}bpm` : '—'}</Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Training Readiness (from Progress tab) ── */}
        {(() => {
          const recoveryTrend = weeklyRecovery.length > 0 ? getRecoveryTrend(weeklyRecovery) : 'stable';
          const avgRecovery = weeklyRecovery.length > 0 ? getWeeklyAverageRecovery(weeklyRecovery) : null;
          const readinessScore = calculateReadiness(recovery, avgRecovery, streak, workoutsThisWeek);
          const readinessColor = readinessScore >= 67 ? '#10B981' : readinessScore >= 34 ? '#F59E0B' : '#EF4444';
          const readinessLabel = readinessScore >= 80 ? 'Peak Readiness' : readinessScore >= 67 ? 'Good to Train' : readinessScore >= 50 ? 'Moderate' : readinessScore >= 34 ? 'Consider Light' : 'Rest Recommended';
          return (
            <View style={[s.card, { backgroundColor: surf, borderColor: bord }]}>
              <SectionHeader icon="⚡" title="TRAINING READINESS" accent={readinessColor} colors={colors} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <ProgressRing score={readinessScore} color={readinessColor} size={60} strokeWidth={7} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: fg }}>{readinessLabel}</Text>
                  <Text style={{ fontSize: 12, color: mut }}>
                    {readinessScore >= 67 ? 'Push hard today' : readinessScore >= 34 ? 'Reduce intensity slightly' : 'Take a rest day'}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <ReadinessBar label="Recovery" value={recovery ? `${Math.round(recovery.recoveryScore)}%` : 'N/A'} progress={recovery ? recovery.recoveryScore / 100 : 0} color={recovery ? (recovery.recoveryScore >= 67 ? '#10B981' : recovery.recoveryScore >= 34 ? '#F59E0B' : '#EF4444') : mut} colors={colors} />
                <ReadinessBar label="Sleep" value={recovery ? `${Math.round(recovery.sleepScore)}%` : 'N/A'} progress={recovery ? recovery.sleepScore / 100 : 0} color={recovery ? (recovery.sleepScore >= 67 ? '#10B981' : recovery.sleepScore >= 34 ? '#F59E0B' : '#EF4444') : mut} colors={colors} />
                <ReadinessBar label="Weekly Load" value={`${workoutsThisWeek}/4`} progress={Math.min(1, workoutsThisWeek / 4)} color={workoutsThisWeek <= 4 ? '#10B981' : '#F59E0B'} colors={colors} />
              </View>
            </View>
          );
        })()}

        {/* ── Personal Records ── */}
        {(() => {
          const prList = Object.entries(prs).sort((a, b) => b[1].e1rm - a[1].e1rm);
          if (prList.length === 0) return null;
          return (
            <View style={[s.card, { backgroundColor: surf, borderColor: bord, paddingBottom: 4 }]}>
              <SectionHeader icon="🏆" title="PERSONAL RECORDS" accent="#F59E0B" colors={colors} />
              {prList.slice(0, 5).map(([name, pr], i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏆';
                const medalColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : undefined;
                return (
                <TouchableOpacity
                  key={name}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: bord,
                    ...(medalColor ? { borderLeftWidth: 3, borderLeftColor: medalColor, paddingLeft: 10, marginLeft: -4 } : {}),
                  }}
                  onPress={() => router.push({ pathname: '/rep-history', params: { exercise: name, exerciseType: '' } } as any)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14, marginRight: 8 }}>{medal}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: fg }}>{name}</Text>
                    <Text style={{ fontSize: 11, color: mut }}>{pr.weight}kg x {pr.reps} · {new Date(pr.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: medalColor || '#F59E0B' }}>~{Math.round(pr.e1rm)}kg</Text>
                </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}

        {/* ── Recent Workouts ── */}
        {recentWorkouts.length > 0 && (
          <View style={[s.card, { backgroundColor: surf, borderColor: bord, paddingBottom: 4 }]}>
            <SectionHeader icon="📋" title="RECENT WORKOUTS" accent="#3B82F6" colors={colors} />
            {recentWorkouts.slice(0, 5).map((w, i) => {
              const sColor = getColor(w.sessionType);
              return (
                <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: bord }}>
                  <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: sColor, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: fg }}>{getName(w.sessionType)}</Text>
                    <Text style={{ fontSize: 11, color: mut }}>
                      {new Date(w.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {w.durationMinutes ? ` · ${w.durationMinutes}m` : ''}
                    </Text>
                  </View>
                  {w.totalVolume ? <Text style={{ fontSize: 13, fontWeight: '600', color: sColor }}>{(w.totalVolume / 1000).toFixed(1)}t</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Coach Insights ── */}
        {recommendations.length > 0 && (
          <View style={[s.card, { backgroundColor: surf, borderColor: bord }]}>
            <SectionHeader icon="💡" title="COACH INSIGHTS" accent="#3B82F6" colors={colors} />
            {recommendations.slice(0, 3).map((rec, i) => {
              const catIcon: Record<string, string> = { nutrition: '🍗', training: '🏋️', recovery: '😴', overload: '📈' };
              return (
                <View key={i} style={{ paddingVertical: 6, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: bord }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: fg }}>{catIcon[rec.type] || '💡'} {rec.message}</Text>
                  <Text style={{ fontSize: 11, color: mut, marginTop: 2, lineHeight: 16 }}>{rec.actionable}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Quick Tools ── */}
        <View style={[s.card, { backgroundColor: surf, borderColor: bord }]}>
          <SectionHeader icon="🔧" title="TOOLS & INSIGHTS" accent="#3B82F6" colors={colors} />
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              onPress={() => router.push('/muscle-heatmap' as any)}
              activeOpacity={0.7}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EF444420', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>🔥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: fg }}>Muscle Heatmap</Text>
                <Text style={{ fontSize: 11, color: mut }}>See which muscles need attention</Text>
              </View>
              <Text style={{ fontSize: 18, color: mut }}>›</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: bord }} />

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              onPress={() => router.push('/readiness' as any)}
              activeOpacity={0.7}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#22C55E20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: fg }}>Readiness Score</Text>
                <Text style={{ fontSize: 11, color: mut }}>Sleep + recovery + nutrition + load</Text>
              </View>
              <Text style={{ fontSize: 18, color: mut }}>›</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: bord }} />

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              onPress={() => router.push('/widgets' as any)}
              activeOpacity={0.7}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F620', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>📱</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: fg }}>Home Screen Widget</Text>
                <Text style={{ fontSize: 11, color: mut }}>Quick glance at streak & workout</Text>
              </View>
              <Text style={{ fontSize: 18, color: mut }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ---- Helper Functions ----

function calculateReadiness(
  recovery: RecoveryData | null,
  avgRecovery: number | null,
  streak: StreakData | null,
  workoutsThisWeek: number,
): number {
  let score = 70;
  if (recovery) {
    score = recovery.recoveryScore * 0.4;
    score += recovery.sleepScore * 0.3;
  }
  if (workoutsThisWeek <= 4) score += 20;
  else if (workoutsThisWeek === 5) score += 10;
  else score += 5;
  if (streak && streak.currentStreak >= 3) score += 10;
  else if (streak && streak.currentStreak >= 1) score += 5;
  return Math.round(Math.min(100, Math.max(0, score)));
}

function ReadinessBar({ label, value, progress, color, colors }: {
  label: string; value: string; progress: number; color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 11, color: (colors as any).cardMuted ?? colors.muted }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color }}>{value}</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: (colors as any).cardBorder ?? colors.border, overflow: 'hidden' }}>
        <View style={{ height: 5, borderRadius: 3, width: `${Math.max(2, progress * 100)}%`, backgroundColor: color } as any} />
      </View>
    </View>
  );
}

// ── SVG Helper Components ──

function SectionHeader({ icon, title, accent, colors: c }: { icon: string; title: string; accent: string; colors: ReturnType<typeof useColors> }) {
  const gradId = `grad_${title.replace(/\s/g, '')}`;
  // Section headers sit on navy background — use white foreground
  const headerColor = c.foreground;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 }}>
      <Text style={{ fontSize: 13 }}>{icon}</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 1, color: headerColor }}>{title}</Text>
      <Svg height={1} style={{ flex: 1, marginLeft: 6 }}>
        <Defs>
          <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={accent} stopOpacity="0.5" />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="1" fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
}

function ProgressRing({ score, color, size = 56, strokeWidth = 6 }: { score: number; color: string; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const gradId = `ring_${size}_${color.replace('#', '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </SvgGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} stroke="#1E2433" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90, ${cx}, ${cy})`}
      />
      <SvgText x={cx} y={cy + 1} textAnchor="middle" alignmentBaseline="central" fontSize={size * 0.28} fontWeight="800" fill={color}>
        {Math.round(score)}
      </SvgText>
    </Svg>
  );
}

function MacroRing({ consumed, target, color, label }: { consumed: number; target: number; color: string; label: string }) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <ProgressRing score={pct} color={color} size={48} strokeWidth={5} />
      <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerName: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  avatarBtn: { position: 'relative' },
  avatarImg: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 20 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heroEmoji: { fontSize: 36, marginRight: 12 },
  heroTitle: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  heroSub: { fontSize: 13, lineHeight: 18 },
  startBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  startBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 12 },
  dayDot: { width: 14, height: 14, borderRadius: 7 },
  checkDot: { width: 6, height: 6, borderRadius: 3, marginTop: -2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metricCard: { width: '48%', borderRadius: 16, borderWidth: 1, padding: 14, position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
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

  coachCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  coachLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  coachIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  coachIcon: { fontSize: 22 },
  coachTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  coachSub: { fontSize: 12, lineHeight: 16 },
  coachBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  coachBadgeText: { fontSize: 12, fontWeight: '700' },

  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 12 },
  warningIcon: { fontSize: 20 },
  warningTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  warningSub: { fontSize: 12, lineHeight: 16 },
  syncPill: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  syncDotSmall: { width: 8, height: 8, borderRadius: 4 },
  deloadBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 12 },
  deloadBannerEmoji: { fontSize: 20 },
  deloadBannerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  deloadBannerSub: { fontSize: 12, lineHeight: 16 },
  deloadBannerArrow: { fontSize: 20, fontWeight: '700' },
});
