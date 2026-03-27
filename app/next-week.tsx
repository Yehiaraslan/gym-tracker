// ============================================================
// NEXT WEEK PREVIEW — Shows upcoming 7 days with predicted weights
// ============================================================

import { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import {
  getNextWeekSchedule,
  getWeekSchedule,
  PROGRAM_SESSIONS,
  SESSION_NAMES,
  SESSION_COLORS,
  type SessionType,
  type ProgramExercise,
  getMesocycleInfo,
} from '@/lib/training-program';
import {
  getSmartWeightSuggestion,
  getLastSessionOfType,
  type SplitWorkoutSession,
} from '@/lib/split-workout-store';
import { getMesocycleStartDate } from '@/lib/coach-engine';
import { loadCustomProgram, type CustomProgram } from '@/lib/custom-program-store';

interface DayPreview {
  date: Date;
  dayName: string;
  session: SessionType;
  exercises: (ProgramExercise & { suggestedWeight?: number; suggestedReason?: string })[];
  previousSession?: SplitWorkoutSession;
}

export default function NextWeekScreen() {
  const colors = useColors();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(1); // 0 = this week, 1 = next week, -1 = last week
  const [days, setDays] = useState<DayPreview[]>([]);
  const [mesoInfo, setMesoInfo] = useState<{ currentWeek: number; isDeload: boolean } | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [customProg, setCustomProg] = useState<CustomProgram | null>(null);
  useEffect(() => { loadCustomProgram().then(setCustomProg); }, []);

  useEffect(() => {
    (async () => {
      const mesoStart = await getMesocycleStartDate();
      const meso = getMesocycleInfo(mesoStart);
      setMesoInfo(meso);

      // Calculate start date for the selected week
      const now = new Date();
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      const startDate = new Date(now);
      startDate.setDate(now.getDate() + daysUntilSunday + (weekOffset - 1) * 7);
      if (weekOffset === 0) {
        // This week: start from last Sunday
        startDate.setDate(now.getDate() - now.getDay());
      }
      startDate.setHours(0, 0, 0, 0);

      const schedule = getWeekSchedule(startDate);

      // Future week's deload status (rough estimate)
      const futureWeek = Math.min(meso.currentWeek + weekOffset, 5);
      const isFutureDeload = futureWeek === 5;

      const previews: DayPreview[] = [];

      for (const day of schedule) {
        if (day.session === 'rest') {
          previews.push({ ...day, exercises: [] });
          continue;
        }

        const exercises = PROGRAM_SESSIONS[day.session];
        const prev = await getLastSessionOfType(day.session);

        const enriched: DayPreview['exercises'] = [];
        for (const ex of exercises) {
          const suggestion = await getSmartWeightSuggestion(day.session, ex, isFutureDeload);
          enriched.push({
            ...ex,
            suggestedWeight: suggestion?.weight,
            suggestedReason: suggestion?.reason,
          });
        }

        previews.push({
          ...day,
          exercises: enriched,
          previousSession: prev || undefined,
        });
      }

      setDays(previews);
    })();
  }, [weekOffset]);

  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset} Weeks`;

  const isToday = (date: Date) => {
    const now = new Date();
    return date.toDateString() === now.toDateString();
  };

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <IconSymbol name="chevron.left" size={24} color={colors.muted} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Week Preview</Text>
          {mesoInfo && (
            <Text className="text-sm text-muted mt-1">
              Mesocycle Week {mesoInfo.currentWeek}/5
              {mesoInfo.isDeload ? ' — DELOAD' : ''}
            </Text>
          )}
        </View>

        {/* Week navigation */}
        <View className="px-6 mb-4">
          <View className="flex-row items-center justify-between rounded-2xl p-3" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <TouchableOpacity
              onPress={() => { setWeekOffset(o => o - 1); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              className="p-2"
            >
              <IconSymbol name="chevron.left" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text className="text-base font-semibold text-foreground">{weekLabel}</Text>
            <TouchableOpacity
              onPress={() => { setWeekOffset(o => o + 1); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              className="p-2"
            >
              <IconSymbol name="chevron.right" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Days */}
        {days.map((day, i) => {
          const isRest = day.session === 'rest';
          const sessionColor = customProg?.sessionColors?.[day.session] || SESSION_COLORS[day.session] || colors.primary;
          const today = isToday(day.date);
          const isExpanded = expandedDay === i;
          const dateStr = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <TouchableOpacity
              key={i}
              onPress={() => setExpandedDay(isExpanded ? null : i)}
              activeOpacity={0.7}
              className="mx-6 mb-3"
            >
              <View
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: today ? 2 : 1,
                  borderColor: today ? colors.primary : colors.border,
                }}
              >
                {/* Day header */}
                <View className="px-4 py-3 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View
                      className="w-3 h-10 rounded-full mr-3"
                      style={{ backgroundColor: sessionColor }}
                    />
                    <View>
                      <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Text className="text-base font-semibold text-foreground">{day.dayName}</Text>
                        <Text className="text-xs text-muted">{dateStr}</Text>
                        {today && (
                          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '20' }}>
                            <Text className="text-xs font-medium" style={{ color: colors.primary }}>TODAY</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm" style={{ color: isRest ? colors.muted : sessionColor }}>
                        {isRest ? '😴 Rest Day' : (customProg?.sessionNames?.[day.session] || SESSION_NAMES[day.session] || day.session)}
                      </Text>
                    </View>
                  </View>
                  {!isRest && (
                    <View className="flex-row items-center">
                      <Text className="text-xs text-muted mr-1">{day.exercises.length} exercises</Text>
                      <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={14} color={colors.muted} />
                    </View>
                  )}
                </View>

                {/* Expanded exercise list */}
                {isExpanded && !isRest && (
                  <View className="px-4 pb-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    {day.exercises.map((ex, ei) => {
                      const displaySets = mesoInfo?.isDeload ? Math.ceil(ex.sets / 2) : ex.sets;
                      return (
                        <View
                          key={ei}
                          className="flex-row items-center py-2.5"
                          style={ei < day.exercises.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border + '50' } : {}}
                        >
                          <View className="w-6 h-6 rounded-full items-center justify-center mr-3" style={{ backgroundColor: sessionColor + '15' }}>
                            <Text className="text-xs" style={{ color: sessionColor }}>{ei + 1}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm text-foreground">{ex.name}</Text>
                            <Text className="text-xs text-muted">
                              {displaySets} × {ex.repsMin === 0 ? 'max' : `${ex.repsMin}-${ex.repsMax}`}
                            </Text>
                          </View>
                          {ex.suggestedWeight && (
                            <View className="items-end">
                              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                                {ex.suggestedWeight}kg
                              </Text>
                              <Text className="text-xs text-muted" numberOfLines={1} style={{ maxWidth: 100 }}>
                                {ex.suggestedReason?.split('→')[0]?.trim() || ''}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Start this workout button (only for today/future) */}
                    {day.date >= new Date(new Date().setHours(0, 0, 0, 0)) && (
                      <TouchableOpacity
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          router.push(`/split-workout?session=${day.session}&deload=${mesoInfo?.isDeload || false}`);
                        }}
                        className="mt-3 py-3 rounded-xl flex-row items-center justify-center"
                        style={{ backgroundColor: sessionColor }}
                      >
                        <IconSymbol name="play.fill" size={16} color="#FFFFFF" />
                        <Text className="text-white font-semibold ml-2">Start This Workout</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}
