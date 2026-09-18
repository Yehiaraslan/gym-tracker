// Coach inbox — one row per athlete, newest first, unread count.
import React, { useCallback } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatWhen } from '@/components/coach/chat-thread';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';

export default function MessagesTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const threads = trpc.coach.threads.useQuery(undefined, { refetchInterval: 15000 });
  useFocusEffect(useCallback(() => { threads.refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const rows = threads.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}
        refreshControl={<RefreshControl refreshing={threads.isFetching} onRefresh={() => threads.refetch()} tintColor={mt} />}
      >
        <Text style={[s.heading, { color: fg, textAlign: align }]}>{t('messagesTitle')}</Text>
        {threads.isLoading ? (
          <ActivityIndicator color={mt} style={{ marginTop: 20 }} />
        ) : rows.length === 0 ? (
          <Text style={[s.empty, { color: mt, textAlign: align }]}>{t('noThreads')}</Text>
        ) : (
          rows.map((r) => (
            <TouchableOpacity
              key={r.peerId}
              style={[s.row, { backgroundColor: colors.surface, borderColor: r.unread > 0 ? colors.primaryEdge : colors.cardBorder, flexDirection: rowDir }]}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/chat/[peerId]', params: { peerId: String(r.peerId), name: r.peerName || r.peerEmail || 'Athlete' } } as any)}
            >
              <View style={[s.initial, { backgroundColor: colors.surface3 }]}>
                <Text style={[s.initialText, { color: fg }]}>{(r.peerName || r.peerEmail || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[s.topLine, { flexDirection: rowDir }]}>
                  <Text style={[s.name, { color: fg, textAlign: align }]} numberOfLines={1}>{r.peerName || r.peerEmail || 'Athlete'}</Text>
                  {r.lastAt ? <Text style={[s.when, { color: mt }]}>{formatWhen(r.lastAt)}</Text> : null}
                </View>
                <Text style={[s.preview, { color: r.unread > 0 ? fg : mt, textAlign: align }]} numberOfLines={1}>
                  {r.lastMessage ?? t('noMessages')}
                </Text>
              </View>
              {r.unread > 0 && (
                <View style={[s.badge, { backgroundColor: pr }]}>
                  <Text style={[s.badgeText, { color: colors.primaryInk }]}>{r.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 110, gap: 10 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  empty: { fontSize: 13, lineHeight: 20, paddingHorizontal: 4 },
  row: { alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 18, fontWeight: '800' },
  topLine: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  when: { fontSize: 11 },
  preview: { fontSize: 13, marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
