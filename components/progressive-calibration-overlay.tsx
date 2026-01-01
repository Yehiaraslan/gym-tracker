/**
 * Progressive Calibration Overlay
 * 
 * Shows joints being detected one by one during calibration.
 * Starts with no visible joints, then progressively shows them as detected.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Pose, KEYPOINTS } from '@/lib/pose-detection';
import { JOINT_DETECTION_ORDER, JointDetectionStatus } from '@/lib/progressive-calibration';
import { useColors } from '@/hooks/use-colors';

// Re-export for convenience
export { JOINT_DETECTION_ORDER, JointDetectionStatus };

interface ProgressiveCalibrationOverlayProps {
  pose: Pose | null;
  width: number;
  height: number;
  detectedJoints: JointDetectionStatus[];
  currentSearchingGroup: number;
  allDetected: boolean;
  onConfirm?: () => void;
}

// Single joint dot component
function JointDot({ 
  x, 
  y, 
  detected, 
  stable,
  isSearching,
  delay = 0,
}: { 
  x: number; 
  y: number; 
  detected: boolean;
  stable: boolean;
  isSearching: boolean;
  delay?: number;
}) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (detected) {
      // Animate in when detected
      scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 200 }));
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
      
      // Pulse animation when stable
      if (stable) {
        pulseScale.value = withSequence(
          withTiming(1.3, { duration: 200 }),
          withTiming(1, { duration: 200 })
        );
      }
    } else if (isSearching) {
      // Faint searching indicator
      scale.value = withTiming(0.5, { duration: 300 });
      opacity.value = withTiming(0.3, { duration: 300 });
    } else {
      scale.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [detected, stable, isSearching]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x - 12 },
      { translateY: y - 12 },
      { scale: scale.value * pulseScale.value },
    ],
    opacity: opacity.value,
  }));

  const dotColor = stable ? '#22C55E' : detected ? '#F59E0B' : '#6B7280';
  const glowColor = stable ? 'rgba(34, 197, 94, 0.4)' : 
                   detected ? 'rgba(245, 158, 11, 0.3)' : 
                   'rgba(107, 114, 128, 0.2)';

  return (
    <Animated.View style={[styles.jointDotContainer, animatedStyle]}>
      {/* Glow effect */}
      <View style={[styles.jointGlow, { backgroundColor: glowColor }]} />
      {/* Main dot */}
      <View style={[styles.jointDot, { backgroundColor: dotColor }]} />
    </Animated.View>
  );
}

// Connection line between joints
function ConnectionLine({
  x1, y1, x2, y2,
  visible,
  stable,
}: {
  x1: number; y1: number;
  x2: number; y2: number;
  visible: boolean;
  stable: boolean;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? (stable ? 0.8 : 0.4) : 0, { duration: 300 });
  }, [visible, stable]);

  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const lineColor = stable ? '#22C55E' : '#F59E0B';

  return (
    <Animated.View
      style={[
        styles.connectionLine,
        animatedStyle,
        {
          width: length,
          left: x1,
          top: y1,
          transform: [{ rotate: `${angle}deg` }],
          backgroundColor: lineColor,
        },
      ]}
    />
  );
}

