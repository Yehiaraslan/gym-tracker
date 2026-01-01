/**
 * Calibration Overlay Component
 * 
 * Displays the calibration UI during the calibration phase.
 * Shows progress, detected joints, and instructions.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { CalibrationPhase, CalibrationState } from '@/lib/calibration-manager';
import { KEYPOINT_NAMES } from '@/lib/pose-service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CalibrationOverlayProps {
  state: CalibrationState;
  onCancel?: () => void;
}

export function CalibrationOverlay({ state, onCancel }: CalibrationOverlayProps) {
  const pulseScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  // Pulse animation for the main indicator
  React.useEffect(() => {
    if (state.phase === 'detecting' || state.phase === 'stabilizing') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [state.phase]);

  // Progress bar animation
  React.useEffect(() => {
    progressWidth.value = withSpring(state.progress, {
      damping: 15,
      stiffness: 100,
    });
  }, [state.progress]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // Get phase color
  const getPhaseColor = () => {
    switch (state.phase) {
      case 'detecting': return '#F59E0B'; // Yellow
      case 'stabilizing': return '#3B82F6'; // Blue
      case 'confirming': return '#22C55E'; // Green
      case 'complete': return '#22C55E'; // Green
      case 'failed': return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  // Get phase icon
  const getPhaseIcon = () => {
    switch (state.phase) {
      case 'detecting': return '🔍';
      case 'stabilizing': return '⏳';
      case 'confirming': return '✓';
      case 'complete': return '✅';
      case 'failed': return '❌';
      default: return '⏸️';
    }
  };

  const phaseColor = getPhaseColor();

  return (
    <View style={styles.container}>
      {/* Semi-transparent background */}
      <View style={styles.backdrop} />

      {/* Main content */}
      <View style={styles.content}>
        {/* Phase indicator */}
        <Animated.View style={[styles.phaseIndicator, pulseStyle]}>
          <Text style={styles.phaseIcon}>{getPhaseIcon()}</Text>
        </Animated.View>

        {/* Phase title */}
        <Text style={styles.phaseTitle}>
          {state.phase === 'detecting' && 'Detecting Joints'}
          {state.phase === 'stabilizing' && 'Hold Still'}
          {state.phase === 'confirming' && 'Confirming...'}
          {state.phase === 'complete' && 'Calibration Complete!'}
          {state.phase === 'failed' && 'Calibration Failed'}
          {state.phase === 'waiting' && 'Preparing...'}
        </Text>

        {/* Instruction */}
        <Text style={styles.instruction}>{state.currentInstruction}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { backgroundColor: phaseColor },
                progressStyle
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{state.progress}%</Text>
        </View>

        {/* Joint detection status */}
        {state.phase === 'detecting' && (
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.jointsContainer}
          >
            <Text style={styles.jointsTitle}>
              Joints Detected: {state.detectedKeypoints.size}/{state.requiredKeypoints.length}
            </Text>
            <View style={styles.jointsList}>
              {state.requiredKeypoints.map((idx) => {
                const isDetected = state.detectedKeypoints.has(idx);
                const name = KEYPOINT_NAMES[idx] || `Joint ${idx}`;
                return (
                  <View 
                    key={idx} 
                    style={[
                      styles.jointBadge,
                      isDetected ? styles.jointDetected : styles.jointMissing
                    ]}
                  >
                    <Text style={[
                      styles.jointText,
                      isDetected ? styles.jointTextDetected : styles.jointTextMissing
                    ]}>
                      {isDetected ? '✓' : '○'} {name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Stability indicator */}
        {state.phase === 'stabilizing' && (
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.stabilityContainer}
          >
            <View style={styles.stabilityMeter}>
              <View 
                style={[
                  styles.stabilityFill,
                  { 
                    width: `${Math.min(100, (state.stableFrameCount / 15) * 100)}%`,
                    backgroundColor: state.isStable ? '#22C55E' : '#F59E0B',
                  }
                ]} 
              />
            </View>
            <Text style={styles.stabilityText}>
              {state.isStable ? 'Stable!' : 'Keep still...'}
            </Text>
          </Animated.View>
        )}

        {/* Confidence indicator */}
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>Confidence:</Text>
          <View style={styles.confidenceMeter}>
            <View 
              style={[
                styles.confidenceFill,
                { 
                  width: `${Math.round(state.averageConfidence * 100)}%`,
                  backgroundColor: state.averageConfidence >= 0.5 ? '#22C55E' : '#F59E0B',
                }
              ]} 
            />
          </View>
          <Text style={styles.confidenceValue}>
            {Math.round(state.averageConfidence * 100)}%
          </Text>
        </View>

        {/* Failure message */}
        {state.phase === 'failed' && state.failureMessage && (
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.failureContainer}
          >
            <Text style={styles.failureText}>{state.failureMessage}</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// Compact calibration progress for corner display
export function CalibrationProgressCompact({
  progress,
  phase,
}: {
  progress: number;
  phase: CalibrationPhase;
}) {
  const getPhaseLabel = () => {
    switch (phase) {
      case 'detecting': return 'Detecting';
      case 'stabilizing': return 'Stabilizing';
      case 'confirming': return 'Confirming';
      case 'complete': return 'Ready';
      default: return 'Calibrating';
    }
  };

  const getColor = () => {
    switch (phase) {
      case 'detecting': return '#F59E0B';
      case 'stabilizing': return '#3B82F6';
      case 'confirming': return '#22C55E';
      case 'complete': return '#22C55E';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.compactContainer}>
      <Text style={[styles.compactLabel, { color: getColor() }]}>
        {getPhaseLabel()}
      </Text>
      <View style={styles.compactProgress}>
        <View 
          style={[
            styles.compactProgressFill,
            { width: `${progress}%`, backgroundColor: getColor() }
          ]} 
        />
      </View>
      <Text style={styles.compactPercent}>{progress}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  phaseIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseIcon: {
    fontSize: 28,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instruction: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    width: 45,
    textAlign: 'right',
  },
  jointsContainer: {
    width: '100%',
    marginTop: 8,
  },
  jointsTitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  jointsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  jointBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  jointDetected: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  jointMissing: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  jointText: {
    fontSize: 11,
  },
  jointTextDetected: {
    color: '#22C55E',
  },
  jointTextMissing: {
    color: '#6B7280',
  },
  stabilityContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  stabilityMeter: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stabilityFill: {
    height: '100%',
    borderRadius: 3,
  },
  stabilityText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  confidenceContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  confidenceMeter: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: 12,
    color: '#FFFFFF',
    width: 35,
    textAlign: 'right',
  },
  failureContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  failureText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  compactContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactProgress: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  compactPercent: {
    fontSize: 11,
    color: '#FFFFFF',
    width: 30,
    textAlign: 'right',
  },
});

export default CalibrationOverlay;
