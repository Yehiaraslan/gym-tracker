import { useState, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { SleepEntry, generateId } from '@/lib/types';
import * as Haptics from 'expo-haptics';

const QUALITY_LABELS = ['', 'Terrible', 'Poor', 'Fair', 'Good', 'Excellent'];
const QUALITY_COLORS = ['', '#EF4444', '#F59E0B', '#FFE66D', '#4ECDC4', '#22C55E'];

export default function SleepScreen() {
  const router = useRouter();
  const colors = useColors();
  const { store, updateStore } = useGym();
  const today = new Date().toLocaleDateString('en-CA');

  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState('');

  // Calculate duration
  const calcDuration = (bed: string, wake: string): number => {
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    let wakeMin = wh * 60 + wm;
    if (wakeMin <= bedMin) wakeMin += 24 * 60;
    return Math.round(((wakeMin - bedMin) / 60) * 10) / 10;
  };

  const duration = calcDuration(bedtime, wakeTime);

  // Get recent sleep entries
  const recentEntries = [...store.sleepEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 14);

  // Calculate averages
  const avgDuration = recentEntries.length > 0
    ? recentEntries.reduce((s, e) => s + e.durationHours, 0) / recentEntries.length
    : 0;
  const avgQuality = recentEntries.length > 0
    ? recentEntries.reduce((s, e) => s + e.qualityRating, 0) / recentEntries.length
    : 0;

  const saveSleep = useCallback(() => {
    const entry: SleepEntry = {
      id: generateId(),
      date: today,
      bedtime,
      wakeTime,
      durationHours: duration,
      qualityRating: quality,
      notes: notes || undefined,
    };

    // Replace if already logged today
    const existing = store.sleepEntries.filter(e => e.date !== today);
    updateStore({ ...store, sleepEntries: [...existing, entry] });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [bedtime, wakeTime, duration, quality, notes, store, today, updateStore]);

  const todayEntry = store.sleepEntries.find(e => e.date === today);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: '700', flex: 1 }}>
            Sleep Tracker
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Avg Duration</Text>
            <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: '700' }}>
              {avgDuration.toFixed(1)}h
            </Text>
            <Text style={{ color: avgDuration >= 7 ? '#22C55E' : '#F59E0B', fontSize: 12 }}>
              {avgDuration >= 7 ? 'On target' : 'Below 7h target'}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Avg Quality</Text>
            <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: '700' }}>
              {avgQuality.toFixed(1)}/5
            </Text>
            <Text style={{ color: avgQuality >= 3.5 ? '#22C55E' : '#F59E0B', fontSize: 12 }}>
              {QUALITY_LABELS[Math.round(avgQuality)] || 'No data'}
            </Text>
          </View>
        </View>

        {/* Log Today's Sleep */}
        <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
            {todayEntry ? 'Update Today' : 'Log Last Night'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Bedtime</Text>
              <TextInput
                value={bedtime}
                onChangeText={setBedtime}
                placeholder="23:00"
                placeholderTextColor={colors.muted}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Wake Time</Text>
              <TextInput
                value={wakeTime}
                onChangeText={setWakeTime}
                placeholder="07:00"
                placeholderTextColor={colors.muted}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              />
            </View>
          </View>

          <Text style={{ color: colors.foreground, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
            Duration: <Text style={{ fontWeight: '700', color: duration >= 7 ? '#22C55E' : '#F59E0B' }}>{duration}h</Text>
          </Text>

          {/* Quality Rating */}
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>Sleep Quality</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {([1, 2, 3, 4, 5] as const).map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => {
                  setQuality(q);
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: quality === q ? QUALITY_COLORS[q] : colors.background,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: quality === q ? '#fff' : colors.muted,
                  fontSize: 12,
                  fontWeight: quality === q ? '700' : '400',
                }}>
                  {q}
                </Text>
                <Text style={{
                  color: quality === q ? '#fff' : colors.muted,
                  fontSize: 9,
                  marginTop: 2,
                }}>
                  {QUALITY_LABELS[q]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)..."
            placeholderTextColor={colors.muted}
            multiline
            style={{
              backgroundColor: colors.background,
              borderRadius: 10,
              padding: 12,
              color: colors.foreground,
              fontSize: 14,
              minHeight: 60,
              marginBottom: 16,
            }}
          />

          <TouchableOpacity
            onPress={saveSleep}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {todayEntry ? 'Update Sleep Log' : 'Save Sleep Log'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent History */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Recent History
          </Text>
          {recentEntries.map((entry) => (
            <View
              key={entry.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 10,
                padding: 14,
                marginBottom: 6,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '500' }}>
                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {entry.bedtime} → {entry.wakeTime}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{
                  color: entry.durationHours >= 7 ? '#22C55E' : '#F59E0B',
                  fontSize: 16,
                  fontWeight: '700',
                }}>
                  {entry.durationHours}h
                </Text>
                <Text style={{ color: QUALITY_COLORS[entry.qualityRating], fontSize: 11 }}>
                  {QUALITY_LABELS[entry.qualityRating]}
                </Text>
              </View>
            </View>
          ))}
          {recentEntries.length === 0 && (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
              No sleep data yet. Start logging above!
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
