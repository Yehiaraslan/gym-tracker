import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.cardBorder,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const colors = useColors();
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      gap: 12,
    }}>
      <Skeleton width="60%" height={16} borderRadius={4} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '40%' : '100%'} height={12} borderRadius={4} />
      ))}
    </View>
  );
}

export function SkeletonWorkoutCard() {
  const colors = useColors();
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={14} borderRadius={4} />
          <Skeleton width="40%" height={10} borderRadius={4} />
        </View>
      </View>
      <Skeleton width="100%" height={48} borderRadius={12} />
    </View>
  );
}
