/**
 * Workout Summary Component
 * 
 * Displays the summary after completing a set.
 * Shows reps, form score, top issues, and fix tip.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  SlideInUp,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { RepCounterSummary } from '@/lib/gated-rep-counter';

interface WorkoutSummaryProps {
  summary: RepCounterSummary;
  exerciseName: string;
  onClose: () => void;
  onSave?: () => void;
}

export function WorkoutSummary({
  summary,
  exerciseName,
  onClose,
  onSave,
}: WorkoutSummaryProps) {
  // Get grade color
  const getGradeColor = () => {
    switch (summary.formGrade) {
      case 'Excellent': return '#22C55E';
      case 'Good': return '#3B82F6';
      case 'Needs Work': return '#F59E0B';
      case 'Poor': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const gradeColor = getGradeColor();

  return (
    <View style={styles.container}>
      <View style={styles.backdrop} />
      
      <Animated.View 
        entering={SlideInUp.springify().damping(15)}
        style={styles.card}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Set Complete!</Text>
            <Text style={styles.exerciseName}>{exerciseName}</Text>
          </View>

          {/* Main Stats */}
          <View style={styles.mainStats}>
            {/* Rep Count */}
            <Animated.View 
              entering={FadeIn.delay(100)}
              style={styles.statBox}
            >
              <Text style={styles.statValue}>{summary.totalReps}</Text>
              <Text style={styles.statLabel}>Reps</Text>
            </Animated.View>

            {/* Form Score */}
            <Animated.View 
              entering={FadeIn.delay(200)}
              style={[styles.statBox, styles.scoreBox]}
            >
              <View style={[styles.scoreCircle, { borderColor: gradeColor }]}>
                <Text style={[styles.scoreValue, { color: gradeColor }]}>
                  {summary.averageFormScore}
                </Text>
              </View>
              <Text style={styles.statLabel}>Form Score</Text>
              <Text style={[styles.gradeLabel, { color: gradeColor }]}>
                {summary.formGrade}
              </Text>
            </Animated.View>

            {/* Tracking Quality */}
            <Animated.View 
              entering={FadeIn.delay(300)}
              style={styles.statBox}
            >
              <Text style={styles.statValue}>{summary.trackingQuality}%</Text>
              <Text style={styles.statLabel}>Tracking</Text>
            </Animated.View>
          </View>

          {/* Top Issues */}
          {summary.topIssues.length > 0 && (
            <Animated.View 
              entering={FadeIn.delay(400)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Areas to Improve</Text>
              {summary.topIssues.map((issue, index) => (
                <View key={issue.type} style={styles.issueRow}>
                  <View style={styles.issueIndicator}>
                    <Text style={styles.issueNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.issueContent}>
                    <Text style={styles.issueMessage}>{issue.message}</Text>
                    <Text style={styles.issueCount}>
                      Occurred {issue.count} time{issue.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Fix Tip */}
          {summary.fixTip && (
            <Animated.View 
              entering={FadeIn.delay(500)}
              style={styles.tipContainer}
            >
              <Text style={styles.tipIcon}>💡</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Quick Tip</Text>
                <Text style={styles.tipText}>{summary.fixTip}</Text>
              </View>
            </Animated.View>
          )}

          {/* Tracking Stats */}
          {summary.pauseCount > 0 && (
            <Animated.View 
              entering={FadeIn.delay(600)}
              style={styles.trackingStats}
            >
              <Text style={styles.trackingNote}>
                ⚠️ Tracking paused {summary.pauseCount} time{summary.pauseCount !== 1 ? 's' : ''} during this set
              </Text>
            </Animated.View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {onSave && (
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={onSave}
              >
                <Text style={styles.saveButtonText}>Save to History</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// Compact summary for inline display
export function WorkoutSummaryCompact({
  reps,
  formScore,
  formGrade,
}: {
  reps: number;
  formScore: number;
  formGrade: string;
}) {
  const getGradeColor = () => {
    switch (formGrade) {
      case 'Excellent': return '#22C55E';
      case 'Good': return '#3B82F6';
      case 'Needs Work': return '#F59E0B';
      case 'Poor': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.compactContainer}>
      <View style={styles.compactStat}>
        <Text style={styles.compactValue}>{reps}</Text>
        <Text style={styles.compactLabel}>reps</Text>
      </View>
      <View style={styles.compactDivider} />
      <View style={styles.compactStat}>
        <Text style={[styles.compactValue, { color: getGradeColor() }]}>
          {formScore}
        </Text>
        <Text style={styles.compactLabel}>form</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 24,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  exerciseName: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  mainStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  statBox: {
    alignItems: 'center',
    gap: 4,
  },
  scoreBox: {
    gap: 8,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  issueIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  issueContent: {
    flex: 1,
    gap: 2,
  },
  issueMessage: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  issueCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  tipIcon: {
    fontSize: 24,
  },
  tipContent: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  tipText: {
    fontSize: 13,
    color: '#93C5FD',
    lineHeight: 18,
  },
  trackingStats: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  trackingNote: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  compactContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  compactStat: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  compactValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  compactDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default WorkoutSummary;
