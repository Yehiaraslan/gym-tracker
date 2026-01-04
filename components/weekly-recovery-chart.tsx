import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import type { WeeklyRecoveryData } from '@/lib/whoop-recovery-service';

interface WeeklyRecoveryChartProps {
  data: WeeklyRecoveryData[];
  height?: number;
}

export function WeeklyRecoveryChart({ data, height = 200 }: WeeklyRecoveryChartProps) {
  const colors = useColors();
  const width = Dimensions.get('window').width - 32; // Account for padding

  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    const maxScore = 100;
    const minScore = 0;
    const range = maxScore - minScore;

    return data.map((item) => ({
      ...item,
      normalizedScore: (item.recoveryScore - minScore) / range,
      color: getRecoveryColor(item.recoveryScore, colors),
    }));
  }, [data, colors]);

  const barWidth = width / Math.max(data.length, 1);
  const barSpacing = barWidth * 0.2;
  const actualBarWidth = barWidth - barSpacing;

  if (data.length === 0) {
    return (
      <View className="items-center justify-center" style={{ height }}>
        <Text className="text-muted">No recovery data available</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Chart */}
      <View style={{ height, position: 'relative' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((percentage) => (
          <View
            key={`grid-${percentage}`}
            style={{
              position: 'absolute',
              top: `${100 - percentage}%`,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: colors.border,
              opacity: 0.3,
            }}
          />
        ))}

        {/* Bars */}
        <View style={{ flexDirection: 'row', height: '100%', alignItems: 'flex-end' }}>
          {chartData.map((item, index) => (
            <View
              key={`bar-${index}`}
              style={{
                width: actualBarWidth,
                marginHorizontal: barSpacing / 2,
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              {/* Bar */}
              <View
                style={{
                  width: '100%',
                  height: `${item.normalizedScore * 100}%`,
                  backgroundColor: item.color,
                  borderRadius: 4,
                  minHeight: 4,
                }}
              />

              {/* Score label */}
              <Text
                style={{
                  fontSize: 10,
                  color: colors.muted,
                  marginTop: 4,
                  fontWeight: '600',
                }}
              >
                {item.recoveryScore}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Day labels */}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {chartData.map((item, index) => (
          <View
            key={`label-${index}`}
            style={{
              width: actualBarWidth,
              marginHorizontal: barSpacing / 2,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: colors.muted }}>
              {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: colors.success,
              marginRight: 6,
            }}
          />
          <Text style={{ fontSize: 12, color: colors.muted }}>Good (67+)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: colors.warning,
              marginRight: 6,
            }}
          />
          <Text style={{ fontSize: 12, color: colors.muted }}>Fair (34-66)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: colors.error,
              marginRight: 6,
            }}
          />
          <Text style={{ fontSize: 12, color: colors.muted }}>Low (&lt;34)</Text>
        </View>
      </View>
    </View>
  );
}

function getRecoveryColor(score: number, colors: any): string {
  if (score >= 67) return colors.success;
  if (score >= 34) return colors.warning;
  return colors.error;
}
