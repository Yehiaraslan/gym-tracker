// ============================================================
// HOME SCREEN — Phy-style dark card dashboard
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View, TouchableOpacity, ScrollView, Platform, StyleSheet, Image, Modal } from 'react-native';
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
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [missedSessions, setMissedSessions] = useState<Array<{ date: string; sessionType: SessionType; sessionName: string; daysAgo: number }>>([]);
  const [dismissedMakeup, setDismissedMakeup] = useState<Set<string>>(new Set());
  const [previewDay, setPreviewDay] = useState<{ date: string; session: SessionType; label: string } | null>(null);
  const [syncState, setSyncState] = useState<PinSyncState | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

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

  // Last night sleep (local log)
  const lastSleep = [...store.sleepEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const loadData = useCallback(async () => {
    try {
      const [streakData, startDate, nutritionData, workouts] = await Promise.all([
        getStreakData(),
        getMesocycleStartDate(),
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
      setNutrition(nutritionData);
      setRecentWorkouts(workouts);
      // Detect missed sessions in the last 7 days
      const completedDates = workouts.filter(w => w.completed).map(w => w.date);
      const missed = getMissedSessions(completedDates, 7);
      setMissedSessions(missed);
    } catch (_) {}
  }, []);

  // Reload every time the tab comes into focus so nutrition/workout data is always fresh
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadUserProfile().then(setUserProfile);
      loadPinSyncState().then(setSyncState);
    }, [loadData])
  );

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
              <Text style={[s.warningSub, { color: mut }]}>Zaki needs your height, weight & goal for personalised coaching</Text>
            </View>
            <Text style={{ color: '#3B82F6', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}
        {/* ── Header ── */}
        <View style={[s.row, { marginBottom: 16, alignItems: 'center' }]}>
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
            <Text style={[s.headerName, { color: fg }]}>{userProfile?.name || 'Yehia'}</Text>
            {userProfile?.fitnessGoal ? (
              <Text style={{ color: mut, fontSize: 12, textTransform: 'capitalize' }}>{userProfile.fitnessGoal.replace('_', ' ')}</Text>
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

        {/* ── Make-up Session Banners ── */}
        {missedSessions.filter(m => !dismissedMakeup.has(m.date)).map(missed => (
          <View
            key={missed.date}
            style={[s.warningBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B', marginBottom: 8 }]}
          >
            <Text style={s.warningIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { color: '#F59E0B' }]}>
                Missed: {missed.sessionName} ({missed.daysAgo === 1 ? 'yesterday' : `${missed.daysAgo} days ago`})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/split-workout', params: { sessionType: missed.sessionType, date: missed.date } } as any);
                }}
              >
                <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                  Make it up today →
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setDismissedMakeup(prev => new Set([...prev, missed.date]))}
              style={{ padding: 4 }}
            >
              <Text style={{ color: mut, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* ── Low Recovery Warning ── */}
        {showLowRecoveryWarning && (
          <View style={[s.warningBanner, { backgroundColor: '#EF444415', borderColor: '#EF4444', marginBottom: 8 }]}>
            <Text style={s.warningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { color: '#EF4444' }]}>Low Recovery ({recoveryScore}%)</Text>
              <Text style={[s.warningSub, { color: mut }]}>Your body needs rest — deload mode uses 70% weight & half sets</Text>
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

        {/* ── 7-Day Week Strip ── */}
        <View style={[s.card, { backgroundColor: surf, borderColor: bord, paddingVertical: 12 }]}>
          <View style={s.weekRow}>
            {weekDays.map((d, i) => {
              const dateStr = d.date.toISOString().split('T')[0];
              const isCompleted = recentWorkouts.some(w => w.date === dateStr && w.completed);
              const dotColor = DOT_COLORS[d.session];
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
                  <Text style={[s.dayLabel, { color: d.isToday ? fg : mut, fontWeight: d.isToday ? '700' : '400' }]}>
                    {d.label}
                  </Text>
                  <View style={[s.dayDot, { backgroundColor: d.isToday ? pri : dotColor, opacity: d.session === 'rest' ? 0.4 : 1 }]} />
                  {isCompleted && <View style={[s.checkDot, { backgroundColor: '#22C55E' }]} />}
                </TouchableOpacity>
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
                  <Text style={{ color: mut, fontSize: 14, marginBottom: 16 }}>{SESSION_NAMES[previewDay.session]}</Text>
                  <Text style={{ color: mut, fontSize: 13 }}>{SESSION_SUBTITLE[previewDay.session]}</Text>
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

        {/* ── Today's Session Hero ── */}
        <TouchableOpacity
          style={[s.heroCard, { backgroundColor: surf, borderColor: SESSION_COLORS[todaySession] + '40' }]}
          onPress={handleStartWorkout}
          activeOpacity={0.85}
        >
          <View style={s.heroRow}>
            <Text style={s.heroEmoji}>{SESSION_EMOJI[todaySession]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { color: fg }]}>{SESSION_NAMES[todaySession]}</Text>
              <Text style={[s.heroSub, { color: mut }]}>{SESSION_SUBTITLE[todaySession]}</Text>
            </View>
          </View>
          {!isRest && (
            <TouchableOpacity
              style={[s.startBtn, { backgroundColor: todayDone ? '#22C55E' : SESSION_COLORS[todaySession] }]}
              onPress={handleStartWorkout}
            >
              <Text style={s.startBtnText}>{todayDone ? '✓ Completed — Start Again' : 'Start Workout'}</Text>
            </TouchableOpacity>
          )}
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
            style={[s.metricCard, { backgroundColor: surf, borderColor: bord }]}
            onPress={() => router.push('/(tabs)/history' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.metricChevron}>›</Text>
            <View style={[s.metricIcon, { backgroundColor: '#F59E0B20' }]}>
              <Text style={s.metricIconText}>🔥</Text>
            </View>
            <Text style={[s.metricLabel, { color: mut }]}>Workout Streak</Text>
            <View style={s.metricValueRow}>
              <Text style={[s.metricValueLg, { color: pri }]}>{streak?.currentStreak ?? 0}</Text>
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
              <Text style={[s.deloadBannerSub, { color: mut }]}>
                {meso.daysUntilDeload === 0
                  ? 'Week 5/5 · 70% weight & half sets today'
                  : `Week ${meso.currentWeek}/${meso.totalWeeks} · Prepare to back off soon`}
              </Text>
            </View>
            <Text style={[s.deloadBannerArrow, { color: mut }]}>›</Text>
          </TouchableOpacity>
        )}
        {/* ── AI Form Coach Banner ── */}
        <TouchableOpacity
          style={[s.coachCard, { backgroundColor: '#1A1F2E', borderColor: '#3B82F640' }]}
          onPress={() => router.push('/(tabs)/coach' as any)}
          activeOpacity={0.8}
        >
          <View style={s.coachLeft}>
            <View style={[s.coachIconWrap, { backgroundColor: '#3B82F620' }]}>
              <Text style={s.coachIcon}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.coachTitle, { color: fg }]}>AI Form Coach</Text>
              <Text style={[s.coachSub, { color: mut }]}>Pose detection · Rep counting · Form score</Text>
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
                {recoveryScore != null ? `${recoveryScore}%` : whoopConnected ? '…' : '—'}
              </Text>
              <Text style={[s.whoopStatus, { color: mut }]}>
                {!whoopConnected ? 'Tap to connect WHOOP'
                  : recoveryScore == null ? 'Fetching data…'
                  : recoveryScore >= 67 ? 'Green — Train hard'
                  : recoveryScore >= 34 ? 'Yellow — Moderate'
                  : 'Red — Rest'}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.metricSub, { color: mut }]}>⚡ HRV</Text>
                <Text style={[s.whoopMetricVal, { color: fg }]}>{hrv != null ? `${hrv}ms` : '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.metricSub, { color: mut }]}>♥ RHR</Text>
                <Text style={[s.whoopMetricVal, { color: fg }]}>{rhr != null ? `${rhr}bpm` : '—'}</Text>
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
  avatarBtn: { position: 'relative' },
  avatarImg: { width: 40, height: 40, borderRadius: 20, borderWidth: 2 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 20 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },

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
