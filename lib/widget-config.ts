// ============================================================
// Widget Configuration — persists which stats appear on the
// Android home screen widget
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const WIDGET_CONFIG_KEY = '@gym_widget_config';

export type WidgetStatSlot = 'streak' | 'readiness' | 'next_session' | 'today_session' | 'weekly_progress' | 'pr_board';

export interface WidgetConfig {
  /** Ordered list of stats to show (max 3 visible rows) */
  enabledStats: WidgetStatSlot[];
  /** Dark or light widget theme */
  theme: 'dark' | 'light';
}

export const WIDGET_STAT_OPTIONS: { id: WidgetStatSlot; label: string; description: string; emoji: string }[] = [
  { id: 'streak',           label: 'Workout Streak',    description: 'Current consecutive workout days',   emoji: '🔥' },
  { id: 'today_session',    label: "Today's Session",   description: 'What workout is scheduled today',    emoji: '🏋️' },
  { id: 'readiness',        label: 'Readiness Score',   description: 'Recovery & readiness for training',  emoji: '⚡' },
  { id: 'next_session',     label: 'Next Workout',      description: 'Day and type of next session',       emoji: '📅' },
  { id: 'weekly_progress',  label: 'Weekly Progress',   description: 'Workouts completed this week',       emoji: '📊' },
  { id: 'pr_board',         label: 'Top PR',            description: 'Your highest estimated 1RM',         emoji: '🏆' },
];

const DEFAULT_CONFIG: WidgetConfig = {
  enabledStats: ['streak', 'today_session', 'readiness'],
  theme: 'dark',
};

export async function getWidgetConfig(): Promise<WidgetConfig> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as WidgetConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveWidgetConfig(config: WidgetConfig): Promise<void> {
  await AsyncStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(config));
}
