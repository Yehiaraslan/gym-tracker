import React, { useEffect } from 'react';
import { View, Text, Modal, Animated, Easing } from 'react-native';
import { Badge } from '@/lib/streak-milestones';
import * as Haptics from 'expo-haptics';

interface MilestoneCelebrationProps {
  milestone: Badge | null;
  visible: boolean;
  onDismiss: () => void;
}

export function MilestoneCelebration({
  milestone,
  visible,
  onDismiss,
}: MilestoneCelebrationProps) {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && milestone) {
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate in
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, milestone]);

  if (!milestone) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
          className="items-center gap-4 bg-surface rounded-3xl p-8 shadow-lg"
        >
          {/* Icon */}
          <Text className="text-8xl">{milestone.icon}</Text>

          {/* Title */}
          <Text className="text-3xl font-bold text-foreground text-center">
            {milestone.name}
          </Text>

          {/* Description */}
          <Text className="text-lg text-muted text-center">
            {milestone.description}
          </Text>

          {/* Celebration text */}
          <Text className="text-base text-primary font-semibold mt-2">
            🎉 Milestone Unlocked! 🎉
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}
