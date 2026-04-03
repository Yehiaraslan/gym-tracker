import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { BodyPart, ExerciseType } from '@/lib/types';

interface ExerciseFormProps {
  onSubmit: (data: {
    name: string;
    videoUrl: string;
    defaultRestSeconds: number;
    defaultReps?: string;
    defaultDuration?: number;
    exerciseType: ExerciseType;
    bodyPart: BodyPart;
    notes: string;
  }) => void;
  onCancel: () => void;
  initialData?: any;
}

const BODY_PARTS: BodyPart[] = ['Legs', 'Arms', 'Chest', 'Back', 'Shoulders', 'Core', 'Cardio', 'Other'];

export function ExerciseForm({ onSubmit, onCancel, initialData }: ExerciseFormProps) {
  const colors = useColors();
  const [name, setName] = useState(initialData?.name || '');
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || '');
  const [restSeconds, setRestSeconds] = useState((initialData?.defaultRestSeconds || 90).toString());
  const [exerciseType, setExerciseType] = useState<ExerciseType>(initialData?.exerciseType || 'reps');
  const [bodyPart, setBodyPart] = useState<BodyPart>(initialData?.bodyPart || 'Other');
  const [reps, setReps] = useState(initialData?.defaultReps || '8-12');
  const [duration, setDuration] = useState((initialData?.defaultDuration || 60).toString());
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }

    onSubmit({
      name: name.trim(),
      videoUrl: videoUrl.trim(),
      defaultRestSeconds: parseInt(restSeconds) || 90,
      defaultReps: exerciseType === 'reps' ? reps : undefined,
      defaultDuration: exerciseType === 'duration' ? parseInt(duration) : undefined,
      exerciseType,
      bodyPart,
      notes: notes.trim(),
    });
  };

  return (
    <ScrollView className="flex-1 p-4" style={{ backgroundColor: colors.background }}>
      <View className="mb-4">
        <Text className="text-lg font-semibold text-cardForeground mb-2">Exercise Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g., Barbell Squat"
          placeholderTextColor={colors.cardMuted}
          className="bg-surface rounded-lg p-3 text-cardForeground"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        />
      </View>

      <View className="mb-4">
        <Text className="text-lg font-semibold text-cardForeground mb-2">Body Part</Text>
        <View className="flex-row flex-wrap gap-2">
          {BODY_PARTS.map(part => (
            <TouchableOpacity
              key={part}
              onPress={() => setBodyPart(part)}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: bodyPart === part ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Text
                style={{
                  color: bodyPart === part ? 'white' : colors.cardForeground,
                  fontWeight: bodyPart === part ? '600' : '400',
                }}
              >
                {part}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-lg font-semibold text-cardForeground mb-2">Exercise Type</Text>
        <View className="flex-row gap-2">
          {(['reps', 'duration'] as ExerciseType[]).map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => setExerciseType(type)}
              className="flex-1 py-3 rounded-lg"
              style={{
                backgroundColor: exerciseType === type ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Text
                className="text-center font-semibold"
                style={{
                  color: exerciseType === type ? 'white' : colors.cardForeground,
                }}
              >
                {type === 'reps' ? 'Reps' : 'Duration'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {exerciseType === 'reps' ? (
        <View className="mb-4">
          <Text className="text-lg font-semibold text-cardForeground mb-2">Default Reps</Text>
          <TextInput
            value={reps}
            onChangeText={setReps}
            placeholder="e.g., 8-12 or 10"
            placeholderTextColor={colors.cardMuted}
            className="bg-surface rounded-lg p-3 text-cardForeground"
            style={{ borderWidth: 1, borderColor: colors.cardBorder }}
          />
        </View>
      ) : (
        <View className="mb-4">
          <Text className="text-lg font-semibold text-cardForeground mb-2">Default Duration (seconds)</Text>
          <TextInput
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g., 60"
            placeholderTextColor={colors.cardMuted}
            keyboardType="numeric"
            className="bg-surface rounded-lg p-3 text-cardForeground"
            style={{ borderWidth: 1, borderColor: colors.cardBorder }}
          />
        </View>
      )}

      <View className="mb-4">
        <Text className="text-lg font-semibold text-cardForeground mb-2">Rest Between Sets (seconds)</Text>
        <TextInput
          value={restSeconds}
          onChangeText={setRestSeconds}
          placeholder="90"
          placeholderTextColor={colors.cardMuted}
          keyboardType="numeric"
          className="bg-surface rounded-lg p-3 text-cardForeground"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        />
      </View>

      <View className="mb-6">
        <Text className="text-lg font-semibold text-cardForeground mb-2">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g., Keep chest up, pause 2 sec"
          placeholderTextColor={colors.cardMuted}
          multiline
          numberOfLines={3}
          className="bg-surface rounded-lg p-3 text-cardForeground"
          style={{ borderWidth: 1, borderColor: colors.cardBorder }}
        />
      </View>

      <View className="flex-row gap-2 mb-4">
        <TouchableOpacity
          onPress={handleSubmit}
          className="flex-1 py-3 rounded-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center font-semibold text-white">Save Exercise</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 py-3 rounded-lg"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
        >
          <Text className="text-center font-semibold text-cardForeground">Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
