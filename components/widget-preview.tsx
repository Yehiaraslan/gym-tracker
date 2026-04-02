import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getWidgetData, type WidgetData } from '@/lib/widget-data';

interface WidgetPreviewProps {
  size: 'small' | 'medium' | 'large';
  data?: WidgetData;
  loading?: boolean;
}

/**
 * Render a circular progress indicator for weekly workouts
 */
function WeeklyProgressCircle({
  completed,
  target,
  colors,
}: {
  completed: number;
  target: number;
  colors: ReturnType<typeof useColors>;
}) {
  const percentage = Math.min(100, (completed / target) * 100);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <View className="items-center gap-2">
      <View className="relative w-16 h-16">
        {/* Background circle */}
        <View
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 3,
            borderColor: colors.border,
          }}
        />
        {/* Progress circle (simplified with visual indicator) */}
        <View className="absolute inset-0 rounded-full items-center justify-center">
          <Text className="text-lg font-bold" style={{ color: colors.primary }}>
            {completed}/{target}
          </Text>
        </View>
      </View>
      <Text className="text-xs" style={{ color: colors.muted }}>
        This Week
      </Text>
    </View>
  );
}

/**
 * Small Widget (2x2)
 * Shows: streak, today's workout, readiness score
 */
function SmallWidget({ data, colors }: { data: WidgetData; colors: ReturnType<typeof useColors> }) {
  return (
    <View
      className="p-4 rounded-2xl gap-3"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        minHeight: 160,
      }}
    >
      {/* Streak */}
      <View className="gap-1">
        <Text className="text-2xl">{data.streakEmoji}</Text>
        <Text
          className="text-xl font-bold"
          style={{ color: colors.foreground }}
        >
          {data.currentStreak}
        </Text>
        <Text className="text-xs" style={{ color: colors.muted }}>
          Day Streak
        </Text>
      </View>

      {/* Today's Workout */}
      <View className="gap-1 border-t pt-3" style={{ borderColor: colors.border }}>
        <Text className="text-lg">{data.todayEmoji}</Text>
        <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
          {data.todaySession}
        </Text>
      </View>

      {/* Readiness */}
      {data.readinessScore !== null && (
        <View className="gap-1 border-t pt-3" style={{ borderColor: colors.border }}>
          <Text className="text-lg">{data.readinessEmoji}</Text>
          <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
            {data.readinessLabel}
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }}>
            Score: {data.readinessScore}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Medium Widget (4x2)
 * Shows: streak + readiness on left, today's workout + weekly progress on right
 */
function MediumWidget({ data, colors }: { data: WidgetData; colors: ReturnType<typeof useColors> }) {
  return (
    <View
      className="p-4 rounded-2xl"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        minHeight: 180,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      {/* Left Column: Streak & Readiness */}
      <View className="gap-4 flex-1">
        {/* Streak */}
        <View className="gap-2">
          <Text className="text-3xl">{data.streakEmoji}</Text>
          <Text
            className="text-2xl font-bold"
            style={{ color: colors.foreground }}
          >
            {data.currentStreak}
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }}>
            Day Streak
          </Text>
        </View>

        {/* Readiness */}
        {data.readinessScore !== null && (
          <View className="gap-2 border-t pt-3" style={{ borderColor: colors.border }}>
            <Text className="text-xl">{data.readinessEmoji}</Text>
            <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
              {data.readinessScore}
            </Text>
            <Text className="text-xs" style={{ color: colors.muted }}>
              Ready
            </Text>
          </View>
        )}
      </View>

      {/* Right Column: Today & Weekly Progress */}
      <View className="gap-4 flex-1 items-end">
        {/* Today's Workout */}
        <View className="gap-2 items-end">
          <Text className="text-3xl">{data.todayEmoji}</Text>
          <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
            {data.todaySession}
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }}>
            Today
          </Text>
        </View>

        {/* Weekly Progress */}
        <View className="items-end border-t pt-3" style={{ borderColor: colors.border }}>
          <Text
            className="text-lg font-bold"
            style={{ color: colors.primary }}
          >
            {data.workoutsThisWeek}/{data.weeklyTarget}
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }}>
            This Week
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Large Widget (4x4)
 * Shows: full stats including streak, readiness, today's workout, weekly progress, next workout
 */
