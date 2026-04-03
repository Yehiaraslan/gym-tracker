import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, Animated } from 'react-native';
import { cn } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';
import type { Badge } from '@/lib/streak-milestones';

interface MilestoneCelebrationProps {
  badge: Badge | null;
  visible: boolean;
  onDismiss: () => void;
}

export function MilestoneCelebration({
  badge,
  visible,
  onDismiss,
}: MilestoneCelebrationProps) {
  const colors = useColors();
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && badge) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 5 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [visible, badge]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
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
  };

  if (!badge) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          <View
            className="bg-surface rounded-3xl p-8 items-center"
            style={{
              borderWidth: 2,
              borderColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Badge Icon */}
            <Text className="text-8xl mb-4">{badge.icon}</Text>

            {/* Badge Name */}
            <Text className="text-2xl font-bold text-cardForeground text-center mb-2">
              {badge.name}
            </Text>

            {/* Badge Description */}
            <Text className="text-base text-cardMuted text-center mb-6">
              {badge.description}
            </Text>

            {/* Confetti Effect (simple stars) */}
            <View className="flex-row gap-2 mb-6">
              <Text className="text-2xl">✨</Text>
              <Text className="text-2xl">🎉</Text>
              <Text className="text-2xl">✨</Text>
            </View>

            {/* Dismiss Button */}
            <Pressable
              onPress={handleDismiss}
              className={cn(
                'bg-primary px-8 py-3 rounded-full',
                'active:opacity-80'
              )}
            >
              <Text className="text-background font-semibold">
                Awesome! 🚀
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
