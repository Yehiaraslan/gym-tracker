import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';

interface MoreItem {
  emoji: string;
  title: string;
  subtitle: string;
  route: string;
}

const MORE_ITEMS: MoreItem[] = [
  { emoji: '\u{1F49A}', title: 'WHOOP Recovery', subtitle: 'Recovery & strain', route: '/whoop' },
  { emoji: '\u{1F4CA}', title: 'Analytics', subtitle: 'Stats & trends', route: '/(tabs)/analytics' },
  { emoji: '\u{1F4C5}', title: 'Calendar', subtitle: 'Training calendar', route: '/(tabs)/calendar' },
  { emoji: '\u{1F634}', title: 'Sleep Tracker', subtitle: 'Sleep quality', route: '/(tabs)/sleep' },
  { emoji: '\u{1F3C6}', title: 'PR Board', subtitle: 'Personal records', route: '/pr-board' },
  { emoji: '\u{1F4F8}', title: 'Progress Photos', subtitle: 'Photo timeline', route: '/progress-pictures' },
  { emoji: '\u{1F4CB}', title: 'Weekly Report', subtitle: 'Weekly summary', route: '/weekly-report' },
  { emoji: '\u{1F4CF}', title: 'Body Measurements', subtitle: 'Track measurements', route: '/body-measurements' },
  { emoji: '\u{1F525}', title: 'Muscle Heatmap', subtitle: 'Volume heatmap', route: '/muscle-heatmap' },
  { emoji: '\u{2699}\u{FE0F}', title: 'Settings / Profile', subtitle: 'Preferences', route: '/profile' },
];

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const s = styles(colors);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: Platform.OS === 'web' ? 24 : insets.top + 12, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.heading, { color: colors.foreground }]}>More</Text>
        <Text style={[s.subheading, { color: colors.muted }]}>All features in one place</Text>

        <View style={s.grid}>
          {MORE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={[
                s.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={s.emoji}>{item.emoji}</Text>
              <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[s.cardSubtitle, { color: colors.muted }]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (_colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: 16,
    },
    heading: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 4,
    },
    subheading: {
      fontSize: 14,
      marginBottom: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    card: {
      width: '48%',
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    emoji: {
      fontSize: 28,
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    cardSubtitle: {
      fontSize: 11,
    },
  });
