// ============================================================
// SPLIT WORKOUT SCREEN — Guided workout execution with
// embedded YouTube, smart suggestions, rest timers, and
// step-by-step set flow
// ============================================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SplitSetLogger } from '@/components/split-set-logger';
import { useColors } from '@/hooks/use-colors';
import { RecoveryBanner } from '@/components/recovery-banner';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Image } from 'expo-image';
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
  getExercisePR,
} from '@/lib/split-workout-store';
import { calculateVolumeLoad, deloadWeight, getWarmupSets, epley1RM } from '@/lib/fitness-utils';
import { checkProgressiveOverload, saveRecommendation } from '@/lib/coach-engine';
import { recordWorkout } from '@/lib/streak-tracker';
import { generateId } from '@/lib/types';
import { getExerciseByName } from '@/lib/data/exercise-library';
import { getTodayRecoveryData, type RecoveryData } from '@/lib/whoop-recovery-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SplitWorkoutScreen() {
  useKeepAwake();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ session?: string; deload?: string }>();
  const sessionType = (params.session as SessionType) || getTodaySession();
  const [isDeload, setIsDeload] = useState(params.deload === 'true');
  const exercises = sessionType !== 'rest' ? PROGRAM_SESSIONS[sessionType] : [];
  const sessionColor = SESSION_COLORS[sessionType] || colors.primary;

  // State
  const [started, setStarted] = useState(false);
  const [previousSession, setPreviousSession] = useState<SplitWorkoutSession | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<SplitExerciseLog[]>([]);
  const [weightSuggestions, setWeightSuggestions] = useState<Record<string, { weight: number; reason: string }>>({});
  const [progressionHints, setProgressionHints] = useState<Record<string, boolean>>({});
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);

  // Rest timer
  const [restTime, setRestTime] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restExerciseName, setRestExerciseName] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active exercise tracking
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoExercise, setVideoExercise] = useState<{ name: string; videoId: string } | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // Completion state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    duration: number;
    totalVolume: number;
    exercisesCompleted: number;
    setsCompleted: number;
    prs: { exercise: string; weight: number; reps: number; e1rm: number }[];
    previousVolume?: number;
  } | null>(null);

  // Scroll ref
  const scrollRef = useRef<ScrollView>(null);

  // Load previous session + suggestions
  useEffect(() => {
    if (sessionType === 'rest') return;
    (async () => {
      const prev = await getLastSessionOfType(sessionType);
      setPreviousSession(prev || null);

      const rec = await getTodayRecoveryData();
      setRecovery(rec);

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
    setActiveExerciseIndex(0);
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
    const restSecs = exercise.restSeconds;
    // Adjust rest based on recovery
    let adjustedRest = restSecs;
    if (recovery) {
      if (recovery.recoveryScore < 34) adjustedRest = Math.round(restSecs * 1.3);
      else if (recovery.recoveryScore < 67) adjustedRest = Math.round(restSecs * 1.1);
    }
    setRestTime(adjustedRest);
    setRestTotal(adjustedRest);
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
      if (rec) saveRecommendation(rec);

      // Auto-advance to next exercise
      if (exerciseIndex < exercises.length - 1) {
        setActiveExerciseIndex(exerciseIndex + 1);
      }
    }
  }, [exercises, exerciseLogs, isDeload, recovery]);

  const handleSkip = useCallback((exerciseIndex: number) => {
    setExerciseLogs(prev => {
      const updated = [...prev];
      updated[exerciseIndex] = { ...updated[exerciseIndex], skipped: true };
      return updated;
    });
    if (exerciseIndex < exercises.length - 1) {
      setActiveExerciseIndex(exerciseIndex + 1);
    }
  }, [exercises]);

  const openVideo = (exerciseName: string) => {
    const libEntry = getExerciseByName(exerciseName);
    if (libEntry?.videoId) {
      setVideoExercise({ name: exerciseName, videoId: libEntry.videoId });
      setVideoPlaying(true);
      setShowVideoModal(true);
    }
  };

  const finishWorkout = async () => {
    if (!startTime) return;
    const now = new Date();
    const duration = Math.floor((now.getTime() - startTime.getTime()) / 60000);

    const totalVolume = exerciseLogs.reduce((total, ex) =>
      total + calculateVolumeLoad(ex.sets.filter(s => !s.isWarmup).map(s => ({ weight: s.weightKg, reps: s.reps }))), 0);

    const exercisesCompleted = exerciseLogs.filter(ex => !ex.skipped && ex.sets.length > 0).length;
    const setsCompleted = exerciseLogs.reduce((sum, ex) => sum + ex.sets.filter(s => !s.isWarmup).length, 0);

    // Detect PRs using Epley formula
    const prs: { exercise: string; weight: number; reps: number; e1rm: number }[] = [];
    for (const exLog of exerciseLogs) {
      if (exLog.skipped) continue;
      const workingSets = exLog.sets.filter(s => !s.isWarmup);
      for (const set of workingSets) {
        const currentE1RM = epley1RM(set.weightKg, set.reps);
        const existingPR = await getExercisePR(exLog.exerciseName);
        if (!existingPR || currentE1RM > existingPR.e1rm) {
          prs.push({ exercise: exLog.exerciseName, weight: set.weightKg, reps: set.reps, e1rm: currentE1RM });
        }
      }
    }

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

    setSummaryData({
      duration,
      totalVolume,
      exercisesCompleted,
      setsCompleted,
      prs,
      previousVolume: previousSession?.totalVolume,
    });
    setShowSummary(true);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const formatDuration = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

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

  // ---- Workout Complete Summary ----
  if (showSummary && summaryData) {
    const volumeDelta = summaryData.previousVolume
      ? ((summaryData.totalVolume - summaryData.previousVolume) / summaryData.previousVolume * 100)
      : null;

    return (
      <ScreenContainer className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Hero */}
          <View className="items-center pt-12 pb-8 px-6">
            <Text style={{ fontSize: 64 }}>🏆</Text>
            <Text className="text-3xl font-bold text-foreground mt-4">Workout Complete!</Text>
            <Text className="text-base text-muted mt-2">{SESSION_NAMES[sessionType]}</Text>
          </View>

          {/* Stats Grid */}
          <View className="px-6 mb-6">
            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <IconSymbol name="timer" size={24} color={sessionColor} />
                <Text className="text-2xl font-bold text-foreground mt-2">{formatDuration(summaryData.duration)}</Text>
                <Text className="text-xs text-muted mt-1">Duration</Text>
                {previousSession?.durationMinutes && (
                  <Text className="text-xs mt-1" style={{ color: summaryData.duration <= previousSession.durationMinutes ? '#10B981' : '#F59E0B' }}>
                    {summaryData.duration <= previousSession.durationMinutes ? 'Faster' : 'Slower'} than last
                  </Text>
                )}
              </View>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <IconSymbol name="flame.fill" size={24} color="#FF6B35" />
                <Text className="text-2xl font-bold text-foreground mt-2">{(summaryData.totalVolume / 1000).toFixed(1)}t</Text>
                <Text className="text-xs text-muted mt-1">Volume</Text>
                {volumeDelta !== null && (
                  <Text className="text-xs mt-1" style={{ color: volumeDelta >= 0 ? '#10B981' : '#EF4444' }}>
                    {volumeDelta >= 0 ? '+' : ''}{volumeDelta.toFixed(1)}% vs last
                  </Text>
                )}
              </View>
            </View>
            <View className="flex-row mt-3" style={{ gap: 10 }}>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text className="text-2xl font-bold text-foreground">{summaryData.exercisesCompleted}</Text>
                <Text className="text-xs text-muted mt-1">Exercises</Text>
              </View>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Text className="text-2xl font-bold text-foreground">{summaryData.setsCompleted}</Text>
                <Text className="text-xs text-muted mt-1">Sets</Text>
              </View>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: summaryData.prs.length > 0 ? '#F59E0B15' : colors.surface, borderWidth: 1, borderColor: summaryData.prs.length > 0 ? '#F59E0B40' : colors.border }}>
                <Text className="text-2xl font-bold" style={{ color: summaryData.prs.length > 0 ? '#F59E0B' : colors.foreground }}>
                  {summaryData.prs.length}
                </Text>
                <Text className="text-xs text-muted mt-1">PRs</Text>
              </View>
            </View>
          </View>

          {/* PRs */}
          {summaryData.prs.length > 0 && (
            <View className="px-6 mb-6">
              <Text className="text-sm font-semibold text-foreground mb-3">Personal Records</Text>
              {summaryData.prs.map((pr, i) => (
                <View
                  key={i}
                  className="flex-row items-center rounded-xl p-3 mb-2"
                  style={{ backgroundColor: '#F59E0B12', borderWidth: 1, borderColor: '#F59E0B30' }}
                >
                  <Text style={{ fontSize: 20 }}>🏆</Text>
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-foreground">{pr.exercise}</Text>
                    <Text className="text-xs text-muted">{pr.weight}kg x {pr.reps} reps</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-bold" style={{ color: '#F59E0B' }}>~{pr.e1rm}kg</Text>
                    <Text className="text-xs text-muted">est. 1RM</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Exercise Breakdown */}
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-foreground mb-3">Exercise Breakdown</Text>
            {exerciseLogs.map((exLog, i) => {
              if (exLog.skipped) return null;
              const workingSets = exLog.sets.filter(s => !s.isWarmup);
              if (workingSets.length === 0) return null;
              const exVolume = calculateVolumeLoad(workingSets.map(s => ({ weight: s.weightKg, reps: s.reps })));
              return (
                <View
                  key={i}
                  className="flex-row items-center rounded-xl p-3 mb-2"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  <View
                    style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: sessionColor, marginRight: 12 }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">{exLog.exerciseName}</Text>
                    <Text className="text-xs text-muted">
                      {workingSets.map(s => `${s.weightKg}×${s.reps}`).join(' · ')}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold" style={{ color: sessionColor }}>
                    {(exVolume / 1000).toFixed(1)}t
                  </Text>
                </View>
              );
            })}
          </View>

          {/* AI Coach Analysis */}
          <View className="px-6 mb-4">
            <TouchableOpacity
              onPress={() => router.push('/ai-coaching-dashboard' as any)}
              className="rounded-2xl p-4 flex-row items-center"
              style={{ backgroundColor: '#6366F115', borderWidth: 1, borderColor: '#6366F140', gap: 10 }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22 }}>🧠</Text>
              <View style={{ flex: 1 }}>
                <Text className="text-sm font-bold text-foreground">Get AI Analysis</Text>
                <Text className="text-xs text-muted">Personalized insights on this workout</Text>
              </View>
              <Text style={{ color: '#6366F1', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          </View>
          {/* Done button */}
          <View className="px-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="py-5 rounded-2xl items-center"
              style={{ backgroundColor: sessionColor }}
            >
              <Text className="text-white font-bold text-lg">Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ---- Pre-workout ----
  if (!started) {
    return (
      <ScreenContainer className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Header */}
          <View className="px-6 pt-4 pb-2">
            <TouchableOpacity onPress={() => router.back()} className="mb-4">
              <IconSymbol name="chevron.left" size={24} color={colors.muted} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">{SESSION_NAMES[sessionType]}</Text>
            <Text className="text-sm text-muted mt-1">
              {exercises.length} exercises{isDeload ? ' · Deload Week' : ''}
            </Text>
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

          {/* Exercise preview with video thumbnails */}
          <View className="px-6 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3">Exercises</Text>
            {exercises.map((ex, i) => {
              const libEntry = getExerciseByName(ex.name);
              const suggestion = weightSuggestions[ex.name];
              const displaySets = isDeload ? Math.ceil(ex.sets / 2) : ex.sets;

              return (
                <View
                  key={i}
                  className="rounded-2xl mb-3 overflow-hidden"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  {/* Video thumbnail */}
                  {libEntry?.videoId && (
                    <TouchableOpacity onPress={() => openVideo(ex.name)} activeOpacity={0.8}>
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: `https://img.youtube.com/vi/${libEntry.videoId}/mqdefault.jpg` }}
                          style={{ width: '100%', height: 140, backgroundColor: colors.border }}
                          contentFit="cover"
                        />
                        <View style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
                        }}>
                          <View style={{
                            width: 48, height: 48, borderRadius: 24,
                            backgroundColor: 'rgba(255,0,0,0.85)',
                            justifyContent: 'center', alignItems: 'center',
                          }}>
                            <IconSymbol name="play.fill" size={22} color="#FFFFFF" />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Exercise info */}
                  <View className="p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <View
                            className="w-7 h-7 rounded-full items-center justify-center mr-3"
                            style={{ backgroundColor: sessionColor + '20' }}
                          >
                            <Text className="text-xs font-bold" style={{ color: sessionColor }}>{i + 1}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-semibold text-foreground">{ex.name}</Text>
                            <Text className="text-xs text-muted mt-0.5">
                              {displaySets} sets × {ex.repsMin === 0 ? 'max' : `${ex.repsMin}-${ex.repsMax} reps`}
                              {suggestion ? ` · ${suggestion.weight}kg` : ''}
                            </Text>
                          </View>
                        </View>
                        {ex.notes ? (
                          <Text className="text-xs text-muted italic mt-2 ml-10">{ex.notes}</Text>
                        ) : null}
                        {libEntry?.proTip ? (
                          <View className="mt-2 ml-10 rounded-lg p-2" style={{ backgroundColor: colors.primary + '08' }}>
                            <Text className="text-xs" style={{ color: colors.primary }}>
                              💡 {libEntry.proTip}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
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

        {/* Video Modal */}
        <VideoModal
          visible={showVideoModal}
          exercise={videoExercise}
          playing={videoPlaying}
          onClose={() => { setShowVideoModal(false); setVideoPlaying(false); }}
          onTogglePlay={() => setVideoPlaying(p => !p)}
          colors={colors}
        />
      </ScreenContainer>
    );
  }

  // ---- Active workout ----
  return (
    <ScreenContainer className="flex-1">
      {/* Sticky Header */}
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
            style={{ width: `${Math.min(100, overallProgress * 100)}%`, backgroundColor: sessionColor }}
          />
        </View>
      </View>

      <ScrollView ref={scrollRef} className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Rest timer card */}
        {isResting && (
          <View
            className="rounded-2xl p-6 items-center mb-4"
            style={{ backgroundColor: '#F59E0B10', borderWidth: 2, borderColor: '#F59E0B40' }}
          >
            <Text className="text-xs font-medium text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Rest Timer
            </Text>
            <Text className="text-5xl font-bold text-foreground">{formatTime(restTime)}</Text>
            <Text className="text-sm text-muted mt-1">{restExerciseName}</Text>
            {/* Progress ring (simplified as bar) */}
            <View className="w-full mt-4 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
              <View
                className="h-full rounded-full"
                style={{
                  width: restTotal > 0 ? `${((restTotal - restTime) / restTotal) * 100}%` : '0%',
                  backgroundColor: '#F59E0B',
                }}
              />
            </View>
            <TouchableOpacity
              onPress={() => { setIsResting(false); setRestTime(0); if (restRef.current) clearInterval(restRef.current); }}
              className="mt-4 px-8 py-3 rounded-xl"
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
          const isActive = i === activeExerciseIndex;
          const libEntry = getExerciseByName(ex.name);

          return (
            <View key={ex.name} className="mb-3">
              <View
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: isComplete ? '#10B98108' : isSkipped ? colors.surface + '60' : colors.surface,
                  borderWidth: isActive && !isComplete ? 2 : 1,
                  borderColor: isActive && !isComplete ? sessionColor : isComplete ? '#10B98130' : isSkipped ? colors.border + '50' : colors.border,
                  opacity: isSkipped ? 0.5 : 1,
                }}
              >
                {/* Exercise header with video button */}
                <TouchableOpacity
                  onPress={() => setActiveExerciseIndex(i)}
                  activeOpacity={0.7}
                  className="px-4 py-3"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: isComplete ? '#10B98120' : sessionColor + '20' }}
                      >
                        {isComplete ? (
                          <IconSymbol name="checkmark.circle.fill" size={18} color="#10B981" />
                        ) : (
                          <Text className="text-xs font-bold" style={{ color: sessionColor }}>
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

                    {/* History button */}
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push({ pathname: '/rep-history', params: { exercise: ex.name, exerciseType: '' } });
                      }}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center',
                        marginRight: libEntry?.videoId ? 4 : 0,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>📊</Text>
                    </TouchableOpacity>

                    {/* Video button */}
                    {libEntry?.videoId && (
                      <TouchableOpacity
                        onPress={() => openVideo(ex.name)}
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: '#FF000015', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <IconSymbol name="play.fill" size={16} color="#FF0000" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expanded content for active exercise */}
                {isActive && !isSkipped && (
                  <View>
                    {/* Embedded video thumbnail */}
                    {libEntry?.videoId && (
                      <TouchableOpacity onPress={() => openVideo(ex.name)} activeOpacity={0.8} className="mx-4 mb-3">
                        <View style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                          <Image
                            source={{ uri: `https://img.youtube.com/vi/${libEntry.videoId}/mqdefault.jpg` }}
                            style={{ width: '100%', height: 120, backgroundColor: colors.border }}
                            contentFit="cover"
                          />
                          <View style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
                          }}>
                            <View style={{
                              width: 40, height: 40, borderRadius: 20,
                              backgroundColor: 'rgba(255,0,0,0.85)',
                              justifyContent: 'center', alignItems: 'center',
                            }}>
                              <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Smart suggestion banner */}
                    {suggestion && !showHint && completedSets === 0 && (
                      <View className="mx-4 mb-3 rounded-xl p-3" style={{ backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '20' }}>
                        <Text className="text-xs" style={{ color: colors.primary }}>
                          💡 Suggested: <Text className="font-bold">{suggestion.weight}kg</Text> — {suggestion.reason}
                        </Text>
                      </View>
                    )}

                    {/* Recovery-adjusted rest info */}
                    {recovery && recovery.recoveryScore < 67 && completedSets === 0 && (
                      <View className="mx-4 mb-3 rounded-xl p-3" style={{ backgroundColor: '#F59E0B10', borderWidth: 1, borderColor: '#F59E0B20' }}>
                        <Text className="text-xs" style={{ color: '#F59E0B' }}>
                          ⚡ Recovery {Math.round(recovery.recoveryScore)}% — rest periods adjusted
                          {recovery.recoveryScore < 34 ? ' (+30%)' : ' (+10%)'}
                        </Text>
                      </View>
                    )}

                    {/* Previous session reference */}
                    {prevExLog && (
                      <View className="mx-4 mb-3">
                        <View className="rounded-xl p-2" style={{ backgroundColor: colors.background }}>
                          <Text className="text-xs text-muted mb-1">Previous Session</Text>
                          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                            {prevExLog.sets.filter(s => !s.isWarmup).map((s, si) => (
                              <View key={si} className="px-2 py-1 rounded-lg" style={{ backgroundColor: colors.border + '50' }}>
                                <Text className="text-xs text-muted">{s.weightKg}×{s.reps}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Set loggers */}
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
                  </View>
                )}

                {/* Collapsed completed sets summary */}
                {!isActive && completedSets > 0 && !isSkipped && (
                  <View className="px-4 pb-3">
                    <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                      {logs?.sets.filter(s => !s.isWarmup).map((s, si) => (
                        <View key={si} className="px-2 py-1 rounded-lg" style={{ backgroundColor: '#10B98115' }}>
                          <Text className="text-xs" style={{ color: '#10B981' }}>{s.weightKg}×{s.reps}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}

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

      {/* Video Modal */}
      <VideoModal
        visible={showVideoModal}
        exercise={videoExercise}
        playing={videoPlaying}
        onClose={() => { setShowVideoModal(false); setVideoPlaying(false); }}
        onTogglePlay={() => setVideoPlaying(p => !p)}
        colors={colors}
      />
    </ScreenContainer>
  );
}

// ---- Video Modal Component ----
function VideoModal({
  visible,
  exercise,
  playing,
  onClose,
  onTogglePlay,
  colors,
}: {
  visible: boolean;
  exercise: { name: string; videoId: string } | null;
  playing: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  if (!exercise) return null;
  const playerWidth = SCREEN_WIDTH - 32;
  const playerHeight = (playerWidth * 9) / 16;

  const libEntry = getExerciseByName(exercise.name);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: Platform.OS === 'ios' ? 60 : 12 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600', flex: 1 }}>{exercise.name}</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <IconSymbol name="xmark.circle.fill" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* YouTube Player */}
        <View style={{ paddingHorizontal: 16 }}>
          <YoutubePlayer
            height={playerHeight}
            width={playerWidth}
            play={playing}
            videoId={exercise.videoId}
            onChangeState={(state: string) => { if (state === 'ended') onTogglePlay(); }}
            webViewProps={{ allowsInlineMediaPlayback: true }}
          />
        </View>

        {/* Exercise guidance */}
        {libEntry && (
          <ScrollView style={{ maxHeight: 200, paddingHorizontal: 16, marginTop: 16 }}>
            {/* Key execution points */}
            {libEntry.execution.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Execution</Text>
                {libEntry.execution.map((step, i) => (
                  <Text key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4, lineHeight: 18 }}>
                    {i + 1}. {step}
                  </Text>
                ))}
              </View>
            )}
            {/* Breathing */}
            {libEntry.breathing && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Breathing</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 }}>{libEntry.breathing}</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Controls */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <TouchableOpacity
            onPress={onTogglePlay}
            style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconSymbol name={playing ? "pause.fill" : "play.fill"} size={20} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 8 }}>{playing ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
