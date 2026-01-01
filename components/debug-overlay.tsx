/**
 * Debug Overlay Component
 * 
 * Shows internal metrics for testing and tuning the AI Form Coach
 * Toggle with a hidden gesture (triple tap on confidence indicator)
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { DebugMetrics, TrackingQuality } from '@/lib/tracking-reliability';
import { useColors } from '@/hooks/use-colors';

interface DebugOverlayProps {
  metrics: DebugMetrics | null;
  visible: boolean;
  onClose: () => void;
}

export function DebugOverlay({ metrics, visible, onClose }: DebugOverlayProps) {
  const colors = useColors();

  if (!visible || !metrics) return null;

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Debug Mode</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Performance */}
        <DebugSection title="Performance">
          <DebugRow label="Frame #" value={metrics.frameNumber.toString()} />
          <DebugRow label="Inference" value={`${metrics.inferenceTimeMs.toFixed(1)}ms`} />
          <DebugRow label="FPS" value={metrics.fps.toFixed(1)} highlight={metrics.fps < 8 ? 'error' : metrics.fps < 10 ? 'warning' : 'success'} />
        </DebugSection>

        {/* Tracking Confidence */}
        <DebugSection title="Tracking Confidence">
          <DebugRow label="Raw" value={`${(metrics.rawConfidence * 100).toFixed(1)}%`} />
          <DebugRow label="Smoothed" value={`${(metrics.smoothedConfidence * 100).toFixed(1)}%`} />
          <DebugRow 
            label="Quality" 
            value={metrics.trackingQuality.toUpperCase()} 
            highlight={metrics.trackingQuality === 'good' ? 'success' : metrics.trackingQuality === 'weak' ? 'warning' : 'error'}
          />
        </DebugSection>

        {/* Keypoints */}
        <DebugSection title="Keypoints">
          <DebugRow label="Visible" value={`${metrics.visibleKeypoints}/${metrics.totalKeypoints}`} />
          {metrics.missingKeypoints.length > 0 && (
            <DebugRow label="Missing" value={metrics.missingKeypoints.join(', ')} highlight="warning" />
          )}
        </DebugSection>

        {/* Joint Angles */}
        <DebugSection title="Joint Angles">
          {Object.entries(metrics.angles).map(([name, value]) => (
            <DebugRow key={name} label={name} value={`${value.toFixed(1)}°`} />
          ))}
          {Object.keys(metrics.angles).length === 0 && (
            <Text style={styles.emptyText}>No angles calculated</Text>
          )}
        </DebugSection>

        {/* State Machine */}
        <DebugSection title="Rep State Machine">
          <DebugRow label="State" value={metrics.repState} />
          <DebugRow label="Rep Count" value={metrics.repCount.toString()} />
          <DebugRow label="Last Rep" value={metrics.lastRepTime > 0 ? `${((Date.now() - metrics.lastRepTime) / 1000).toFixed(1)}s ago` : 'N/A'} />
        </DebugSection>

        {/* Thresholds */}
        <DebugSection title="Thresholds">
          {Object.entries(metrics.thresholds).map(([name, value]) => (
            <DebugRow key={name} label={name} value={typeof value === 'number' ? value.toFixed(1) : String(value)} />
          ))}
        </DebugSection>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

interface DebugSectionProps {
  title: string;
  children: React.ReactNode;
}

function DebugSection({ title, children }: DebugSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface DebugRowProps {
  label: string;
  value: string;
  highlight?: 'success' | 'warning' | 'error';
}

function DebugRow({ label, value, highlight }: DebugRowProps) {
  const getHighlightColor = () => {
    switch (highlight) {
      case 'success': return '#4ADE80';
      case 'warning': return '#FBBF24';
      case 'error': return '#F87171';
      default: return '#9CA3AF';
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: getHighlightColor() }]}>{value}</Text>
    </View>
  );
}

/**
 * Compact Debug Badge
 * 
 * Shows minimal debug info, tap to expand full overlay
 */
interface DebugBadgeProps {
  fps: number;
  confidence: number;
  quality: TrackingQuality;
  onPress: () => void;
}

export function DebugBadge({ fps, confidence, quality, onPress }: DebugBadgeProps) {
  const getQualityColor = () => {
    switch (quality) {
      case 'good': return '#4ADE80';
      case 'weak': return '#FBBF24';
      case 'lost': return '#F87171';
    }
  };

  return (
    <Pressable onPress={onPress} style={[styles.badge, { borderColor: getQualityColor() }]}>
      <Text style={styles.badgeText}>
        {fps.toFixed(0)} FPS | {(confidence * 100).toFixed(0)}% | {quality.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/**
 * Angle Visualizer
 * 
 * Shows joint angles with visual representation
 */
interface AngleVisualizerProps {
  angles: Record<string, number>;
  thresholds: Record<string, { min: number; max: number }>;
}

export function AngleVisualizer({ angles, thresholds }: AngleVisualizerProps) {
  return (
    <View style={styles.angleContainer}>
      {Object.entries(angles).map(([name, value]) => {
        const threshold = thresholds[name];
        const isInRange = threshold ? value >= threshold.min && value <= threshold.max : true;
        
        return (
          <View key={name} style={styles.angleRow}>
            <Text style={styles.angleName}>{name}</Text>
            <View style={styles.angleBar}>
              <View 
                style={[
                  styles.angleIndicator, 
                  { 
                    left: `${Math.min(100, Math.max(0, (value / 180) * 100))}%`,
                    backgroundColor: isInRange ? '#4ADE80' : '#F87171'
                  }
                ]} 
              />
              {threshold && (
                <>
                  <View style={[styles.thresholdLine, { left: `${(threshold.min / 180) * 100}%` }]} />
                  <View style={[styles.thresholdLine, { left: `${(threshold.max / 180) * 100}%` }]} />
                </>
              )}
            </View>
            <Text style={[styles.angleValue, { color: isInRange ? '#4ADE80' : '#F87171' }]}>
              {value.toFixed(0)}°
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Badge styles
  badge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  // Angle visualizer styles
  angleContainer: {
    padding: 8,
  },
  angleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  angleName: {
    color: '#9CA3AF',
    fontSize: 11,
    width: 80,
  },
  angleBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginHorizontal: 8,
    position: 'relative',
  },
  angleIndicator: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 8,
    backgroundColor: '#666',
  },
  angleValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    width: 40,
    textAlign: 'right',
  },
});
