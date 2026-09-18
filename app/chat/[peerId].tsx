// Full-screen message thread with one peer (coach ↔ athlete).
import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { ChatThread } from '@/components/coach/chat-thread';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';

export default function ChatScreen() {
  const { peerId, name } = useLocalSearchParams<{ peerId: string; name?: string }>();
  const { user } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const { t } = useI18n();
  const id = Number(peerId);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.back}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>‹ {t('back')}</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>{name || t('chat')}</Text>
        <View style={s.back} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {user && Number.isFinite(id) && id > 0 ? (
          <ChatThread peerId={id} myId={user.id} placeholder={t('typeMessage')} />
        ) : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48, borderBottomWidth: 1 },
  back: { width: 80 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
});
