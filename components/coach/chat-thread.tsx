// ============================================================
// CHAT THREAD — coach ↔ trainee direct messages.
// Used embedded (Coach tab) and full-screen (chat/[peerId]).
// Polls every 8s; no sockets needed at this scale.
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';

type Props = {
  peerId: number;
  myId: number;
  /** Render inside a parent ScrollView (no own scrolling). */
  embedded?: boolean;
  placeholder?: string;
};

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

export function ChatThread({ peerId, myId, embedded, placeholder }: Props) {
  const colors = useColors();
  const { t, isRTL } = useI18n();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const utils = trpc.useUtils();

  const thread = trpc.coach.thread.useQuery({ peerId }, { refetchInterval: 8000 });
  const send = trpc.coach.sendMessage.useMutation({
    onSuccess: () => {
      setDraft('');
      thread.refetch();
      utils.coach.threads.invalidate();
      utils.coach.unreadCount.invalidate();
    },
  });

  const messages = thread.data ?? [];
  useEffect(() => {
    if (!embedded) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, embedded]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate({ peerId, body });
  };

  const bubbles = (
    <View style={s.list}>
      {thread.isLoading ? (
        <ActivityIndicator color={colors.muted} style={{ marginVertical: 20 }} />
      ) : messages.length === 0 ? (
        <Text style={[s.empty, { color: colors.muted, textAlign: isRTL ? 'right' : 'left' }]}>{t('noMessages')}</Text>
      ) : (
        messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <View
              key={m.id}
              style={[
                s.bubbleRow,
                { justifyContent: mine ? (isRTL ? 'flex-start' : 'flex-end') : (isRTL ? 'flex-end' : 'flex-start') },
              ]}
            >
              <View style={[
                s.bubble,
                mine
                  ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                  : { backgroundColor: colors.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
              ]}>
                <Text style={[s.body, { color: mine ? colors.primaryInk : colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{m.body}</Text>
                <Text style={[s.when, { color: mine ? colors.primaryInk : colors.muted, opacity: 0.75 }]}>{formatWhen(m.createdAt)}</Text>
              </View>
            </View>
          );
        })
      )}
      {send.isError && <Text style={[s.err, { color: colors.error }]}>{send.error.message}</Text>}
    </View>
  );

  const composer = (
    <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.background, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <TextInput
        style={[s.input, { color: colors.foreground, backgroundColor: colors.surface2, borderColor: colors.border, textAlign: isRTL ? 'right' : 'left' }]}
        placeholder={placeholder ?? t('typeMessage')}
        placeholderTextColor={colors.muted}
        value={draft}
        onChangeText={setDraft}
        multiline
        maxLength={4000}
        onSubmitEditing={Platform.OS === 'web' ? submit : undefined}
        blurOnSubmit={Platform.OS === 'web'}
        testID="chat-input"
      />
      <TouchableOpacity
        style={[s.sendBtn, { backgroundColor: colors.primary, opacity: draft.trim() && !send.isPending ? 1 : 0.5 }]}
        onPress={submit}
        disabled={!draft.trim() || send.isPending}
        activeOpacity={0.85}
        accessibilityLabel={t('send')}
      >
        {send.isPending ? <ActivityIndicator color={colors.primaryInk} /> : <Text style={[s.sendText, { color: colors.primaryInk }]}>{isRTL ? '◀' : '▶'}</Text>}
      </TouchableOpacity>
    </View>
  );

  if (embedded) {
    return (
      <View>
        {bubbles}
        {composer}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {bubbles}
      </ScrollView>
      {composer}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 8 },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  body: { fontSize: 15, lineHeight: 21 },
  when: { fontSize: 10, alignSelf: 'flex-end' },
  err: { fontSize: 12, marginTop: 4 },
  composer: { alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 16, fontWeight: '800' },
});
