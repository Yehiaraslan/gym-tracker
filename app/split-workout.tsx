// ============================================================
// SPLIT WORKOUT SCREEN — Upper/Lower session with smart features
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SplitSetLogger } from '@/components/split-set-logger';
import { VolumeTracker } from '@/components/volume-tracker';
import { useColors } from '@/hooks/use-colors';
import { RecoveryBanner } from '@/components/recovery-banner';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import {
  type SessionType,
  PROGRAM_SESSIONS,
  SESSION_NAMES,
  SESSION_COLORS,
  getTodaySession,
  type ProgramExercise,
} from '@/lib/training-program';
import {
  type SplitSetLog,
  type SplitExerciseLog,
  type SplitWorkoutSession,
  getLastSessionOfType,
  saveSplitWorkout,
  getSmartWeightSuggestion,
  getConsecutiveTopRange,
} from '@/lib/split-workout-store';
import { calculateVolumeLoad, deloadWeight, getWarmupSets } from '@/lib/fitness-utils';
import { checkProgressiveOverload, saveRecommendation } from '@/lib/coach-engine';
import { recordWorkout } from '@/lib/streak-tracker';
import { generateId } from '@/lib/types';

export default function SplitWorkoutScreen() {
  useKeepAwake();

  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ session?: string; deload?: string }>();

  const sessionType = (params.session as SessionType) || getTodaySession();
  const [isDeload, setIsDeload] = useState(params.deload === 'true');
  const exercises = sessionType !== 'rest' ? PROGRAM_SESSIONS[sessionType] : [];

  const [started, setStarted] = useState(false);
  const [previousSession, setPreviousSession] = useState<SplitWorkoutSession | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<SplitExerciseLog[]>([]);
  const [weightSuggestions, setWeightSuggestions] = useState<Record<string, { weight: number; reason: string }>>({});
  const [progressionHints, setProgressionHints] = useState<Record<string, boolean>>({});
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [restTime, setRestTime] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restExerciseName, setRestExerciseName] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load previous session + suggestions
  useEffect(() => {
    if (sessionType === 'rest') return;

    (async () => {
      const prev = await getLastSessionOfType(sessionType);
      setPreviousSession(prev || null);

      // Load smart weight suggestions for each exercise
      const suggestions: Record<string, { weight: number; reason: string }> = {};
      const hints: Record<string, boolean> = {};

      for (const ex of exercises) {
        const suggestion = await getSmartWeightSuggestion(sessionType, ex, isDeload);
        if (suggestion) suggestions[ex.name] = suggestion;

        const consecutive = await getConsecutiveTopRange(sessionType, ex.name, ex.repsMax);
        hints[ex.name] = consecutive >= 1 && !isDeload;
      }

      setWeightSuggestions(suggestions);
      setProgressionHints(hints);
    })();
  }, [sessionType]);

  // Elapsed timer
  useEffect(() => {
    if (started && startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, startTime]);

  // Rest timer
  useEffect(() => {
    if (isResting && restTime > 0) {
      restRef.current = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            setIsResting(false);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [isResting, restTime]);

  const startWorkout = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = new Date();
    setStartTime(now);
    setStarted(true);
    setExerciseLogs(exercises.map(ex => ({
      exerciseName: ex.name,
      sets: [],
      skipped: false,
    })));
  };

  const handleSetLogged = useCallback((exerciseIndex: number, weight: number, reps: number, rpe?: number) => {
    setExerciseLogs(prev => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIndex] };
      ex.sets = [...ex.sets, {
        setNumber: ex.sets.length + 1,
        weightKg: weight,
        reps,
        rpe,
        timestamp: new Date().toISOString(),
      }];
      updated[exerciseIndex] = ex;
      return updated;
    });

    // Start rest timer
    const exercise = exercises[exerciseIndex];
    setRestTime(exercise.restSeconds);
    setIsResting(true);
    setRestExerciseName(exercise.name);

    // Check progressive overload
    const displaySets = isDeload ? Math.ceil(exercises[exerciseIndex].sets / 2) : exercises[exerciseIndex].sets;
    const currentSets = exerciseLogs[exerciseIndex]?.sets || [];
    const allSets = [...currentSets.map(s => ({ weight: s.weightKg, reps: s.reps })), { weight, reps }];

    if (allSets.length >= displaySets) {
      const rec = checkProgressiveOverload(
        exercises[exerciseIndex].name,
        allSets,
        exercises[exerciseIndex].repsMax,
        exercises[exerciseIndex].muscleGroup,
      );
      if (rec) {
        saveRecommendation(rec);
        // Toast would go here in a real implementation
      }
    }
  }, [exercises, exerciseLogs, isDeload]);

  const handleSkip = useCallback((exerciseIndex: number) => {
    setExerciseLogs(prev => {
      const updated = [...prev];
      updated[exerciseIndex] = { ...updated[exerciseIndex], skipped: true };
      return updated;
    });
  }, []);

  const finishWorkout = async () => {
    if (!startTime) return;
    const now = new Date();
    const duration = Math.floor((now.getTime() - startTime.getTime()) / 60000);

    const totalVolume = exerciseLogs.reduce((total, ex) =>
      total + calculateVolumeLoad(ex.sets.filter(s => !s.isWarmup).map(s => ({ weight: s.weightKg, reps: s.reps }))), 0);

    const session: SplitWorkoutSession = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      sessionType,
      exercises: exerciseLogs,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      completed: true,
      durationMinutes: duration,
      totalVolume,
    };

    await saveSplitWorkout(session);
    await recordWorkout();

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert('Workout Complete! 💪', `${SESSION_NAMES[sessionType]}\n${duration}m · ${totalVolume.toLocaleString()}kg volume`, [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const totalSetsLogged = exerciseLogs.reduce((sum, ex) => sum + ex.sets.filter(s => !s.isWarmup).length, 0);
  const totalSetsTarget = exercises.reduce((sum, ex) => sum + (isDeload ? Math.ceil(ex.sets / 2) : ex.sets), 0);
  const overallProgress = totalSetsTarget > 0 ? totalSetsLogged / totalSetsTarget : 0;

  // ---- Rest day ----
  if (sessionType === 'rest') {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <Text style={{ fontSize: 64 }}>😴</Text>
        <Text className="text-2xl font-bold text-foreground mt-4">Rest Day</Text>
        <Text className="text-muted text-center mt-2">Recovery is where the gains happen.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-8 px-6 py-3 rounded-xl"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Text className="font-semibold text-foreground">Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ---- Pre-workout ----
  if (!started) {
    const sessionColor = SESSION_COLORS[sessionType];

    return (
      <ScreenContainer className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Header */}
          <View className="px-6 pt-4 pb-2">
            <TouchableOpacity onPress={() => router.back()} className="mb-4">
              <IconSymbol name="chevron.left" size={24} color={colors.muted} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">{SESSION_NAMES[sessionType]}</Text>
            <Text className="text-sm text-muted mt-1">{exercises.length} exercises</Text>
          </View>

          {/* Session type selector */}
          <View className="px-6 mb-4">
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {(['upper-a', 'lower-a', 'upper-b', 'lower-b'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => router.setParams({ session: s })}
                  className="flex-1 py-3 px-2 rounded-xl items-center"
                  style={{
                    backgroundColor: sessionType === s ? SESSION_COLORS[s] : colors.surface,
                    borderWidth: 1,
                    borderColor: sessionType === s ? SESSION_COLORS[s] : colors.border,
                    minWidth: '45%',
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: sessionType === s ? '#FFFFFF' : colors.muted }}
                  >
                    {SESSION_NAMES[s].split('—')[0].trim()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* WHOOP Recovery Banner */}
          <View className="px-6 mb-4">
            <RecoveryBanner onSuggestDeload={() => setIsDeload(true)} />
          </View>
          {/* Exercise preview */}
          <View className="px-6 mb-4">
            <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              {exercises.map((ex, i) => {
                const suggestion = weightSuggestions[ex.name];
                const displaySets = isDeload ? Math.ceil(ex.sets / 2) : ex.sets;
                return (
                  <View
                    key={i}
                    className="flex-row items-center py-3"
                    style={i < exercises.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}}
                  >
                    <View
                      className="w-7 h-7 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: sessionColor + '20' }}
                    >
                      <Text className="text-xs font-bold" style={{ color: sessionColor }}>{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{ex.name}</Text>
                      <Text className="text-xs text-muted mt-0.5">
                        {displaySets} × {ex.repsMin === 0 ? 'max' : `${ex.repsMin}-${ex.repsMax}`}
                        {suggestion ? ` · ${suggestion.weight}kg` : ''}
                      </Text>
                    </View>
                    {suggestion && (
                      <Text className="text-xs font-medium" style={{ color: colors.primary }}>
                        {suggestion.weight}kg
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Previous session */}
          {previousSession && (
            <View className="px-6 mb-4">
              <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text className="text-xs text-muted mb-1">Last Session</Text>
                <Text className="text-sm text-foreground">
                  {new Date(previousSession.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  {previousSession.durationMinutes ? ` · ${previousSession.durationMinutes}m` : ''}
                  {previousSession.totalVolume ? ` · ${previousSession.totalVolume.toLocaleString()}kg` : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Start button */}
          <View className="px-6">
            <TouchableOpacity
              onPress={startWorkout}
              className="py-5 rounded-2xl flex-row items-center justify-center"
              style={{ backgroundColor: sessionColor }}
            >
              <IconSymbol name="play.fill" size={22} color="#FFFFFF" />
              <Text className="text-white font-bold text-lg ml-2">Start Workout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ---- Active workout ----
  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-base font-bold text-foreground">{SESSION_NAMES[sessionType]}</Text>
            <Text className="text-xs text-muted">
              ⏱ {formatTime(elapsed)} · {totalSetsLogged}/{totalSetsTarget} sets
            </Text>
          </View>
          <TouchableOpacity
            onPress={finishWorkout}
            className="px-4 py-2 rounded-xl"
            style={{ backgroundColor: '#10B981' }}
          >
            <Text className="text-white text-sm font-semibold">Finish</Text>
          </TouchableOpacity>
        </View>
        <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, overallProgress * 100)}%`, backgroundColor: SESSION_COLORS[sessionType] }}
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Rest timer overlay */}
        {isResting && (
          <View
            className="rounded-2xl p-6 items-center mb-4"
            style={{ backgroundColor: '#F59E0B' + '10', borderWidth: 2, borderColor: '#F59E0B' + '40' }}
          >
            <Text className="text-5xl font-bold text-foreground">{formatTime(restTime)}</Text>
            <Text className="text-sm text-muted mt-1">Rest · {restExerciseName}</Text>
            <TouchableOpacity
              onPress={() => { setIsResting(false); setRestTime(0); if (restRef.current) clearInterval(restRef.current); }}
              className="mt-4 px-6 py-2 rounded-xl"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-white font-semibold">Skip Rest</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Exercise cards */}
        {exercises.map((ex, i) => {
          const displaySets = isDeload ? Math.ceil(ex.sets / 2) : ex.sets;
          const prevExLog = previousSession?.exercises.find(e => e.exerciseName === ex.name);
          const logs = exerciseLogs[i];
          const isSkipped = logs?.skipped;
          const completedSets = logs?.sets.filter(s => !s.isWarmup).length || 0;
          const isComplete = completedSets >= displaySets;
          const suggestion = weightSuggestions[ex.name];
          const showHint = progressionHints[ex.name] || false;

          return (
            <View key={ex.name} className="mb-3">
              {/* Exercise header */}
              <View
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: isComplete ? '#10B981' + '08' : isSkipped ? colors.surface + '60' : colors.surface,
                  borderWidth: 1,
                  borderColor: isComplete ? '#10B981' + '30' : isSkipped ? colors.border + '50' : colors.border,
                  opacity: isSkipped ? 0.5 : 1,
                }}
              >
                <View className="px-4 py-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: isComplete ? '#10B981' + '20' : SESSION_COLORS[sessionType] + '20' }}
                      >
                        {isComplete ? (
                          <IconSymbol name="checkmark.circle.fill" size={18} color="#10B981" />
                        ) : (
                          <Text className="text-xs font-bold" style={{ color: SESSION_COLORS[sessionType] }}>
                            {completedSets}/{displaySets}
                          </Text>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-base font-semibold"
                          style={{ color: isComplete ? '#10B981' : colors.foreground }}
                        >
                          {ex.name}
                        </Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {displaySets} × {ex.repsMin === 0 ? 'max' : `${ex.repsMin}-${ex.repsMax}`} · {Math.floor(ex.restSeconds / 60)}m rest
                          {isDeload ? ' · DELOAD' : ''}
                        </Text>
                        {ex.notes ? <Text className="text-xs text-muted italic mt-0.5">{ex.notes}</Text> : null}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Previous session reference */}
                {prevExLog && !isSkipped && (
                  <View className="px-4 pb-2">
                    <View className="rounded-xl p-2" style={{ backgroundColor: colors.background }}>
                      <Text className="text-xs text-muted mb-1">Previous Session</Text>
                      <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                        {prevExLog.sets.filter(s => !s.isWarmup).map((s, si) => (
                          <View key={si} className="px-2 py-1 rounded-lg" style={{ backgroundColor: colors.border + '50' }}>
                            <Text className="text-xs text-muted">S{si + 1}: {s.weightKg}kg×{s.reps}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Set loggers */}
                {!isSkipped && (
                  <View className="px-4 pb-3" style={{ gap: 6 }}>
                    {Array.from({ length: displaySets }).map((_, si) => {
                      const prevSet = prevExLog?.sets.filter(s => !s.isWarmup)[si];
                      const completedSet = logs?.sets.filter(s => !s.isWarmup)[si];
                      return (
                        <SplitSetLogger
                          key={si}
                          setNumber={si + 1}
                          targetRepsMin={ex.repsMin}
                          targetRepsMax={ex.repsMax}
                          previousSet={prevSet}
                          suggestedWeight={suggestion?.weight}
                          suggestedReason={si === 0 ? suggestion?.reason : undefined}
                          isDeload={isDeload}
                          isCompleted={si < completedSets}
                          completedSet={completedSet}
                          showProgressionHint={si === 0 && showHint}
                          onComplete={(w, r, rpe) => handleSetLogged(i, w, r, rpe)}
                        />
                      );
                    })}

                    {/* Skip button */}
                    {!isComplete && (
                      <TouchableOpacity
                        onPress={() => handleSkip(i)}
                        className="py-3 rounded-xl items-center flex-row justify-center"
                        style={{ borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}
                      >
                        <IconSymbol name="forward.fill" size={14} color={colors.muted} />
                        <Text className="text-sm text-muted ml-2">Skip Exercise</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Volume tracker */}
        {totalSetsLogged > 0 && (
          <View className="mb-4">
            <VolumeTracker
              exercises={exercises.map((ex, i) => ({
                exerciseName: ex.name,
                muscleGroup: ex.muscleGroup === 'upper' ? 'Upper Body' : 'Lower Body',
                completedSets: exerciseLogs[i]?.sets.filter(s => !s.isWarmup) || [],
                targetSets: isDeload ? Math.ceil(ex.sets / 2) : ex.sets,
              }))}
              previousSessionVolume={previousSession?.totalVolume}
            />
          </View>
        )}

        {/* Finish button */}
        <TouchableOpacity
          onPress={finishWorkout}
          className="py-5 rounded-2xl flex-row items-center justify-center mb-4"
          style={{ backgroundColor: '#10B981' }}
        >
          <Text style={{ fontSize: 20 }}>🏆</Text>
          <Text className="text-white font-bold text-lg ml-2">Complete Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