export function ProgressiveCalibrationOverlay({
  pose,
  width,
  height,
  detectedJoints,
  currentSearchingGroup,
  allDetected,
  onConfirm,
}: ProgressiveCalibrationOverlayProps) {
  const colors = useColors();

  // Get keypoint position
  const getKeypointPosition = (index: number) => {
    if (!pose || !pose.keypoints[index]) {
      return { x: 0, y: 0, valid: false };
    }
    const kp = pose.keypoints[index];
    return {
      x: kp.x * width,
      y: kp.y * height,
      valid: kp.score > 0.3,
    };
  };

  // Check if a joint group is detected
  const isGroupDetected = (groupIndex: number) => {
    const status = detectedJoints.find(j => j.groupIndex === groupIndex);
    return status?.detected || false;
  };

  const isGroupStable = (groupIndex: number) => {
    const status = detectedJoints.find(j => j.groupIndex === groupIndex);
    return status?.stable || false;
  };

  // Render joint dots for a group
  const renderJointGroup = (groupIndex: number) => {
    const group = JOINT_DETECTION_ORDER[groupIndex];
    const detected = isGroupDetected(groupIndex);
    const stable = isGroupStable(groupIndex);
    const isSearching = currentSearchingGroup === groupIndex;

    return group.keypoints.map((kpIndex, i) => {
      const pos = getKeypointPosition(kpIndex);
      if (!pos.valid && !isSearching) return null;

      return (
        <JointDot
          key={`${groupIndex}-${i}`}
          x={pos.valid ? pos.x : width / 2 + (i === 0 ? -50 : 50)}
          y={pos.valid ? pos.y : height / 2}
          detected={detected && pos.valid}
          stable={stable && pos.valid}
          isSearching={isSearching && !detected}
          delay={i * 100}
        />
      );
    });
  };

  // Render connections between joints
  const renderConnections = () => {
    const connections: React.ReactElement[] = [];

    // Shoulder to shoulder
    if (isGroupDetected(0)) {
      const ls = getKeypointPosition(KEYPOINTS.LEFT_SHOULDER);
      const rs = getKeypointPosition(KEYPOINTS.RIGHT_SHOULDER);
      if (ls.valid && rs.valid) {
        connections.push(
          <ConnectionLine
            key="shoulders"
            x1={ls.x} y1={ls.y}
            x2={rs.x} y2={rs.y}
            visible={true}
            stable={isGroupStable(0)}
          />
        );
      }
    }

    // Shoulder to elbow connections
    if (isGroupDetected(0) && isGroupDetected(1)) {
      const ls = getKeypointPosition(KEYPOINTS.LEFT_SHOULDER);
      const le = getKeypointPosition(KEYPOINTS.LEFT_ELBOW);
      const rs = getKeypointPosition(KEYPOINTS.RIGHT_SHOULDER);
      const re = getKeypointPosition(KEYPOINTS.RIGHT_ELBOW);

      if (ls.valid && le.valid) {
        connections.push(
          <ConnectionLine key="l-arm-upper" x1={ls.x} y1={ls.y} x2={le.x} y2={le.y} 
            visible={true} stable={isGroupStable(1)} />
        );
      }
      if (rs.valid && re.valid) {
        connections.push(
          <ConnectionLine key="r-arm-upper" x1={rs.x} y1={rs.y} x2={re.x} y2={re.y}
            visible={true} stable={isGroupStable(1)} />
        );
      }
    }

    // Elbow to wrist connections
    if (isGroupDetected(1) && isGroupDetected(2)) {
      const le = getKeypointPosition(KEYPOINTS.LEFT_ELBOW);
      const lw = getKeypointPosition(KEYPOINTS.LEFT_WRIST);
      const re = getKeypointPosition(KEYPOINTS.RIGHT_ELBOW);
      const rw = getKeypointPosition(KEYPOINTS.RIGHT_WRIST);

      if (le.valid && lw.valid) {
        connections.push(
          <ConnectionLine key="l-arm-lower" x1={le.x} y1={le.y} x2={lw.x} y2={lw.y}
            visible={true} stable={isGroupStable(2)} />
        );
      }
      if (re.valid && rw.valid) {
        connections.push(
          <ConnectionLine key="r-arm-lower" x1={re.x} y1={re.y} x2={rw.x} y2={rw.y}
            visible={true} stable={isGroupStable(2)} />
        );
      }
    }

    // Hip to hip
    if (isGroupDetected(3)) {
      const lh = getKeypointPosition(KEYPOINTS.LEFT_HIP);
      const rh = getKeypointPosition(KEYPOINTS.RIGHT_HIP);
      if (lh.valid && rh.valid) {
        connections.push(
          <ConnectionLine key="hips" x1={lh.x} y1={lh.y} x2={rh.x} y2={rh.y}
            visible={true} stable={isGroupStable(3)} />
        );
      }
    }

    // Shoulder to hip (torso)
    if (isGroupDetected(0) && isGroupDetected(3)) {
      const ls = getKeypointPosition(KEYPOINTS.LEFT_SHOULDER);
      const lh = getKeypointPosition(KEYPOINTS.LEFT_HIP);
      const rs = getKeypointPosition(KEYPOINTS.RIGHT_SHOULDER);
      const rh = getKeypointPosition(KEYPOINTS.RIGHT_HIP);

      if (ls.valid && lh.valid) {
        connections.push(
          <ConnectionLine key="l-torso" x1={ls.x} y1={ls.y} x2={lh.x} y2={lh.y}
            visible={true} stable={isGroupStable(3)} />
        );
      }
      if (rs.valid && rh.valid) {
        connections.push(
          <ConnectionLine key="r-torso" x1={rs.x} y1={rs.y} x2={rh.x} y2={rh.y}
            visible={true} stable={isGroupStable(3)} />
        );
      }
    }

    // Hip to knee
    if (isGroupDetected(3) && isGroupDetected(4)) {
      const lh = getKeypointPosition(KEYPOINTS.LEFT_HIP);
      const lk = getKeypointPosition(KEYPOINTS.LEFT_KNEE);
      const rh = getKeypointPosition(KEYPOINTS.RIGHT_HIP);
      const rk = getKeypointPosition(KEYPOINTS.RIGHT_KNEE);

      if (lh.valid && lk.valid) {
        connections.push(
          <ConnectionLine key="l-thigh" x1={lh.x} y1={lh.y} x2={lk.x} y2={lk.y}
            visible={true} stable={isGroupStable(4)} />
        );
      }
      if (rh.valid && rk.valid) {
        connections.push(
          <ConnectionLine key="r-thigh" x1={rh.x} y1={rh.y} x2={rk.x} y2={rk.y}
            visible={true} stable={isGroupStable(4)} />
        );
      }
    }

    // Knee to ankle
    if (isGroupDetected(4) && isGroupDetected(5)) {
      const lk = getKeypointPosition(KEYPOINTS.LEFT_KNEE);
      const la = getKeypointPosition(KEYPOINTS.LEFT_ANKLE);
      const rk = getKeypointPosition(KEYPOINTS.RIGHT_KNEE);
      const ra = getKeypointPosition(KEYPOINTS.RIGHT_ANKLE);

      if (lk.valid && la.valid) {
        connections.push(
          <ConnectionLine key="l-shin" x1={lk.x} y1={lk.y} x2={la.x} y2={la.y}
            visible={true} stable={isGroupStable(5)} />
        );
      }
      if (rk.valid && ra.valid) {
        connections.push(
          <ConnectionLine key="r-shin" x1={rk.x} y1={rk.y} x2={ra.x} y2={ra.y}
            visible={true} stable={isGroupStable(5)} />
        );
      }
    }

    return connections;
  };

  // Current searching message
  const getSearchingMessage = () => {
    if (allDetected) return 'All joints detected!';
    if (currentSearchingGroup < JOINT_DETECTION_ORDER.length) {
      return `Looking for ${JOINT_DETECTION_ORDER[currentSearchingGroup].name.toLowerCase()}...`;
    }
    return 'Detecting joints...';
  };

  return (
    <View style={[styles.container, { width, height }]} pointerEvents="box-none">
      {/* Connections */}
      {renderConnections()}

      {/* Joint dots for each group */}
      {JOINT_DETECTION_ORDER.map((_, groupIndex) => renderJointGroup(groupIndex))}

      {/* Status panel */}
      <View style={styles.statusPanel}>
        <Text style={styles.statusText}>{getSearchingMessage()}</Text>
        
        {/* Joint group indicators */}
        <View style={styles.jointIndicators}>
          {JOINT_DETECTION_ORDER.map((group, idx) => {
            const detected = isGroupDetected(idx);
            const stable = isGroupStable(idx);
            const isSearching = currentSearchingGroup === idx;
            
            return (
              <View key={idx} style={styles.jointIndicator}>
                <View 
                  style={[
                    styles.indicatorDot,
                    stable ? styles.indicatorStable :
                    detected ? styles.indicatorDetected :
                    isSearching ? styles.indicatorSearching :
                    styles.indicatorPending
                  ]} 
                />
                <Text style={[
                  styles.indicatorLabel,
                  (detected || isSearching) && styles.indicatorLabelActive
                ]}>
                  {group.name}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Confirm button when all detected */}
        {allDetected && onConfirm && (
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              onConfirm();
            }}
          >
            <Text style={styles.confirmButtonText}>Confirm & Start</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  jointDotContainer: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jointGlow: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  jointDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  connectionLine: {
    position: 'absolute',
    height: 3,
    borderRadius: 1.5,
    transformOrigin: 'left center',
  },
  statusPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  jointIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  jointIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorPending: {
    backgroundColor: '#4B5563',
  },
  indicatorSearching: {
    backgroundColor: '#3B82F6',
  },
  indicatorDetected: {
    backgroundColor: '#F59E0B',
  },
  indicatorStable: {
    backgroundColor: '#22C55E',
  },
  indicatorLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  indicatorLabelActive: {
    color: '#fff',
  },
  confirmButton: {
    marginTop: 16,
    backgroundColor: '#22C55E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProgressiveCalibrationOverlay;
