import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { DifficultyRating } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface DifficultyRatingProps {
  value?: DifficultyRating;
  onChange: (rating: DifficultyRating) => void;
  disabled?: boolean;
}
const DIFFICULTY_OPTIONS: Array<{ value: DifficultyRating; label: string; emoji: string; color: string }> = [
  { value: 'easy', label: 'Easy', emoji: '😌', color: '#22C55E' },
  { value: 'medium', label: 'Medium', emoji: '💪', color: '#F59E0B' },
  { value: 'hard', label: 'Hard', emoji: '🔥', color: '#EF4444' },
];
export function DifficultyRatingComponent({ value, onChange, disabled = false }: DifficultyRatingProps) {
  const colors = useColors();
  const handleSelect = (rating: DifficultyRating) => {
    if (!disabled) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onChange(rating);
    }
  };
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground mb-2">How was this exercise?</Text>
      <View className="flex-row gap-3">
        {DIFFICULTY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => handleSelect(option.value)}
            disabled={disabled}
            className="flex-1 rounded-xl p-3 items-center justify-center"
            style={{
              backgroundColor: value === option.value ? option.color + '20' : colors.surface,
              borderWidth: 2,
              borderColor: value === option.value ? option.color : colors.border,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text className="text-2xl mb-1">{option.emoji}</Text>
            <Text
              className="text-xs font-semibold"
              style={{ color: value === option.value ? option.color : colors.muted }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
