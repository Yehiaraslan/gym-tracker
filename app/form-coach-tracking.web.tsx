// Web stub — VisionCamera (MediaPipe pose detection) is native-only
// This file is used by Metro on web instead of form-coach-tracking.tsx
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

export default function FormCoachTrackingWeb() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer className="items-center justify-center p-8">
      <Text style={{ fontSize: 48, marginBottom: 16 }}>📱</Text>
      <Text className="text-xl font-bold text-cardForeground text-center mb-3">
        AI Form Coach
      </Text>
      <Text className="text-sm text-cardMuted text-center mb-6 leading-relaxed">
        The AI Form Coach uses your camera with MediaPipe pose detection.
        This feature requires the native Android or iOS app — it is not available in the web preview.
      </Text>
      <TouchableOpacity
        onPress={() => router.back()}
        className="px-6 py-3 rounded-full"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-white font-semibold">Go Back</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
