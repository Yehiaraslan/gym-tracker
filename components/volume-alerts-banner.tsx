import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { VolumeAlert } from '@/lib/volume-balance';
import { useColors } from '@/hooks/use-colors';

interface VolumeAlertsBannerProps {
  alerts: VolumeAlert[];
  onDismiss?: (id: string) => void;
  onPress?: () => void;
}

export function VolumeAlertsBanner({ alerts, onDismiss, onPress }: VolumeAlertsBannerProps) {
  const colors = useColors();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const slideAnim = new Animated.Value(0);

  // Filter out dismissed alerts and get the highest severity one
  const visibleAlerts = alerts.filter((alert) => !dismissedIds.has(alert.id));

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const topAlert = visibleAlerts.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  )[0];

  useEffect(() => {
    if (topAlert) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [topAlert?.id, slideAnim]);

  if (!topAlert) {
    return null;
  }

  const handleDismiss = () => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(topAlert.id);
    setDismissedIds(newDismissed);
    onDismiss?.(topAlert.id);
  };

  const getBackgroundColor = () => {
    switch (topAlert.severity) {
      case 'critical':
        return '#FEE2E2'; // light red
      case 'warning':
        return '#FEF3C7'; // light yellow
      case 'info':
      default:
        return '#DBEAFE'; // light blue
    }
  };

  const getBorderColor = () => {
    switch (topAlert.severity) {
      case 'critical':
        return '#FCA5A5'; // red border
      case 'warning':
        return '#FCD34D'; // yellow border
      case 'info':
      default:
        return '#93C5FD'; // blue border
    }
  };

  const getTextColor = () => {
    switch (topAlert.severity) {
      case 'critical':
        return '#7F1D1D'; // dark red
      case 'warning':
        return '#92400E'; // dark yellow/brown
      case 'info':
      default:
        return '#1E40AF'; // dark blue
    }
  };

  const containerOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const containerTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerOpacity,
          transform: [{ translateY: containerTranslateY }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={[
          styles.banner,
          {
            backgroundColor: getBackgroundColor(),
            borderColor: getBorderColor(),
          },
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.emoji}>{topAlert.emoji}</Text>
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.title,
                {
                  color: getTextColor(),
                },
              ]}
            >
              {topAlert.title}
            </Text>
            <Text
              style={[
                styles.message,
                {
                  color: getTextColor(),
                },
              ]}
              numberOfLines={2}
            >
              {topAlert.message}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleDismiss}
          style={[
            styles.closeButton,
            {
              backgroundColor: `${getTextColor()}20`,
            },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={[
              styles.closeIcon,
              {
                color: getTextColor(),
              },
            ]}
          >
            ×
          </Text>
        </Pressable>
      </Pressable>

      {visibleAlerts.length > 1 && (
        <Text
          style={[
            styles.moreCount,
            {
              color: colors.muted,
            },
          ]}
        >
          +{visibleAlerts.length - 1} more alert{visibleAlerts.length - 1 !== 1 ? 's' : ''}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  emoji: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '300',
  },
  moreCount: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
