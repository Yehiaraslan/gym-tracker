import React, { useState, useCallback, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  StyleSheet,
  LayoutAnimation,
  UIManager,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { getSplitWorkouts, getSplitWeightHistory, type SplitWorkoutSession } from '@/lib/split-workout-store';
import { SESSION_NAMES, SESSION_COLORS, PROGRAM_SESSIONS, type SessionType } from '@/lib/training-program';
import { loadCustomProgram, type CustomProgram } from '@/lib/custom-program-store';
import { getTodaySessionFromSchedule } from '@/lib/schedule-store';
import { getTodayRecoveryData, type RecoveryData } from '@/lib/whoop-recovery-service';
import { getDailyNutrition } from '@/lib/nutrition-store';
import { getStreakData } from '@/lib/streak-tracker';
import { BodyMeasurementsView } from '@/components/body-measurements';
import * as Haptics from 'expo-haptics';
import {
  Space,
  Gutter,
  Radius,
  FontSize,
  FontWeight,
  Shadow,
  ActiveOpacity,
} from '@/lib/design-tokens';

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(mins?: number): string {
  if (!mins) return '';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

type ViewMode = 'workouts' | 'exercises' | 'body';

export default function HistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { store } = useGym();
  const [exerciseHistoryMap, setExerciseHistoryMap] = useState<Record<string, { date: string; weight: number; reps: number }[]>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('workouts');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [splitWorkouts, setSplitWorkouts] = useState<SplitWorkoutSession[]>([]);
  const [workoutSearchQuery, setWorkoutSearchQuery] = useState('');
  const [customProg, setCustomProg] = useState<CustomProgram | null>(null);
  const [todaySession, setTodaySession] = useState<string>('rest');
  const [customProgram, setCustomProgram] = useState<CustomProgram | null>(null);
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [nutritionLogged, setNutritionLogged] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  useEffect(() => { loadCustomProgram().then(setCustomProg); }, []);

  // Reload split workouts and exercise history every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      getTodaySessionFromSchedule().then(setTodaySession).catch(() => {});
      loadCustomProgram().then(setCustomProgram).catch(() => {});
      getTodayRecoveryData().then(setRecoveryData).catch(() => {});
      getDailyNutrition().then(n => setNutritionLogged(n ? n.meals.length > 0 : false)).catch(() => {});
      getStreakData().then(s => setCurrentStreak(s.currentStreak)).catch(() => {});
      getSplitWorkouts().then(sessions => {
        const completed = sessions
          .filter(s => s.completed)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSplitWorkouts(completed);
        // Build per-exercise weight history from split sessions
        const uniqueNames = Array.from(
          new Set(
            completed.flatMap(s => s.exercises.filter(e => !e.skipped).map(e => e.exerciseName))
          )
        );
        Promise.all(
          uniqueNames.map(name => getSplitWeightHistory(name).then(h => ({ name, h })))
        ).then(results => {
          const map: Record<string, { date: string; weight: number; reps: number }[]> = {};
          results.forEach(({ name, h }) => { map[name] = h; });
          setExerciseHistoryMap(map);
        });
      });
    }, [])
  );

  // Filter workouts by notes/session name keyword
  const filteredWorkouts = splitWorkouts.filter(w => {
    if (!workoutSearchQuery.trim()) return true;
    const q = workoutSearchQuery.toLowerCase();
    return (
      (w.notes ?? '').toLowerCase().includes(q) ||
      (customProg?.sessionNames?.[w.sessionType] ?? SESSION_NAMES[w.sessionType] ?? w.sessionType).toLowerCase().includes(q)
    );
  });

  // Filter exercises by search
  const filteredExercises = store.exercises.filter(ex => {
    if (!searchQuery.trim()) return true;
    return ex.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleWorkout = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWorkout(expandedWorkout === id ? null : id);
  };

  const renderWorkoutItem = ({ item }: { item: SplitWorkoutSession }) => {
    const isExpanded = expandedWorkout === item.id;
    const sessionName = customProg?.sessionNames?.[item.sessionType] ?? SESSION_NAMES[item.sessionType] ?? item.sessionType;
    const workingSets = item.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => !s.isWarmup).length, 0);
    const totalVolume = item.totalVolume ?? item.exercises.reduce((acc, ex) =>
      acc + ex.sets.reduce((s, set) => s + (set.weightKg * set.reps), 0), 0
    );
    // Count exercises that have at least one completed working set (not just non-skipped)
    const doneExercises = item.exercises.filter(ex =>
      !ex.skipped && ex.sets.some(s => !s.isWarmup && s.reps > 0)
    );

    return (
      <TouchableOpacity onPress={() => toggleWorkout(item.id)} activeOpacity={0.7}>
        <View style={[styles.card, { borderColor: colors.cardBorder, backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionName, { color: colors.cardForeground }]}>{sessionName}</Text>
              <Text style={[styles.sessionDate, { color: colors.cardMuted }]}>
                {formatSessionDate(item.date)}
                {item.durationMinutes ? `  ·  ${formatDuration(item.durationMinutes)}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {item.hasPRs && (
                <View style={[styles.badge, { backgroundColor: '#F59E0B22', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                  <Text style={{ fontSize: 11 }}>🏆</Text>
                  <Text style={[styles.badgeText, { color: '#F59E0B' }]}>New PR</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: colors.success + '22' }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  {doneExercises.length} exercises
                </Text>
              </View>
              {workingSets > 0 && (
                <Text style={[styles.setsText, { color: colors.cardMuted }]}>
                  {workingSets} sets · {Math.round(totalVolume).toLocaleString()} kg vol
                </Text>
              )}
            </View>
          </View>

          {/* Expanded exercises */}
          {isExpanded && (
            <View style={[styles.expandedArea, { borderTopColor: colors.cardBorder }]}>
              {item.exercises.map((ex, idx) => (
                <View key={idx} style={[styles.exerciseRow, { borderBottomColor: colors.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exerciseName, { color: ex.skipped ? colors.cardMuted : colors.cardForeground }]}>
                      {ex.skipped ? '⊘ ' : ''}{ex.exerciseName}
                    </Text>
                    {ex.skipped && ex.skipReason ? (
                      <Text style={[styles.skipReason, { color: colors.cardMuted }]}>Skipped: {ex.skipReason}</Text>
                    ) : null}
                  </View>
                  {!ex.skipped && ex.sets.filter(s => !s.isWarmup).length > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      {ex.sets.filter(s => !s.isWarmup).map((set, si) => (
                        <Text key={si} style={[styles.setDetail, { color: colors.cardMuted }]}>
                          {set.weightKg > 0 ? `${set.weightKg}kg × ${set.reps}` : `${set.reps} reps`}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Session notes (shown when expanded) */}
          {isExpanded && item.notes ? (
            <View style={[{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }]}>
              <View style={{ backgroundColor: '#6366F110', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#6366F130' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#6366F1', marginBottom: 3 }}>SESSION NOTES</Text>
                <Text style={{ fontSize: 13, color: colors.cardForeground, lineHeight: 18 }}>{item.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* Exercise swap history (shown when expanded and swaps exist) */}
          {isExpanded && item.swapLog && item.swapLog.length > 0 ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }}>
              <View style={{ backgroundColor: '#F59E0B10', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F59E0B30' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#F59E0B', marginBottom: 6 }}>
                  🔄 EXERCISE SWAPS ({item.swapLog.length})
                </Text>
                {item.swapLog.map((swap, si) => (
                  <View key={si} style={{ marginBottom: si < item.swapLog!.length - 1 ? 8 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.cardMuted, textDecorationLine: 'line-through' }}>
                        {swap.originalExercise}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#F59E0B' }}>→</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.cardForeground }}>
                        {swap.replacementExercise}
                      </Text>
                    </View>
                    {swap.zakiVerification ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 }}>
                        <Text style={{ fontSize: 11 }}>
                          {swap.zakiVerification.suitable ? '✅' : '⚠️'}
                        </Text>
                        <Text style={{ fontSize: 11, color: swap.zakiVerification.suitable ? '#22C55E' : '#F59E0B', flex: 1 }}>
                          Zaki: {swap.zakiVerification.message}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={{ fontSize: 11, color: colors.cardMuted, marginTop: 2 }}>
                      {new Date(swap.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {/* Expand chevron */}
          <View style={[styles.chevronRow, { borderTopColor: colors.cardBorder }]}>
            <Text style={[styles.chevronText, { color: colors.cardMuted }]}>
              {isExpanded ? '▲ Hide details' : '▼ Show exercises'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderExerciseItem = ({ item }: { item: typeof store.exercises[0] }) => {
    // Use split workout history (keyed by name) as the primary data source
    const history = exerciseHistoryMap[item.name] ?? [];
    const isSelected = selectedExercise === item.id;
    const maxWeight = history.length > 0 ? Math.max(...history.map(h => h.weight)) : null;

    return (
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setSelectedExercise(isSelected ? null : item.id);
        }}
        activeOpacity={0.7}
      >
        <View 
          className="bg-surface rounded-xl mx-4 mb-3 overflow-hidden"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <View className="p-4">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-cardForeground">{item.name}</Text>
                <Text className="text-sm text-cardMuted mt-1">
                  {history.length} workout{history.length !== 1 ? 's' : ''} logged
                </Text>
              </View>
              {maxWeight !== null && (
                <View className="items-end">
                  <View className="flex-row items-center">
                    <IconSymbol name="trophy.fill" size={16} color={colors.warning} />
                    <Text className="ml-1 font-bold text-cardForeground">{maxWeight} kg</Text>
                  </View>
                  <Text className="text-xs text-cardMuted">Best</Text>
                </View>
              )}
            </View>
          </View>

          {/* Weight History */}
          {isSelected && history.length > 0 && (
            <View 
              className="px-4 pb-4 pt-2 border-t"
              style={{ borderTopColor: colors.cardBorder }}
            >
              <Text className="text-sm font-medium text-cardMuted mb-3">Weight History</Text>
              {history.slice(-10).reverse().map((entry, index) => (
                <View 
                  key={index}
                  className="flex-row justify-between items-center py-2 border-b"
                  style={{ borderBottomColor: colors.cardBorder }}
                >
                  <Text className="text-sm text-cardMuted">{formatSessionDate(entry.date)}</Text>
                  <View className="flex-row items-center">
                    <Text className="font-semibold text-cardForeground">{entry.weight} kg</Text>
                    <Text className="text-sm text-cardMuted ml-2">× {entry.reps} reps</Text>
                    {entry.weight === maxWeight && (
                      <IconSymbol name="trophy.fill" size={14} color={colors.warning} style={{ marginLeft: 8 }} />
                    )}
                  </View>
                </View>
              ))}
              {history.length > 10 && (
                <Text className="text-xs text-cardMuted text-center mt-2">
                  Showing last 10 entries
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  function getSessionEmoji(sessionId: string): string {
    const emojis: Record<string, string> = { 'upper-a': '💪', 'lower-a': '🦵', 'upper-b': '🏋️', 'lower-b': '🔥', rest: '😴' };
    if (emojis[sessionId]) return emojis[sessionId];
    const name = (customProgram?.sessionNames?.[sessionId] || sessionId).toLowerCase();
    if (name.includes('push')) return '💪';
    if (name.includes('pull')) return '🦶';
    if (name.includes('leg')) return '🦵';
    if (name.includes('upper')) return '🏋️';
    return '🏋️';
  }

  function getSessionName(sessionId: string): string {
    if (customProgram?.sessionNames?.[sessionId]) return customProgram.sessionNames[sessionId];
    return SESSION_NAMES[sessionId as keyof typeof SESSION_NAMES] || sessionId;
  }

  function getExerciseCount(sessionId: string): number {
    if (customProgram?.sessions?.[sessionId]) return customProgram.sessions[sessionId].length;
    const defaultSessions = PROGRAM_SESSIONS as Record<string, any[]>;
    return defaultSessions[sessionId]?.length ?? 8;
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.cardForeground }]}>Workout History</Text>
        {splitWorkouts.length > 0 && (
          <Text style={[styles.headerSub, { color: colors.cardMuted }]}>
            {splitWorkouts.length} session{splitWorkouts.length !== 1 ? 's' : ''} completed
          </Text>
        )}
      </View>

      {/* Mission Briefing */}
      {todaySession !== 'rest' && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.hero,
          padding: Space._4,
          marginBottom: Space._4,
          marginHorizontal: Gutter,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}>
          {/* Mission Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space._3 }}>
            <Text style={{ fontSize: 28 }}>{getSessionEmoji(todaySession)}</Text>
            <View style={{ marginLeft: Space._3, flex: 1 }}>
              <Text style={{ color: colors.cardMuted, fontSize: FontSize.tiny + 1, fontWeight: FontWeight.bold, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                TODAY'S MISSION
              </Text>
              <Text style={{ color: colors.cardForeground, fontSize: FontSize.title, fontWeight: FontWeight.heavy }}>
                {getSessionName(todaySession)}
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(200, 245, 60, 0.14)', borderRadius: Radius.chip, paddingHorizontal: Space._2, paddingVertical: Space._1 }}>
              <Text style={{ color: colors.primary, fontSize: FontSize.eyebrow, fontWeight: FontWeight.bold }}>+100 XP</Text>
            </View>
          </View>

          {/* Readiness Indicators */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>{recoveryData && recoveryData.recoveryScore >= 67 ? '���' : recoveryData && recoveryData.recoveryScore >= 34 ? '🟡' : '🔴'}</Text>
              <Text style={{ color: colors.cardMuted, fontSize: 12 }}>Recovery</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>{nutritionLogged ? '🟢' : '🔴'}</Text>
              <Text style={{ color: colors.cardMuted, fontSize: 12 }}>Nutrition</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>🔥</Text>
              <Text style={{ color: colors.cardMuted, fontSize: 12 }}>{currentStreak}d streak</Text>
            </View>
          </View>

          {/* Exercise count + Start button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.cardMuted, fontSize: 12 }}>
                {getExerciseCount(todaySession)} exercises · ~60 min
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                router.push({ pathname: '/split-workout', params: { sessionType: todaySession, date: todayStr } } as any);
              }}
              activeOpacity={ActiveOpacity.primary}
              style={{
                backgroundColor: colors.primary,
                borderRadius: Radius.button,
                paddingHorizontal: Space._5,
                paddingVertical: Space._3,
                flexDirection: 'row',
                alignItems: 'center',
                gap: Space._2,
                ...Shadow.cta(),
              }}
            >
              <Text style={{ color: colors.primaryInk, fontSize: FontSize.body + 1, fontWeight: FontWeight.bold }}>Start Quest</Text>
              <Text style={{ fontSize: FontSize.body }}>⚔️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rest Day Mission Briefing */}
      {todaySession === 'rest' && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.hero,
          padding: Space._4,
          marginBottom: Space._4,
          marginHorizontal: Gutter,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 36, marginBottom: Space._2 }}>😴</Text>
          <Text style={{ color: colors.cardForeground, fontSize: FontSize.section, fontWeight: FontWeight.bold }}>Rest Day</Text>
          <Text style={{ color: colors.cardMuted, fontSize: FontSize.bodySm, marginTop: Space._1, textAlign: 'center' }}>
            Recovery is where gains are made. Focus on sleep, nutrition, and mobility.
          </Text>
          {currentStreak > 0 && (
            <Text style={{ color: '#F59E0B', fontSize: FontSize.meta, marginTop: Space._2 }}>🔥 {currentStreak} day streak — don't break it!</Text>
          )}
        </View>
      )}

      {/* View Mode Toggle */}
      <View style={styles.toggleRow}>
        {(['workouts', 'exercises', 'body'] as ViewMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode(mode);
            }}
            style={[styles.toggleBtn, { backgroundColor: viewMode === mode ? colors.primary : colors.surface }]}
          >
            <Text style={[styles.toggleLabel, { color: viewMode === mode ? colors.primaryInk : colors.cardForeground }]}>
              {mode === 'workouts' ? 'Workouts' : mode === 'exercises' ? 'Exercises' : 'Body'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search (workouts view — by notes or session name) */}
      {viewMode === 'workouts' && (
        <View style={styles.searchRow}>
          <TextInput
            value={workoutSearchQuery}
            onChangeText={setWorkoutSearchQuery}
            placeholder="Search by session name or notes..."
            placeholderTextColor={colors.cardMuted}
            style={[styles.searchInput, { color: colors.cardForeground, backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            returnKeyType="search"
          />
        </View>
      )}

      {/* Search (exercises view) */}
      {viewMode === 'exercises' && (
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises..."
            placeholderTextColor={colors.cardMuted}
            style={[styles.searchInput, { color: colors.cardForeground, backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          />
        </View>
      )}

      {/* Content */}
      {viewMode === 'workouts' ? (
        <FlatList
          data={filteredWorkouts}
          keyExtractor={item => item.id}
          renderItem={renderWorkoutItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="dumbbell.fill" size={48} color={colors.cardMuted} />
              <Text style={[styles.emptyTitle, { color: colors.cardForeground }]}>No Workouts Yet</Text>
              <Text style={[styles.emptyBody, { color: colors.cardMuted }]}>
                Complete your first workout to see it here
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : viewMode === 'exercises' ? (
        <FlatList
          data={filteredExercises}
          keyExtractor={item => item.id}
          renderItem={renderExerciseItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="dumbbell.fill" size={48} color={colors.cardMuted} />
              <Text style={[styles.emptyTitle, { color: colors.cardForeground }]}>
                {searchQuery ? 'No Matching Exercises' : 'No Exercises Yet'}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.cardMuted }]}>
                {searchQuery ? 'Try a different search term' : 'Add exercises in the Admin panel'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : (
        <BodyMeasurementsView />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Gutter, paddingTop: Space._2, paddingBottom: Space._3 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerSub: { fontSize: FontSize.bodySm, marginTop: 2 },
  toggleRow: { flexDirection: 'row', paddingHorizontal: Gutter, marginBottom: Space._3, gap: Space._2 - 2 },
  toggleBtn: { flex: 1, paddingVertical: Space._2 + 2, borderRadius: Radius.pill, alignItems: 'center' },
  toggleLabel: { fontSize: FontSize.bodySm, fontWeight: '600' },
  searchRow: { paddingHorizontal: Gutter, marginBottom: Space._3 },
  searchInput: { borderRadius: Radius.button, padding: Space._3 + 2, borderWidth: 1, fontSize: FontSize.body + 1 },
  card: { marginHorizontal: Gutter, marginBottom: Space._2 + 2, borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: Space._3 + 2 },
  sessionName: { fontSize: FontSize.section, fontWeight: '600' },
  sessionDate: { fontSize: FontSize.bodySm, marginTop: 2 },
  badge: { paddingHorizontal: Space._2 + 2, paddingVertical: 3, borderRadius: Radius.modal },
  badgeText: { fontSize: FontSize.meta, fontWeight: '600' },
  setsText: { fontSize: FontSize.eyebrow, marginTop: 2 },
  expandedArea: { borderTopWidth: 1, paddingHorizontal: Space._3 + 2, paddingTop: Space._2, paddingBottom: Space._1 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: Space._2, borderBottomWidth: StyleSheet.hairlineWidth },
  exerciseName: { fontSize: FontSize.body, fontWeight: '500', flex: 1, marginRight: Space._2 },
  skipReason: { fontSize: FontSize.meta, marginTop: 2 },
  setDetail: { fontSize: FontSize.bodySm, marginBottom: 2 },
  chevronRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: Space._2, alignItems: 'center' },
  chevronText: { fontSize: FontSize.meta },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: Space._8 },
  emptyTitle: { fontSize: FontSize.title, fontWeight: '600', marginTop: Space._4 },
  emptyBody: { fontSize: FontSize.body, textAlign: 'center', marginTop: Space._2, lineHeight: 20 },
});
