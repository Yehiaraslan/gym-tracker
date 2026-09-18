// ============================================================
// HOME SCREEN — schedule-first athlete landing.
//   1. Week / month calendar of the training schedule, landing on today
//   2. The selected day's session with its exercises and a Start button
// Gamification (player card, quests, XP, achievements) was removed on
// 2026-09-18 at Yehia's request; something else will replace it later.
// ============================================================
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View, TouchableOpacity, ScrollView, Platform, StyleSheet, Image, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { syncCoachPlans } from '@/lib/coach-plan-sync';
import { isCoachRole } from './_layout';
import { loadUserProfile, type UserProfile } from '@/lib/profile-store';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useI18n, localizeDigits } from '@/lib/i18n';
import {
  SESSION_NAMES,
  getMissedSessions,
  PROGRAM_SESSIONS,
  type SessionType,
  type ProgramExercise,
} from '@/lib/training-program';
import { loadCustomProgram, getProgramProgress, suggestNextProgram, type CustomProgram } from '@/lib/custom-program-store';
import {
  getActiveSchedule,
  saveScheduleOverride,
  type CustomSchedule,
  type DayName,
} from '@/lib/schedule-store';
import { getSplitWorkouts, type SplitWorkoutSession } from '@/lib/split-workout-store';
import { WhoopReconnectBanner } from '@/components/whoop-reconnect-banner';
import { loadPinSyncState, type PinSyncState } from '@/lib/pin-sync-store';
import { trpc } from '@/lib/trpc';
import { getDeviceId } from '@/lib/device-id';
import { useAuth } from '@/hooks/use-auth';
import { hasResumableWorkout, type ActiveWorkoutState } from '@/lib/active-workout-store';
import { ScheduleCalendar, toDateStr, fromDateStr, type CalendarMode } from '@/components/schedule-calendar';
import {
  Space,
  Radius,
  FontSize,
  FontWeight,
  Shadow,
  ActiveOpacity,
  ColorPool,
  Gutter,
  StackLg,
  CardPadLg,
} from '@/lib/design-tokens';

