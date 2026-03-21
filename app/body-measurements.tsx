import { useState, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { WeightEntry, generateId } from '@/lib/types';
import * as Haptics from 'expo-haptics';

export default function BodyMeasurementsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { store, updateStore } = useGym();
  const today = new Date().toISOString().split('T')[0];

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [arms, setArms] = useState('');
  const [thighs, setThighs] = useState('');
  const [notes, setNotes] = useState('');

  // Get recent weight entries
  const recentEntries = [...store.weightEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30);

  // Calculate trends
  const latestWeight = recentEntries[0]?.weight || 0;
  const weekAgoEntry = recentEntries.find((_, i) => i >= 7);
  const weekChange = weekAgoEntry ? latestWeight - weekAgoEntry.weight : 0;

  const saveEntry = useCallback(() => {
    const w = parseFloat(weight);
    if (!w || w <= 0) return;

    const entry: WeightEntry = {
      id: generateId(),
      date: today,
      weight: w,
      bodyFatPercent: bodyFat ? parseFloat(bodyFat) : undefined,
      chest: chest ? parseFloat(chest) : undefined,
      waist: waist ? parseFloat(waist) : undefined,
      arms: arms ? parseFloat(arms) : undefined,
      thighs: thighs ? parseFloat(thighs) : undefined,
      notes: notes || undefined,
    };

    // Replace if already logged today
    const existing = store.weightEntries.filter(e => e.date !== today);
    updateStore({ ...store, weightEntries: [...existing, entry] });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Clear form
    setWeight('');
    setBodyFat('');
    setChest('');
    setWaist('');
    setArms('');
    setThighs('');
    setNotes('');
  }, [weight, bodyFat, chest, waist, arms, thighs, notes, store, today, updateStore]);

  const todayEntry = store.weightEntries.find(e => e.date === today);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: '700', flex: 1 }}>
            Body Measurements
          </Text>
        </View>

        {/* Weight Summary */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Current</Text>
            <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: '700' }}>
              {latestWeight > 0 ? `${latestWeight}` : '—'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>kg</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>7-Day Change</Text>
            <Text style={{
              color: weekChange > 0 ? '#F59E0B' : weekChange < 0 ? '#22C55E' : colors.muted,
              fontSize: 28,
              fontWeight: '700',
            }}>
              {weekChange !== 0 ? `${weekChange > 0 ? '+' : ''}${weekChange.toFixed(1)}` : '—'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>kg</Text>
          </View>
        </View>

        {/* Weight Chart (simple bar representation) */}
        {recentEntries.length > 1 && (
          <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
              Weight Trend (Last 14 days)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 }}>
              {recentEntries.slice(0, 14).reverse().map((entry, i) => {
                const min = Math.min(...recentEntries.slice(0, 14).map(e => e.weight));
                const max = Math.max(...recentEntries.slice(0, 14).map(e => e.weight));
                const range = max - min || 1;
                const height = 20 + ((entry.weight - min) / range) * 80;
                return (
                  <View key={entry.id} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{
                      width: '80%',
                      height,
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                      opacity: 0.5 + (i / 14) * 0.5,
                    }} />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Log Form */}
        <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
            {todayEntry ? 'Update Today' : 'Log Measurements'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Weight (kg) *</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder={todayEntry ? String(todayEntry.weight) : '80.0'}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Body Fat %</Text>
              <TextInput
                value={bodyFat}
                onChangeText={setBodyFat}
                placeholder="15.0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Chest (cm)</Text>
              <TextInput
                value={chest}
                onChangeText={setChest}
                placeholder="100"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Waist (cm)</Text>
              <TextInput
                value={waist}
                onChangeText={setWaist}
                placeholder="80"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Arms (cm)</Text>
              <TextInput
                value={arms}
                onChangeText={setArms}
                placeholder="38"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Thighs (cm)</Text>
              <TextInput
                value={thighs}
                onChangeText={setThighs}
                placeholder="60"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

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
              minHeight: 50,
              marginBottom: 16,
            }}
          />

          <TouchableOpacity
            onPress={saveEntry}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: weight ? 1 : 0.5,
            }}
            disabled={!weight}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {todayEntry ? 'Update Measurements' : 'Save Measurements'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent History */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            History
          </Text>
          {recentEntries.slice(0, 14).map((entry) => (
            <View
              key={entry.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 10,
                padding: 14,
                marginBottom: 4,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '500' }}>
                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {entry.bodyFatPercent ? `BF: ${entry.bodyFatPercent}%` : ''}
                  {entry.chest ? ` · Chest: ${entry.chest}cm` : ''}
                  {entry.waist ? ` · Waist: ${entry.waist}cm` : ''}
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700' }}>
                {entry.weight} kg
              </Text>
            </View>
          ))}
          {recentEntries.length === 0 && (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
              No measurements yet. Start tracking above!
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
