'use no memo';
// Widget UI component for Android home screen widget
// Uses react-native-android-widget primitives (NOT standard RN components)

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetData } from '@/lib/widget-data';

interface GymStatsWidgetProps {
  data: WidgetData | null;
}

// Theme colors (dark mode — matches app theme)
const COLORS = {
  surface: '#161A22',
  foreground: '#F1F5F9',
  muted: '#64748B',
  primary: '#3B82F6',
  border: '#1E293B',
};

export function GymStatsWidget({ data }: GymStatsWidgetProps) {
  const streak = data?.currentStreak ?? 0;
  const todaySession = data?.todaySession ?? 'Rest Day';
  const todayEmoji = data?.todayEmoji ?? '😴';
  const readinessScore = data?.readinessScore ?? null;
  const readinessLabel = data?.readinessLabel ?? 'Unknown';
  const readinessEmoji = data?.readinessEmoji ?? '❓';
  const streakEmoji = streak > 0 ? '🔥' : '💤';

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
    >
      {/* Streak Row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <TextWidget
          text={streakEmoji}
          style={{ fontSize: 18 }}
        />
        <TextWidget
          text={` ${streak}`}
          style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: COLORS.foreground,
          }}
        />
        <TextWidget
          text="  Day Streak"
          style={{
            fontSize: 12,
            color: COLORS.muted,
          }}
        />
      </FlexWidget>

      {/* Today's Session Row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingTop: 8,
        }}
      >
        <TextWidget
          text={todayEmoji}
          style={{ fontSize: 16 }}
        />
        <TextWidget
          text={`  ${todaySession}`}
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            color: COLORS.foreground,
          }}
        />
      </FlexWidget>

      {/* Readiness Row */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingTop: 8,
        }}
      >
        <TextWidget
          text={readinessEmoji}
          style={{ fontSize: 16 }}
        />
        <TextWidget
          text={readinessScore !== null ? `  Ready: ${readinessScore}` : `  ${readinessLabel}`}
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: COLORS.muted,
          }}
        />
      </FlexWidget>

      {/* App branding */}
      <FlexWidget
        style={{
          width: 'match_parent',
          alignItems: 'flex-end',
          paddingTop: 4,
        }}
      >
        <TextWidget
          text="Banana Pro Gym"
          style={{
            fontSize: 9,
            color: COLORS.muted,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
