import { useState, useMemo, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { getDayName } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { getSplitWorkouts } from '@/lib/split-workout-store';
import type { BodyPart } from '@/lib/types';

// Derive a fun emoji from the body parts of a program day's exercises
function getWorkoutEmoji(bodyParts: BodyPart[]): string {
  if (!bodyParts.length) return '😴';
  const parts = bodyParts.join(' ').toLowerCase();
  if (parts.includes('legs')) return '🦵';
  if (parts.includes('back')) return '🏋️';
  if (parts.includes('chest')) return '💪';
  if (parts.includes('shoulders')) return '🔥';
  if (parts.includes('arms')) return '💥';
  if (parts.includes('cardio')) return '🏃';
  if (parts.includes('core')) return '🎯';
  return '⚡';
}

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const colors = useColors();
  const { store, getProgramDay, getExerciseById, currentCycleInfo } = useGym();
  const [selectedWeek, setSelectedWeek] = useState(currentCycleInfo.week);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  // Load completed workout dates whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      getSplitWorkouts().then(sessions => {
        const dates = new Set(sessions.filter(s => s.completed).map(s => s.date));
        setCompletedDates(dates);
      });
    }, [])
  );

  // Get all configured days for the selected week
  const weekProgram = useMemo(() => {
    const days = [];
    for (let day = 1; day <= 7; day++) {
      const program = getProgramDay(selectedWeek, day);
      const start = new Date(store.settings.cycleStartDate);
      const offsetDays = (selectedWeek - 1) * 7 + (day - 1);
      const d = new Date(start);
      d.setDate(d.getDate() + offsetDays);
      const isoDate = d.toLocaleDateString('en-CA');
      days.push({
        dayNumber: day,
        dayName: getDayName(day),
        hasWorkout: !!(program && program.exercises.length > 0),
        exerciseCount: program?.exercises.length || 0,
        exercises: program?.exercises || [],
        workoutEmoji: getWorkoutEmoji(
          (program?.exercises ?? []).map(ex => getExerciseById(ex.exerciseId)?.bodyPart).filter(Boolean) as BodyPart[]
        ),
        isoDate,
      });
    }
    return days;
  }, [selectedWeek, store.programDays, store.settings.cycleStartDate]);

  // Calculate total workouts in the 8-week cycle
  const cycleStats = useMemo(() => {
    let totalWorkouts = 0;
    let totalExercises = 0;
    
    for (let week = 1; week <= 8; week++) {
      for (let day = 1; day <= 7; day++) {
        const program = getProgramDay(week, day);
        if (program && program.exercises.length > 0) {
          totalWorkouts++;
          totalExercises += program.exercises.length;
        }
      }
    }
    
    return { totalWorkouts, totalExercises };
  }, [store.programDays]);

  // Compute the ISO date string for any week/day combination using cycleStartDate
  const getDateForWeekDay = useCallback((week: number, day: number): string => {
    const start = new Date(store.settings.cycleStartDate);
    const offsetDays = (week - 1) * 7 + (day - 1);
    const d = new Date(start);
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA');
  }, [store.settings.cycleStartDate]);

  const selectedDayProgram = selectedDay ? weekProgram.find(d => d.dayNumber === selectedDay) : null;

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-cardForeground">8-Week Schedule</Text>
        <Text className="text-sm text-cardMuted mt-1">
          Cycle {currentCycleInfo.cycle} • Currently Week {currentCycleInfo.week}, {getDayName(currentCycleInfo.day)}
        </Text>
      </View>

      {/* Cycle Overview Stats */}
      <View className="flex-row px-4 mb-4">
        <View 
          className="flex-1 bg-surface rounded-xl p-4 mr-2"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <Text className="text-2xl font-bold text-cardForeground">{cycleStats.totalWorkouts}</Text>
          <Text className="text-sm text-cardMuted">Workout Days</Text>
        </View>
        <View 
          className="flex-1 bg-surface rounded-xl p-4 ml-2"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <Text className="text-2xl font-bold text-cardForeground">{cycleStats.totalExercises}</Text>
          <Text className="text-sm text-cardMuted">Total Exercises</Text>
        </View>
      </View>

      {/* Week Selector */}
      <View className="px-4 mb-4">
        <Text className="text-sm font-medium text-cardMuted mb-2">Select Week</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(week => {
            const isCurrentWeek = week === currentCycleInfo.week;
            const isSelected = week === selectedWeek;
            
            // Count workouts in this week
            let workoutCount = 0;
            for (let day = 1; day <= 7; day++) {
              const program = getProgramDay(week, day);
              if (program && program.exercises.length > 0) workoutCount++;
            }
            
            return (
              <TouchableOpacity
                key={week}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedWeek(week);
                  setSelectedDay(null);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  marginRight: 8,
                  borderWidth: isCurrentWeek && !isSelected ? 2 : 1,
                  borderColor: isCurrentWeek && !isSelected ? colors.success : isSelected ? colors.primary : colors.cardBorder,
                  minWidth: 70,
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: isSelected ? '#FFFFFF' : colors.cardForeground,
                  fontWeight: '700',
                  fontSize: 16,
                }}>
                  W{week}
                </Text>
                <Text style={{ 
                  color: isSelected ? 'rgba(255,255,255,0.8)' : colors.cardMuted,
                  fontSize: 11,
                  marginTop: 2,
                }}>
                  {workoutCount} days
                </Text>
                {isCurrentWeek && (
                  <View 
                    style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: 3, 
                      backgroundColor: isSelected ? '#FFFFFF' : colors.success,
                      marginTop: 4,
                    }} 
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Week Calendar Grid */}
      <View className="px-4 mb-4">
        <Text className="text-sm font-medium text-cardMuted mb-2">Week {selectedWeek} Schedule</Text>
        <View 
          className="bg-surface rounded-xl overflow-hidden"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        >
          {/* Day Headers */}
          <View className="flex-row border-b" style={{ borderBottomColor: colors.cardBorder }}>
            {DAYS_SHORT.map((day, index) => {
              const isToday = selectedWeek === currentCycleInfo.week && (index + 1) === currentCycleInfo.day;
              return (
                <View 
                  key={day} 
                  className="flex-1 py-2"
                  style={{ 
                    backgroundColor: isToday ? colors.primary + '20' : 'transparent',
                  }}
                >
                  <Text 
                    className="text-center text-xs font-medium"
                    style={{ color: isToday ? colors.primary : colors.cardMuted }}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Day Cells */}
          <View className="flex-row">
            {weekProgram.map((day) => {
              const isToday = selectedWeek === currentCycleInfo.week && day.dayNumber === currentCycleInfo.day;
              const isSelected = selectedDay === day.dayNumber;
              const isCompleted = completedDates.has(day.isoDate);
              const isPast = new Date(day.isoDate) < new Date(new Date().toLocaleDateString('en-CA'));
              
              return (
                <TouchableOpacity
                  key={day.dayNumber}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDay(isSelected ? null : day.dayNumber);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    alignItems: 'center',
                    backgroundColor: isSelected ? colors.primary + '10' : isToday ? colors.primary + '05' : 'transparent',
                    borderLeftWidth: day.dayNumber > 1 ? 1 : 0,
                    borderLeftColor: colors.cardBorder,
                  }}
                >
                  {day.hasWorkout ? (
                    <View 
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isCompleted
                          ? colors.success
                          : isToday
                          ? colors.primary
                          : isPast
                          ? colors.error + '40'
                          : colors.primary + '30',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {isCompleted ? (
                        <Text style={{ fontSize: 16 }}>✓</Text>
                      ) : (
                        <Text style={{ fontSize: 16 }}>{day.workoutEmoji}</Text>
                      )}
                    </View>
                  ) : (
                    <View 
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.cardBorder,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.cardMuted, fontSize: 14 }}>😴</Text>
                    </View>
                  )}
                  <Text 
                    className="text-xs mt-1"
                    style={{ color: isCompleted ? colors.success : day.hasWorkout ? colors.cardForeground : colors.cardMuted }}
                  >
                    {isCompleted ? 'Done' : day.exerciseCount > 0 ? `${day.exerciseCount} ex` : '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Selected Day Details */}
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {selectedDayProgram ? (
          <View 
            className="bg-surface rounded-xl p-4 mb-4"
            style={{ borderWidth: 1, borderColor: colors.cardBorder }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-lg font-semibold text-cardForeground">
                  {selectedDayProgram.dayName}
                </Text>
                <Text className="text-sm text-cardMuted">
                  Week {selectedWeek}
                </Text>
              </View>
              {selectedDayProgram.hasWorkout && (
                <View 
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.success + '20' }}
                >
                  <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>
                    {selectedDayProgram.exerciseCount} exercises
                  </Text>
                </View>
              )}
            </View>

            {selectedDayProgram.hasWorkout ? (
              <View>
                {selectedDayProgram.exercises.map((ex, index) => {
                  const exercise = getExerciseById(ex.exerciseId);
                  return (
                    <View 
                      key={index}
                      className="py-3 border-b"
                      style={{ borderBottomColor: colors.cardBorder }}
                    >
                      <Text className="font-medium text-cardForeground">
                        {index + 1}. {exercise?.name || 'Unknown'}
                      </Text>
                      <Text className="text-sm text-cardMuted mt-1">
                        {ex.sets} sets × {ex.reps} reps • Rest: {ex.restSeconds}s
                      </Text>
                      {exercise?.notes ? (
                        <Text className="text-xs mt-1" style={{ color: colors.warning }}>
                          📝 {exercise.notes}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="items-center py-6">
                <IconSymbol name="calendar" size={32} color={colors.cardMuted} />
                <Text className="text-cardMuted mt-2">Rest Day</Text>
                <Text className="text-sm text-cardMuted">No workout scheduled</Text>
              </View>
            )}
          </View>
        ) : (
          <View 
            className="bg-surface rounded-xl p-6 items-center mb-4"
            style={{ borderWidth: 1, borderColor: colors.cardBorder }}
          >
            <IconSymbol name="calendar" size={48} color={colors.cardMuted} />
            <Text className="text-cardForeground font-medium mt-4">Select a Day</Text>
            <Text className="text-sm text-cardMuted text-center mt-1">
              Tap on a day above to see the workout details
            </Text>
          </View>
        )}

        {/* Week Summary */}
        <View 
          className="bg-surface rounded-xl p-4 mb-8"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <Text className="text-sm font-medium text-cardMuted mb-3">Week {selectedWeek} Summary</Text>
          <View className="flex-row flex-wrap">
            {weekProgram.filter(d => d.hasWorkout).map((day) => (
              <View 
                key={day.dayNumber}
                className="mr-2 mb-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.background }}
              >
                <Text className="text-sm font-medium text-cardForeground">
                  {day.dayName.substring(0, 3)}
                </Text>
                <Text className="text-xs text-cardMuted">
                  {day.exerciseCount} exercises
                </Text>
              </View>
            ))}
            {weekProgram.filter(d => d.hasWorkout).length === 0 && (
              <Text className="text-cardMuted">No workouts configured for this week</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
