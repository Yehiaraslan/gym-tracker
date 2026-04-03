import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { VolumeBalanceResult } from '@/lib/volume-balance';
import { useColors } from '@/hooks/use-colors';

interface VolumeBalanceCardProps {
  result: VolumeBalanceResult;
  compact?: boolean;
}

export function VolumeBalanceCard({ result, compact = false }: VolumeBalanceCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(!compact);

  const maxSets = Math.max(result.push.sets, result.pull.sets, result.legs.sets, 1);

  const pushWidth = (result.push.sets / maxSets) * 100;
  const pullWidth = (result.pull.sets / maxSets) * 100;
  const legsWidth = (result.legs.sets / maxSets) * 100;

  const hasWarnings = result.alerts.some((a) => a.severity === 'warning' || a.severity === 'critical');
  const hasCritical = result.alerts.some((a) => a.severity === 'critical');

  const borderColor = hasCritical ? '#EF4444' : hasWarnings ? '#FBBF24' : colors.cardBorder;
  const borderWidth = hasCritical || hasWarnings ? 2 : 1;

  return (
    <Pressable
      onPress={() => compact && setExpanded(!expanded)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor,
          borderWidth,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.cardForeground }]}>Volume Balance</Text>
        {result.alerts.length > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{result.alerts.length}</Text>
          </View>
        )}
      </View>

      {(expanded || !compact) && (
        <>
          {/* Push Bar */}
          <View style={styles.volumeRow}>
            <Text style={[styles.label, { color: colors.cardForeground }]}>Push</Text>
            <View style={[styles.barContainer, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(pushWidth, 5)}%`,
                    backgroundColor: '#3B82F6',
                  },
                ]}
              />
            </View>
            <Text style={[styles.setCount, { color: colors.cardMuted }]}>{result.push.sets}</Text>
          </View>

          {/* Pull Bar */}
          <View style={styles.volumeRow}>
            <Text style={[styles.label, { color: colors.cardForeground }]}>Pull</Text>
            <View style={[styles.barContainer, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(pullWidth, 5)}%`,
                    backgroundColor: '#8B5CF6',
                  },
                ]}
              />
            </View>
            <Text style={[styles.setCount, { color: colors.cardMuted }]}>{result.pull.sets}</Text>
          </View>

          {/* Legs Bar */}
          <View style={styles.volumeRow}>
            <Text style={[styles.label, { color: colors.cardForeground }]}>Legs</Text>
            <View style={[styles.barContainer, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.max(legsWidth, 5)}%`,
                    backgroundColor: '#22C55E',
                  },
                ]}
              />
            </View>
            <Text style={[styles.setCount, { color: colors.cardMuted }]}>{result.legs.sets}</Text>
          </View>

          {/* Ratios */}
          <View style={styles.ratioRow}>
            <View style={styles.ratioItem}>
              <Text style={[styles.ratioLabel, { color: colors.cardMuted }]}>Push:Pull</Text>
              <Text style={[styles.ratioValue, { color: colors.cardForeground }]}>
                {result.pushPullRatio.toFixed(2)}:1
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.ratioItem}>
              <Text style={[styles.ratioLabel, { color: colors.cardMuted }]}>Upper:Lower</Text>
              <Text style={[styles.ratioValue, { color: colors.cardForeground }]}>
                {result.upperLowerRatio.toFixed(2)}:1
              </Text>
            </View>
          </View>

          {/* Alerts Section */}
          {result.alerts.length > 0 && (
            <View style={[styles.alertsSection, { borderTopColor: colors.cardBorder }]}>
              <Text style={[styles.alertsTitle, { color: colors.cardForeground }]}>Alerts</Text>
              {result.alerts.slice(0, 2).map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <Text style={styles.alertEmoji}>{alert.emoji}</Text>
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertTitle, { color: colors.cardForeground }]}>{alert.title}</Text>
                    <Text
                      style={[
                        styles.alertMessage,
                        {
                          color: colors.cardMuted,
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {alert.message}
                    </Text>
                  </View>
                </View>
              ))}
              {result.alerts.length > 2 && (
                <Text style={[styles.moreAlerts, { color: colors.cardMuted }]}>
                  +{result.alerts.length - 2} more alert{result.alerts.length - 2 !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          )}

          {/* Trend Badge */}
          <View style={styles.trendRow}>
            <Text style={[styles.trendLabel, { color: colors.cardMuted }]}>Status:</Text>
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    result.weeklyTrend === 'well-balanced'
                      ? '#D1FAE5'
                      : result.weeklyTrend === 'balanced'
                        ? '#FEF3C7'
                        : '#FEE2E2',
                },
              ]}
            >
              <Text
                style={[
                  styles.trendText,
                  {
                    color:
                      result.weeklyTrend === 'well-balanced'
                        ? '#065F46'
                        : result.weeklyTrend === 'balanced'
                          ? '#92400E'
                          : '#7F1D1D',
                  },
                ]}
              >
                {result.weeklyTrend.replace(/-/g, ' ')}
              </Text>
            </View>
          </View>
        </>
      )}

      {compact && !expanded && (
        <Text style={[styles.compactHint, { color: colors.cardMuted }]}>Tap to expand</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    width: 45,
  },
  barContainer: {
    flex: 1,
    height: 24,
    borderRadius: 6,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  setCount: {
    fontSize: 13,
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingVertical: 10,
  },
  ratioItem: {
    alignItems: 'center',
    flex: 1,
  },
  ratioLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  ratioValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  alertsSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  alertsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  alertItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  alertEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 11,
    lineHeight: 16,
  },
  moreAlerts: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    justifyContent: 'space-between',
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  compactHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
