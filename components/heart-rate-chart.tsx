import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/use-colors';
import { WhoopHeartRateData } from '@/lib/whoop-service';

interface HeartRateChartProps {
  data: WhoopHeartRateData;
}

export function HeartRateChart({ data }: HeartRateChartProps) {
  const colors = useColors();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 64; // Account for padding
  const chartHeight = 180;
  const padding = 40;

  // Calculate chart dimensions
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  // Get min and max HR for scaling
  const minHR = Math.min(...data.estimatedCurve.map(d => d.hr)) - 10;
  const maxHR = Math.max(...data.estimatedCurve.map(d => d.hr)) + 10;
  const hrRange = maxHR - minHR;

  // Scale functions
  const scaleX = (index: number) => (index / (data.estimatedCurve.length - 1)) * innerWidth + padding;
  const scaleY = (hr: number) => chartHeight - ((hr - minHR) / hrRange) * innerHeight - padding;

  // Build SVG path for the line
  const points = data.estimatedCurve
    .map((d, i) => `${scaleX(i)},${scaleY(d.hr)}`)
    .join(' ');

  // Sample points for labels (every ~10 points)
  const labelInterval = Math.max(1, Math.floor(data.estimatedCurve.length / 6));

  return (
    <View className="bg-surface rounded-2xl p-4 mt-4" style={{ borderWidth: 1, borderColor: colors.cardBorder }}>
      {/* Header */}
      <View className="mb-4">
        <Text className="text-lg font-semibold text-cardForeground">Heart Rate</Text>
        <View className="flex-row gap-6 mt-2">
          <View>
            <Text className="text-xs text-cardMuted">Average</Text>
            <Text className="text-xl font-bold text-cardForeground">{data.averageHeartRate} bpm</Text>
          </View>
          <View>
            <Text className="text-xs text-cardMuted">Max</Text>
            <Text className="text-xl font-bold text-cardForeground">{data.maxHeartRate} bpm</Text>
          </View>
          <View>
            <Text className="text-xs text-cardMuted">Duration</Text>
            <Text className="text-xl font-bold text-cardForeground">{data.durationMinutes} min</Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      <View className="mb-4 items-center">
        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = chartHeight - ratio * innerHeight - padding;
            const hr = Math.round(minHR + ratio * hrRange);
            return (
              <React.Fragment key={`grid-${i}`}>
                <Line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke={colors.cardBorder}
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                <SvgText
                  x={padding - 5}
                  y={y + 4}
                  fontSize="10"
                  fill={colors.cardMuted}
                  textAnchor="end"
                >
                  {hr}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* HR line */}
          <Polyline
            points={points}
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.estimatedCurve.map((d, i) => {
            if (i % labelInterval === 0) {
              return (
                <Circle
                  key={`point-${i}`}
                  cx={scaleX(i)}
                  cy={scaleY(d.hr)}
                  r="3"
                  fill="#EF4444"
                />
              );
            }
            return null;
          })}

          {/* X-axis labels */}
          {data.estimatedCurve.map((d, i) => {
            if (i % labelInterval === 0) {
              return (
                <SvgText
                  key={`label-${i}`}
                  x={scaleX(i)}
                  y={chartHeight - padding + 15}
                  fontSize="10"
                  fill={colors.cardMuted}
                  textAnchor="middle"
                >
                  {d.time}m
                </SvgText>
              );
            }
            return null;
          })}
        </Svg>
      </View>

      {/* Zone Distribution */}
      <View className="mt-4">
        <Text className="text-sm font-semibold text-cardForeground mb-3">Heart Rate Zones</Text>
        {data.zones.map((zone, idx) => (
          <View key={idx} className="mb-2">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: zone.color }}
                />
                <Text className="text-sm text-cardForeground flex-1">{zone.label}</Text>
              </View>
              <Text className="text-sm font-semibold text-cardForeground">
                {zone.minutes}m ({zone.percentage}%)
              </Text>
            </View>
            <View
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: colors.cardBorder }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${zone.percentage}%`,
                  backgroundColor: zone.color,
                }}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Stats */}
      <View className="mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-cardMuted">Total Strain</Text>
            <Text className="text-lg font-semibold text-cardForeground">{data.strain.toFixed(1)}</Text>
          </View>
          <View>
            <Text className="text-xs text-cardMuted">Energy Burned</Text>
            <Text className="text-lg font-semibold text-cardForeground">{data.kilojoules} kJ</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