const DAY_NAMES: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { t, lang, isRTL } = useI18n();

  const todayStr = toDateStr(new Date());

  // ── Schedule + program ──
  const [schedule, setSchedule] = useState<CustomSchedule | null>(null);
  const [customProgram, setCustomProgram] = useState<CustomProgram | null>(null);
  const [workouts, setWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calMode, setCalMode] = useState<CalendarMode>('week');

  // ── Banners ──
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [missedSessions, setMissedSessions] = useState<Array<{ date: string; sessionType: SessionType; sessionName: string; daysAgo: number }>>([]);
  const [dismissedMakeup, setDismissedMakeup] = useState<Set<string>>(new Set());
  const [reschedulingDate, setReschedulingDate] = useState<string | null>(null);
  const [rescheduleToast, setRescheduleToast] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<PinSyncState | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [resumableWorkout, setResumableWorkout] = useState<ActiveWorkoutState | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getDeviceId().then(setDeviceId); }, []);

  // WHOOP recovery (only used for the low-recovery warning)
  const whoopStatusQ = trpc.whoop.status.useQuery(
    { deviceId: deviceId! },
    { enabled: !!deviceId, staleTime: 60_000, retry: 1 }
  );
  const whoopConnected = whoopStatusQ.data?.connected ?? false;
  const whoopRecoveryQ = trpc.whoop.recovery.useQuery(
    { deviceId: deviceId!, days: 7 },
    { enabled: !!deviceId && whoopConnected, staleTime: 60_000, retry: 1 }
  );

  const loadAll = useCallback(async () => {
    try {
      const [sched, program, all, resumable] = await Promise.all([
        getActiveSchedule(),
        loadCustomProgram(),
        getSplitWorkouts().catch(() => [] as SplitWorkoutSession[]),
        hasResumableWorkout(),
      ]);
      setSchedule(sched);
      setCustomProgram(program);
      setWorkouts(all);
      setResumableWorkout(resumable);
      const completedDates = all.filter(w => w.completed).map(w => w.date);
      setMissedSessions(getMissedSessions(completedDates, 7, sched as Record<string, SessionType>));
    } catch (_) {}
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // A coach lands on their roster, not the athlete dashboard.
      if (isCoachRole(authUser?.role)) {
        router.replace('/(tabs)/athletes' as any);
        return;
      }
      loadUserProfile().then(setUserProfile);
      loadPinSyncState().then(setSyncState);
      // Pull anything the coach assigned BEFORE reading the schedule/program,
      // so a new plan shows up on this very focus.
      syncCoachPlans().catch(() => null).finally(() => { loadAll(); });
    }, [loadAll, authUser?.role, router])
  );

  // ── Lookups ──
  const sessionForDate = useCallback((dateStr: string): SessionType => {
    if (!schedule) return 'rest';
    const dayName = DAY_NAMES[fromDateStr(dateStr).getDay()];
    return schedule[dayName] ?? 'rest';
  }, [schedule]);

  const getColor = useCallback((sessionId: string): string => {
    if (sessionId === 'rest') return DEFAULT_DOT_COLORS.rest;
    if (customProgram?.sessionColors?.[sessionId]) return customProgram.sessionColors[sessionId];
    if (DEFAULT_DOT_COLORS[sessionId]) return DEFAULT_DOT_COLORS[sessionId];
    const sessionKeys = customProgram ? Object.keys(customProgram.sessionNames) : [];
    const idx = sessionKeys.indexOf(sessionId);
    return ColorPool[idx >= 0 ? idx % ColorPool.length : 0];
  }, [customProgram]);

  const getName = (sessionId: string): string => {
    if (sessionId === 'rest') return t('homeRestDay');
    if (customProgram?.sessionNames?.[sessionId]) return customProgram.sessionNames[sessionId];
    return SESSION_NAMES[sessionId as keyof typeof SESSION_NAMES] || sessionId;
  };

  const getEmoji = (sessionId: string): string => {
    if (DEFAULT_SESSION_EMOJI[sessionId]) return DEFAULT_SESSION_EMOJI[sessionId];
    return guessSessionEmoji(sessionId, customProgram?.sessionNames?.[sessionId]);
  };

  const getExercises = (sessionId: string): ProgramExercise[] => {
    if (sessionId === 'rest') return [];
    if (customProgram?.sessions?.[sessionId]) return customProgram.sessions[sessionId];
    return (PROGRAM_SESSIONS as Record<string, ProgramExercise[]>)[sessionId] ?? [];
  };

  const completedDates = useMemo(() => new Set(workouts.filter(w => w.completed).map(w => w.date)), [workouts]);

  // ── Selected day ──
  const selSession = sessionForDate(selectedDate);
  const selIsRest = selSession === 'rest';
  const selDone = completedDates.has(selectedDate);
  const selExercises = getExercises(selSession);
  const selColor = getColor(selSession);
  const selDate = fromDateStr(selectedDate);
  const dayDiff = Math.round((selDate.getTime() - fromDateStr(todayStr).getTime()) / 86400000);
  const relLabel = dayDiff === 0 ? t('homeToday') : dayDiff === 1 ? t('homeTomorrow') : dayDiff === -1 ? t('homeYesterday') : null;
  const dayKeys = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'] as const;
  const monthKeys = ['monthJan', 'monthFeb', 'monthMar', 'monthApr', 'monthMay', 'monthJun', 'monthJul', 'monthAug', 'monthSep', 'monthOct', 'monthNov', 'monthDec'] as const;
  const longDate = `${t(dayKeys[selDate.getDay()])} ${localizeDigits(selDate.getDate(), lang)} ${t(monthKeys[selDate.getMonth()])}`;
  const bodyParts = [...new Set(selExercises.map(e => e.bodyPart).filter(Boolean))].slice(0, 4).join(' · ');

  // This week's progress (Sunday-based week containing today)
  const weekProgress = useMemo(() => {
    const today = fromDateStr(todayStr);
    const start = new Date(today); start.setDate(today.getDate() - today.getDay());
    let planned = 0; let done = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = toDateStr(d);
      if (sessionForDate(ds) !== 'rest') planned++;
      if (completedDates.has(ds)) done++;
    }
    return { planned, done };
  }, [todayStr, sessionForDate, completedDates]);

  const startSession = (sessionType: SessionType, date: string, extra: Record<string, string> = {}) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/split-workout', params: { sessionType, date, ...extra } } as any);
  };

  // Reschedule a missed session into today's slot by swapping the schedule
  const handleRescheduleToToday = async (missed: { date: string; sessionType: SessionType; sessionName: string }) => {
    if (reschedulingDate) return;
    setReschedulingDate(missed.date);
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const activeSchedule = await getActiveSchedule();
      const todayDayName = DAY_NAMES[new Date().getDay()];
      const missedDayName = DAY_NAMES[fromDateStr(missed.date).getDay()];
      const todayOriginal = activeSchedule[todayDayName];
      const newSchedule = { ...activeSchedule, [todayDayName]: missed.sessionType, [missedDayName]: todayOriginal };
      await saveScheduleOverride({
        appliedAt: new Date().toISOString(),
        description: `Rescheduled ${missed.sessionName} from ${missedDayName} to ${todayDayName}`,
        schedule: newSchedule,
        appliedByZaki: false,
      });
      setDismissedMakeup(prev => new Set([...prev, missed.date]));
      setRescheduleToast(t('homeMovedToToday', { name: missed.sessionName }));
      setTimeout(() => setRescheduleToast(null), 3000);
      setSelectedDate(todayStr);
      await loadAll();
    } catch (e) {
      // silently fail — user can still tap "Start now"
    } finally {
      setReschedulingDate(null);
    }
  };

  // WHOOP v2 API: snake_case fields
  const latestRecoveryRecord = (whoopRecoveryQ.data?.records as any[])?.find(
    (r: any) => r.score_state === 'SCORED' && r.score != null
  );
  const recoveryScore: number | null = latestRecoveryRecord?.score?.recovery_score != null
    ? Math.round(latestRecoveryRecord.score.recovery_score) : null;
  const todaySession = sessionForDate(todayStr);
  const todayDone = completedDates.has(todayStr);
  const showLowRecoveryWarning = recoveryScore != null && recoveryScore < 33 && !todayDone && todaySession !== 'rest';

  const surf = colors.surface;
  const bord = colors.cardBorder;
  const fg = colors.cardForeground;
  const mut = colors.cardMuted;
  const screenFg = colors.foreground;
  const screenMut = colors.muted;
  const pri = colors.primary;
  const ink = colors.primaryInk;
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const txtAlign = isRTL ? 'right' : 'left';

  const startLabel = selDone ? `✓ ${t('homeCompleted')}`
    : dayDiff > 0 ? t('homeStartEarly')
    : dayDiff < 0 ? t('homeLogSession')
    : t('homeStartWorkout');

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Gutter, paddingTop: Space._2, paddingBottom: Space._10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={pri} />}
      >
        <WhoopReconnectBanner />

        {rescheduleToast != null && (
          <View style={[s.warningBanner, { backgroundColor: '#22C55E20', borderColor: '#22C55E', marginBottom: 8, flexDirection: rowDir }]}>
            <Text style={s.warningIcon}>✅</Text>
            <Text style={[s.warningTitle, { color: '#22C55E', flex: 1, textAlign: txtAlign }]}>{rescheduleToast}</Text>
          </View>
        )}

        {/* ── Smart banner queue ── */}
        {(() => {
          const banners: { key: string; priority: number; render: () => ReactNode }[] = [];

          const visibleMissed = missedSessions.filter(m => !dismissedMakeup.has(m.date));
          if (visibleMissed.length > 0) {
            const last = visibleMissed[0];
            const isRescheduling = reschedulingDate === last.date;
            banners.push({
              key: 'missed_workout',
              priority: 1,
              render: () => (
                <View style={[s.warningBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B', marginBottom: 0, flexDirection: 'column', alignItems: isRTL ? 'flex-end' : 'flex-start', gap: 8 }]}>
                  <View style={{ flexDirection: rowDir, alignItems: 'center', width: '100%', gap: 8 }}>
                    <Text style={s.warningIcon}>📅</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.warningTitle, { color: '#F59E0B', textAlign: txtAlign }]}>
                        {t('homeMissed', { name: last.sessionName })} · {last.daysAgo === 1 ? t('homeYesterday') : t('homeDaysAgo', { n: localizeDigits(last.daysAgo, lang) })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDismissedMakeup(prev => new Set([...prev, ...visibleMissed.map(m => m.date)]))}
                      style={{ padding: 4 }}
                    >
                      <Text style={{ color: screenMut, fontSize: 11 }}>{visibleMissed.length > 1 ? t('homeDismissAll', { n: visibleMissed.length }) : '✕'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: rowDir, gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleRescheduleToToday(last)}
                      disabled={isRescheduling}
                      style={{ backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, opacity: isRescheduling ? 0.6 : 1 }}
                    >
                      <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>{isRescheduling ? '⏳' : `📆 ${t('homeScheduleForToday')}`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => startSession(last.sessionType, last.date)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' }}
                    >
                      <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700' }}>{t('startNow')} →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ),
            });
          }

          if (showLowRecoveryWarning) {
            banners.push({
              key: 'low_recovery',
              priority: 2,
              render: () => (
                <View style={[s.warningBanner, { backgroundColor: '#EF444415', borderColor: '#EF4444', marginBottom: 0, flexDirection: rowDir }]}>
                  <Text style={s.warningIcon}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.warningTitle, { color: '#EF4444', textAlign: txtAlign }]}>{t('homeLowRecovery', { n: recoveryScore! })}</Text>
                    <Text style={[s.warningSub, { color: screenMut, textAlign: txtAlign }]}>{t('homeLowRecoverySub')}</Text>
                    <View style={{ flexDirection: rowDir, gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={{ backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
                        onPress={() => startSession(todaySession, todayStr, { deload: 'true' })}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>🏳️ {t('homeSwitchDeload')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ backgroundColor: '#EF444430', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 }}
                        onPress={() => startSession(todaySession, todayStr)}
                      >
                        <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>{t('homeTrainAnyway')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ),
            });
          }

          if (userProfile && (!userProfile.name || !userProfile.dateOfBirth || !userProfile.heightCm || !userProfile.weightKg || !userProfile.fitnessGoal)) {
            banners.push({
              key: 'profile_incomplete',
              priority: 3,
              render: () => (
                <TouchableOpacity
                  style={[s.warningBanner, { backgroundColor: pri + '15', borderColor: pri, marginBottom: 0, flexDirection: rowDir }]}
                  onPress={() => router.push('/profile' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={s.warningIcon}>👤</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.warningTitle, { color: pri, textAlign: txtAlign }]}>{t('homeCompleteProfile')}</Text>
                    <Text style={[s.warningSub, { color: screenMut, textAlign: txtAlign }]}>{t('homeCompleteProfileSub')}</Text>
                  </View>
                  <Text style={{ color: pri, fontSize: 18 }}>{isRTL ? '‹' : '›'}</Text>
                </TouchableOpacity>
              ),
            });
          }

          if (customProgram && !customProgram.assignedByCoach) {
            const progress = getProgramProgress(customProgram);
            if (progress.isComplete) {
              const suggestion = suggestNextProgram(
                customProgram,
                userProfile?.fitnessGoal || 'muscle_gain',
                userProfile?.experienceLevel || 'intermediate',
                userProfile?.equipment || 'full_gym',
              );
              banners.push({
                key: 'program_complete',
                priority: 4,
                render: () => (
                  <View style={[s.warningBanner, { backgroundColor: '#22C55E15', borderColor: '#22C55E', marginBottom: 0, flexDirection: rowDir }]}>
                    <Text style={s.warningIcon}>🌟</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.warningTitle, { color: '#22C55E', textAlign: txtAlign }]}>{t('homeProgramComplete')}</Text>
                      <Text style={[s.warningSub, { color: screenMut, textAlign: txtAlign }]}>{suggestion.reason}</Text>
                      <TouchableOpacity onPress={() => router.push('/program-setup' as any)} style={{ marginTop: 8 }}>
                        <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '700', textAlign: txtAlign }}>{t('homeSwitchTo', { name: suggestion.template.name })} →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ),
              });
            }
          }

          banners.sort((a, b) => a.priority - b.priority);
          if (banners.length === 0) return null;
          const currentBanner = banners[bannerIndex % banners.length];
          return (
            <View style={{ marginBottom: 8, position: 'relative' }}>
              {currentBanner.render()}
              {banners.length > 1 && (
                <TouchableOpacity
                  onPress={() => setBannerIndex((bannerIndex + 1) % banners.length)}
                  style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: '#00000040', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>+{banners.length - 1} ▼</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* ── Header ── */}
        <View style={[s.row, { alignItems: 'center', flexDirection: rowDir, marginBottom: StackLg }]}>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} activeOpacity={0.85}>
            {userProfile?.profilePhotoUri ? (
              <Image source={{ uri: userProfile.profilePhotoUri }} style={[s.avatarImg, { borderColor: pri }]} />
            ) : (
              <View style={[s.avatarPlaceholder, { backgroundColor: surf, borderColor: bord }]}>
                <Text style={s.avatarEmoji}>👤</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={[s.headerName, { color: screenFg, textAlign: txtAlign }]} numberOfLines={1}>{authUser?.name || userProfile?.name || t('athleteFallback')}</Text>
            <Text style={{ color: screenMut, fontSize: 12, textAlign: txtAlign }}>
              {t('homeThisWeekProgress', { done: localizeDigits(weekProgress.done, lang), planned: localizeDigits(weekProgress.planned, lang) })}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.syncPill, { backgroundColor: syncState?.linked ? '#22C55E15' : surf, borderColor: syncState?.linked ? '#22C55E40' : bord, marginHorizontal: 6 }]}
            onPress={() => router.push('/pin-sync' as any)}
            activeOpacity={0.7}
          >
            <View style={[s.syncDotSmall, { backgroundColor: syncState?.linked ? '#22C55E' : '#94A3B8' }]} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: surf, borderColor: bord }]} onPress={() => router.push('/progress-pictures' as any)}>
            <Text style={{ fontSize: 16 }}>📸</Text>
          </TouchableOpacity>
        </View>

        {/* ── Resume in-progress workout ── */}
        {resumableWorkout && (
          <TouchableOpacity
            style={[s.warningBanner, { backgroundColor: pri + '15', borderColor: pri, marginBottom: StackLg, flexDirection: rowDir }]}
            onPress={() => startSession(resumableWorkout.sessionType, todayStr)}
            activeOpacity={0.8}
          >
            <Text style={s.warningIcon}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.warningTitle, { color: pri, textAlign: txtAlign }]}>{t('homeInProgress', { name: getName(resumableWorkout.sessionType) })}</Text>
              <Text style={[s.warningSub, { color: mut, textAlign: txtAlign }]}>
                {t('homeInProgressSub', { n: resumableWorkout.exerciseLogs.filter(e => e.sets.length > 0).length, m: Math.round(resumableWorkout.elapsed / 60) })}
              </Text>
            </View>
            <View style={{ backgroundColor: pri, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
              <Text style={{ color: ink, fontWeight: '700', fontSize: 12 }}>{t('homeResume')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Schedule calendar ── */}
        <ScheduleCalendar
          mode={calMode}
          onModeChange={setCalMode}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          todayStr={todayStr}
          sessionForDate={sessionForDate}
          colorFor={getColor}
          completedDates={completedDates}
        />

        {/* ── Selected day card ── */}
        <View style={[s.dayCard, { backgroundColor: surf, borderColor: selIsRest ? bord : selColor + '55', marginTop: StackLg }]}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: selIsRest ? bord : selColor, opacity: 0.9 }} />
          <View style={{ padding: CardPadLg }}>
            <View style={{ flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between', marginBottom: Space._2 }}>
              <Text style={{ color: mut, fontSize: FontSize.eyebrow, fontWeight: FontWeight.semi, letterSpacing: 1 }}>
                {(relLabel ? `${relLabel} · ` : '') + longDate}
              </Text>
              {selDone && (
                <View style={{ backgroundColor: colors.successStrong + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: colors.successStrong, fontSize: 10, fontWeight: '800' }}>✓ {t('homeCompleted').toUpperCase()}</Text>
                </View>
              )}
            </View>

            {customProgram?.assignedByCoach && !selIsRest ? (
              <View style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', backgroundColor: colors.primarySoft, borderColor: colors.primaryEdge, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: Space._2 }}>
                <Text style={{ color: pri, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                  {t('homePlanBy', { name: customProgram.assignedByCoach.coachName }).toUpperCase()}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: rowDir, alignItems: 'center', marginBottom: Space._3 }}>
              <Text style={{ fontSize: 44, marginHorizontal: Space._3 }}>{getEmoji(selSession)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: fg, fontSize: FontSize.hero, fontWeight: FontWeight.heavy, letterSpacing: -0.2, textAlign: txtAlign }}>{getName(selSession)}</Text>
                <Text style={{ color: mut, fontSize: FontSize.body, lineHeight: 20, marginTop: 2, textAlign: txtAlign }}>
                  {selIsRest ? t('homeRestHint') : (bodyParts || t('homeExercises', { n: localizeDigits(selExercises.length, lang) }))}
                </Text>
              </View>
            </View>

            {/* Exercise preview */}
            {!selIsRest && selExercises.length > 0 && (
              <View style={{ marginBottom: Space._3, gap: 6 }}>
                {selExercises.slice(0, 5).map((ex, i) => (
                  <View key={`${ex.name}-${i}`} style={{ flexDirection: rowDir, alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: selColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: selColor, fontSize: 11, fontWeight: '800' }}>{localizeDigits(i + 1, lang)}</Text>
                    </View>
                    <Text style={{ color: fg, fontSize: FontSize.bodySm, fontWeight: '600', flex: 1, textAlign: txtAlign }} numberOfLines={1}>{ex.name}</Text>
                    <Text style={{ color: mut, fontSize: FontSize.meta }}>
                      {localizeDigits(ex.sets, lang)} × {ex.repsMin === 0 ? 'max' : `${localizeDigits(ex.repsMin, lang)}–${localizeDigits(ex.repsMax, lang)}`}
                    </Text>
                  </View>
                ))}
                {selExercises.length > 5 && (
                  <Text style={{ color: mut, fontSize: FontSize.meta, textAlign: txtAlign, marginTop: 2 }}>{t('homeMoreExercises', { n: localizeDigits(selExercises.length - 5, lang) })}</Text>
                )}
              </View>
            )}

            {/* No plan at all */}
            {!selIsRest && selExercises.length === 0 && (
              <View style={{ marginBottom: Space._3 }}>
                <Text style={{ color: fg, fontSize: FontSize.bodySm, fontWeight: '700', textAlign: txtAlign }}>{t('homeNoPlan')}</Text>
                <Text style={{ color: mut, fontSize: FontSize.meta, textAlign: txtAlign, marginTop: 2 }}>{t('homeNoPlanHint')}</Text>
                <TouchableOpacity onPress={() => router.push('/program-setup' as any)} style={{ marginTop: 8, alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
                  <Text style={{ color: pri, fontSize: 13, fontWeight: '700' }}>{t('homeSetUpProgram')} →</Text>
                </TouchableOpacity>
              </View>
            )}

            {!selIsRest && (
              <TouchableOpacity
                style={{
                  backgroundColor: selDone ? colors.successStrong : selColor,
                  borderRadius: Radius.button,
                  paddingVertical: Space._3 + 2,
                  alignItems: 'center',
                  ...Shadow.cta(selDone ? colors.successStrong : selColor),
                }}
                onPress={() => startSession(selSession, selectedDate)}
                activeOpacity={ActiveOpacity.primary}
                accessibilityLabel="start-session"
              >
                <Text style={{ color: '#fff', fontSize: FontSize.body + 1, fontWeight: FontWeight.bold }}>{startLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  avatarImg: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 20 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  dayCard: { borderRadius: Radius.hero, borderWidth: 1, overflow: 'hidden', ...Shadow.card },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: Space._2 + 2, borderRadius: Radius.button, borderWidth: 1.5, padding: Space._3, marginBottom: Space._3 },
  warningIcon: { fontSize: 20 },
  warningTitle: { fontSize: FontSize.bodySm, fontWeight: '700', marginBottom: 2 },
  warningSub: { fontSize: FontSize.meta, lineHeight: 16 },
  syncPill: { width: 32, height: 32, borderRadius: Radius.hero, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  syncDotSmall: { width: 8, height: 8, borderRadius: Radius.bar },
});
