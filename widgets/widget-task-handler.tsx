'use no memo';
// Widget task handler — runs in background when Android requests a widget update

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { GymStatsWidget } from './gym-stats-widget';
import { getWidgetData, updateWidgetData } from '@/lib/widget-data';

const WIDGET_MAP: Record<string, React.FC<{ data: any }>> = {
  GymStats: GymStatsWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const WidgetComponent = WIDGET_MAP[widgetInfo.widgetName];

  if (!WidgetComponent) {
    console.warn(`[widget-task-handler] Unknown widget: ${widgetInfo.widgetName}`);
    return;
  }

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      // Generate fresh data and render the widget
      let data = await getWidgetData();
      if (!data) {
        try {
          data = await updateWidgetData();
        } catch {
          data = null;
        }
      }
      props.renderWidget(<WidgetComponent data={data} />);
      break;
    }

    case 'WIDGET_DELETED':
      // Nothing to clean up
      break;

    case 'WIDGET_CLICK':
      // Handled by clickAction="OPEN_APP" in the widget component
      break;

    default:
      break;
  }
}