function LargeWidget({ data, colors }: { data: WidgetData; colors: ReturnType<typeof useColors> }) {
  return (
    <View
      className="p-5 rounded-2xl gap-5"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        minHeight: 320,
      }}
    >
      {/* Top Row: Streak & Readiness */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {/* Streak */}
        <View className="gap-2">
          <Text className="text-4xl">{data.streakEmoji}</Text>
          <Text
            className="text-3xl font-bold"
            style={{ color: colors.foreground }}
          >
            {data.currentStreak}
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }}>
            Day Streak
          </Text>
        </View>

        {/* Readiness Score Circle */}
        {data.readinessScore !== null && (
          <View className="items-center gap-2">
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 80,
                height: 80,
                backgroundColor: colors.primary,
                opacity: 0.1,
              }}
            >
              <View className="items-center">
                <Text
                  className="text-2xl font-bold"
                  style={{ color: colors.primary }}
                >
                  {data.readinessScore}
                </Text>
                <Text className="text-xs" style={{ color: colors.muted }}>
                  Ready
                </Text>
              </View>
            </View>
            <Text className="text-lg">{data.readinessEmoji}</Text>
          </View>
        )}
      </View>

      <View style={{ borderColor: colors.border, borderBottomWidth: 1 }} />

      {/* Middle Row: Today & Weekly Progress */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {/* Today's Workout */}
        <View className="gap-3">
          <Text className="text-3xl">{data.todayEmoji}</Text>
          <View>
            <Text className="text-xs" style={{ color: colors.muted }}>
              Today
            </Text>
            <Text
              className="text-lg font-bold"
              style={{ color: colors.foreground }}
            >
              {data.todaySession}
            </Text>
          </View>
        </View>

        {/* Weekly Progress Circle */}
        <WeeklyProgressCircle
          completed={data.workoutsThisWeek}
          target={data.weeklyTarget}
          colors={colors}
        />
      </View>

      <View style={{ borderColor: colors.border, borderBottomWidth: 1 }} />

      {/* Next Workout Info */}
      <View className="gap-2">
        <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
          NEXT WORKOUT
        </Text>
        <View className="gap-1">
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.foreground }}
          >
            {data.nextWorkoutDay}
          </Text>
          <Text className="text-sm" style={{ color: colors.primary }}>
            {data.nextWorkoutType}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Widget Preview Component
 * Displays a preview of the home screen widget at the specified size
 */
export function WidgetPreview({ size, data: providedData, loading }: WidgetPreviewProps) {
  const colors = useColors();
  const [data, setData] = useState<WidgetData | null>(providedData || null);
  const [isLoading, setIsLoading] = useState(loading ?? false);

  useEffect(() => {
    if (providedData) {
      setData(providedData);
      return;
    }

    // Load widget data if not provided
    setIsLoading(true);
    getWidgetData().then((widgetData) => {
      if (widgetData) {
        setData(widgetData);
      }
      setIsLoading(false);
    });
  }, [providedData]);

  if (isLoading || !data) {
    return (
      <View
        className="rounded-2xl items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          minHeight: size === 'small' ? 160 : size === 'medium' ? 180 : 320,
          opacity: 0.5,
        }}
      >
        <Text style={{ color: colors.muted }}>Loading...</Text>
      </View>
    );
  }

  switch (size) {
    case 'small':
      return <SmallWidget data={data} colors={colors} />;
    case 'medium':
      return <MediumWidget data={data} colors={colors} />;
    case 'large':
      return <LargeWidget data={data} colors={colors} />;
  }
}
