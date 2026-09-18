// ============================================================
// ATHLETES (coach home) — the coach's command centre.
//   · Today at a glance: trained / meals logged / need attention / unread
//   · Search + filter chips (All · Attention · No plan)
//   · Roster sorted by triage (server decides), each row showing the one
//     reason the athlete needs a look, this week's sessions vs plan,
//     weight trend and whether meals were logged today.
//   · Invite code + message-everyone live in the header row.
// ============================================================
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COACH } from '@/constants/coach';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import type { RosterRow } from '@/shared/coach-types';

type Filter = 'all' | 'attention' | 'noplan';

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
}

export default function AthletesTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bcOpen, setBcOpen] = useState(false);
  const [bcText, setBcText] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const roster = trpc.coach.roster.useQuery(undefined, { refetchInterval: 30000 });
  useFocusEffect(useCallback(() => { roster.refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const createInvite = trpc.trainerLink.createInvite.useMutation({
    onSuccess: (d) => setIssued(d),
    onError: (e) => Alert.alert(t('inviteAthlete'), e.message),
  });
  const broadcast = trpc.coach.broadcast.useMutation({
    onSuccess: (d) => { setBcOpen(false); setBcText(''); Alert.alert('✓', t('broadcastSent', { n: d.sent })); },
    onError: (e) => Alert.alert(t('broadcast'), e.message),
  });

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const card = { backgroundColor: colors.surface, borderColor: colors.cardBorder };
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const rows: RosterRow[] = roster.data ?? [];

  const stats = useMemo(() => ({
    total: rows.length,
    trained: rows.filter((r) => r.trainedToday).length,
    meals: rows.filter((r) => r.loggedNutritionToday).length,
    attention: rows.filter((r) => r.attention === 'attention').length,
    unread: rows.reduce((a, r) => a + r.unread, 0),
  }), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'attention' && r.attention === 'ok') return false;
      if (filter === 'noplan' && (r.workoutPlanName || r.mealPlanName)) return false;
      if (q && !(`${r.name} ${r.email ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, query, filter]);

  const reasonText = (r: RosterRow): string => {
    switch (r.attentionReason) {
      case 'no_plan': return t('reasonNoPlan');
      case 'never_trained': return t('reasonNeverTrained');
      case 'inactive': return t('reasonInactive');
      case 'unread': return t('reasonUnread');
      case 'behind_plan': return t('reasonBehind');
      default: return t('onTrack');
    }
  };
  const tone = (a: RosterRow['attention']) => a === 'attention' ? colors.error : a === 'watch' ? colors.warningStrong : colors.successStrong;

  const filters: Array<{ key: Filter; label: string; n?: number }> = [
    { key: 'all', label: t('filterAll'), n: rows.length },
    { key: 'attention', label: t('filterAttention'), n: rows.filter((r) => r.attention !== 'ok').length },
    { key: 'noplan', label: t('filterNoPlan'), n: rows.filter((r) => !r.workoutPlanName && !r.mealPlanName).length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: Platform.OS === 'web' ? 16 : insets.top + 8 }]}
        refreshControl={<RefreshControl refreshing={roster.isFetching} onRefresh={() => roster.refetch()} tintColor={mt} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[s.headerRow, { flexDirection: rowDir }]}>
          <Image source={COACH.avatar} style={[s.avatar, { borderColor: pr }]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.heading, { color: fg, textAlign: align }]}>{t('athletes')}</Text>
            <Text style={[s.sub, { color: mt, textAlign: align }]}>{user?.name ? t('coachName', { name: user.name }) : t('athletesSub')}</Text>
          </View>
        </View>

        {/* Today at a glance */}
        <View style={[s.card, card]}>
          <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{t('todayAtAGlance')}</Text>
          <View style={[s.statRow, { flexDirection: rowDir }]}>
            <Stat v={`${stats.trained}/${stats.total}`} l={t('trainedToday')} c={colors.successStrong} bg={colors.surface3} mt={mt} />
            <Stat v={`${stats.meals}/${stats.total}`} l={t('mealsLoggedToday')} c={pr} bg={colors.surface3} mt={mt} />
            <Stat v={String(stats.attention)} l={t('needAttention')} c={stats.attention ? colors.error : colors.successStrong} bg={colors.surface3} mt={mt} />
            <Stat v={String(stats.unread)} l={t('unreadShort')} c={stats.unread ? colors.warningStrong : mt} bg={colors.surface3} mt={mt} />
          </View>
        </View>

        {/* Actions */}
        <View style={[s.actions, { flexDirection: rowDir }]}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: pr }]} onPress={() => { setInviteOpen(true); if (!issued) createInvite.mutate(); }} activeOpacity={0.85}>
            <Text style={[s.actionText, { color: colors.primaryInk }]}>＋ {t('inviteAthlete')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryEdge }]} onPress={() => setBcOpen(true)} activeOpacity={0.85} disabled={rows.length === 0}>
            <Text style={[s.actionText, { color: rows.length ? pr : mt }]}>📣 {t('broadcast')}</Text>
          </TouchableOpacity>
        </View>

        {/* Search + filters */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('searchAthletes')}
          placeholderTextColor={mt}
          style={[s.search, { color: fg, backgroundColor: colors.surface, borderColor: colors.border, textAlign: align }]}
          autoCorrect={false}
        />
        <View style={[s.chips, { flexDirection: rowDir }]}>
          {filters.map((f) => {
            const on = filter === f.key;
            return (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[s.chip, { borderColor: on ? pr : colors.border, backgroundColor: on ? colors.primarySoft : 'transparent' }]} activeOpacity={0.8}>
                <Text style={[s.chipText, { color: on ? pr : mt }]}>{f.label}{f.n != null ? ` · ${f.n}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Roster */}
        {roster.isLoading ? (
          <ActivityIndicator color={mt} style={{ marginTop: 20 }} />
        ) : roster.isError ? (
          <Text style={[s.empty, { color: colors.error }]}>{roster.error.message}</Text>
        ) : rows.length === 0 ? (
          <Text style={[s.empty, { color: mt, textAlign: align }]}>{t('noAthletes')}</Text>
        ) : visible.length === 0 ? (
          <Text style={[s.empty, { color: mt, textAlign: align }]}>{t('noMatches')}</Text>
        ) : (
          visible.map((r) => {
            const ago = daysSince(r.lastWorkoutDate);
            const msgH = hoursSince(r.lastMessageAt);
            const done = r.workoutsLast7;
            const planned = r.plannedDaysPerWeek;
            const displayName = r.name || r.email || t('athleteFallback');
            return (
              <TouchableOpacity
                key={r.linkId}
                style={[s.card, card, r.attention === 'attention' && { borderColor: colors.error }]}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: String(r.userId), name: displayName } } as any)}
              >
                <View style={[s.athleteRow, { flexDirection: rowDir }]}>
                  <View style={[s.initial, { backgroundColor: colors.surface3 }]}>
                    <Text style={[s.initialText, { color: fg }]}>{displayName.slice(0, 1).toUpperCase()}</Text>
                    <View style={[s.dot, { backgroundColor: tone(r.attention), borderColor: colors.surface }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, { color: fg, textAlign: align }]} numberOfLines={1}>{displayName}</Text>
                    <Text style={[s.reason, { color: tone(r.attention), textAlign: align }]} numberOfLines={1}>{reasonText(r)}</Text>
                  </View>
                  {r.unread > 0 && (
                    <View style={[s.badge, { backgroundColor: pr }]}>
                      <Text style={[s.badgeText, { color: colors.primaryInk }]}>{r.unread}</Text>
                    </View>
                  )}
                </View>

                {/* Week pills */}
                {planned > 0 ? (
                  <View style={[s.pillRow, { flexDirection: rowDir }]}>
                    {Array.from({ length: Math.max(planned, done) }).map((_, i) => (
                      <View key={i} style={[s.pill, { backgroundColor: i < done ? colors.successStrong : colors.surface3, borderColor: i < planned ? colors.border : 'transparent' }]} />
                    ))}
                    <Text style={[s.pillLabel, { color: mt }]}>{t('weekProgress', { done, planned })}</Text>
                  </View>
                ) : null}

                {/* Signals */}
                <View style={[s.signals, { flexDirection: rowDir }]}>
                  <Text style={[s.signal, { color: ago !== null && ago <= 2 ? colors.successStrong : colors.warningStrong }]} numberOfLines={1}>
                    🏋️ {ago === null ? t('never') : ago === 0 ? t('today') : t('daysAgo', { n: ago })}
                  </Text>
                  <Text style={[s.signal, { color: r.loggedNutritionToday ? colors.successStrong : mt }]} numberOfLines={1}>
                    🍽️ {r.loggedNutritionToday ? t('logged') : t('notYet')}
                  </Text>
                  <Text style={[s.signal, { color: r.weightDelta30 == null ? mt : r.weightDelta30 < 0 ? colors.successStrong : fg }]} numberOfLines={1}>
                    ⚖️ {r.weightDelta30 == null ? '—' : r.weightDelta30 === 0 ? t('weightFlat') : r.weightDelta30 > 0 ? t('weightUp', { kg: r.weightDelta30 }) : t('weightDown', { kg: Math.abs(r.weightDelta30) })}
                  </Text>
                  <Text style={[s.signal, { color: mt }]} numberOfLines={1}>
                    💬 {msgH === null ? '—' : msgH < 24 ? `${msgH}h` : t('daysAgo', { n: Math.floor(msgH / 24) })}
                  </Text>
                </View>

                <View style={[s.chipsRow, { flexDirection: rowDir }]}>
                  <Text style={[s.planChip, { color: r.workoutPlanName ? pr : mt, borderColor: r.workoutPlanName ? colors.primaryEdge : colors.border }]} numberOfLines={1}>
                    🏋️ {r.workoutPlanName ?? t('noPlanYet')}
                  </Text>
                  <Text style={[s.planChip, { color: r.mealPlanName ? pr : mt, borderColor: r.mealPlanName ? colors.primaryEdge : colors.border }]} numberOfLines={1}>
                    🍽️ {r.mealPlanName ?? t('noPlanYet')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Invite sheet */}
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <View style={s.backdrop}>
          <View style={[s.sheet, card]}>
            <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{t('inviteAthlete')}</Text>
            <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{t('inviteHint')}</Text>
            <View style={[s.codeBox, { borderColor: pr, backgroundColor: colors.primarySoft }]}>
              {createInvite.isPending && !issued ? <ActivityIndicator color={pr} /> : (
                <>
                  <Text style={[s.code, { color: fg }]} selectable>{issued?.code ?? '········'}</Text>
                  {issued && <Text style={[s.codeHint, { color: mt }]}>{t('expires', { date: new Date(issued.expiresAt).toLocaleDateString() })}</Text>}
                </>
              )}
            </View>
            <View style={[s.sheetBtns, { flexDirection: rowDir }]}>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.surface3, flex: 1 }]} onPress={() => createInvite.mutate()} disabled={createInvite.isPending} activeOpacity={0.85}>
                <Text style={[s.btnText, { color: fg }]}>{t('generateAnother')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: pr, flex: 1 }]} onPress={() => setInviteOpen(false)} activeOpacity={0.85}>
                <Text style={[s.btnText, { color: colors.primaryInk }]}>{t('back')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Broadcast sheet */}
      <Modal visible={bcOpen} transparent animationType="fade" onRequestClose={() => setBcOpen(false)}>
        <View style={s.backdrop}>
          <View style={[s.sheet, card]}>
            <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>📣 {t('broadcast')}</Text>
            <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{t('broadcastHint')}</Text>
            <TextInput
              value={bcText}
              onChangeText={setBcText}
              placeholder={t('broadcastPlaceholder')}
              placeholderTextColor={mt}
              multiline
              style={[s.bcInput, { color: fg, backgroundColor: colors.surface3, borderColor: colors.border, textAlign: align }]}
            />
            <View style={[s.sheetBtns, { flexDirection: rowDir }]}>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.surface3, flex: 1 }]} onPress={() => setBcOpen(false)} activeOpacity={0.85}>
                <Text style={[s.btnText, { color: fg }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: pr, flex: 1, opacity: bcText.trim() ? 1 : 0.5 }]} onPress={() => broadcast.mutate({ body: bcText })} disabled={!bcText.trim() || broadcast.isPending} activeOpacity={0.85}>
                {broadcast.isPending ? <ActivityIndicator color={colors.primaryInk} /> : <Text style={[s.btnText, { color: colors.primaryInk }]}>{t('send')} · {rows.length}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ v, l, c, bg, mt }: { v: string; l: string; c: string; bg: string; mt: string }) {
  return (
    <View style={[s.stat, { backgroundColor: bg }]}>
      <Text style={[s.statV, { color: c }]}>{v}</Text>
      <Text style={[s.statL, { color: mt }]} numberOfLines={2}>{l}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 110, gap: 12 },
  headerRow: { alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  heading: { fontSize: 28, fontWeight: '700' },
  sub: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 19 },
  statRow: { gap: 8 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  statV: { fontSize: 20, fontWeight: '800' },
  statL: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  actions: { gap: 10 },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '700' },
  search: { height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  chips: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 20, paddingHorizontal: 4 },
  athleteRow: { alignItems: 'center', gap: 12 },
  initial: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 18, fontWeight: '800' },
  dot: { position: 'absolute', right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  reason: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  pillRow: { alignItems: 'center', gap: 4 },
  pill: { width: 18, height: 8, borderRadius: 4, borderWidth: 1 },
  pillLabel: { fontSize: 11, marginHorizontal: 6 },
  signals: { flexWrap: 'wrap', gap: 10 },
  signal: { fontSize: 11, fontWeight: '600' },
  chipsRow: { gap: 8 },
  planChip: { flex: 1, fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  sheet: { gap: 10 },
  sheetBtns: { gap: 10, marginTop: 4 },
  codeBox: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 4, marginTop: 4, minHeight: 72, justifyContent: 'center' },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 6 },
  codeHint: { fontSize: 11 },
  btn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 14, fontWeight: '700' },
  bcInput: { minHeight: 100, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, textAlignVertical: 'top' },
});
