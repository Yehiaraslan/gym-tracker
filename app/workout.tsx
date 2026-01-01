import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { 
  generateId, 
  WorkoutLog, 
  ExerciseLog, 
  SetLog,
  getDayName,
} from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

export default function WorkoutScreen() {
  useKeepAwake();
  
  const colors = useColors();
  const router = useRouter();
  const { 
    currentCycleInfo, 
    getTodayProgram, 
    getExerciseById,
    getLastWeight,
    getBestWeight,
    addWorkoutLog,
    updateWorkoutLog,
  } = useGym();

  const todayProgram = getTodayProgram();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsMessage, setCongratsMessage] = useState('');
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize workout log
  useEffect(() => {
    if (todayProgram && todayProgram.exercises.length > 0) {
      const exercises: ExerciseLog[] = todayProgram.exercises.map(dayEx => {
        const exercise = getExerciseById(dayEx.exerciseId);
        return {
          exerciseId: dayEx.exerciseId,
          exerciseName: exercise?.name || 'Unknown',
          targetSets: dayEx.sets,
          targetReps: dayEx.reps,
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
      setReps(firstExercise.reps.split('-')[0]);
    }
  }, []);

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
  const lastWeight = currentDayExercise ? getLastWeight(currentDayExercise.exerciseId) : null;
  const bestWeight = currentDayExercise ? getBestWeight(currentDayExercise.exerciseId) : null;

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
        setReps(nextExercise.reps.split('-')[0]);
      } else {
        // Workout complete
        completeWorkout(updatedLog);
      }
    }
  }, [workoutLog, todayProgram, currentDayExercise, currentExerciseIndex, currentSetIndex, weight, reps, bestWeight]);

  const completeWorkout = async (log: WorkoutLog) => {
    const finalLog = {
      ...log,
      completedAt: Date.now(),
      isCompleted: true,
    };
    
    await addWorkoutLog(finalLog);
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    Alert.alert(
      'Workout Complete! 💪',
      'Great job! Your workout has been saved.',
      [{ text: 'Done', onPress: () => router.back() }]
    );
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

      <ScrollView className="flex-1 px-4">
        {/* Rest Timer Overlay */}
        {isResting ? (
          <View 
            className="bg-surface rounded-3xl p-8 items-center mb-6"
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
        ) : (
          <>
            {/* Current Exercise Card */}
            <View 
              className="bg-surface rounded-3xl p-6 mb-6"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">
                    {currentExercise?.name}
                  </Text>
                  <Text className="text-muted mt-1">
                    Set {currentSetIndex + 1} of {currentDayExercise?.sets}
                  </Text>
                </View>
                {currentExercise?.videoUrl ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(currentExercise.videoUrl)}
                    className="p-3 rounded-full"
                    style={{ backgroundColor: colors.primary + '20' }}
                  >
                    <IconSymbol name="video.fill" size={24} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
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
              {lastWeight !== null && (
                <View 
                  className="flex-row items-center mb-4 p-3 rounded-xl"
                  style={{ backgroundColor: colors.primary + '10' }}
                >
                  <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
                  <Text className="ml-2 text-foreground">
                    Last time: <Text className="font-bold">{lastWeight} kg</Text>
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
          <View className="mt-6">
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
            <Text className="text-xl text-success mt-2 font-semibold">{congratsMessage}</Text>
            <Text className="text-muted mt-2">Keep pushing!</Text>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
