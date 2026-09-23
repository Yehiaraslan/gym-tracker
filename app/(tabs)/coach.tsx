// ============================================================
// COACH TAB (trainee view) — reach Coach Mohamad Yousry.
// Photo + contact channels, link status (invite code), the plans
// he set for you, and a direct message thread. No AI here.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Platform, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatThread } from '@/components/coach/chat-thread';
import { COACH } from '@/constants/coach';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { syncCoachPlans, type CoachSyncResult } from '@/lib/coach-plan-sync';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';

export default function CoachTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  const isGuest = !user || user.id === 0 || user.loginMethod === 'guest' || user.openId?.startsWith('guest-');

  const [code, setCode] = useState('');
  const [plans, setPlans] = useState<CoachSyncResult | null>(null);

  const trainers = trpc.trainerLink.myTrainers.useQuery(undefined, { enabled: !isGuest });
  const link = trainers.data?.[0] ?? null;

  const refreshPlans = useCallback(() => {
    if (isGuest) return;
    syncCoachPlans().then(setPlans).catch(() => {});
  }, [isGuest]);

  useFocusEffect(useCallback(() => { refreshPlans(); }, [refreshPlans]));

  const redeem = trpc.trainerLink.redeem.useMutation({
    onSuccess: () => {
      setCode('');
      Alert.alert('✓', t('linkedOk'));
      trainers.refetch();
      refreshPlans();
    },
    onError: (e) => Alert.alert(t('notLinkedTitle'), e.message),
  });
  const setPhotos = trpc.trainerLink.setPhotoConsent.useMutation({ onSuccess: () => trainers.refetch() });
  const revoke = trpc.trainerLink.revoke.useMutation({ onSuccess: () => { trainers.refetch(); refreshPlans(); } });

  const confirmRevoke = () => {
    if (!link) return;
    Alert.alert(t('endLink'), t('endLinkConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('endLink'), style: 'destructive', onPress: () => revoke.mutate({ linkId: link.linkId }) },
    ]);
  };

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const card = { backgroundColor: colors.surface, borderColor: colors.cardBorder };
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;
  const coachName = lang === 'ar' ? COACH.nameAr : COACH.name;
  const coachTitle = lang === 'ar' ? COACH.titleAr : COACH.title;

  const contacts: Array<{ key: string; label: string; icon: string; url: string }> = [];
  if (COACH.whatsapp) contacts.push({ key: 'wa', label: t('whatsapp'), icon: '💬', url: `https://wa.me/${COACH.whatsapp}` });
  if (COACH.phone) contacts.push({ key: 'tel', label: t('call'), icon: '📞', url: `tel:${COACH.phone}` });
  if (COACH.instagram) contacts.push({ key: 'ig', label: t('instagram'), icon: '📸', url: `https://instagram.com/${COACH.instagram}` });
  if (COACH.email) contacts.push({ key: 'mail', label: 'Email', icon: '✉️', url: `mailto:${COACH.email}` });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}
        refreshControl={<RefreshControl refreshing={trainers.isFetching} onRefresh={() => { trainers.refetch(); refreshPlans(); }} tintColor={mt} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.heading, { color: fg, textAlign: align }]}>{t('yourCoach')}</Text>

        {/* ── Coach card ── */}
        <View style={[s.hero, card]}>
          <Image source={COACH.photo} style={s.heroPhoto} resizeMode="cover" />
          <View style={s.heroBody}>
            <Text style={[s.coachName, { color: fg, textAlign: align }]}>{coachName}</Text>
            <Text style={[s.coachTitle, { color: pr, textAlign: align }]}>{coachTitle}</Text>
            <Text style={[s.coachIntro, { color: mt, textAlign: align }]}>{t('coachIntro')}</Text>
            {contacts.length > 0 && (
              <View style={[s.contactRow, { flexDirection: rowDir }]}>
                {contacts.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.contactBtn, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
                    onPress={() => Linking.openURL(c.url).catch(() => {})}
                    activeOpacity={0.8}
                  >
                    <Text style={s.contactIcon}>{c.icon}</Text>
                    <Text style={[s.contactLabel, { color: fg }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Link state ── */}
        {isGuest ? (
          <View style={[s.card, card]}>
            <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{t('guestNotice')}</Text>
            <TouchableOpacity
              onPress={async () => { await logout(); router.replace('/login' as any); }}
              style={[s.btn, { backgroundColor: colors.primary, marginTop: 12 }]}
              activeOpacity={0.8}
            >
              <Text style={s.btnText}>{t('guestCta')}</Text>
            </TouchableOpacity>
          </View>
        ) : trainers.isLoading ? (
          <ActivityIndicator color={mt} style={{ marginVertical: 16 }} />
        ) : !link ? (
          <View style={[s.card, card]}>
            <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{t('notLinkedTitle')}</Text>
            <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{t('notLinkedBody')}</Text>
            <TextInput
              style={[s.codeInput, { color: fg, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={t('inviteCodePlaceholder')}
              placeholderTextColor={mt}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
            <TouchableOpacity
              style={[s.btn, { backgroundColor: pr }, code.length !== 8 && { opacity: 0.5 }]}
              onPress={() => redeem.mutate({ code })}
              disabled={code.length !== 8 || redeem.isPending}
              activeOpacity={0.85}
            >
              {redeem.isPending ? <ActivityIndicator color={colors.primaryInk} /> : <Text style={[s.btnText, { color: colors.primaryInk }]}>{t('linkToCoach')}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Plans set by the coach */}
            <View style={[s.card, card]}>
              <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{t('yourPlan')}</Text>
              <Text style={[s.meta, { color: mt, textAlign: align }]}>
                {t('linkedSince', { date: new Date(link.since).toLocaleDateString() })}
              </Text>
              {([
                { label: t('workoutPlanLabel'), icon: '🏋️', name: plans?.workoutPlan?.name },
                { label: t('mealPlanLabel'), icon: '🍽️', name: plans?.mealPlan?.name },
              ]).map((p) => (
                <View key={p.label} style={[s.planRow, { flexDirection: rowDir, borderColor: colors.border }]}>
                  <Text style={s.planIcon}>{p.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.planLabel, { color: mt, textAlign: align }]}>{p.label}</Text>
                    <Text style={[s.planName, { color: p.name ? fg : mt, textAlign: align }]}>{p.name ?? t('noPlanYet')}</Text>
                  </View>
                  {p.name ? <Text style={[s.planTag, { color: pr, backgroundColor: colors.primarySoft }]}>{t('setBy')}</Text> : null}
                </View>
              ))}
              <View style={[s.consentRow, { flexDirection: rowDir }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.consentTitle, { color: fg, textAlign: align }]}>{t('sharePhotos')}</Text>
                  <Text style={[s.consentHint, { color: mt, textAlign: align }]}>{t('sharePhotosHint')}</Text>
                </View>
                <Switch
                  value={link.photosShared}
                  onValueChange={(v) => setPhotos.mutate({ linkId: link.linkId, shared: v })}
                  disabled={setPhotos.isPending}
                  trackColor={{ true: pr, false: colors.border }}
                />
              </View>
            </View>

            {/* Messages */}
            <Text style={[s.section, { color: mt, textAlign: align }]}>{t('messagesTitle').toUpperCase()}</Text>
            <View style={[s.card, card, { paddingBottom: 0, overflow: 'hidden' }]}>
              <ChatThread peerId={link.userId} myId={user!.id} embedded />
            </View>

            <TouchableOpacity onPress={confirmRevoke} disabled={revoke.isPending} activeOpacity={0.7} style={s.revoke}>
              <Text style={[s.revokeText, { color: colors.warningStrong }]}>{t('endLink')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 110, gap: 14 },
  heading: { fontSize: 28, fontWeight: '700' },
  hero: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  heroPhoto: { width: '100%', height: 260 },
  heroBody: { padding: 16, gap: 6 },
  coachName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  coachTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  coachIntro: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  contactRow: { gap: 10, marginTop: 10, flexWrap: 'wrap' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  contactIcon: { fontSize: 15 },
  contactLabel: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 12 },
  codeInput: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 20, letterSpacing: 4, textAlign: 'center', marginTop: 4 },
  btn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { fontSize: 15, fontWeight: '700' },
  planRow: { alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  planIcon: { fontSize: 22 },
  planLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  planName: { fontSize: 15, fontWeight: '600' },
  planTag: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  consentRow: { alignItems: 'center', gap: 12, marginTop: 10 },
  consentTitle: { fontSize: 14, fontWeight: '600' },
  consentHint: { fontSize: 11, lineHeight: 15 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 4, marginLeft: 4 },
  revoke: { alignItems: 'center', paddingVertical: 8 },
  revokeText: { fontSize: 13, fontWeight: '700' },
});
