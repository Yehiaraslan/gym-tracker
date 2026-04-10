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
  TextInput,
  Animated,
  Easing,
  Share,
  StyleSheet,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  getAlternativesForExercise,
  type AlternativeExercise,
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
  consumePendingWeights,
} from '@/lib/split-workout-store';
import { calculateVolumeLoad, deloadWeight, getWarmupSets, epley1RM } from '@/lib/fitness-utils';
import { localDateStr } from '@/lib/utils';
import { checkProgressiveOverload, saveRecommendation } from '@/lib/coach-engine';
import { recordWorkout } from '@/lib/streak-tracker';
import { generateId } from '@/lib/types';
import { awardWorkoutXP, awardPRXP } from '@/lib/xp-system';
import { XPLevelUpOverlay } from '@/components/xp-levelup-overlay';
import { loadStore, saveStore } from '@/lib/store';
import { getExerciseByName } from '@/lib/data/exercise-library';
import { getTodayRecoveryData, type RecoveryData } from '@/lib/whoop-recovery-service';
import {
  saveActiveWorkout,
  loadActiveWorkout,
  clearActiveWorkout,
} from '@/lib/active-workout-store';
import { trpc } from '@/lib/trpc';
import { loadCustomProgram } from '@/lib/custom-program-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SplitWorkoutScreen() {
  useKeepAwake();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionType?: string; session?: string; deload?: string }>();
  const sessionType = (params.sessionType as SessionType) || (params.session as SessionType) || getTodaySession();
  const [isDeload, setIsDeload] = useState(params.deload === 'true');
  const defaultExercises = sessionType !== 'rest' ? (PROGRAM_SESSIONS[sessionType] ?? []) : [];
  const [programExercises, setProgramExercises] = useState<ProgramExercise[]>(defaultExercises);
  const [swappableExercises, setSwappableExercises] = useState<ProgramExercise[]>([]);
  // Tracks the ORIGINAL exercise name for each slot — used for swap lookup so
  // swapping back works correctly on the 2nd/3rd attempt.
  const originalExerciseNamesRef = useRef<string[]>([]);

  // Load exercises from custom program if available, then apply saved swaps
  useEffect(() => {
    if (sessionType === 'rest') return;
    (async () => {
      // 1. Check custom program first
      let baseExercises = defaultExercises;
      try {
        const custom = await loadCustomProgram();
        if (custom?.sessions?.[sessionType]) {
          baseExercises = custom.sessions[sessionType];
          setProgramExercises(baseExercises);
        }
      } catch { /* use default */ }

      // 2. Record original exercise names (always from base, never from swaps)
      originalExerciseNamesRef.current = baseExercises.map(ex => ex.name);

      // 3. Apply saved swaps
      const key = `@gym_swap_${sessionType}`;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Record<number, ProgramExercise>;
          const updated = baseExercises.map((ex, i) => saved[i] ? { ...saved[i] } : ex);
          setSwappableExercises(updated);
        } catch { /* ignore */ }
      }
    })();
  }, [sessionType]);
  const exercises = swappableExercises.length > 0 ? swappableExercises : programExercises;
  // Dynamic session color and name: check custom program first, then defaults
  const [sessionColor, setSessionColor] = useState(SESSION_COLORS[sessionType] || colors.primary);
  const [sessionDisplayName, setSessionDisplayName] = useState(SESSION_NAMES[sessionType] || sessionType);
  const [customProg, setCustomProg] = useState<Awaited<ReturnType<typeof loadCustomProgram>>>(null);
  useEffect(() => {
    (async () => {
      try {
        const custom = await loadCustomProgram();
        setCustomProg(custom);
        if (custom?.sessionColors?.[sessionType]) {
          setSessionColor(custom.sessionColors[sessionType]);
        }
        if (custom?.sessionNames?.[sessionType]) {
          setSessionDisplayName(custom.sessionNames[sessionType]);
        }
      } catch { /* use default */ }
    })();
  }, [sessionType]);
  const resolveSessionName = (st: string): string => {
    if (customProg?.sessionNames?.[st]) return customProg.sessionNames[st];
    return SESSION_NAMES[st as keyof typeof SESSION_NAMES] || st;
  };
  const resolveSessionColor = (st: string): string => {
    if (customProg?.sessionColors?.[st]) return customProg.sessionColors[st];
    return SESSION_COLORS[st as keyof typeof SESSION_COLORS] || colors.primary;
  };

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
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [summaryData, setSummaryData] = useState<{
    duration: number;
    totalVolume: number;
    exercisesCompleted: number;
    setsCompleted: number;
    prs: { exercise: string; weight: number; reps: number; e1rm: number }[];
    previousVolume?: number;
  } | null>(null);

  // Sharing card
  const viewShotRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState(false);
  // XP Level-Up overlay
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<import('@/lib/types').PlayerLevel>('Novice');
  const [levelUpXP, setLevelUpXP] = useState(0);
  // PR Celebration overlay
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [celebrationPRs, setCelebrationPRs] = useState<{ exercise: string; weight: number; reps: number; e1rm: number }[]>([]);
  const [celebrationIndex, setCelebrationIndex] = useState(0);
  const prCardOpacity = useRef(new Animated.Value(0)).current;
  const prCardScale = useRef(new Animated.Value(0.7)).current;
  const prCardY = useRef(new Animated.Value(60)).current;
  // Confetti particles (stable refs)
  const CONFETTI_COUNT = 36;
  const confettiX = useRef(Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))).current;
  const confettiY = useRef(Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))).current;
  const confettiOpacity = useRef(Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))).current;
  const confettiRotate = useRef(Array.from({ length: CONFETTI_COUNT }, () => new Animated.Value(0))).current;
  const CONFETTI_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'];

  const launchPRCelebration = (prs: { exercise: string; weight: number; reps: number; e1rm: number }[]) => {
    if (prs.length === 0) return;
    setCelebrationPRs(prs);
    setCelebrationIndex(0);
    setShowPRCelebration(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset all animated values
    prCardOpacity.setValue(0);
    prCardScale.setValue(0.7);
    prCardY.setValue(60);
    confettiX.forEach((v, i) => v.setValue((Math.random() - 0.5) * SCREEN_WIDTH * 0.9));
    confettiY.forEach(v => v.setValue(-80));
    confettiOpacity.forEach(v => v.setValue(1));
    confettiRotate.forEach(v => v.setValue(0));

    // Card entrance
    Animated.parallel([
      Animated.spring(prCardScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(prCardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(prCardY, { toValue: 0, duration: 300, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start();

    // Confetti burst
    const confettiAnims = confettiX.map((_, i) =>
      Animated.parallel([
        Animated.timing(confettiY[i], {
          toValue: 400 + Math.random() * 300,
          duration: 1200 + Math.random() * 800,
          delay: Math.random() * 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(confettiOpacity[i], {
          toValue: 0,
          duration: 1400,
          delay: 600 + Math.random() * 400,
          useNativeDriver: true,
        }),
        Animated.timing(confettiRotate[i], {
          toValue: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4),
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(20, confettiAnims).start();
  };

  // Zaki workout modification (yellow recovery)
  const [zakiModifLoading, setZakiModifLoading] = useState(false);
  const [zakiModifResult, setZakiModifResult] = useState<string | null>(null);
  const [showZakiModif, setShowZakiModif] = useState(false);
  const zakiWorkoutModifMutation = trpc.zaki.workoutModification.useMutation();

  // Zaki mid-workout check-in
  const [showZakiCheckIn, setShowZakiCheckIn] = useState(false);
  const [zakiCheckInLoading, setZakiCheckInLoading] = useState(false);
  const [zakiCheckInResult, setZakiCheckInResult] = useState<string | null>(null);
  const [zakiCheckInSessionId, setZakiCheckInSessionId] = useState<string | undefined>(undefined);
  const zakiMidWorkoutMutation = trpc.zaki.midWorkoutCheckIn.useMutation();

  // Exercise swap
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<AlternativeExercise[]>([]);
  const [swapOriginalExercise, setSwapOriginalExercise] = useState<ProgramExercise | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Lighter alternative for the recovery nudge (Strength → Volume)
  const nudgeAlternative: SessionType | null = (() => {
    if (!recovery || recovery.recoveryScore >= 50 || nudgeDismissed || started) return null;
    if (sessionType === 'upper-a') return 'upper-b';
    if (sessionType === 'lower-a') return 'lower-b';
    return null;
  })();

  const handleOpenSwap = (exerciseIndex: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ex = exercises[exerciseIndex];
    if (!ex || sessionType === 'rest') return;
    // Always look up alternatives using the ORIGINAL exercise name so that
    // swapping back works correctly on the 2nd and 3rd attempt.
    const originalName = originalExerciseNamesRef.current[exerciseIndex] ?? ex.name;
    const alts = getAlternativesForExercise(originalName, sessionType as Exclude<SessionType, 'rest'>)
      // Exclude the exercise that is currently in this slot (already selected)
      .filter(a => a.name !== ex.name);
    // If the slot is currently swapped, prepend a "Restore original" option
    const isSwapped = ex.name !== originalName;
    const originalExercise = isSwapped
      ? programExercises[exerciseIndex] ?? exercises[exerciseIndex]
      : null;
    setSwapTargetIndex(exerciseIndex);
    setSwapAlternatives(alts);
    setSwapOriginalExercise(isSwapped ? originalExercise : null);
    setShowSwapModal(true);
  };

  const handleConfirmSwap = (alt: AlternativeExercise) => {
    if (swapTargetIndex === null) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = exercises.map((ex, i) => i === swapTargetIndex ? { ...alt } : ex);
    setSwappableExercises(updated);
    setExerciseLogs(prev => prev.map((log, i) =>
      i === swapTargetIndex ? { ...log, exerciseName: alt.name } : log
    ));
    // Persist swap so it's remembered in future sessions
    if (sessionType !== 'rest') {
      const swapMap: Record<number, ProgramExercise> = {};
      updated.forEach((ex, i) => {
        if (ex.name !== programExercises[i]?.name) swapMap[i] = ex;
      });
      AsyncStorage.setItem(`@gym_swap_${sessionType}`, JSON.stringify(swapMap)).catch(() => {});
    }
    setShowSwapModal(false);
    setSwapTargetIndex(null);
    setSwapOriginalExercise(null);
  };

  const handleZakiModification = async () => {
    if (!recovery) return;
    setZakiModifLoading(true);
    setShowZakiModif(true);
    try {
      const exList = exercises.map(ex => ({
        name: ex.name,
        sets: isDeload ? Math.ceil(ex.sets / 2) : ex.sets,
        reps: `${ex.repsMin}-${ex.repsMax}`,
        weight: weightSuggestions[ex.name]?.weight,
      }));
      const result = await zakiWorkoutModifMutation.mutateAsync({
        sessionName: sessionDisplayName,
        recoveryScore: recovery.recoveryScore,
        sleepHours: recovery.sleepScore ? recovery.sleepScore / 10 : undefined, // sleepScore 0-100 → approximate hours
        exercises: exList,
      });
      setZakiModifResult(result.response);
    } catch (e) {
      setZakiModifResult('Zaki is unavailable right now. Trust your body and reduce load by 10-15%.');
    } finally {
      setZakiModifLoading(false);
    }
  };

  const handleZakiCheckIn = async () => {
    setZakiCheckInLoading(true);
    setShowZakiCheckIn(true);
    try {
      // Build completed exercises summary from current exerciseLogs
      const completedExercises = exerciseLogs.map((log, idx) => {
        const ex = exercises[idx];
        const sets = log.sets;
        const avgWeight = sets.length > 0 ? sets.reduce((s, x) => s + x.weightKg, 0) / sets.length : undefined;
        const avgReps = sets.length > 0 ? sets.reduce((s, x) => s + x.reps, 0) / sets.length : undefined;
        const avgRpe = sets.some(x => x.rpe) ? sets.filter(x => x.rpe).reduce((s, x) => s + (x.rpe ?? 0), 0) / sets.filter(x => x.rpe).length : undefined;
        const setsTarget = isDeload ? Math.ceil(ex.sets / 2) : ex.sets;
        return {
          name: log.exerciseName,
          setsCompleted: sets.length,
          setsTarget,
          avgWeight: avgWeight ? Math.round(avgWeight * 10) / 10 : undefined,
          avgReps: avgReps ? Math.round(avgReps * 10) / 10 : undefined,
          avgRpe: avgRpe ? Math.round(avgRpe * 10) / 10 : undefined,
          skipped: log.skipped,
        };
      });

      // Remaining = exercises not yet started (no sets logged, not skipped)
      const remainingExercises = exerciseLogs
        .filter(log => log.sets.length === 0 && !log.skipped)
        .map(log => log.exerciseName);

      const result = await zakiMidWorkoutMutation.mutateAsync({
        sessionName: sessionDisplayName,
        elapsedMinutes: Math.round(elapsed / 60),
        recoveryScore: recovery?.recoveryScore,
        completedExercises,
        remainingExercises,
        zakiSessionId: zakiCheckInSessionId,
      });
      setZakiCheckInResult(result.response);
      if (result.zakiSessionId) setZakiCheckInSessionId(result.zakiSessionId);
    } catch {
      setZakiCheckInResult('Zaki is unavailable right now. Trust your instincts and listen to your body.');
    } finally {
      setZakiCheckInLoading(false);
    }
  };

  // Scroll ref
  const scrollRef = useRef<ScrollView>(null);
  // Resume flag — prevents double-loading
  const resumeChecked = useRef(false);

  // On mount: check for a resumable workout
  useEffect(() => {
    if (resumeChecked.current || sessionType === 'rest') return;
    resumeChecked.current = true;
    (async () => {
      const saved = await loadActiveWorkout();
      if (!saved || !saved.started || saved.sessionType !== sessionType) return;
      Alert.alert(
        'Resume Workout?',
        `You have an in-progress ${resolveSessionName(saved.sessionType)} workout. Continue where you left off?`,
        [
          {
            text: 'Start Fresh',
            style: 'destructive',
            onPress: async () => { await clearActiveWorkout(); },
          },
          {
            text: 'Resume',
            style: 'default',
            onPress: () => {
              setStarted(saved.started);
              setStartTime(new Date(saved.startTime));
              setExerciseLogs(saved.exerciseLogs);
              setActiveExerciseIndex(saved.activeExerciseIndex);
              setElapsed(saved.elapsed);
            },
          },
        ],
        { cancelable: false }
      );
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Override with Zaki's pending weights if the user tapped "Load These Weights"
      const pending = await consumePendingWeights();
      if (pending && Object.keys(pending).length > 0) {
        for (const ex of exercises) {
          const kg = pending[ex.name];
          if (kg && kg > 0) {
            suggestions[ex.name] = {
              weight: kg,
              reason: `💪 Zaki suggested ${kg}kg based on your schedule plan`,
            };
          }
        }
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

    // Persist workout state for resume-on-back
    setExerciseLogs(current => {
      if (started && startTime) {
        saveActiveWorkout({
          sessionType,
          isDeload,
          started: true,
          startTime: startTime.toISOString(),
          exerciseLogs: current,
          activeExerciseIndex: exerciseIndex,
          elapsed,
          savedAt: new Date().toISOString(),
        }).catch(() => {});
      }
      return current;
    });

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

  // ── Share workout card ──
  const handleShare = async () => {
    if (!summaryData || !viewShotRef.current) return;
    try {
      setIsSharing(true);
      // Small delay to let the card render fully
      await new Promise(r => setTimeout(r, 300));
      const uri = await (viewShotRef.current as any).capture();
      if (Platform.OS === 'web') {
        Alert.alert('Share', 'Sharing is only available on Android/iOS.');
        return;
      }
      await Share.share({
        url: uri,
        message: `💪 Just crushed ${sessionDisplayName}! ${summaryData.exercisesCompleted} exercises · ${(summaryData.totalVolume / 1000).toFixed(1)}t volume${summaryData.prs.length > 0 ? ` · ${summaryData.prs.length} PR${summaryData.prs.length > 1 ? 's' : ''}! 🏆` : ''} #GymTrackr`,
      });
    } catch (e) {
      console.warn('[share]', e);
    } finally {
      setIsSharing(false);
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
      date: localDateStr(),
      sessionType,
      exercises: exerciseLogs,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      completed: true,
      durationMinutes: duration,
      totalVolume,
      hasPRs: prs.length > 0,
      isDeload,
    };

    await saveSplitWorkout(session);
    await recordWorkout();
    await clearActiveWorkout(); // Remove persisted state after completion

    // Award XP for workout completion and PRs
    try {
      const currentStore = await loadStore();
      const oldLevel = currentStore.xpState.level;
      let updatedXP = awardWorkoutXP(currentStore.xpState);
      const xpGained = updatedXP.totalXP - currentStore.xpState.totalXP;
      for (let i = 0; i < prs.length; i++) {
        updatedXP = awardPRXP(updatedXP);
      }
      await saveStore({ ...currentStore, xpState: updatedXP });
      // Trigger level-up overlay if the level changed
      if (updatedXP.level !== oldLevel) {
        setLevelUpLevel(updatedXP.level);
        setLevelUpXP(xpGained);
        setShowLevelUp(true);
      }
    } catch (e) {
      console.warn('[split-workout] XP award failed:', e);
    }

    setSummaryData({
      duration,
      totalVolume,
      exercisesCompleted,
      setsCompleted,
      prs,
      previousVolume: previousSession?.totalVolume,
    });

    // Show PR celebration BEFORE summary if there are new PRs
    if (prs.length > 0) {
      launchPRCelebration(prs);
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSummary(true);
    }
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
        <Text className="text-2xl font-bold text-cardForeground mt-4">Rest Day</Text>
        <Text className="text-cardMuted text-center mt-2">Recovery is where the gains happen.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-8 px-6 py-3 rounded-xl"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <Text className="font-semibold text-cardForeground">Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ---- Workout Complete Summary ----
  if (showSummary && summaryData) {
    const volumeDelta = summaryData.previousVolume
      ? ((summaryData.totalVolume - summaryData.previousVolume) / summaryData.previousVolume * 100)
      : null;

    const shareDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return (
      <ScreenContainer className="flex-1">
        {/* Hidden sharing card — captured by ViewShot */}
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'jpg', quality: 0.95 }}
          style={shareCardStyles.offscreen}
        >
          <View style={shareCardStyles.card}>
            {/* Header */}
            <View style={shareCardStyles.header}>
              <View style={shareCardStyles.accentBar} />
              <View style={{ flex: 1 }}>
                <Text style={shareCardStyles.cardTitle}>{sessionDisplayName}</Text>
                <Text style={shareCardStyles.cardDate}>{shareDate}</Text>
              </View>
              <Text style={shareCardStyles.trophy}>🏆</Text>
            </View>
            {/* Stats row */}
            <View style={shareCardStyles.statsRow}>
              <View style={shareCardStyles.statBox}>
                <Text style={shareCardStyles.statValue}>{formatDuration(summaryData.duration)}</Text>
                <Text style={shareCardStyles.statLabel}>Duration</Text>
              </View>
              <View style={shareCardStyles.statBox}>
                <Text style={shareCardStyles.statValue}>{(summaryData.totalVolume / 1000).toFixed(1)}t</Text>
                <Text style={shareCardStyles.statLabel}>Volume</Text>
              </View>
              <View style={shareCardStyles.statBox}>
                <Text style={shareCardStyles.statValue}>{summaryData.setsCompleted}</Text>
                <Text style={shareCardStyles.statLabel}>Sets</Text>
              </View>
              {summaryData.prs.length > 0 && (
                <View style={shareCardStyles.statBox}>
                  <Text style={[shareCardStyles.statValue, { color: '#F59E0B' }]}>{summaryData.prs.length} PR{summaryData.prs.length > 1 ? 's' : ''}</Text>
                  <Text style={shareCardStyles.statLabel}>Records</Text>
                </View>
              )}
            </View>
            {/* Exercise list (top 5) */}
            {exerciseLogs
              .filter(ex => !ex.skipped && ex.sets.filter(s => !s.isWarmup).length > 0)
              .slice(0, 5)
              .map((ex, i) => {
                const ws = ex.sets.filter(s => !s.isWarmup);
                const best = ws.reduce((b, s) => s.weightKg > b ? s.weightKg : b, 0);
                return (
                  <View key={i} style={shareCardStyles.exRow}>
                    <View style={[shareCardStyles.exDot, { backgroundColor: sessionColor }]} />
                    <Text style={shareCardStyles.exName} numberOfLines={1}>{ex.exerciseName}</Text>
                    <Text style={shareCardStyles.exWeight}>{best}kg</Text>
                  </View>
                );
              })}
            {/* PRs */}
            {summaryData.prs.length > 0 && (
              <View style={shareCardStyles.prRow}>
                <Text style={shareCardStyles.prText}>🏆 {summaryData.prs.map(p => `${p.exercise} ${p.weight}kg×${p.reps}`).join(' · ')}</Text>
              </View>
            )}
            {/* Footer branding */}
            <View style={shareCardStyles.footer}>
              <Text style={shareCardStyles.footerText}>GymTrackr</Text>
            </View>
          </View>
        </ViewShot>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Hero */}
          <View className="items-center pt-12 pb-8 px-6">
            <Text style={{ fontSize: 64 }}>🏆</Text>
            <Text className="text-3xl font-bold text-cardForeground mt-4">Workout Complete!</Text>
            <Text className="text-base text-cardMuted mt-2">{sessionDisplayName}</Text>
          </View>

          {/* Stats Grid */}
          <View className="px-6 mb-6">
            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
                <IconSymbol name="timer" size={24} color={sessionColor} />
                <Text className="text-2xl font-bold text-cardForeground mt-2">{formatDuration(summaryData.duration)}</Text>
                <Text className="text-xs text-cardMuted mt-1">Duration</Text>
                {previousSession?.durationMinutes && (
                  <Text className="text-xs mt-1" style={{ color: summaryData.duration <= previousSession.durationMinutes ? '#10B981' : '#F59E0B' }}>
                    {summaryData.duration <= previousSession.durationMinutes ? 'Faster' : 'Slower'} than last
                  </Text>
                )}
              </View>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
                <IconSymbol name="flame.fill" size={24} color="#FF6B35" />
                <Text className="text-2xl font-bold text-cardForeground mt-2">{(summaryData.totalVolume / 1000).toFixed(1)}t</Text>
                <Text className="text-xs text-cardMuted mt-1">Volume</Text>
                {volumeDelta !== null && (
                  <Text className="text-xs mt-1" style={{ color: volumeDelta >= 0 ? '#10B981' : '#EF4444' }}>
                    {volumeDelta >= 0 ? '+' : ''}{volumeDelta.toFixed(1)}% vs last
                  </Text>
                )}
              </View>
            </View>
            <View className="flex-row mt-3" style={{ gap: 10 }}>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text className="text-2xl font-bold text-cardForeground">{summaryData.exercisesCompleted}</Text>
                <Text className="text-xs text-cardMuted mt-1">Exercises</Text>
              </View>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text className="text-2xl font-bold text-cardForeground">{summaryData.setsCompleted}</Text>
                <Text className="text-xs text-cardMuted mt-1">Sets</Text>
              </View>
              <View className="flex-1 rounded-2xl p-4 items-center" style={{ backgroundColor: summaryData.prs.length > 0 ? '#F59E0B15' : colors.surface, borderWidth: 1, borderColor: summaryData.prs.length > 0 ? '#F59E0B40' : colors.cardBorder }}>
                <Text className="text-2xl font-bold" style={{ color: summaryData.prs.length > 0 ? '#F59E0B' : colors.cardForeground }}>
                  {summaryData.prs.length}
                </Text>
                <Text className="text-xs text-cardMuted mt-1">PRs</Text>
              </View>
            </View>
          </View>

          {/* PRs */}
          {summaryData.prs.length > 0 && (
            <View className="px-6 mb-6">
              <Text className="text-sm font-semibold text-cardForeground mb-3">Personal Records</Text>
              {summaryData.prs.map((pr, i) => (
                <View
                  key={i}
                  className="flex-row items-center rounded-xl p-3 mb-2"
                  style={{ backgroundColor: '#F59E0B12', borderWidth: 1, borderColor: '#F59E0B30' }}
                >
                  <Text style={{ fontSize: 20 }}>🏆</Text>
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-cardForeground">{pr.exercise}</Text>
                    <Text className="text-xs text-cardMuted">{pr.weight}kg x {pr.reps} reps</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-bold" style={{ color: '#F59E0B' }}>~{pr.e1rm}kg</Text>
                    <Text className="text-xs text-cardMuted">est. 1RM</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Exercise Breakdown */}
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-cardForeground mb-3">Exercise Breakdown</Text>
            {exerciseLogs.map((exLog, i) => {
              if (exLog.skipped) return null;
              const workingSets = exLog.sets.filter(s => !s.isWarmup);
              if (workingSets.length === 0) return null;
              const exVolume = calculateVolumeLoad(workingSets.map(s => ({ weight: s.weightKg, reps: s.reps })));
              return (
                <View
                  key={i}
                  className="flex-row items-center rounded-xl p-3 mb-2"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
                >
                  <View
                    style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: sessionColor, marginRight: 12 }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-cardForeground">{exLog.exerciseName}</Text>
                    <Text className="text-xs text-cardMuted">
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

          {/* Post-workout Notes */}
          <View className="px-6 mb-4">
            <Text className="text-sm font-semibold text-cardForeground mb-2">Session Notes</Text>
            <Text className="text-xs text-cardMuted mb-3">How did you feel? Any physical sensations, energy levels, or observations?</Text>
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
            >
              <TextInput
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                placeholder="e.g. Felt strong on bench, left shoulder tight, great energy today..."
                placeholderTextColor={colors.cardMuted}
                multiline
                numberOfLines={4}
                returnKeyType="done"
                blurOnSubmit
                style={{
                  color: colors.cardForeground,
                  fontSize: 14,
                  lineHeight: 20,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
              {/* Quick-tap note presets */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {[
                  { label: '💪 Felt strong', text: 'Felt strong today, great energy and focus throughout.' },
                  { label: '😴 Fatigued', text: 'Felt fatigued, energy was low. May need more rest.' },
                  { label: '⚠️ Joint discomfort', text: 'Noticed some joint discomfort during the session. Will monitor.' },
                ].map((preset) => (
                  <TouchableOpacity
                    key={preset.label}
                    onPress={() => setWorkoutNotes(prev => prev ? `${prev} ${preset.text}` : preset.text)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      backgroundColor: colors.background,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.cardForeground }}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
                <Text className="text-sm font-bold text-cardForeground">Get AI Analysis</Text>
                <Text className="text-xs text-cardMuted">Personalized insights on this workout</Text>
              </View>
              <Text style={{ color: '#6366F1', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          </View>
          {/* Share Workout button */}
          <View className="px-6 mb-3">
            <TouchableOpacity
              onPress={handleShare}
              disabled={isSharing}
              style={[
                shareCardStyles.shareBtn,
                { borderColor: sessionColor, opacity: isSharing ? 0.6 : 1 },
              ]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
              <Text style={[shareCardStyles.shareBtnText, { color: sessionColor }]}>
                {isSharing ? 'Preparing...' : 'Share Workout'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Done button */}
          <View className="px-6">
            <TouchableOpacity
              onPress={async () => {
                // Save notes to the session if user typed anything
                if (workoutNotes.trim()) {
                  const all = await import('@/lib/split-workout-store').then(m => m.getSplitWorkouts());
                  const latest = all[all.length - 1];
                  if (latest) {
                    latest.notes = workoutNotes.trim();
                    await import('@/lib/split-workout-store').then(m => m.saveSplitWorkout(latest));
                  }
                  router.back();
                } else {
                  // Nudge user to add notes — they can skip
                  Alert.alert(
                    'Add a Quick Note?',
                    'Your AI coach uses session notes to identify patterns in your training. Even one sentence helps — how did you feel?',
                    [
                      { text: 'Skip', style: 'cancel', onPress: () => router.back() },
                      { text: 'Add Note', style: 'default' },
                    ],
                  );
                }
              }}
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
              <IconSymbol name="chevron.left" size={24} color={colors.cardMuted} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-cardForeground">{sessionDisplayName}</Text>
            <Text className="text-sm text-cardMuted mt-1">
              {exercises.length} exercises{isDeload ? ' · Deload Week' : ''}
            </Text>
          </View>

          {/* Session type selector */}
          <View className="px-6 mb-4">
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {(customProg ? Object.keys(customProg.sessionNames) : ['upper-a', 'lower-a', 'upper-b', 'lower-b']).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => router.setParams({ session: s })}
                  className="flex-1 py-3 px-2 rounded-xl items-center"
                  style={{
                    backgroundColor: sessionType === s ? resolveSessionColor(s) : colors.surface,
                    borderWidth: 1,
                    borderColor: sessionType === s ? resolveSessionColor(s) : colors.cardBorder,
                    minWidth: '45%',
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: sessionType === s ? '#FFFFFF' : colors.cardMuted }}
                  >
                    {resolveSessionName(s).split('—')[0].trim()}
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
            <Text className="text-sm font-semibold text-cardForeground mb-3">Exercises</Text>
            {exercises.map((ex, i) => {
              const libEntry = getExerciseByName(ex.name);
              const suggestion = weightSuggestions[ex.name];
              const displaySets = isDeload ? Math.ceil(ex.sets / 2) : ex.sets;

              return (
                <View
                  key={i}
                  className="rounded-2xl mb-3 overflow-hidden"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
                >
                  {/* Video thumbnail */}
                  {libEntry?.videoId && (
                    <TouchableOpacity onPress={() => openVideo(ex.name)} activeOpacity={0.8}>
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: `https://img.youtube.com/vi/${libEntry.videoId}/mqdefault.jpg` }}
                          style={{ width: '100%', height: 140, backgroundColor: colors.cardBorder }}
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
                            <Text className="text-base font-semibold text-cardForeground">{ex.name}</Text>
                            <Text className="text-xs text-cardMuted mt-0.5">
                              {displaySets} sets × {ex.repsMin === 0 ? 'max' : `${ex.repsMin}-${ex.repsMax} reps`}
                              {suggestion ? ` · ${suggestion.weight}kg` : ''}
                            </Text>
                          </View>
                        </View>
                        {ex.notes ? (
                          <Text className="text-xs text-cardMuted italic mt-2 ml-10">{ex.notes}</Text>
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
              <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text className="text-xs text-cardMuted mb-1">Last Session</Text>
                <Text className="text-sm text-cardForeground">
                  {new Date(previousSession.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  {previousSession.durationMinutes ? ` · ${previousSession.durationMinutes}m` : ''}
                  {previousSession.totalVolume ? ` · ${previousSession.totalVolume.toLocaleString()}kg` : ''}
                </Text>
              </View>
            </View>
          )}

          {/* ── Zaki Recovery Nudge Banner (recovery < 50%, Strength session, not yet started) ── */}
          {nudgeAlternative && (
            <View className="px-6 mb-3">
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: '#EF4444',
                  backgroundColor: '#EF444410',
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>
                    🔴 Recovery {Math.round(recovery!.recoveryScore)}% — Zaki Recommends
                  </Text>
                  <TouchableOpacity onPress={() => setNudgeDismissed(true)} style={{ padding: 4 }}>
                    <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.cardForeground, fontSize: 13, marginBottom: 10 }}>
                  Your recovery is below 50%. Switching to{' '}
                  <Text style={{ fontWeight: '700' }}>{resolveSessionName(nudgeAlternative)}</Text>{' '}
                  (lighter volume day) will protect your joints and still drive adaptation.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#EF4444',
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.setParams({ session: nudgeAlternative });
                    setNudgeDismissed(true);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    Switch to {resolveSessionName(nudgeAlternative).split('—')[0].trim()}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Zaki Modification Button — shown only when recovery is yellow (34-66%) */}
          {recovery && recovery.recoveryScore >= 34 && recovery.recoveryScore < 67 && (
            <View className="px-6 mb-3">
              <TouchableOpacity
                onPress={handleZakiModification}
                className="py-3 rounded-2xl flex-row items-center justify-center"
                style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#F59E0B' }}
              >
                <Text style={{ fontSize: 18 }}>🤖</Text>
                <Text className="font-semibold ml-2" style={{ color: '#F59E0B' }}>
                  Ask Zaki to Modify Session
                </Text>
              </TouchableOpacity>
              <Text className="text-xs text-cardMuted text-center mt-1">
                Recovery {Math.round(recovery.recoveryScore)}% — Zaki will adapt this session to your body
              </Text>
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

        {/* ── PR Celebration Overlay ── */}
        {showPRCelebration && (
          <View
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.75)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 999,
            }}
          >
            {/* Confetti particles */}
            {confettiX.map((xVal, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  top: '30%',
                  left: '50%',
                  width: 8 + (i % 4) * 2,
                  height: 8 + (i % 4) * 2,
                  borderRadius: i % 3 === 0 ? 4 : 2,
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  opacity: confettiOpacity[i],
                  transform: [
                    { translateX: xVal },
                    { translateY: confettiY[i] },
                    { rotate: confettiRotate[i].interpolate({ inputRange: [-5, 5], outputRange: ['-1800deg', '1800deg'] }) },
                  ],
                }}
              />
            ))}

            {/* PR Card */}
            <Animated.View
              style={{
                opacity: prCardOpacity,
                transform: [{ scale: prCardScale }, { translateY: prCardY }],
                width: SCREEN_WIDTH * 0.85,
                backgroundColor: '#1a1a2e',
                borderRadius: 24,
                padding: 28,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#F59E0B',
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 20,
                elevation: 20,
              }}
            >
              {/* Trophy icon */}
              <Text style={{ fontSize: 56, marginBottom: 8 }}>🏆</Text>

              <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 4 }}>
                PERSONAL RECORD
              </Text>

              {/* Current PR */}
              {celebrationPRs[celebrationIndex] && (
                <>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4, lineHeight: 28 }}>
                    {celebrationPRs[celebrationIndex].exercise}
                  </Text>
                  <Text style={{ color: '#F59E0B', fontSize: 36, fontWeight: '900', marginBottom: 4 }}>
                    {celebrationPRs[celebrationIndex].weight}kg × {celebrationPRs[celebrationIndex].reps}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Est. 1RM</Text>
                    <Text style={{ color: '#10B981', fontSize: 18, fontWeight: '700' }}>~{Math.round(celebrationPRs[celebrationIndex].e1rm)}kg</Text>
                  </View>
                </>
              )}

              {/* Multiple PRs indicator */}
              {celebrationPRs.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                  {celebrationPRs.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: i === celebrationIndex ? '#F59E0B' : 'rgba(255,255,255,0.3)',
                      }}
                    />
                  ))}
                </View>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                {celebrationIndex < celebrationPRs.length - 1 ? (
                  <TouchableOpacity
                    style={{
                      flex: 1, backgroundColor: '#F59E0B', borderRadius: 14,
                      paddingVertical: 14, alignItems: 'center',
                    }}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setCelebrationIndex(i => i + 1);
                      // Re-animate card for next PR
                      prCardScale.setValue(0.85);
                      prCardY.setValue(20);
                      Animated.parallel([
                        Animated.spring(prCardScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
                        Animated.timing(prCardY, { toValue: 0, duration: 200, useNativeDriver: true }),
                      ]).start();
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>Next PR →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={{
                      flex: 1, backgroundColor: '#F59E0B', borderRadius: 14,
                      paddingVertical: 14, alignItems: 'center',
                    }}
                    onPress={() => {
                      setShowPRCelebration(false);
                      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setShowSummary(true);
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>See Summary →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>
        )}

         {/* Video Modal */}
        <VideoModal
          visible={showVideoModal}
          exercise={videoExercise}
          playing={videoPlaying}
          onClose={() => { setShowVideoModal(false); setVideoPlaying(false); }}
          onTogglePlay={() => setVideoPlaying(p => !p)}
          colors={colors}
        />

        {/* Zaki Modification Result Modal */}
        <Modal
          visible={showZakiModif}
          animationType="slide"
          transparent
          onRequestClose={() => setShowZakiModif(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
          }}>
            <View style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '80%',
            }}>
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Text style={{ fontSize: 22 }}>🤖</Text>
                  <Text className="text-lg font-bold text-cardForeground">Zaki’s Modification</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowZakiModif(false)}
                  style={{ padding: 4 }}
                >
                  <IconSymbol name="xmark" size={20} color={colors.cardMuted} />
                </TouchableOpacity>
              </View>

              {/* Recovery badge */}
              {recovery && (
                <View className="flex-row items-center mb-4 px-3 py-2 rounded-xl" style={{ backgroundColor: '#F59E0B22' }}>
                  <Text className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
                    ⚡ Recovery {Math.round(recovery.recoveryScore)}% — Yellow Zone
                  </Text>
                </View>
              )}

              {/* Content */}
              <ScrollView showsVerticalScrollIndicator={false}>
                {zakiModifLoading ? (
                  <View className="items-center py-8">
                    <Text className="text-cardMuted text-base">Zaki is analysing your session…</Text>
                  </View>
                ) : (
                  <Text className="text-cardForeground text-sm leading-relaxed" style={{ lineHeight: 22 }}>
                    {zakiModifResult}
                  </Text>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>

              {/* Action buttons */}
              {!zakiModifLoading && (
                <View className="flex-row gap-3 mt-2">
                  <TouchableOpacity
                    onPress={() => setShowZakiModif(false)}
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
                  >
                    <Text className="text-cardForeground font-semibold">Got It</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowZakiModif(false); startWorkout(); }}
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: sessionColor }}
                  >
                    <Text className="text-white font-semibold">Start Modified</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    );
  }
  // ---- Active workout ----
  return (
    <ScreenContainer className="flex-1">
      {/* Sticky Header */}
      <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-base font-bold text-cardForeground">{sessionDisplayName}</Text>
            <Text className="text-xs text-cardMuted">
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
        <View className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.cardBorder }}>
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
            <Text className="text-xs font-medium text-cardMuted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Rest Timer
            </Text>
            <Text className="text-5xl font-bold text-cardForeground">{formatTime(restTime)}</Text>
            <Text className="text-sm text-cardMuted mt-1">{restExerciseName}</Text>
            {/* Progress ring (simplified as bar) */}
            <View className="w-full mt-4 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.cardBorder }}>
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
                  borderColor: isActive && !isComplete ? sessionColor : isComplete ? '#10B98130' : isSkipped ? colors.cardBorder + '50' : colors.cardBorder,
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
                          style={{ color: isComplete ? '#10B981' : colors.cardForeground }}
                        >
                          {ex.name}
                        </Text>
                        <Text className="text-xs text-cardMuted mt-0.5">
                          {displaySets} × {ex.repsMin === 0 ? 'max' : `${ex.repsMin}-${ex.repsMax}`} · {Math.floor(ex.restSeconds / 60)}m rest
                          {isDeload ? ' · DELOAD' : ''}
                        </Text>
                        {ex.notes ? <Text className="text-xs text-cardMuted italic mt-0.5">{ex.notes}</Text> : null}
                      </View>
                    </View>

                    {/* Swap button */}
                    {!isComplete && (
                      <TouchableOpacity
                        onPress={() => handleOpenSwap(i)}
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: colors.warning + '18', alignItems: 'center', justifyContent: 'center',
                          marginRight: 4,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>🔄</Text>
                      </TouchableOpacity>
                    )}
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
                            style={{ width: '100%', height: 120, backgroundColor: colors.cardBorder }}
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
                          <Text className="text-xs text-cardMuted mb-1">Previous Session</Text>
                          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                            {prevExLog.sets.filter(s => !s.isWarmup).map((s, si) => (
                              <View key={si} className="px-2 py-1 rounded-lg" style={{ backgroundColor: colors.cardBorder + '50' }}>
                                <Text className="text-xs text-cardMuted">{s.weightKg}×{s.reps}</Text>
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

      {/* Floating Zaki Check-In Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          zIndex: 50,
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleZakiCheckIn();
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#6366F1',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text style={{ fontSize: 24 }}>🤖</Text>
        </TouchableOpacity>
      </View>

      {/* Zaki Mid-Workout Check-In Modal */}
      <Modal
        visible={showZakiCheckIn}
        animationType="slide"
        transparent
        onRequestClose={() => setShowZakiCheckIn(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '75%',
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22 }}>🤖</Text>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: colors.cardForeground }}>Zaki Check-In</Text>
                  <Text style={{ fontSize: 11, color: colors.cardMuted }}>
                    {Math.round(elapsed / 60)}m in · {totalSetsLogged}/{totalSetsTarget} sets
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowZakiCheckIn(false)} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={20} color={colors.cardMuted} />
              </TouchableOpacity>
            </View>

            {/* Recovery badge */}
            {recovery && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: recovery.recoveryScore >= 67 ? '#22C55E20' : recovery.recoveryScore >= 34 ? '#F59E0B20' : '#EF444420',
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: recovery.recoveryScore >= 67 ? '#22C55E' : recovery.recoveryScore >= 34 ? '#F59E0B' : '#EF4444',
                }}>
                  {recovery.recoveryScore >= 67 ? '⚡ Green' : recovery.recoveryScore >= 34 ? '⚡ Yellow' : '🔴 Red'} — Recovery {Math.round(recovery.recoveryScore)}%
                </Text>
              </View>
            )}

            {/* Content */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {zakiCheckInLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ color: colors.cardMuted, fontSize: 15 }}>Zaki is reading your session…</Text>
                </View>
              ) : (
                <Text style={{ color: colors.cardForeground, fontSize: 14, lineHeight: 22 }}>
                  {zakiCheckInResult}
                </Text>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Actions */}
            {!zakiCheckInLoading && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowZakiCheckIn(false)}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 14,
                    alignItems: 'center', backgroundColor: colors.surface,
                    borderWidth: 1, borderColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ color: colors.cardForeground, fontWeight: '600' }}>Got It</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setZakiCheckInResult(null);
                    handleZakiCheckIn();
                  }}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 14,
                    alignItems: 'center', backgroundColor: '#6366F1',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Ask Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Video Modal */}
        <VideoModal
          visible={showVideoModal}
          exercise={videoExercise}
          playing={videoPlaying}
          onClose={() => { setShowVideoModal(false); setVideoPlaying(false); }}
          onTogglePlay={() => setVideoPlaying(p => !p)}
          colors={colors}
        />
      {/* Exercise Swap Modal */}
      <Modal
        visible={showSwapModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowSwapModal(false); setSwapOriginalExercise(null); }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.cardForeground, marginBottom: 4 }}>Swap Exercise</Text>
            <Text style={{ fontSize: 13, color: colors.cardMuted, marginBottom: 16 }}>
              {swapTargetIndex !== null ? `Replacing: ${exercises[swapTargetIndex]?.name}` : ''}
            </Text>

            {/* Restore original option — shown when this slot is currently swapped */}
            {swapOriginalExercise && (
              <TouchableOpacity
                onPress={() => handleConfirmSwap(swapOriginalExercise as AlternativeExercise)}
                style={{
                  backgroundColor: colors.primary + '18',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1.5,
                  borderColor: colors.primary + '60',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>↩ Restore original</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.cardForeground, marginTop: 2 }}>{swapOriginalExercise.name}</Text>
                <Text style={{ fontSize: 12, color: colors.cardMuted, marginTop: 2 }}>
                  {swapOriginalExercise.sets} sets · {swapOriginalExercise.repsMin}-{swapOriginalExercise.repsMax} reps · {swapOriginalExercise.bodyPart}
                </Text>
              </TouchableOpacity>
            )}

            {swapAlternatives.length === 0 && !swapOriginalExercise ? (
              <Text style={{ color: colors.cardMuted, textAlign: 'center', paddingVertical: 20 }}>No alternatives available for this exercise.</Text>
            ) : (
              swapAlternatives.map((alt, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleConfirmSwap(alt)}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.cardForeground }}>{alt.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.cardMuted, marginTop: 2 }}>
                    {alt.sets} sets · {alt.repsMin}-{alt.repsMax} reps · {alt.bodyPart}
                  </Text>
                  {alt.notes ? <Text style={{ fontSize: 11, color: colors.cardMuted, fontStyle: 'italic', marginTop: 2 }}>{alt.notes}</Text> : null}
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              onPress={() => { setShowSwapModal(false); setSwapOriginalExercise(null); }}
              style={{ marginTop: 8, alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: colors.cardMuted, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
       </Modal>

      {/* XP Level-Up Celebration */}
      <XPLevelUpOverlay
        visible={showLevelUp}
        newLevel={levelUpLevel}
        xpGained={levelUpXP}
        onDismiss={() => setShowLevelUp(false)}
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

// ── Workout Sharing Card Styles ──
const shareCardStyles = StyleSheet.create({
  // Positioned off-screen so ViewShot can capture it without showing it
  offscreen: {
    position: 'absolute',
    top: -2000,
    left: 0,
    width: 360,
  },
  card: {
    width: 360,
    backgroundColor: '#0A0B0A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2D2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  accentBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    backgroundColor: '#C8F53C',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: -0.3,
  },
  cardDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  trophy: {
    fontSize: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1A1D1A',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C8F53C',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D1A',
    gap: 10,
  },
  exDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  exName: {
    flex: 1,
    fontSize: 13,
    color: '#E2E8F0',
  },
  exWeight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  prRow: {
    marginTop: 12,
    backgroundColor: '#F59E0B12',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F59E0B30',
  },
  prText: {
    fontSize: 12,
    color: '#F59E0B',
    lineHeight: 18,
  },
  footer: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 11,
    color: '#C8F53C',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Share button in the summary screen
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
