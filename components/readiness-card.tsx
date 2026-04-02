import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { ReadinessResult } from '@/lib/readiness-score';

interface ReadinessCardProps {
  readinessResult: ReadinessResult;
}

export function ReadinessCard({ readinessResult }: ReadinessCardProps) {
  const colors = useColors();
  const [isExpanded, setIsExpanded] = useState(false);

  const styles = StyleSheet.create({
    container: {
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      overflow: 'hidden',
    },
    cardContent: {
      padding: 16,
    },
    collapsedContent: {
      alignItems: 'center',
    },
    circleContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 8,
      borderColor: readinessResult.color,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    scoreText: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.foreground,
    },
    labelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emoji: {
      fontSize: 24,
      marginRight: 8,
    },
    labelText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    recommendationText: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 18,
    },
    expandedContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
      marginTop: 12,
    },
    breakdownSection: {
      marginBottom: 16,
    },
    breakdownLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    breakdownBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.muted,
      overflow: 'hidden',
      marginBottom: 4,
    },
    breakdownFill: {
      height: '100%',
      borderRadius: 4,
    },
    breakdownDetail: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 8,
    },
    expandButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    expandButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: readinessResult.color,
    },
  });

  const getScoreColor = (score: number): string => {
    if (score >= 85) return '#22C55E';
    if (score >= 70) return '#3B82F6';
    if (score >= 50) return '#F59E0B';
    if (score >= 30) return '#F97316';
    return '#EF4444';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.collapsedContent}>
          {/* Circular progress ring */}
          <View style={styles.circleContainer}>
            <Text style={styles.scoreText}>{readinessResult.score}</Text>
          </View>

          {/* Label and emoji */}
          <View style={styles.labelContainer}>
            <Text style={styles.emoji}>{readinessResult.emoji}</Text>
            <Text style={styles.labelText}>{readinessResult.label}</Text>
          </View>

          {/* Recommendation */}
          <Text style={styles.recommendationText}>
            {readinessResult.recommendation}
          </Text>

          {/* Breakdown bars preview */}
          <View style={{ marginTop: 16, width: '100%' }}>
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Sleep</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${readinessResult.breakdown.sleep.score}%`,
                      backgroundColor: getScoreColor(
                        readinessResult.breakdown.sleep.score
                      ),
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Recovery</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${readinessResult.breakdown.recovery.score}%`,
                      backgroundColor: getScoreColor(
                        readinessResult.breakdown.recovery.score
                      ),
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Nutrition</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${readinessResult.breakdown.nutrition.score}%`,
                      backgroundColor: getScoreColor(
                        readinessResult.breakdown.nutrition.score
                      ),
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Training Load</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${readinessResult.breakdown.trainingLoad.score}%`,
                      backgroundColor: getScoreColor(
                        readinessResult.breakdown.trainingLoad.score
                      ),
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Expand button */}
          <View style={styles.expandButton}>
            <Text style={styles.expandButtonText}>
              {isExpanded ? 'Hide Details' : 'Show Details'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded details */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          <ScrollView scrollEnabled={false}>
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Sleep (25% weight)</Text>
              <Text style={styles.breakdownDetail}>
                Score: {readinessResult.breakdown.sleep.score}/100
              </Text>
              <Text style={styles.breakdownDetail}>
                {readinessResult.breakdown.sleep.detail}
              </Text>
            </View>

            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Recovery (30% weight)</Text>
              <Text style={styles.breakdownDetail}>
                Score: {readinessResult.breakdown.recovery.score}/100
              </Text>
              <Text style={styles.breakdownDetail}>
                {readinessResult.breakdown.recovery.detail}
              </Text>
            </View>

            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>Nutrition (20% weight)</Text>
              <Text style={styles.breakdownDetail}>
                Score: {readinessResult.breakdown.nutrition.score}/100
              </Text>
              <Text style={styles.breakdownDetail}>
                {readinessResult.breakdown.nutrition.detail}
              </Text>
            </View>

            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownLabel}>
                Training Load (25% weight)
              </Text>
              <Text style={styles.breakdownDetail}>
                Score: {readinessResult.breakdown.trainingLoad.score}/100
              </Text>
              <Text style={styles.breakdownDetail}>
                {readinessResult.breakdown.trainingLoad.detail}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
