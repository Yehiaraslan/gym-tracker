import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  PanResponder,
  Animated,
  Dimensions,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ProgressPhoto {
  id: string;
  uri: string;
  date: number;
  category: 'front' | 'side' | 'back';
}

interface ProgressPhotoSliderProps {
  beforePhoto: ProgressPhoto;
  afterPhoto: ProgressPhoto;
}

export function ProgressPhotoSlider({ beforePhoto, afterPhoto }: ProgressPhotoSliderProps) {
  const colors = useColors();
  const [sliderPosition, setSliderPosition] = useState(50);
  const screenWidth = Dimensions.get('window').width - 32; // Account for padding
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      const { dx } = gestureState;
      const percentage = Math.max(0, Math.min(100, ((sliderPosition / 100 * screenWidth + dx) / screenWidth) * 100));
      setSliderPosition(percentage);
    },
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const daysDifference = Math.floor((afterPhoto.date - beforePhoto.date) / (1000 * 60 * 60 * 24));

  return (
    <View className="mb-6">
      <View
        className="bg-surface rounded-xl p-4 overflow-hidden"
        style={{ borderWidth: 1, borderColor: colors.cardBorder }}
      >
        {/* Comparison Slider */}
        <View
          className="relative rounded-lg overflow-hidden"
          style={{ height: 400, backgroundColor: colors.background }}
          {...panResponder.panHandlers}
        >
          {/* After Photo (Background) */}
          <Image
            source={{ uri: afterPhoto.uri }}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
            }}
            resizeMode="cover"
          />

          {/* Before Photo (Overlay) */}
          <View
            style={{
              width: `${sliderPosition}%`,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Image
              source={{ uri: beforePhoto.uri }}
              style={{
                width: screenWidth,
                height: '100%',
              }}
              resizeMode="cover"
            />
          </View>

          {/* Slider Handle */}
          <View
            style={{
              position: 'absolute',
              left: `${sliderPosition}%`,
              top: 0,
              height: '100%',
              width: 4,
              backgroundColor: colors.primary,
              transform: [{ translateX: -2 }],
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: '50%',
                left: -12,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primary,
                justifyContent: 'center',
                alignItems: 'center',
                transform: [{ translateY: -14 }],
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <IconSymbol name="chevron.left" size={16} color="#FFFFFF" />
              <IconSymbol name="chevron.right" size={16} color="#FFFFFF" />
            </View>
          </View>

          {/* Labels */}
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              backgroundColor: colors.primary + 'CC',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          >
            <Text className="text-white font-semibold text-sm">Before</Text>
          </View>

          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: colors.success + 'CC',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          >
            <Text className="text-white font-semibold text-sm">After</Text>
          </View>
        </View>

        {/* Photo Info */}
        <View className="mt-4 flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-xs text-cardMuted">Before</Text>
            <Text className="text-sm font-semibold text-cardForeground">
              {formatDate(beforePhoto.date)}
            </Text>
          </View>

          <View className="items-center">
            <Text className="text-xs text-cardMuted">Progress</Text>
            <Text className="text-sm font-bold" style={{ color: colors.success }}>
              {daysDifference} days
            </Text>
          </View>

          <View className="flex-1 items-end">
            <Text className="text-xs text-cardMuted">After</Text>
            <Text className="text-sm font-semibold text-cardForeground">
              {formatDate(afterPhoto.date)}
            </Text>
          </View>
        </View>

        {/* Category Badge */}
        <View className="mt-3 flex-row items-center justify-center">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
              {beforePhoto.category.charAt(0).toUpperCase() + beforePhoto.category.slice(1)} View
            </Text>
          </View>
        </View>
      </View>

      {/* Instructions */}
      <View className="mt-3 flex-row items-center gap-2 px-2">
        <IconSymbol name="info.circle.fill" size={16} color={colors.cardMuted} />
        <Text className="text-xs text-cardMuted flex-1">Drag the slider to compare photos</Text>
      </View>
    </View>
  );
}
