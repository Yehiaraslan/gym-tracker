// ============================================================
// COACHING — the trainer ↔ trainee link, from both sides.
//
// One screen, two faces: a trainer sees their roster and can
// mint invite codes; an athlete sees who coaches them and can
// redeem a code. Either side can end the link at any time.
//
// Photo sharing is the athlete's switch alone, off by default,
// and it does not come back on its own after a link is cut.
// ============================================================
import { useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAuth } from '@/hooks/use-auth';
import { trpc } from '@/lib/trpc';

export default function CoachingScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer' || user?.role === 'admin';

  const [code, setCode] = useState('');
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);

  const trainees = trpc.trainerLink.myTrainees.useQuery(undefined, { enabled: isTrainer });
  const trainers = trpc.trainerLink.myTrainers.useQuery(undefined, { enabled: !isTrainer });

  const refetchAll = () => {
    if (isTrainer) trainees.refetch();
    else trainers.refetch();
  };

  const createInvite = trpc.trainerLink.createInvite.useMutation({
    onSuccess: (data) => setIssued(data),
    onError: (e) => Alert.alert('Could not create a code', e.message),
  });

  const redeem = trpc.trainerLink.redeem.useMutation({
    onSuccess: () => {
      setCode('');
      Alert.alert('Linked', 'Your coach can now set your training and meals.');
      refetchAll();
    },
    onError: (e) => Alert.alert('Could not use that code', e.message),
  });

  const revoke = trpc.trainerLink.revoke.useMutation({
    onSuccess: () => refetchAll(),
    onError: (e) => Alert.alert('Could not end the link', e.message),
  });

  const setPhotos = trpc.trainerLink.setPhotoConsent.useMutation({
    onSuccess: () => refetchAll(),
    onError: (e) => Alert.alert('Could not change photo sharing', e.message),
  });

  const confirmRevoke = (linkId: string, who: string) => {
    Alert.alert(
      'End this link?',
      `${who} will no longer see your training, meals or photos. You can link again later with a new code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End link', style: 'destructive', onPress: () => revoke.mutate({ linkId }) },
      ],
    );
  };

  const fg = colors.foreground;
  const mt = colors.muted;
  const pr = colors.primary;
  const card = { backgroundColor: colors.surface2, borderColor: colors.border };

  const list = isTrainer ? trainees : trainers;
  const rows = list.data ?? [];

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: isTrainer ? 'My Athletes' : 'My Coach' }} />
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={refetchAll} tintColor={mt} />}
      >
        {isTrainer ? (
          <View style={[s.card, card]}>
            <Text style={[s.cardTitle, { color: fg }]}>Invite an athlete</Text>
            <Text style={[s.cardBody, { color: mt }]}>
              Generate a code and send it to them. It works once and expires in 7 days.
            </Text>
            {issued && (
              <View style={[s.codeBox, { borderColor: pr }]}>
                <Text style={[s.code, { color: fg }]}>{issued.code}</Text>
                <Text style={[s.codeHint, { color: mt }]}>
                  Expires {new Date(issued.expiresAt).toLocaleDateString()}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[s.btn, { backgroundColor: pr }]}
              onPress={() => createInvite.mutate()}
              disabled={createInvite.isPending}
              activeOpacity={0.85}
            >
              {createInvite.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{issued ? 'Generate another code' : 'Generate invite code'}</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.card, card]}>
            <Text style={[s.cardTitle, { color: fg }]}>Have an invite code?</Text>
            <Text style={[s.cardBody, { color: mt }]}>
              Enter the code your coach gave you to link your accounts.
            </Text>
            <TextInput
              style={[s.input, { color: fg, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="ABCD2345"
              placeholderTextColor={mt}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
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
              {redeem.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Link to my coach</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text style={[s.section, { color: mt }]}>
          {isTrainer ? 'ATHLETES' : 'COACHING ME'}
        </Text>

        {list.isLoading ? (
          <ActivityIndicator color={mt} style={{ marginTop: 20 }} />
        ) : rows.length === 0 ? (
          <Text style={[s.empty, { color: mt }]}>
            {isTrainer
              ? 'No athletes yet. Send someone an invite code to get started.'
              : 'No coach linked. Enter an invite code above when you have one.'}
          </Text>
        ) : (
          rows.map((r) => (
            <View key={r.linkId} style={[s.card, card]}>
              <Text style={[s.name, { color: fg }]}>{r.name || r.email || 'Athlete'}</Text>
              {!!r.email && <Text style={[s.meta, { color: mt }]}>{r.email}</Text>}
              <Text style={[s.meta, { color: mt }]}>
                Linked since {new Date(r.since).toLocaleDateString()}
              </Text>

              {!isTrainer && (
                <View style={s.consentRow}>
                  <View style={s.consentText}>
                    <Text style={[s.consentTitle, { color: fg }]}>Share my progress photos</Text>
                    <Text style={[s.consentHint, { color: mt }]}>
                      Off by default. Your coach sees photos only while this is on.
                    </Text>
                  </View>
                  <Switch
                    value={r.photosShared}
                    onValueChange={(v) => setPhotos.mutate({ linkId: r.linkId, shared: v })}
                    disabled={setPhotos.isPending}
                  />
                </View>
              )}

              {isTrainer && (
                <Text style={[s.meta, { color: r.photosShared ? colors.successStrong : mt }]}>
                  {r.photosShared ? '📷 Sharing progress photos' : '📷 Photos not shared'}
                </Text>
              )}

              <TouchableOpacity
                style={[s.linkBtn, { borderColor: colors.border }]}
                onPress={() => confirmRevoke(r.linkId, r.name || 'They')}
                disabled={revoke.isPending}
                activeOpacity={0.7}
              >
                <Text style={[s.linkBtnText, { color: colors.warningStrong }]}>End link</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 19 },
  codeBox: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 4, marginTop: 4 },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 6 },
  codeHint: { fontSize: 11 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 20, letterSpacing: 4, textAlign: 'center', marginTop: 4 },
  btn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 10, marginLeft: 4 },
  empty: { fontSize: 13, lineHeight: 20, paddingHorizontal: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  consentText: { flex: 1, gap: 2 },
  consentTitle: { fontSize: 14, fontWeight: '600' },
  consentHint: { fontSize: 11, lineHeight: 15 },
  linkBtn: { borderWidth: 1, borderRadius: 12, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  linkBtnText: { fontSize: 13, fontWeight: '700' },
});
