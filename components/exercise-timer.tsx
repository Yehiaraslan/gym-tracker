import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface ExerciseTimerProps {
  duration: number;
  onComplete: () => void;
  exerciseName: string;
}

export function ExerciseTimer({ duration, onComplete, exerciseName }: ExerciseTimerProps) {
  const colors = useColors();
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration - timeLeft) / duration) * 100;

  return (
    <View className="items-center justify-center p-6 bg-surface rounded-2xl" style={{ borderWidth: 1, borderColor: colors.cardBorder }}>
      <Text className="text-lg font-semibold text-cardMuted mb-2">{exerciseName}</Text>
      
      <View className="w-full h-2 bg-background rounded-full mb-6" style={{ borderWidth: 1, borderColor: colors.cardBorder }}>
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>

      <Text className="text-6xl font-bold text-primary mb-6">
        {formatTime(timeLeft)}
      </Text>

      <View className="flex-row gap-4 w-full">
        <TouchableOpacity
          onPress={() => setIsRunning(!isRunning)}
          className="flex-1 py-4 rounded-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center font-semibold text-white text-lg">
            {isRunning ? 'Pause' : 'Start'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setTimeLeft(duration);
            setIsRunning(false);
          }}
          className="flex-1 py-4 rounded-lg"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <Text className="text-center font-semibold text-cardForeground text-lg">Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsRunning(false);
            onComplete();
          }}
          className="flex-1 py-4 rounded-lg"
          style={{ backgroundColor: colors.success + '20' }}
        >
          <Text className="text-center font-semibold text-lg" style={{ color: colors.success }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
