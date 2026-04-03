import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import {
  getWidgetConfig,
  saveWidgetConfig,
  WIDGET_STAT_OPTIONS,
  type WidgetConfig,
  type WidgetStatSlot,
} from '@/lib/widget-config';
import { updateWidgetData } from '@/lib/widget-data';

const MAX_STATS = 3;

export default function WidgetConfigScreen() {
  const colors = useColors();
  const router = useRouter();
  const [config, setConfig] = useState<WidgetConfig>({
    enabledStats: ['streak', 'today_session', 'readiness'],
    theme: 'dark',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getWidgetConfig().then(setConfig);
    }, [])
  );

  const toggleStat = (id: WidgetStatSlot) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfig(prev => {
      const isEnabled = prev.enabledStats.includes(id);
      if (isEnabled) {
        return { ...prev, enabledStats: prev.enabledStats.filter(s => s !== id) };
      }
      if (prev.enabledStats.length >= MAX_STATS) return prev; // cap at 3
      return { ...prev, enabledStats: [...prev.enabledStats, id] };
    });
    setSaved(false);
  };

  const moveUp = (id: WidgetStatSlot) => {
    setConfig(prev => {
      const idx = prev.enabledStats.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev.enabledStats];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return { ...prev, enabledStats: next };
    });
    setSaved(false);
  };

  const moveDown = (id: WidgetStatSlot) => {
    setConfig(prev => {
      const idx = prev.enabledStats.indexOf(id);
      if (idx < 0 || idx >= prev.enabledStats.length - 1) return prev;
      const next = [...prev.enabledStats];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return { ...prev, enabledStats: next };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveWidgetConfig(config);
      await updateWidgetData(); // push updated widget to home screen
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => router.back(), 800);
    } catch (e) {
      console.error('Widget config save failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const s = styles(colors);

  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ gap: 6 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={[s.title]}>Widget Stats</Text>
          <Text style={[s.subtitle]}>
            Choose up to {MAX_STATS} stats to show on your Android home screen widget. Drag to reorder.
          </Text>
        </View>

        {/* Active order preview */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Active Rows (in order)</Text>
          {config.enabledStats.length === 0 ? (
            <Text style={{ color: colors.cardMuted, fontSize: 13, marginTop: 8 }}>
              No stats selected — tap below to add some.
            </Text>
          ) : (
            config.enabledStats.map((id, idx) => {
              const opt = WIDGET_STAT_OPTIONS.find(o => o.id === id)!;
              return (
                <View key={id} style={s.activeRow}>
                  <Text style={{ fontSize: 20, width: 28 }}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activeLabel}>{opt.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => moveUp(id)}
                      style={[s.arrowBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                      disabled={idx === 0}
                    >
                      <Text style={{ color: colors.primary, fontSize: 16 }}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveDown(id)}
                      style={[s.arrowBtn, { opacity: idx === config.enabledStats.length - 1 ? 0.3 : 1 }]}
                      disabled={idx === config.enabledStats.length - 1}
                    >
                      <Text style={{ color: colors.primary, fontSize: 16 }}>↓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          <Text style={[s.countBadge, { color: config.enabledStats.length >= MAX_STATS ? colors.warning : colors.cardMuted }]}>
            {config.enabledStats.length}/{MAX_STATS} slots used
          </Text>
        </View>

        {/* All stat options */}
        <View style={{ gap: 10 }}>
          <Text style={s.sectionLabel}>Available Stats</Text>
          {WIDGET_STAT_OPTIONS.map(opt => {
            const isEnabled = config.enabledStats.includes(opt.id);
            const isDisabled = !isEnabled && config.enabledStats.length >= MAX_STATS;
            return (
              <View
                key={opt.id}
                style={[
                  s.optionRow,
                  isEnabled && { borderColor: colors.primary, borderWidth: 1.5 },
                  isDisabled && { opacity: 0.45 },
                ]}
              >
                <Text style={{ fontSize: 22, width: 32 }}>{opt.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.optLabel}>{opt.label}</Text>
                  <Text style={s.optDesc}>{opt.description}</Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleStat(opt.id)}
                  disabled={isDisabled}
                  trackColor={{ false: colors.cardBorder, true: colors.primary }}
                  thumbColor={isEnabled ? '#fff' : colors.cardMuted}
                />
              </View>
            );
          })}
        </View>

        {/* Theme toggle */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Widget Theme</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            {(['dark', 'light'] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setConfig(p => ({ ...p, theme: t })); setSaved(false); }}
                style={[
                  s.themeBtn,
                  config.theme === t && { borderColor: colors.primary, borderWidth: 2 },
                  t === 'dark' ? { backgroundColor: '#161A22' } : { backgroundColor: '#F1F5F9' },
                ]}
              >
                <Text style={{ color: t === 'dark' ? '#F1F5F9' : '#11181C', fontWeight: '600', fontSize: 14 }}>
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[s.saveBtn, { backgroundColor: saved ? colors.success : colors.primary, opacity: isSaving ? 0.7 : 1 }]}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {saved ? '✓ Saved!' : isSaving ? 'Saving…' : 'Save & Update Widget'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    title: { fontSize: 26, fontWeight: '700', color: colors.cardForeground },
    subtitle: { fontSize: 14, color: colors.cardMuted, lineHeight: 20 },
    sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.cardMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 4,
    },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      gap: 10,
    },
    activeLabel: { fontSize: 15, fontWeight: '600', color: colors.cardForeground },
    arrowBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBorder,
      borderRadius: 8,
    },
    countBadge: { fontSize: 12, marginTop: 8, textAlign: 'right' },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    optLabel: { fontSize: 15, fontWeight: '600', color: colors.cardForeground },
    optDesc: { fontSize: 12, color: colors.cardMuted },
    themeBtn: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    saveBtn: {
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
  });
