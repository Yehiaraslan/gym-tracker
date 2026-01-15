import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert,
  Modal,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { VideoPlayer } from '@/components/video-player';
import { ExerciseGuidance } from '@/components/exercise-guidance';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { 
  generateId, 
  WorkoutLog, 
  ExerciseLog, 
  SetLog,
  getDayName,
  WarmupCooldownExercise,
} from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { getRandomTip, FormTip, getCategoryEmoji, getCategoryLabel } from '@/lib/form-tips';
import { toggleFavoriteTip, getFavoriteTips } from '@/lib/favorite-tips';
import { recordWorkout } from '@/lib/streak-tracker';
import { HeartRateChart } from '@/components/heart-rate-chart';
import { getDemoHeartRateData } from '@/lib/whoop-service';

type WorkoutPhase = 'warmup' | 'main' | 'cooldown' | 'complete';

import { WhoopHeartRateData } from '@/lib/whoop-service';

export default function WorkoutScreen() {
  useKeepAwake();
  
  const colors = useColors();
  const router = useRouter();
  const { 
    store,
    currentCycleInfo, 
    getTodayProgram, 
    getExerciseById,
    getLastWeight,
    getBestWeight,
    addWorkoutLog,
  } = useGym();

  const todayProgram = getTodayProgram();
  const warmupExercises = store.warmupCooldown.warmupExercises.sort((a, b) => a.order - b.order);
  const cooldownExercises = store.warmupCooldown.cooldownExercises.sort((a, b) => a.order - b.order);
  
  const [phase, setPhase] = useState<WorkoutPhase>(warmupExercises.length > 0 ? 'warmup' : 'main');
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [cooldownIndex, setCooldownIndex] = useState(0);
  const [warmupTimer, setWarmupTimer] = useState(0);
  const [isWarmupTimerRunning, setIsWarmupTimerRunning] = useState(false);
  
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsMessage, setCongratsMessage] = useState('');
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [currentFormTip, setCurrentFormTip] = useState<FormTip | null>(null);
  const [displayedTips, setDisplayedTips] = useState<Array<{ tip: FormTip; exerciseName: string; timestamp: number }>>([]); 
  const [favoritedTipIds, setFavoritedTipIds] = useState<Set<string>>(new Set());
  const [heartRateData, setHeartRateData] = useState<WhoopHeartRateData | null>(null);
  const workoutStartTimeRef = useRef<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warmupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipRotationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize workout log
  useEffect(() => {
    if (todayProgram && todayProgram.exercises.length > 0) {
      const exercises: ExerciseLog[] = todayProgram.exercises.map(dayEx => {
        const exercise = getExerciseById(dayEx.exerciseId);
        return {
          exerciseId: dayEx.exerciseId,
          exerciseName: exercise?.name || 'Unknown',
          targetSets: dayEx.sets,
          targetReps: dayEx.reps || '8-12',
          sets: [],
        };
      });

      const log: WorkoutLog = {
        id: generateId(),
        date: new Date().toISOString().split('T')[0],
        cycleNumber: currentCycleInfo.cycle,
        weekNumber: currentCycleInfo.week,
        dayNumber: currentCycleInfo.day,
        exercises,
        startedAt: Date.now(),
        completedAt: null,
        isCompleted: false,
      };

      setWorkoutLog(log);
      
      // Pre-fill weight from last workout
      const firstExercise = todayProgram.exercises[0];
      const lastWeight = getLastWeight(firstExercise.exerciseId);
      if (lastWeight !== null) {
        setWeight(lastWeight.toString());
      }
      
      // Pre-fill reps from target
      if (firstExercise.reps) {
        setReps(firstExercise.reps.split('-')[0]);
      }
    }
  }, []);

  // Initialize warmup timer
  useEffect(() => {
    if (phase === 'warmup' && warmupExercises.length > 0) {
      setWarmupTimer(warmupExercises[warmupIndex]?.duration || 30);
    }
  }, [phase, warmupIndex]);

  // Initialize cooldown timer
  useEffect(() => {
    if (phase === 'cooldown' && cooldownExercises.length > 0) {
      setWarmupTimer(cooldownExercises[cooldownIndex]?.duration || 30);
    }
  }, [phase, cooldownIndex]);

  // Warmup/Cooldown timer
  useEffect(() => {
    if (isWarmupTimerRunning && warmupTimer > 0) {
      warmupTimerRef.current = setInterval(() => {
        setWarmupTimer(prev => {
          if (prev <= 1) {
            setIsWarmupTimerRunning(false);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (warmupTimerRef.current) {
        clearInterval(warmupTimerRef.current);
      }
    };
  }, [isWarmupTimerRunning, warmupTimer]);

  // Rest timer
  useEffect(() => {
    if (isResting && restTime > 0) {
      timerRef.current = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            setIsResting(false);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isResting, restTime]);

  const currentDayExercise = todayProgram?.exercises[currentExerciseIndex];
  const currentExercise = currentDayExercise ? getExerciseById(currentDayExercise.exerciseId) : null;

  // Form tip rotation during rest
  useEffect(() => {
    if (isResting && currentExercise) {
      // Set initial tip and track it
      const initialTip = getRandomTip(currentExercise.name);
      setCurrentFormTip(initialTip);
      setDisplayedTips(prev => {
        // Avoid duplicates
        if (!prev.some(t => t.tip.id === initialTip.id)) {
          return [...prev, { tip: initialTip, exerciseName: currentExercise.name, timestamp: Date.now() }];
        }
        return prev;
      });
      
      // Rotate tips every 8 seconds if rest is long enough
      tipRotationRef.current = setInterval(() => {
        const newTip = getRandomTip(currentExercise?.name || '');
        setCurrentFormTip(newTip);
        setDisplayedTips(prev => {
          // Avoid duplicates
          if (!prev.some(t => t.tip.id === newTip.id)) {
            return [...prev, { tip: newTip, exerciseName: currentExercise?.name || '', timestamp: Date.now() }];
          }
          return prev;
        });
      }, 8000);
    } else {
      setCurrentFormTip(null);
    }

    return () => {
      if (tipRotationRef.current) {
        clearInterval(tipRotationRef.current);
      }
    };
  }, [isResting, currentExercise?.name]);
  const lastWeightValue = currentDayExercise ? getLastWeight(currentDayExercise.exerciseId) : null;
  const bestWeight = currentDayExercise ? getBestWeight(currentDayExercise.exerciseId) : null;

  const currentWarmupExercise = warmupExercises[warmupIndex];
  const currentCooldownExercise = cooldownExercises[cooldownIndex];

  const startWarmupTimer = () => {
    setIsWarmupTimerRunning(true);
  };

  const skipWarmupExercise = () => {
    setIsWarmupTimerRunning(false);
    if (warmupTimerRef.current) clearInterval(warmupTimerRef.current);
    
    if (phase === 'warmup') {
      if (warmupIndex + 1 < warmupExercises.length) {
        setWarmupIndex(prev => prev + 1);
        setWarmupTimer(warmupExercises[warmupIndex + 1]?.duration || 30);
      } else {
        setPhase('main');
      }
    } else if (phase === 'cooldown') {
      if (cooldownIndex + 1 < cooldownExercises.length) {
        setCooldownIndex(prev => prev + 1);
        setWarmupTimer(cooldownExercises[cooldownIndex + 1]?.duration || 30);
      } else {
        setPhase('complete');
        recordWorkout(); // Update streak
        Alert.alert(
          'Workout Complete! 💪',
          'Great job! Your workout has been saved.',
          [{ text: 'Done', onPress: () => router.back() }]
        );
      }
    }
  };

  const completeWarmupExercise = () => {
    setIsWarmupTimerRunning(false);
    if (warmupTimerRef.current) clearInterval(warmupTimerRef.current);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (phase === 'warmup') {
      if (warmupIndex + 1 < warmupExercises.length) {
        setWarmupIndex(prev => prev + 1);
        setWarmupTimer(warmupExercises[warmupIndex + 1]?.duration || 30);
      } else {
        setPhase('main');
      }
    } else if (phase === 'cooldown') {
      if (cooldownIndex + 1 < cooldownExercises.length) {
        setCooldownIndex(prev => prev + 1);
        setWarmupTimer(cooldownExercises[cooldownIndex + 1]?.duration || 30);
      } else {
        setPhase('complete');
        recordWorkout(); // Update streak
        Alert.alert(
          'Workout Complete! 💪',
          'Great job! Your workout has been saved.',
          [{ text: 'Done', onPress: () => router.back() }]
        );
      }
    }
  };

  const skipWarmupPhase = () => {
    setPhase('main');
    setIsWarmupTimerRunning(false);
    if (warmupTimerRef.current) clearInterval(warmupTimerRef.current);
  };

  const skipCooldownPhase = () => {
    setPhase('complete');
    recordWorkout(); // Update streak
    Alert.alert(
      'Workout Complete! 💪',
      'Great job! Your workout has been saved.',
      [{ text: 'Done', onPress: () => router.back() }]
    );
  };

  const completeSet = useCallback(() => {
    if (!workoutLog || !todayProgram || !currentDayExercise) return;
    
    const weightNum = parseFloat(weight) || 0;
    const repsNum = parseInt(reps) || 0;

    if (weightNum <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Check for PR
    if (bestWeight !== null && weightNum > bestWeight) {
      setCongratsMessage(`New PR! +${(weightNum - bestWeight).toFixed(1)} kg`);
      setShowCongrats(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setTimeout(() => setShowCongrats(false), 2500);
    }

    // Add set to log
    const newSet: SetLog = {
      setNumber: currentSetIndex + 1,
      weight: weightNum,
      reps: repsNum,
      completedAt: Date.now(),
    };

    const updatedLog = { ...workoutLog };
    updatedLog.exercises[currentExerciseIndex].sets.push(newSet);
    setWorkoutLog(updatedLog);

    // Check if more sets for this exercise
    if (currentSetIndex + 1 < currentDayExercise.sets) {
      setCurrentSetIndex(prev => prev + 1);
      setIsResting(true);
      setRestTime(currentDayExercise.restSeconds);
    } else {
      // Move to next exercise
      if (currentExerciseIndex + 1 < todayProgram.exercises.length) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSetIndex(0);
        setIsResting(true);
        setRestTime(currentDayExercise.restSeconds);
        
        // Pre-fill next exercise weight
        const nextExercise = todayProgram.exercises[currentExerciseIndex + 1];
        const nextLastWeight = getLastWeight(nextExercise.exerciseId);
        if (nextLastWeight !== null) {
          setWeight(nextLastWeight.toString());
        } else {
          setWeight('');
        }
        if (nextExercise.reps) {
          setReps(nextExercise.reps.split('-')[0]);
        }
      } else {
        // Main workout complete - move to cooldown or finish
        completeMainWorkout(updatedLog);
      }
    }
  }, [workoutLog, todayProgram, currentDayExercise, currentExerciseIndex, currentSetIndex, weight, reps, bestWeight]);

  const completeMainWorkout = async (log: WorkoutLog) => {
    const finalLog = {
      ...log,
      completedAt: Date.now(),
      isCompleted: true,
    };
    
    await addWorkoutLog(finalLog);
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    if (cooldownExercises.length > 0) {
      setPhase('cooldown');
      setWarmupTimer(cooldownExercises[0]?.duration || 30);
    } else {
      setPhase('complete');
      recordWorkout(); // Update streak
      Alert.alert(
        'Workout Complete! 💪',
        'Great job! Your workout has been saved.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    }
  };

  const skipRest = () => {
    setIsResting(false);
    setRestTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const cancelWorkout = () => {
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel? Progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openVideo = (url: string) => {
    Linking.openURL(url);
  };

  if (!todayProgram || todayProgram.exercises.length === 0) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <IconSymbol name="calendar" size={64} color={colors.muted} />
        <Text className="text-xl font-semibold text-foreground mt-4">No Workout Today</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 px-6 py-3 rounded-xl"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="font-semibold text-white">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Render Warmup Phase
  if (phase === 'warmup' && currentWarmupExercise) {
    return (
      <ScreenContainer className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity onPress={cancelWorkout} className="p-2">
            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-lg font-semibold" style={{ color: colors.warning }}>
              🔥 Warm-up
            </Text>
            <Text className="text-sm text-muted">
              {warmupIndex + 1} of {warmupExercises.length}
            </Text>
          </View>
          <TouchableOpacity onPress={skipWarmupPhase} className="p-2">
            <Text style={{ color: colors.muted }}>Skip All</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View className="px-4 mb-4">
          <View 
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.border }}
          >
            <View 
              className="h-full rounded-full"
              style={{ 
                width: `${((warmupIndex + 1) / warmupExercises.length) * 100}%`,
                backgroundColor: colors.warning,
              }}
            />
          </View>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Video Player */}
          {currentWarmupExercise.videoUrl && (
            <View className="mb-4">
              <VideoPlayer 
                videoUrl={currentWarmupExercise.videoUrl} 
                exerciseName={currentWarmupExercise.name}
              />
            </View>
          )}

          {/* Exercise Card */}
          <View 
            className="bg-surface rounded-3xl p-6 mb-6"
            style={{ borderWidth: 2, borderColor: colors.warning }}
          >
            <Text className="text-2xl font-bold text-foreground text-center">
              {currentWarmupExercise.name}
            </Text>
            
            {currentWarmupExercise.notes && (
              <View 
                className="mt-4 p-4 rounded-xl"
                style={{ backgroundColor: colors.warning + '15' }}
              >
                <Text className="text-foreground text-center">
                  {currentWarmupExercise.notes}
                </Text>
              </View>
            )}

            {/* Timer */}
            <View className="items-center mt-6">
              <Text className="text-6xl font-bold text-foreground">
                {formatTime(warmupTimer)}
              </Text>
              <Text className="text-muted mt-2">
                {isWarmupTimerRunning ? 'Time remaining' : 'Tap Start to begin'}
              </Text>
            </View>

            {/* Controls */}
            <View className="flex-row mt-6">
              {!isWarmupTimerRunning ? (
                <TouchableOpacity
                  onPress={startWarmupTimer}
                  style={{
                    flex: 1,
                    backgroundColor: colors.warning,
                    paddingVertical: 16,
                    borderRadius: 12,
                    marginRight: 8,
                  }}
                >
                  <Text className="text-white font-bold text-center text-lg">Start Timer</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsWarmupTimerRunning(false)}
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    paddingVertical: 16,
                    borderRadius: 12,
                    marginRight: 8,
                  }}
                >
                  <Text className="text-white font-bold text-center text-lg">Pause</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={completeWarmupExercise}
                style={{
                  flex: 1,
                  backgroundColor: colors.success,
                  paddingVertical: 16,
                  borderRadius: 12,
                  marginLeft: 8,
                }}
              >
                <Text className="text-white font-bold text-center text-lg">Done ✓</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={skipWarmupExercise}
              className="mt-4"
            >
              <Text className="text-center text-muted">Skip this exercise</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Render Cooldown Phase
  if (phase === 'cooldown' && currentCooldownExercise) {
    return (
      <ScreenContainer className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <View style={{ width: 44 }} />
          <View className="items-center">
            <Text className="text-lg font-semibold" style={{ color: colors.primary }}>
              ❄️ Cool-down
            </Text>
            <Text className="text-sm text-muted">
              {cooldownIndex + 1} of {cooldownExercises.length}
            </Text>
          </View>
          <TouchableOpacity onPress={skipCooldownPhase} className="p-2">
            <Text style={{ color: colors.muted }}>Skip All</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View className="px-4 mb-4">
          <View 
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.border }}
          >
            <View 
              className="h-full rounded-full"
              style={{ 
                width: `${((cooldownIndex + 1) / cooldownExercises.length) * 100}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Video Player */}
          {currentCooldownExercise.videoUrl && (
            <View className="mb-4">
              <VideoPlayer 
                videoUrl={currentCooldownExercise.videoUrl} 
                exerciseName={currentCooldownExercise.name}
              />
            </View>
          )}

          {/* Exercise Card */}
          <View 
            className="bg-surface rounded-3xl p-6 mb-6"
            style={{ borderWidth: 2, borderColor: colors.primary }}
          >
            <Text className="text-2xl font-bold text-foreground text-center">
              {currentCooldownExercise.name}
            </Text>
            
            {currentCooldownExercise.notes && (
              <View 
                className="mt-4 p-4 rounded-xl"
                style={{ backgroundColor: colors.primary + '15' }}
              >
                <Text className="text-foreground text-center">
                  {currentCooldownExercise.notes}
                </Text>
              </View>
            )}

            {/* Timer */}
            <View className="items-center mt-6">
              <Text className="text-6xl font-bold text-foreground">
                {formatTime(warmupTimer)}
              </Text>
              <Text className="text-muted mt-2">
                {isWarmupTimerRunning ? 'Time remaining' : 'Tap Start to begin'}
              </Text>
            </View>

            {/* Controls */}
            <View className="flex-row mt-6">
              {!isWarmupTimerRunning ? (
                <TouchableOpacity
                  onPress={startWarmupTimer}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 12,
                    marginRight: 8,
                  }}
                >
                  <Text className="text-white font-bold text-center text-lg">Start Timer</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsWarmupTimerRunning(false)}
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    paddingVertical: 16,
                    borderRadius: 12,
                    marginRight: 8,
                  }}
                >
                  <Text className="text-white font-bold text-center text-lg">Pause</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={completeWarmupExercise}
                style={{
                  flex: 1,
                  backgroundColor: colors.success,
                  paddingVertical: 16,
                  borderRadius: 12,
                  marginLeft: 8,
                }}
              >
                <Text className="text-white font-bold text-center text-lg">Done ✓</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={skipWarmupExercise}
              className="mt-4"
            >
              <Text className="text-center text-muted">Skip this exercise</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Render Complete Phase with Summary
  if (phase === 'complete') {
    // Group tips by exercise
    const tipsByExercise = displayedTips.reduce((acc, item) => {
      if (!acc[item.exerciseName]) {
        acc[item.exerciseName] = [];
      }
      // Avoid duplicates in the same exercise group
      if (!acc[item.exerciseName].some(t => t.tip.id === item.tip.id)) {
        acc[item.exerciseName].push(item);
      }
      return acc;
    }, {} as Record<string, typeof displayedTips>);

    // Load favorite tips and heart rate data on complete phase
    useEffect(() => {
      getFavoriteTips().then(favorites => {
        setFavoritedTipIds(new Set(favorites.map(f => f.tip.id)));
      });
      
      // Load demo heart rate data (in production, fetch from WHOOP API)
      const duration = workoutLog?.startedAt && workoutLog?.completedAt 
        ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
        : 45;
      const demoData = getDemoHeartRateData(duration);
      setHeartRateData(demoData);
    }, []);

    // Handle favorite toggle
    const handleToggleFavorite = async (tip: FormTip, exerciseName: string) => {
      try {
        const isFavorited = await toggleFavoriteTip(tip, exerciseName);
        setFavoritedTipIds(prev => {
          const newSet = new Set(prev);
          if (isFavorited) {
            newSet.add(tip.id);
          } else {
            newSet.delete(tip.id);
          }
          return newSet;
        });
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    };

    // Handle share workout summary
    const handleShareSummary = async () => {
      const totalSets = workoutLog?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) || 0;
      const duration = workoutLog?.startedAt && workoutLog?.completedAt 
        ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
        : 0;
      
      let message = `🏋️ Workout Complete!\n\n`;
      message += `📊 Summary:\n`;
      message += `• Exercises: ${todayProgram.exercises.length}\n`;
      message += `• Total Sets: ${totalSets}\n`;
      if (duration > 0) {
        message += `• Duration: ${duration} min\n`;
      }
      
      if (displayedTips.length > 0) {
        message += `\n💡 Form Tips Reviewed (${displayedTips.length}):\n`;
        Object.entries(tipsByExercise).forEach(([exerciseName, tips]) => {
          message += `\n${exerciseName}:\n`;
          tips.forEach(item => {
            message += `  ${getCategoryEmoji(item.tip.category)} ${item.tip.tip}\n`;
          });
        });
      }
      
      message += `\n💪 Keep pushing!`;
      
      try {
        await Share.share({ message });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    };

    return (
      <ScreenContainer className="flex-1">
        {/* Header */}
        <View className="px-4 py-6 items-center">
          <IconSymbol name="trophy.fill" size={64} color={colors.warning} />
          <Text className="text-3xl font-bold text-foreground mt-4">Workout Complete!</Text>
          <Text className="text-lg text-muted mt-2">Great job! 💪</Text>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Workout Summary */}
          <View 
            className="bg-surface rounded-2xl p-5 mb-4"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-foreground">Summary</Text>
              <TouchableOpacity 
                onPress={handleShareSummary}
                className="flex-row items-center px-3 py-1.5 rounded-full"
                style={{ backgroundColor: colors.primary + '20' }}
              >
                <IconSymbol name="square.and.arrow.up" size={16} color={colors.primary} />
                <Text className="ml-1.5 text-sm font-medium" style={{ color: colors.primary }}>Share</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Exercises</Text>
              <Text className="text-foreground font-medium">{todayProgram.exercises.length}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Total Sets</Text>
              <Text className="text-foreground font-medium">
                {workoutLog?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) || 0}
              </Text>
            </View>
            {workoutLog?.startedAt && workoutLog?.completedAt && (
              <View className="flex-row justify-between">
                <Text className="text-muted">Duration</Text>
                <Text className="text-foreground font-medium">
                  {Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)} min
                </Text>
              </View>
            )}
          </View>

          {/* Heart Rate Chart */}
          {heartRateData && (
            <HeartRateChart data={heartRateData} />
          )}

          {/* Form Tips History */}
          {displayedTips.length > 0 && (
            <View 
              className="bg-surface rounded-2xl p-5 mb-4"
              style={{ borderWidth: 1, borderColor: colors.primary + '40' }}
            >
              <View className="flex-row items-center mb-4">
                <Text style={{ fontSize: 20 }}>💡</Text>
                <Text className="text-lg font-semibold text-foreground ml-2">
                  Form Tips Reviewed ({displayedTips.length})
                </Text>
              </View>
              
              {Object.entries(tipsByExercise).map(([exerciseName, tips]) => (
                <View key={exerciseName} className="mb-4">
                  <Text className="text-sm font-semibold mb-2" style={{ color: colors.primary }}>
                    {exerciseName}
                  </Text>
                  {tips.map((item, index) => (
                    <View 
                      key={`${item.tip.id}-${index}`}
                      className="flex-row items-start mb-2 pl-2"
                      style={{ borderLeftWidth: 2, borderLeftColor: colors.border }}
                    >
                      <Text style={{ fontSize: 14 }}>{getCategoryEmoji(item.tip.category)}</Text>
                      <Text className="text-sm text-muted ml-2 flex-1">{item.tip.tip}</Text>
                      <TouchableOpacity 
                        onPress={() => handleToggleFavorite(item.tip, exerciseName)}
                        className="ml-2 p-1"
                      >
                        <IconSymbol 
                          name={favoritedTipIds.has(item.tip.id) ? "star.fill" : "star"} 
                          size={18} 
                          color={favoritedTipIds.has(item.tip.id) ? colors.warning : colors.muted} 
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
              
              <Text className="text-xs text-muted text-center mt-2">
                Tap ⭐ to save tips for future reference
              </Text>
            </View>
          )}

          {/* Done Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="py-4 rounded-xl mb-8"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-white font-bold text-center text-lg">Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Main Workout Phase
  const progress = ((currentExerciseIndex * currentDayExercise!.sets + currentSetIndex) / 
    todayProgram.exercises.reduce((acc, ex) => acc + ex.sets, 0)) * 100;

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={cancelWorkout} className="p-2">
          <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">
          Week {currentCycleInfo.week}, {getDayName(currentCycleInfo.day)}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Progress Bar */}
      <View className="px-4 mb-4">
        <View 
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: colors.border }}
        >
          <View 
            className="h-full rounded-full"
            style={{ 
              width: `${progress}%`,
              backgroundColor: colors.primary,
            }}
          />
        </View>
        <Text className="text-xs text-muted mt-1 text-center">
          Exercise {currentExerciseIndex + 1} of {todayProgram.exercises.length}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Rest Timer Overlay */}
        {isResting ? (
          <View className="mb-6">
            {/* Timer Card */}
            <View 
              className="bg-surface rounded-3xl p-8 items-center"
              style={{ borderWidth: 2, borderColor: colors.warning }}
            >
              <IconSymbol name="timer" size={48} color={colors.warning} />
              <Text className="text-5xl font-bold text-foreground mt-4">
                {formatTime(restTime)}
              </Text>
              <Text className="text-lg text-muted mt-2">Rest Time</Text>
              <TouchableOpacity
                onPress={skipRest}
                className="mt-6 px-8 py-3 rounded-xl"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="font-semibold text-white">Skip Rest</Text>
              </TouchableOpacity>
            </View>

            {/* Form Tip Card */}
            {currentFormTip && (
              <View 
                className="bg-surface rounded-2xl p-5 mt-4"
                style={{ borderWidth: 1, borderColor: colors.primary + '40' }}
              >
                <View className="flex-row items-center mb-3">
                  <Text style={{ fontSize: 20 }}>{getCategoryEmoji(currentFormTip.category)}</Text>
                  <Text className="text-sm font-semibold ml-2" style={{ color: colors.primary }}>
                    {getCategoryLabel(currentFormTip.category)} Tip
                  </Text>
                </View>
                <Text className="text-base text-foreground leading-relaxed">
                  {currentFormTip.tip}
                </Text>
                <Text className="text-xs text-muted mt-3 text-center">
                  Tips rotate every 8 seconds
                </Text>
              </View>
            )}

            {/* Next Up Preview */}
            {currentExercise && (
              <View className="mt-4 px-2">
                <Text className="text-sm text-muted text-center">
                  Next: Set {currentSetIndex + 2} of {currentDayExercise?.sets} • {currentExercise.name}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Exercise Guidance - Video/GIF and Instructions */}
            {currentExercise && (
              <ExerciseGuidance
                exerciseName={currentExercise.name}
                exerciseId={currentExercise.id}
                videoUrl={currentExercise.videoUrl}
                notes={currentExercise.notes}
                apiKey={store.settings.rapidApiKey}
              />
            )}

            {/* Current Exercise Card */}
            <View 
              className="bg-surface rounded-3xl p-6 mb-6"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="mb-4">
                <Text className="text-2xl font-bold text-foreground">
                  {currentExercise?.name}
                </Text>
                <Text className="text-muted mt-1">
                  Set {currentSetIndex + 1} of {currentDayExercise?.sets}
                </Text>
              </View>

              {/* Target Reps */}
              <View 
                className="bg-background rounded-xl p-4 mb-4"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <Text className="text-sm text-muted">Target Reps</Text>
                <Text className="text-xl font-bold text-foreground">
                  {currentDayExercise?.reps}
                </Text>
              </View>

              {/* Last Weight Reference */}
              {lastWeightValue !== null && (
                <View 
                  className="flex-row items-center mb-4 p-3 rounded-xl"
                  style={{ backgroundColor: colors.primary + '10' }}
                >
                  <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
                  <Text className="ml-2 text-foreground">
                    Last time: <Text className="font-bold">{lastWeightValue} kg</Text>
                  </Text>
                </View>
              )}

              {/* Weight Input */}
              <Text className="text-sm font-medium text-muted mb-2">Weight (kg)</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                className="bg-background rounded-xl p-4 text-2xl font-bold text-foreground text-center mb-4"
                style={{ borderWidth: 1, borderColor: colors.border }}
              />

              {/* Reps Input */}
              <Text className="text-sm font-medium text-muted mb-2">Reps Completed</Text>
              <TextInput
                value={reps}
                onChangeText={setReps}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                className="bg-background rounded-xl p-4 text-2xl font-bold text-foreground text-center"
                style={{ borderWidth: 1, borderColor: colors.border }}
              />
            </View>

            {/* Complete Set Button */}
            <TouchableOpacity
              onPress={completeSet}
              style={{
                backgroundColor: colors.success,
                paddingVertical: 18,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol name="checkmark.circle.fill" size={24} color="#FFFFFF" />
              <Text className="text-white font-bold text-lg ml-2">
                Complete Set
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Completed Sets */}
        {workoutLog && workoutLog.exercises[currentExerciseIndex].sets.length > 0 && (
          <View className="mt-6 mb-8">
            <Text className="text-sm font-medium text-muted mb-3">Completed Sets</Text>
            {workoutLog.exercises[currentExerciseIndex].sets.map((set, index) => (
              <View 
                key={index}
                className="flex-row items-center bg-surface rounded-xl p-3 mb-2"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <View 
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: colors.success + '20' }}
                >
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                </View>
                <Text className="flex-1 text-foreground">Set {set.setNumber}</Text>
                <Text className="font-semibold text-foreground">{set.weight} kg × {set.reps}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Congratulations Modal */}
      <Modal
        visible={showCongrats}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View 
            className="bg-background rounded-3xl p-8 mx-8 items-center"
            style={{ borderWidth: 2, borderColor: colors.success }}
          >
            <IconSymbol name="trophy.fill" size={64} color={colors.warning} />
            <Text className="text-3xl font-bold text-foreground mt-4">🎉 PR!</Text>
            <Text className="text-xl mt-2 font-semibold" style={{ color: colors.success }}>{congratsMessage}</Text>
            <Text className="text-muted mt-2">Keep pushing!</Text>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
