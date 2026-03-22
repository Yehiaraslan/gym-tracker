import { useState, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList,
  TextInput,
  Platform,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { getSplitWorkouts, type SplitWorkoutSession } from '@/lib/split-workout-store';
import { SESSION_NAMES } from '@/lib/training-program';
import { BodyMeasurementsView } from '@/components/body-measurements';
import * as Haptics from 'expo-haptics';

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
  const { store, getWeightHistory } = useGym();
  const [viewMode, setViewMode] = useState<ViewMode>('workouts');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [splitWorkouts, setSplitWorkouts] = useState<SplitWorkoutSession[]>([]);

  // Reload split workouts every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      getSplitWorkouts().then(sessions => {
        const completed = sessions
          .filter(s => s.completed)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSplitWorkouts(completed);
      });
    }, [])
  );

  // Filter exercises by search
  const filteredExercises = store.exercises.filter(ex => {
    if (!searchQuery.trim()) return true;
    return ex.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleWorkout = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWorkout(expandedWorkout === id ? null : id);
  };

  const renderWorkoutItem = ({ item }: { item: SplitWorkoutSession }) => {
    const isExpanded = expandedWorkout === item.id;
    const sessionName = SESSION_NAMES[item.sessionType] ?? item.sessionType;
    const workingSets = item.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => !s.isWarmup).length, 0);
    const totalVolume = item.totalVolume ?? item.exercises.reduce((acc, ex) =>
      acc + ex.sets.reduce((s, set) => s + (set.weightKg * set.reps), 0), 0
    );
    const doneExercises = item.exercises.filter(ex => !ex.skipped);

    return (
      <TouchableOpacity onPress={() => toggleWorkout(item.id)} activeOpacity={0.7}>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionName, { color: colors.foreground }]}>{sessionName}</Text>
              <Text style={[styles.sessionDate, { color: colors.muted }]}>
                {formatSessionDate(item.date)}
                {item.durationMinutes ? `  ·  ${formatDuration(item.durationMinutes)}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[styles.badge, { backgroundColor: colors.success + '22' }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  {doneExercises.length} exercises
                </Text>
              </View>
              {workingSets > 0 && (
                <Text style={[styles.setsText, { color: colors.muted }]}>
                  {workingSets} sets · {Math.round(totalVolume).toLocaleString()} kg vol
                </Text>
              )}
            </View>
          </View>

          {/* Expanded exercises */}
          {isExpanded && (
            <View style={[styles.expandedArea, { borderTopColor: colors.border }]}>
              {item.exercises.map((ex, idx) => (
                <View key={idx} style={[styles.exerciseRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exerciseName, { color: ex.skipped ? colors.muted : colors.foreground }]}>
                      {ex.skipped ? '⊘ ' : ''}{ex.exerciseName}
                    </Text>
                    {ex.skipped && ex.skipReason ? (
                      <Text style={[styles.skipReason, { color: colors.muted }]}>Skipped: {ex.skipReason}</Text>
                    ) : null}
                  </View>
                  {!ex.skipped && ex.sets.filter(s => !s.isWarmup).length > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      {ex.sets.filter(s => !s.isWarmup).map((set, si) => (
                        <Text key={si} style={[styles.setDetail, { color: colors.muted }]}>
                          {set.weightKg > 0 ? `${set.weightKg}kg × ${set.reps}` : `${set.reps} reps`}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Expand chevron */}
          <View style={[styles.chevronRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.chevronText, { color: colors.muted }]}>
              {isExpanded ? '▲ Hide details' : '▼ Show exercises'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderExerciseItem = ({ item }: { item: typeof store.exercises[0] }) => {
    const history = getWeightHistory(item.id);
    const isSelected = selectedExercise === item.id;
    const maxWeight = history.length > 0 ? Math.max(...history.map(h => h.weight)) : null;

    return (
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedExercise(isSelected ? null : item.id);
        }}
        activeOpacity={0.7}
      >
        <View 
          className="bg-surface rounded-xl mx-4 mb-3 overflow-hidden"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <View className="p-4">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
                <Text className="text-sm text-muted mt-1">
                  {history.length} workout{history.length !== 1 ? 's' : ''} logged
                </Text>
              </View>
              {maxWeight !== null && (
                <View className="items-end">
                  <View className="flex-row items-center">
                    <IconSymbol name="trophy.fill" size={16} color={colors.warning} />
                    <Text className="ml-1 font-bold text-foreground">{maxWeight} kg</Text>
                  </View>
                  <Text className="text-xs text-muted">Best</Text>
                </View>
              )}
            </View>
          </View>

          {/* Weight History */}
          {isSelected && history.length > 0 && (
            <View 
              className="px-4 pb-4 pt-2 border-t"
              style={{ borderTopColor: colors.border }}
            >
              <Text className="text-sm font-medium text-muted mb-3">Weight History</Text>
              {history.slice(-10).reverse().map((entry, index) => (
                <View 
                  key={index}
                  className="flex-row justify-between items-center py-2 border-b"
                  style={{ borderBottomColor: colors.border }}
                >
                  <Text className="text-sm text-muted">{formatSessionDate(entry.date)}</Text>
                  <View className="flex-row items-center">
                    <Text className="font-semibold text-foreground">{entry.weight} kg</Text>
                    <Text className="text-sm text-muted ml-2">× {entry.reps} reps</Text>
                    {entry.weight === maxWeight && (
                      <IconSymbol name="trophy.fill" size={14} color={colors.warning} style={{ marginLeft: 8 }} />
                    )}
                  </View>
                </View>
              ))}
              {history.length > 10 && (
                <Text className="text-xs text-muted text-center mt-2">
                  Showing last 10 entries
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Workout History</Text>
        {splitWorkouts.length > 0 && (
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            {splitWorkouts.length} session{splitWorkouts.length !== 1 ? 's' : ''} completed
          </Text>
        )}
      </View>

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
            <Text style={[styles.toggleLabel, { color: viewMode === mode ? '#FFFFFF' : colors.foreground }]}>
              {mode === 'workouts' ? 'Workouts' : mode === 'exercises' ? 'Exercises' : 'Body'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search (exercises view) */}
      {viewMode === 'exercises' && (
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises..."
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
        </View>
      )}

      {/* Content */}
      {viewMode === 'workouts' ? (
        <FlatList
          data={splitWorkouts}
          keyExtractor={item => item.id}
          renderItem={renderWorkoutItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="dumbbell.fill" size={48} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Workouts Yet</Text>
              <Text style={[styles.emptyBody, { color: colors.muted }]}>
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
              <IconSymbol name="dumbbell.fill" size={48} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {searchQuery ? 'No Matching Exercises' : 'No Exercises Yet'}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.muted }]}>
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
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 2 },
  toggleRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 6 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleLabel: { fontSize: 13, fontWeight: '600' },
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchInput: { borderRadius: 12, padding: 14, borderWidth: 1, fontSize: 15 },
  card: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  sessionName: { fontSize: 16, fontWeight: '600' },
  sessionDate: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  setsText: { fontSize: 11, marginTop: 2 },
  expandedArea: { borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  exerciseName: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 },
  skipReason: { fontSize: 12, marginTop: 2 },
  setDetail: { fontSize: 13, marginBottom: 2 },
  chevronRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, alignItems: 'center' },
  chevronText: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
