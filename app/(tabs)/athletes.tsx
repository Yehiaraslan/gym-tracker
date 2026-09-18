// ============================================================
// ATHLETES (coach home) — everyone Coach Mohamad coaches, with
// the signals he scans first: last workout, this week's count,
// which plans are set, unread messages. Invite codes live here.
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COACH } from '@/constants/coach';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

export default function AthletesTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);

  const roster = trpc.coach.roster.useQuery(undefined, { refetchInterval: 30000 });
  useFocusEffect(useCallback(() => { roster.refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const createInvite = trpc.trainerLink.createInvite.useMutation({
    onSuccess: (d) => setIssued(d),
    onError: (e) => Alert.alert(t('inviteAthlete'), e.message),
  });

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const card = { backgroundColor: colors.surface, borderColor: colors.cardBorder };
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const rows = roster.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}
        refreshControl={<RefreshControl refreshing={roster.isFetching} onRefresh={() => roster.refetch()} tintColor={mt} />}
      >
        <View style={[s.headerRow, { flexDirection: rowDir }]}>
          <Image source={COACH.avatar} style={[s.avatar, { borderColor: pr }]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.heading, { color: fg, textAlign: align }]}>{t('athletes')}</Text>
            <Text style={[s.sub, { color: mt, textAlign: align }]}>{user?.name ? `Coach ${user.name}` : t('athletesSub')}</Text>
          </View>
        </View>

        {/* Invite */}
        <View style={[s.card, card]}>
          <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{t('inviteAthlete')}</Text>
          <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{t('inviteHint')}</Text>
          {issued && (
            <View style={[s.codeBox, { borderColor: pr, backgroundColor: colors.primarySoft }]}>
              <Text style={[s.code, { color: fg }]} selectable>{issued.code}</Text>
              <Text style={[s.codeHint, { color: mt }]}>{t('expires', { date: new Date(issued.expiresAt).toLocaleDateString() })}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.btn, { backgroundColor: pr }]}
            onPress={() => createInvite.mutate()}
            disabled={createInvite.isPending}
            activeOpacity={0.85}
          >
            {createInvite.isPending
              ? <ActivityIndicator color={colors.primaryInk} />
              : <Text style={[s.btnText, { color: colors.primaryInk }]}>{issued ? t('generateAnother') : t('generateCode')}</Text>}
          </TouchableOpacity>
        </View>

        {/* Roster */}
        {roster.isLoading ? (
          <ActivityIndicator color={mt} style={{ marginTop: 20 }} />
        ) : roster.isError ? (
          <Text style={[s.empty, { color: colors.error }]}>{roster.error.message}</Text>
        ) : rows.length === 0 ? (
          <Text style={[s.empty, { color: mt, textAlign: align }]}>{t('noAthletes')}</Text>
        ) : (
          rows.map((r) => {
            const ago = daysSince(r.lastWorkoutDate);
            const stale = ago === null || ago > 4;
            return (
              <TouchableOpacity
                key={r.linkId}
                style={[s.card, card]}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: String(r.userId), name: r.name || r.email || 'Athlete' } } as any)}
              >
                <View style={[s.athleteRow, { flexDirection: rowDir }]}>
                  <View style={[s.initial, { backgroundColor: colors.surface3 }]}>
                    <Text style={[s.initialText, { color: fg }]}>{(r.name || r.email || '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: fg, textAlign: align }]}>{r.name || r.email || 'Athlete'}</Text>
                    <Text style={[s.meta, { color: stale ? colors.warningStrong : colors.successStrong, textAlign: align }]}>
                      {t('lastWorkout')}: {ago === null ? t('never') : ago === 0 ? t('today') : `${ago}d`}
                      {'  ·  '}{r.workoutsLast7} {t('workoutsShort')} {t('thisWeek')}
                    </Text>
                  </View>
                  {r.unread > 0 && (
                    <View style={[s.badge, { backgroundColor: pr }]}>
                      <Text style={[s.badgeText, { color: colors.primaryInk }]}>{r.unread}</Text>
                    </View>
                  )}
                </View>
                <View style={[s.chips, { flexDirection: rowDir }]}>
                  <Text style={[s.chip, { color: r.workoutPlanName ? pr : mt, borderColor: r.workoutPlanName ? colors.primaryEdge : colors.border }]} numberOfLines={1}>
                    🏋️ {r.workoutPlanName ?? t('noPlanYet')}
                  </Text>
                  <Text style={[s.chip, { color: r.mealPlanName ? pr : mt, borderColor: r.mealPlanName ? colors.primaryEdge : colors.border }]} numberOfLines={1}>
                    🍽️ {r.mealPlanName ?? t('noPlanYet')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 110, gap: 14 },
  headerRow: { alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  heading: { fontSize: 28, fontWeight: '700' },
  sub: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 19 },
  codeBox: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 4, marginTop: 4 },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 6 },
  codeHint: { fontSize: 11 },
  btn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 20, paddingHorizontal: 4 },
  athleteRow: { alignItems: 'center', gap: 12 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 18, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  chips: { gap: 8, marginTop: 6 },
  chip: { flex: 1, fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
});
