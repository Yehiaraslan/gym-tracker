import { useState, useMemo } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { WorkoutLog, formatDate, getDayName } from '@/lib/types';
import * as Haptics from 'expo-haptics';

type ViewMode = 'workouts' | 'exercises';

export default function HistoryScreen() {
  const colors = useColors();
  const { store, getWeightHistory } = useGym();
  const [viewMode, setViewMode] = useState<ViewMode>('workouts');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  // Get completed workouts sorted by date
  const completedWorkouts = useMemo(() => {
    return [...store.workoutLogs]
      .filter(log => log.isCompleted)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  }, [store.workoutLogs]);

  // Filter exercises by search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return store.exercises;
    return store.exercises.filter(ex => 
      ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [store.exercises, searchQuery]);

  const toggleWorkout = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWorkout(expandedWorkout === id ? null : id);
  };

  const renderWorkoutItem = ({ item }: { item: WorkoutLog }) => {
    const isExpanded = expandedWorkout === item.id;
    const totalSets = item.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    
    return (
      <TouchableOpacity
        onPress={() => toggleWorkout(item.id)}
        activeOpacity={0.7}
      >
        <View 
          className="bg-surface rounded-xl mx-4 mb-3 overflow-hidden"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          {/* Header */}
          <View className="p-4">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-lg font-semibold text-foreground">
                  {formatDate(item.date)}
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Cycle {item.cycleNumber} • Week {item.weekNumber} • {getDayName(item.dayNumber)}
                </Text>
              </View>
              <View className="items-end">
                <View 
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.success + '20' }}
                >
                  <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>
                    {item.exercises.length} exercises
                  </Text>
                </View>
                <Text className="text-xs text-muted mt-1">{totalSets} sets</Text>
              </View>
            </View>
            
            <View className="flex-row items-center mt-3">
              <IconSymbol 
                name={isExpanded ? "chevron.right" : "chevron.right"} 
                size={16} 
                color={colors.muted} 
              />
              <Text className="text-sm text-muted ml-1">
                {isExpanded ? 'Tap to collapse' : 'Tap to expand'}
              </Text>
            </View>
          </View>

          {/* Expanded Content */}
          {isExpanded && (
            <View 
              className="px-4 pb-4 pt-2 border-t"
              style={{ borderTopColor: colors.border }}
            >
              {item.exercises.map((exerciseLog, index) => (
                <View 
                  key={index}
                  className="py-3 border-b"
                  style={{ borderBottomColor: colors.border }}
                >
                  <Text className="font-medium text-foreground mb-2">
                    {exerciseLog.exerciseName}
                  </Text>
                  <View className="flex-row flex-wrap">
                    {exerciseLog.sets.map((set, setIndex) => (
                      <View 
                        key={setIndex}
                        className="mr-2 mb-2 px-3 py-1 rounded-lg"
                        style={{ backgroundColor: colors.background }}
                      >
                        <Text className="text-sm text-foreground">
                          {set.weight}kg × {set.reps}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderExerciseItem = ({ item }: { item: typeof store.exercises[0] }) => {
    const history = getWeightHistory(item.id);
    const isSelected = selectedExercise === item.id;
    const latestWeight = history.length > 0 ? history[history.length - 1].weight : null;
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
                  <Text className="text-sm text-muted">{formatDate(entry.date)}</Text>
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
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">History</Text>
      </View>

      {/* View Mode Toggle */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('workouts');
          }}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            marginRight: 4,
            backgroundColor: viewMode === 'workouts' ? colors.primary : colors.surface,
          }}
        >
          <Text 
            style={{ 
              textAlign: 'center', 
              fontWeight: '600',
              color: viewMode === 'workouts' ? '#FFFFFF' : colors.foreground,
            }}
          >
            Workouts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('exercises');
          }}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            marginLeft: 4,
            backgroundColor: viewMode === 'exercises' ? colors.primary : colors.surface,
          }}
        >
          <Text 
            style={{ 
              textAlign: 'center', 
              fontWeight: '600',
              color: viewMode === 'exercises' ? '#FFFFFF' : colors.foreground,
            }}
          >
            Exercises
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search (for exercises view) */}
      {viewMode === 'exercises' && (
        <View className="px-4 mb-4">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises..."
            placeholderTextColor={colors.muted}
            className="bg-surface rounded-xl p-4 text-foreground"
            style={{ borderWidth: 1, borderColor: colors.border }}
          />
        </View>
      )}

      {/* Content */}
      {viewMode === 'workouts' ? (
        <FlatList
          data={completedWorkouts}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkoutItem}
          ListEmptyComponent={
            <View className="items-center py-12 px-4">
              <IconSymbol name="clock.fill" size={48} color={colors.muted} />
              <Text className="text-lg font-semibold text-foreground mt-4">No Workouts Yet</Text>
              <Text className="text-muted text-center mt-2">
                Complete your first workout to see it here
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseItem}
          ListEmptyComponent={
            <View className="items-center py-12 px-4">
              <IconSymbol name="dumbbell.fill" size={48} color={colors.muted} />
              <Text className="text-lg font-semibold text-foreground mt-4">
                {searchQuery ? 'No Matching Exercises' : 'No Exercises Yet'}
              </Text>
              <Text className="text-muted text-center mt-2">
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Add exercises in the Admin panel'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </ScreenContainer>
  );
}
