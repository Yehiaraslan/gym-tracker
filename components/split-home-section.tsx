// ============================================================
// SPLIT HOME SECTION — Upper/Lower program card for home screen
// ============================================================

import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getTodaySession,
  SESSION_NAMES,
  SESSION_COLORS,
  PROGRAM_SESSIONS,
  getMesocycleInfo,
  type SessionType,
} from '@/lib/training-program';
import {
  getRecentSplitWorkouts,
  getLastSessionOfType,
  type SplitWorkoutSession,
} from '@/lib/split-workout-store';
import { getMesocycleStartDate, getActiveRecommendations, type CoachRecommendation } from '@/lib/coach-engine';

export function SplitHomeSection() {
  const colors = useColors();
  const router = useRouter();

  const todaySession = getTodaySession();
  const isRest = todaySession === 'rest';
  const sessionColor = SESSION_COLORS[todaySession];
  const exercises = !isRest ? PROGRAM_SESSIONS[todaySession] : [];

  const [mesoInfo, setMesoInfo] = useState<{ currentWeek: number; isDeload: boolean; daysUntilDeload: number } | null>(null);
  const [lastSession, setLastSession] = useState<SplitWorkoutSession | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [recommendations, setRecommendations] = useState<CoachRecommendation[]>([]);

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

      const recs = await getActiveRecommendations();
      setRecommendations(recs.slice(0, 2));
    })();
  }, []);

  const startSplitWorkout = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/split-workout?session=${todaySession}&deload=${mesoInfo?.isDeload || false}`);
  };

  return (
    <View className="px-6 mt-6 mb-4">
      {/* Section header */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-lg font-bold text-foreground">Upper/Lower Split</Text>
          {mesoInfo && (
            <Text className="text-xs text-muted mt-0.5">
              Week {mesoInfo.currentWeek}/5
              {mesoInfo.isDeload ? ' — DELOAD WEEK' : ` · ${mesoInfo.daysUntilDeload}d to deload`}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push('/next-week')}
          className="flex-row items-center px-3 py-1.5 rounded-full"
          style={{ backgroundColor: colors.primary + '15' }}
        >
          <Text className="text-xs font-medium" style={{ color: colors.primary }}>Preview</Text>
          <IconSymbol name="chevron.right" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Today's session card */}
      {!isRest ? (
        <TouchableOpacity
          onPress={startSplitWorkout}
          activeOpacity={0.8}
          className="rounded-2xl p-5 mb-3"
          style={{
            backgroundColor: sessionColor + '12',
            borderWidth: 1.5,
            borderColor: sessionColor + '35',
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs font-medium" style={{ color: sessionColor, textTransform: 'uppercase', letterSpacing: 1 }}>
                Today's Split Workout
              </Text>
              <Text className="text-xl font-bold text-foreground mt-1">
                {SESSION_NAMES[todaySession]}
              </Text>
              <Text className="text-sm text-muted mt-1">
                {exercises.length} exercises · 9:00 PM
                {mesoInfo?.isDeload ? ' · Deload' : ''}
              </Text>
              {lastSession && (
                <Text className="text-xs text-muted mt-2">
                  Last: {new Date(lastSession.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {lastSession.durationMinutes ? ` · ${lastSession.durationMinutes}m` : ''}
                  {lastSession.totalVolume ? ` · ${(lastSession.totalVolume / 1000).toFixed(1)}t` : ''}
                </Text>
              )}
            </View>
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center"
              style={{ backgroundColor: sessionColor }}
            >
              <IconSymbol name="play.fill" size={22} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <View
          className="rounded-2xl p-5 mb-3"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <View className="flex-row items-center">
            <Text style={{ fontSize: 32 }}>😴</Text>
            <View className="ml-3">
              <Text className="text-base font-semibold text-foreground">Rest Day</Text>
              <Text className="text-sm text-muted">Recovery is where gains happen</Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick nav row */}
      <View className="flex-row" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/pr-board'); }}
          className="flex-1 flex-row items-center rounded-xl p-3"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 18 }}>🏆</Text>
          <Text className="text-sm font-medium text-foreground ml-2">PR Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/weekly-report'); }}
          className="flex-1 flex-row items-center rounded-xl p-3"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 18 }}>📋</Text>
          <Text className="text-sm font-medium text-foreground ml-2">Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/next-week'); }}
          className="flex-1 flex-row items-center rounded-xl p-3"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 18 }}>📅</Text>
          <Text className="text-sm font-medium text-foreground ml-2">Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/nutrition'); }}
          className="flex-1 flex-row items-center rounded-xl p-3"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontSize: 18 }}>🍗</Text>
          <Text className="text-sm font-medium text-foreground ml-2">Nutrition</Text>
        </TouchableOpacity>
      </View>

      {/* Coach recommendations */}
      {recommendations.length > 0 && (
        <View className="mt-3">
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
            const color = typeColors[rec.type] ?? '#6B7280';
            const icon = typeIcons[rec.type] ?? '💡';

            return (
              <View
                key={rec.id}
                className="rounded-xl p-3 mt-2"
                style={{ backgroundColor: color + '10', borderWidth: 1, borderColor: color + '25' }}
              >
                <View className="flex-row items-start">
                  <Text style={{ fontSize: 16 }}>{icon}</Text>
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

      {/* Recent split workouts */}
      {recentWorkouts.length > 0 && (
        <View className="mt-4">
          <Text className="text-xs font-medium text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Recent Split Workouts
          </Text>
          {recentWorkouts.slice(0, 3).map(w => (
            <View
              key={w.id}
              className="flex-row items-center rounded-xl p-3 mb-2"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="w-2 h-8 rounded-full mr-3" style={{ backgroundColor: SESSION_COLORS[w.sessionType] }} />
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">{SESSION_NAMES[w.sessionType]}</Text>
                <Text className="text-xs text-muted">
                  {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {w.durationMinutes ? ` · ${w.durationMinutes}m` : ''}
                </Text>
              </View>
              {w.totalVolume && (
                <Text className="text-sm font-semibold" style={{ color: SESSION_COLORS[w.sessionType] }}>
                  {(w.totalVolume / 1000).toFixed(1)}t
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
