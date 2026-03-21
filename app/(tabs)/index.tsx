// ============================================================
// HOME SCREEN — Calendar Dashboard with Today's Workout
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getTodaySession,
  getSessionForDate,
  SESSION_NAMES,
  SESSION_COLORS,
  PROGRAM_SESSIONS,
  WEEKLY_SCHEDULE,
  getMesocycleInfo,
  NUTRITION_TARGETS,
  type SessionType,
} from '@/lib/training-program';
import {
  getRecentSplitWorkouts,
  getLastSessionOfType,
  getAllPRs,
  type SplitWorkoutSession,
} from '@/lib/split-workout-store';
import { getMesocycleStartDate, getActiveRecommendations, type CoachRecommendation } from '@/lib/coach-engine';
import { getStreakData, StreakData } from '@/lib/streak-tracker';
import { getTodayRecoveryData, type RecoveryData } from '@/lib/whoop-recovery-service';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();

  const todaySession = getTodaySession();
  const isRest = todaySession === 'rest';
  const sessionColor = isRest ? colors.muted : SESSION_COLORS[todaySession];
  const exercises = !isRest ? PROGRAM_SESSIONS[todaySession] : [];

  const [mesoInfo, setMesoInfo] = useState<{ currentWeek: number; isDeload: boolean; daysUntilDeload: number } | null>(null);
  const [lastSession, setLastSession] = useState<SplitWorkoutSession | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);
  const [prCount, setPrCount] = useState(0);

  // Build this week's calendar
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const result: { date: Date; label: string; session: SessionType; isToday: boolean; dateNum: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOfWeek + i);
      result.push({
        date: d,
        label: DAY_LABELS[i],
        session: getSessionForDate(d),
        isToday: d.toDateString() === today.toDateString(),
        dateNum: d.getDate(),
      });
    }
    return result;
  }, []);

  useEffect(() => {
    (async () => {
      const mesoStart = await getMesocycleStartDate();
      setMesoInfo(getMesocycleInfo(mesoStart));

      if (!isRest) {
        const prev = await getLastSessionOfType(todaySession);
        setLastSession(prev || null);
      }

      const recent = await getRecentSplitWorkouts(5);
      setRecentWorkouts(recent);

      const streak = await getStreakData();
      setStreakData(streak);

      const rec = await getTodayRecoveryData();
      setRecovery(rec);

      const recs = await getActiveRecommendations();
      setRecommendations(recs.slice(0, 3));

      const prs = await getAllPRs();
      setPrCount(Object.keys(prs).length);
    })();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const startWorkout = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/split-workout?session=${todaySession}&deload=${mesoInfo?.isDeload || false}`);
  };

  // Recovery zone
  const recoveryZone = recovery
    ? recovery.recoveryScore >= 67
      ? { color: '#10B981', label: 'High', icon: '🟢' }
      : recovery.recoveryScore >= 34
        ? { color: '#F59E0B', label: 'Moderate', icon: '🟡' }
        : { color: '#EF4444', label: 'Low', icon: '🔴' }
    : null;

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <Text className="text-sm text-muted">{today}</Text>
          <Text className="text-3xl font-bold text-foreground mt-1">Dashboard</Text>
        </View>

        {/* Weekly Calendar Strip */}
        <View className="px-4 py-4">
          <View className="flex-row justify-between">
            {weekDays.map((day, i) => {
              const daySession = day.session;
              const dayColor = daySession !== 'rest' ? SESSION_COLORS[daySession] : colors.border;
              const hasWorkout = daySession !== 'rest';
              // Check if this day has a completed workout
              const isCompleted = recentWorkouts.some(
                w => w.date === day.date.toISOString().split('T')[0] && w.completed
              );

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    if (day.isToday && !isRest) startWorkout();
                  }}
                  style={{
                    alignItems: 'center',
                    width: 44,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: day.isToday ? sessionColor + '15' : 'transparent',
                    borderWidth: day.isToday ? 2 : 0,
                    borderColor: day.isToday ? sessionColor : 'transparent',
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: day.isToday ? sessionColor : colors.muted }}
                  >
                    {day.label}
                  </Text>
                  <Text
                    className="text-lg font-bold mt-1"
                    style={{ color: day.isToday ? colors.foreground : colors.muted }}
                  >
                    {day.dateNum}
                  </Text>
                  {/* Dot indicator */}
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      marginTop: 4,
                      backgroundColor: isCompleted ? '#10B981' : hasWorkout ? dayColor : 'transparent',
                      opacity: isCompleted ? 1 : 0.5,
                    }}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Today's Workout Card — Primary CTA */}
        {!isRest ? (
          <View className="px-6 mb-4">
            <TouchableOpacity
              onPress={startWorkout}
              activeOpacity={0.8}
              style={{
                borderRadius: 20,
                padding: 20,
                backgroundColor: sessionColor + '12',
                borderWidth: 1.5,
                borderColor: sessionColor + '35',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: sessionColor, textTransform: 'uppercase', letterSpacing: 1.5 }}
                  >
                    Today's Workout
                  </Text>
                  <Text className="text-2xl font-bold text-foreground mt-1">
                    {SESSION_NAMES[todaySession]}
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    {exercises.length} exercises
                    {mesoInfo?.isDeload ? ' · Deload Week' : ''}
                  </Text>
                </View>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: sessionColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconSymbol name="play.fill" size={24} color="#FFFFFF" />
                </View>
              </View>

              {/* Exercise preview list */}
              <View
                className="mt-4 pt-4"
                style={{ borderTopWidth: 1, borderTopColor: sessionColor + '20' }}
              >
                {exercises.slice(0, 4).map((ex, i) => (
                  <View key={i} className="flex-row items-center py-1.5">
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: sessionColor + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Text className="text-xs font-bold" style={{ color: sessionColor }}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text className="text-xs text-muted">
                      {ex.sets} × {ex.repsMin}-{ex.repsMax}
                    </Text>
                  </View>
                ))}
                {exercises.length > 4 && (
                  <Text className="text-xs text-muted mt-1 ml-8">
                    +{exercises.length - 4} more exercises
                  </Text>
                )}
              </View>

              {/* Last session reference */}
              {lastSession && (
                <View
                  className="mt-3 pt-3"
                  style={{ borderTopWidth: 1, borderTopColor: sessionColor + '15' }}
                >
                  <Text className="text-xs text-muted">
                    Last: {new Date(lastSession.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {lastSession.durationMinutes ? ` · ${lastSession.durationMinutes}m` : ''}
                    {lastSession.totalVolume ? ` · ${(lastSession.totalVolume / 1000).toFixed(1)}t` : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="px-6 mb-4">
            <View
              style={{
                borderRadius: 20,
                padding: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center">
                <Text style={{ fontSize: 40 }}>😴</Text>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-bold text-foreground">Rest Day</Text>
                  <Text className="text-sm text-muted mt-1">
                    Recovery is where the gains happen. Stay hydrated and get quality sleep.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Quick Stats Row */}
        <View className="px-6 mb-4">
          <View className="flex-row" style={{ gap: 10 }}>
            {/* Streak */}
            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center mb-1">
                <IconSymbol name="flame.fill" size={16} color="#FF6B35" />
                <Text className="text-xs text-muted ml-1">Streak</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {streakData?.currentStreak ?? 0}
              </Text>
              <Text className="text-xs text-muted">days</Text>
            </View>

            {/* Recovery */}
            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center mb-1">
                <Text style={{ fontSize: 12 }}>{recoveryZone?.icon ?? '⚪'}</Text>
                <Text className="text-xs text-muted ml-1">Recovery</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {recovery ? `${Math.round(recovery.recoveryScore)}%` : '--'}
              </Text>
              <Text className="text-xs text-muted">{recoveryZone?.label ?? 'No data'}</Text>
            </View>

            {/* Mesocycle */}
            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center mb-1">
                <IconSymbol name="chart.line.uptrend.xyaxis" size={14} color={colors.primary} />
                <Text className="text-xs text-muted ml-1">Meso</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {mesoInfo ? `W${mesoInfo.currentWeek}` : '--'}
              </Text>
              <Text className="text-xs text-muted">
                {mesoInfo?.isDeload ? 'Deload' : `of 5`}
              </Text>
            </View>
          </View>
        </View>

        {/* Recovery Insight (if connected) */}
        {recovery && (
          <View className="px-6 mb-4">
            <View
              className="rounded-2xl p-4"
              style={{
                backgroundColor: recoveryZone!.color + '10',
                borderWidth: 1,
                borderColor: recoveryZone!.color + '25',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Text style={{ fontSize: 14 }}>{recoveryZone!.icon}</Text>
                  <Text
                    className="text-xs font-semibold ml-1.5"
                    style={{ color: recoveryZone!.color, textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    WHOOP Recovery
                  </Text>
                </View>
                <Text className="text-2xl font-black" style={{ color: recoveryZone!.color }}>
                  {Math.round(recovery.recoveryScore)}%
                </Text>
              </View>
              <Text className="text-sm text-foreground mt-2">
                {recovery.recoveryScore >= 67
                  ? 'Excellent recovery — train hard today!'
                  : recovery.recoveryScore >= 34
                    ? 'Moderate recovery — consider reducing intensity.'
                    : 'Low recovery — rest or light session recommended.'}
              </Text>
              {(recovery.strain > 0 || recovery.sleepScore > 0) && (
                <View className="flex-row mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: recoveryZone!.color + '15', gap: 16 }}>
                  {recovery.strain > 0 && (
                    <View>
                      <Text className="text-xs text-muted">Strain</Text>
                      <Text className="text-sm font-semibold text-foreground">{recovery.strain.toFixed(1)}</Text>
                    </View>
                  )}
                  {recovery.sleepScore > 0 && (
                    <View>
                      <Text className="text-xs text-muted">Sleep</Text>
                      <Text className="text-sm font-semibold text-foreground">{recovery.sleepScore}%</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Coach Recommendations */}
        {recommendations.length > 0 && (
          <View className="px-6 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3">Smart Recommendations</Text>
            {recommendations.map(rec => {
              const typeColors: Record<string, string> = {
                nutrition: '#F59E0B',
                training: '#3B82F6',
                recovery: '#8B5CF6',
                overload: '#10B981',
              };
              const typeIcons: Record<string, string> = {
                nutrition: '🍗',
                training: '🏋️',
                recovery: '😴',
                overload: '📈',
              };
              const color = typeColors[rec.type] || colors.primary;
              const icon = typeIcons[rec.type] || '💡';

              return (
                <View
                  key={rec.id}
                  className="rounded-xl p-3 mb-2"
                  style={{ backgroundColor: color + '10', borderWidth: 1, borderColor: color + '20' }}
                >
                  <View className="flex-row items-start">
                    <Text style={{ fontSize: 14 }}>{icon}</Text>
                    <View className="ml-2 flex-1">
                      <Text className="text-sm font-semibold" style={{ color }}>{rec.message}</Text>
                      <Text className="text-xs text-muted mt-0.5">{rec.actionable}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Quick Nav */}
        <View className="px-6 mb-4">
          <Text className="text-sm font-semibold text-foreground mb-3">Quick Access</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/pr-board');
              }}
              className="flex-1 flex-row items-center rounded-xl p-3"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minWidth: '45%' }}
            >
              <Text style={{ fontSize: 18 }}>🏆</Text>
              <Text className="text-sm font-medium text-foreground ml-2">PR Board</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/weekly-report');
              }}
              className="flex-1 flex-row items-center rounded-xl p-3"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minWidth: '45%' }}
            >
              <Text style={{ fontSize: 18 }}>📋</Text>
              <Text className="text-sm font-medium text-foreground ml-2">Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/next-week');
              }}
              className="flex-1 flex-row items-center rounded-xl p-3"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minWidth: '45%' }}
            >
              <Text style={{ fontSize: 18 }}>📅</Text>
              <Text className="text-sm font-medium text-foreground ml-2">Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/nutrition');
              }}
              className="flex-1 flex-row items-center rounded-xl p-3"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minWidth: '45%' }}
            >
              <Text style={{ fontSize: 18 }}>🍗</Text>
              <Text className="text-sm font-medium text-foreground ml-2">Nutrition</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Workouts */}
        {recentWorkouts.length > 0 && (
          <View className="px-6 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3">Recent Workouts</Text>
            {recentWorkouts.slice(0, 4).map(w => (
              <View
                key={w.id}
                className="flex-row items-center rounded-xl p-3 mb-2"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <View
                  style={{
                    width: 4,
                    height: 32,
                    borderRadius: 2,
                    backgroundColor: SESSION_COLORS[w.sessionType],
                    marginRight: 12,
                  }}
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    {SESSION_NAMES[w.sessionType]}
                  </Text>
                  <Text className="text-xs text-muted">
                    {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {w.durationMinutes ? ` · ${w.durationMinutes}m` : ''}
                  </Text>
                </View>
                {w.totalVolume ? (
                  <Text className="text-sm font-semibold" style={{ color: SESSION_COLORS[w.sessionType] }}>
                    {(w.totalVolume / 1000).toFixed(1)}t
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
