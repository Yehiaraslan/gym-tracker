/**
 * Tracking Status Indicator
 * 
 * Displays the current tracking confidence and status.
 * Shows warnings when tracking is weak or paused.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { TrackingStatus } from '@/lib/pose-service';

interface TrackingStatusIndicatorProps {
  confidence: number;
  status: TrackingStatus;
  isPaused: boolean;
  warningMessage?: string;
  showConfidenceBar?: boolean;
  compact?: boolean;
}

export function TrackingStatusIndicator({
  confidence,
  status,
  isPaused,
  warningMessage,
  showConfidenceBar = true,
  compact = false,
}: TrackingStatusIndicatorProps) {
  const pulseOpacity = useSharedValue(1);

  // Pulse animation for warnings
  React.useEffect(() => {
    if (status === 'weak' || isPaused) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [status, isPaused]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Get status color
  const getStatusColor = () => {
    if (isPaused) return '#EF4444'; // Red
    switch (status) {
      case 'good': return '#22C55E'; // Green
      case 'weak': return '#F59E0B'; // Yellow
      case 'lost': return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  // Get status label
  const getStatusLabel = () => {
    if (isPaused) return 'PAUSED';
    switch (status) {
      case 'good': return 'TRACKING';
      case 'weak': return 'WEAK';
      case 'lost': return 'LOST';
      default: return 'UNKNOWN';
    }
  };

  const statusColor = getStatusColor();
  const confidencePercent = Math.round(confidence * 100);

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, pulseStyle]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.compactLabel, { color: statusColor }]}>
          {confidencePercent}%
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status Badge */}
      <Animated.View 
        style={[
          styles.statusBadge, 
          { backgroundColor: statusColor },
          pulseStyle
        ]}
      >
        <Text style={styles.statusLabel}>{getStatusLabel()}</Text>
      </Animated.View>

      {/* Confidence Bar */}
      {showConfidenceBar && (
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceBarBackground}>
            <Animated.View 
              style={[
                styles.confidenceBarFill,
                { 
                  width: `${confidencePercent}%`,
                  backgroundColor: statusColor,
                }
              ]}
            />
          </View>
          <Text style={styles.confidenceText}>{confidencePercent}%</Text>
        </View>
      )}

      {/* Warning Message */}
      {warningMessage && (
        <Animated.View style={[styles.warningContainer, pulseStyle]}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>{warningMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// Separate warning banner component for overlay
export function TrackingWarningBanner({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  const translateY = useSharedValue(-100);

  React.useEffect(() => {
    translateY.value = withSpring(visible ? 0 : -100, {
      damping: 15,
      stiffness: 150,
    });
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible && translateY.value === -100) return null;

  return (
    <Animated.View style={[styles.warningBanner, animatedStyle]}>
      <Text style={styles.warningBannerIcon}>⚠️</Text>
      <Text style={styles.warningBannerText}>{message}</Text>
    </Animated.View>
  );
}

// Confidence level legend
export function ConfidenceLevelLegend({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.legendCompact}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.legendTextCompact}>Good</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendTextCompact}>Weak</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendTextCompact}>Lost</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.legend}>
      <Text style={styles.legendTitle}>Tracking Quality</Text>
      <View style={styles.legendItems}>
        <View style={styles.legendItemFull}>
          <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.legendText}>Good (60%+)</Text>
        </View>
        <View style={styles.legendItemFull}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>Weak (30-60%)</Text>
        </View>
        <View style={styles.legendItemFull}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Lost (&lt;30%)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    gap: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  warningIcon: {
    fontSize: 16,
  },
  warningText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  warningBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 100,
  },
  warningBannerIcon: {
    fontSize: 18,
  },
  warningBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 12,
  },
  legendCompact: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 12,
  },
  legendTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  legendItems: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendItemFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  legendTextCompact: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.9,
  },
});

export default TrackingStatusIndicator;
