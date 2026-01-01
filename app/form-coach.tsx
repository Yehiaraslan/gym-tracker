import { useState } from 'react';
import { 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { ExerciseType } from '@/lib/pose-detection';

interface ExerciseOption {
  type: ExerciseType;
  name: string;
  description: string;
  icon: string;
  tips: string[];
}

const EXERCISES: ExerciseOption[] = [
  {
    type: 'pushup',
    name: 'Push-up',
    description: 'Track your push-up form and count reps automatically',
    icon: '💪',
    tips: [
      'Position camera to your side for best tracking',
      'Ensure good lighting',
      'Keep your whole body in frame',
    ],
  },
  {
    type: 'pullup',
    name: 'Pull-up',
    description: 'Track your pull-up form and count reps automatically',
    icon: '🏋️',
    tips: [
      'Position camera in front of you',
      'Ensure good lighting',
      'Keep your upper body in frame',
    ],
  },
];

export default function FormCoachScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null);

  const handleSelectExercise = (type: ExerciseType) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedExercise(type);
  };

  const handleStartTracking = () => {
    if (!selectedExercise) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    router.push({
      pathname: '/form-coach-tracking',
      params: { exercise: selectedExercise },
    } as any);
  };

  const selectedOption = EXERCISES.find(e => e.type === selectedExercise);

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2 mr-2"
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-foreground">AI Form Coach</Text>
          <Text className="text-sm text-muted">On-device pose tracking</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View 
          className="bg-surface rounded-2xl p-4 mb-6"
          style={{ borderWidth: 1, borderColor: colors.primary + '30' }}
        >
          <View className="flex-row items-center mb-2">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text className="ml-2 font-semibold text-foreground">How it works</Text>
          </View>
          <Text className="text-muted text-sm leading-5">
            The AI Form Coach uses your camera to track your body position in real-time. 
            It counts your reps automatically and provides feedback on your form. 
            All processing happens on your device - no video is uploaded.
          </Text>
        </View>

        {/* Exercise Selection */}
        <Text className="text-lg font-semibold text-foreground mb-3">Select Exercise</Text>
        
        {EXERCISES.map((exercise) => (
          <TouchableOpacity
            key={exercise.type}
            onPress={() => handleSelectExercise(exercise.type)}
            activeOpacity={0.7}
          >
            <View 
              className="bg-surface rounded-2xl p-5 mb-3"
              style={{ 
                borderWidth: 2, 
                borderColor: selectedExercise === exercise.type 
                  ? colors.primary 
                  : colors.border,
              }}
            >
              <View className="flex-row items-center">
                <View 
                  className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                  style={{ backgroundColor: colors.primary + '15' }}
                >
                  <Text style={{ fontSize: 28 }}>{exercise.icon}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">
                    {exercise.name}
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    {exercise.description}
                  </Text>
                </View>
                {selectedExercise === exercise.type && (
                  <IconSymbol 
                    name="checkmark.circle.fill" 
                    size={24} 
                    color={colors.primary} 
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Tips Section */}
        {selectedOption && (
          <View className="mt-4 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Tips for {selectedOption.name}
            </Text>
            <View 
              className="bg-surface rounded-2xl p-4"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              {selectedOption.tips.map((tip, index) => (
                <View key={index} className="flex-row items-start mb-2 last:mb-0">
                  <View 
                    className="w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5"
                    style={{ backgroundColor: colors.success + '20' }}
                  >
                    <Text className="text-xs font-bold" style={{ color: colors.success }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="flex-1 text-foreground">{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Disclaimer */}
        <View 
          className="bg-surface rounded-xl p-4 mb-6"
          style={{ backgroundColor: colors.warning + '10' }}
        >
          <View className="flex-row items-start">
            <Text style={{ fontSize: 16, marginRight: 8 }}>⚠️</Text>
            <Text className="flex-1 text-sm text-muted">
              AI tracking works best with stable camera position and good lighting. 
              Results may vary based on conditions.
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Start Button */}
      {selectedExercise && (
        <View className="px-4 pb-6">
          <TouchableOpacity
            onPress={handleStartTracking}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 18,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSymbol name="play.fill" size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-lg ml-2">
              Start Tracking
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
