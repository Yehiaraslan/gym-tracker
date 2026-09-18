// ============================================================
// ATHLETE DETAIL (coach view) — Progress · Plan · Meals for one
// trainee. Everything here is served only while the link is
// active (assertCanCoach on the server).
// ============================================================
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { macroCalories } from '@/shared/coach-types';

type Seg = 'progress' | 'plan' | 'meals';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export default function AthleteScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const traineeId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const [seg, setSeg] = useState<Seg>('progress');

  const progress = trpc.coach.traineeProgress.useQuery({ traineeId }, { enabled: traineeId > 0 });
  const plans = trpc.coach.traineePlans.useQuery({ traineeId }, { enabled: traineeId > 0 });
  useFocusEffect(useCallback(() => { progress.refetch(); plans.refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const card = { backgroundColor: colors.surface, borderColor: colors.cardBorder };
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const p = progress.data;
  const displayName = p?.trainee.name || name || 'Athlete';

  const segs: Array<{ key: Seg; label: string }> = [
    { key: 'progress', label: t('progress') },
    { key: 'plan', label: t('plan') },
    { key: 'meals', label: t('meals') },
  ];

  const weights = p?.bodyWeight.filter((b) => b.weightKg != null) ?? [];
  const wMin = weights.length ? Math.min(...weights.map((w) => w.weightKg!)) : 0;
  const wMax = weights.length ? Math.max(...weights.map((w) => w.weightKg!)) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 4, borderBottomColor: colors.border, flexDirection: rowDir }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.headerSide}>
          <Text style={{ color: pr, fontSize: 16, fontWeight: '700' }}>{isRTL ? '›' : '‹'} {t('back')}</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: fg }]} numberOfLines={1}>{displayName}</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/chat/[peerId]', params: { peerId: String(traineeId), name: displayName } } as any)}
          hitSlop={10}
          style={[s.headerSide, { alignItems: 'flex-end' }]}
        >
          <Text style={{ color: pr, fontSize: 14, fontWeight: '700' }}>💬 {t('chat')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.segRow, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: rowDir }]}>
        {segs.map((sg) => (
          <TouchableOpacity key={sg.key} style={[s.segBtn, seg === sg.key && { backgroundColor: pr }]} onPress={() => setSeg(sg.key)} activeOpacity={0.85}>
            <Text style={[s.segText, { color: seg === sg.key ? colors.primaryInk : mt }]}>{sg.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={progress.isFetching} onRefresh={() => { progress.refetch(); plans.refetch(); }} tintColor={mt} />}
      >
        {progress.isLoading ? (
          <ActivityIndicator color={mt} style={{ marginTop: 30 }} />
        ) : progress.isError ? (
          <Text style={[s.err, { color: colors.error }]}>{progress.error.message}</Text>
        ) : seg === 'progress' && p ? (
          <>
            <View style={[s.statRow, { flexDirection: rowDir }]}>
              {[
                { v: p.workoutsLast7, l: t('thisWeek') },
                { v: p.workoutsLast30, l: '30d' },
                { v: p.streak?.currentStreak ?? 0, l: t('streakLabel') },
              ].map((st) => (
                <View key={st.l} style={[s.stat, card]}>
                  <Text style={[s.statV, { color: pr }]}>{st.v}</Text>
                  <Text style={[s.statL, { color: mt }]} numberOfLines={1}>{st.l}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.meta, { color: p.trainee.photosShared ? colors.successStrong : mt, textAlign: align }]}>
              📷 {p.trainee.photosShared ? t('photosShared') : t('photosNotShared')}
            </Text>

            <Section title={t('bodyWeight')} card={card} fg={fg} align={align}>
              {weights.length === 0 ? <Empty text={t('noData')} color={mt} /> : (
                <>
                  <View style={[s.spark, { flexDirection: rowDir }]}>
                    {weights.slice(-20).map((w, i) => {
                      const h = wMax === wMin ? 0.6 : 0.2 + 0.8 * ((w.weightKg! - wMin) / (wMax - wMin));
                      return <View key={i} style={[s.sparkBar, { height: `${Math.round(h * 100)}%`, backgroundColor: pr }]} />;
                    })}
                  </View>
                  <Text style={[s.meta, { color: mt, textAlign: align }]}>
                    {weights[0].date} {weights[0].weightKg!.toFixed(1)} kg → {weights[weights.length - 1].date} {weights[weights.length - 1].weightKg!.toFixed(1)} kg
                  </Text>
                </>
              )}
            </Section>

            <Section title={`🏋️ ${t('workoutsShort')}`} card={card} fg={fg} align={align}>
              {p.workouts.length === 0 ? <Empty text={t('noData')} color={mt} /> : p.workouts.slice(0, 10).map((w) => (
                <View key={w.id} style={[s.line, { borderColor: colors.border, flexDirection: rowDir }]}>
                  <Text style={[s.lineMain, { color: fg, textAlign: align }]}>{w.date} · {w.sessionType}</Text>
                  <Text style={[s.lineSub, { color: w.completed ? colors.successStrong : colors.warningStrong }]}>
                    {w.completed ? '✓' : '…'} {w.exerciseCount} ex{w.totalVolumeKg ? ` · ${Math.round(w.totalVolumeKg)} kg` : ''}
                  </Text>
                </View>
              ))}
            </Section>

            <Section title={t('nutritionAdherence')} card={card} fg={fg} align={align}>
              {p.nutrition.length === 0 ? <Empty text={t('noData')} color={mt} /> : p.nutrition.map((n) => {
                const pct = n.targetCalories ? Math.round((n.calories / n.targetCalories) * 100) : null;
                return (
                  <View key={n.date} style={[s.line, { borderColor: colors.border, flexDirection: rowDir }]}>
                    <Text style={[s.lineMain, { color: fg, textAlign: align }]}>{n.date}</Text>
                    <Text style={[s.lineSub, { color: pct == null ? mt : pct >= 90 && pct <= 110 ? colors.successStrong : colors.warningStrong }]}>
                      {n.calories} kcal · P {n.protein}g{pct != null ? ` · ${pct}%` : ''}
                    </Text>
                  </View>
                );
              })}
            </Section>

            <Section title={t('personalRecords')} card={card} fg={fg} align={align}>
              {p.personalRecords.length === 0 ? <Empty text={t('noData')} color={mt} /> : p.personalRecords.map((r, i) => (
                <View key={i} style={[s.line, { borderColor: colors.border, flexDirection: rowDir }]}>
                  <Text style={[s.lineMain, { color: fg, textAlign: align }]}>{r.exerciseName}</Text>
                  <Text style={[s.lineSub, { color: pr }]}>{r.weightKg} kg × {r.reps}</Text>
                </View>
              ))}
            </Section>
          </>
        ) : seg === 'plan' ? (
          <>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: pr }]}
              onPress={() => router.push({ pathname: '/plan-builder', params: { traineeId: String(traineeId), name: displayName } } as any)}
              activeOpacity={0.85}
            >
              <Text style={[s.btnText, { color: colors.primaryInk }]}>{plans.data?.workoutPlan ? t('editPlan') : t('assignPlan')}</Text>
            </TouchableOpacity>
            {plans.data?.workoutPlan ? (
              <>
                <View style={[s.card, card]}>
                  <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{plans.data.workoutPlan.name}</Text>
                  {!!plans.data.workoutPlan.description && <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{plans.data.workoutPlan.description}</Text>}
                  <Text style={[s.meta, { color: mt, textAlign: align }]}>{plans.data.workoutPlan.durationWeeks} wk · {new Date(plans.data.workoutPlan.createdAt).toLocaleDateString()}</Text>
                  <View style={{ gap: 4, marginTop: 6 }}>
                    {DAYS.map((d) => {
                      const sid = plans.data!.workoutPlan!.weeklySchedule[d];
                      const sess = plans.data!.workoutPlan!.sessions.find((x) => x.id === sid);
                      return (
                        <View key={d} style={[{ flexDirection: rowDir, justifyContent: 'space-between' }]}>
                          <Text style={[s.lineMain, { color: mt }]}>{d.slice(0, 3)}</Text>
                          <Text style={[s.lineMain, { color: sess ? fg : mt, fontWeight: sess ? '700' : '400' }]}>{sess?.name ?? 'Rest'}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                {plans.data.workoutPlan.sessions.map((sess) => (
                  <View key={sess.id} style={[s.card, card]}>
                    <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{sess.name}</Text>
                    {sess.exercises.map((e, i) => (
                      <View key={i} style={[s.line, { borderColor: colors.border, flexDirection: rowDir }]}>
                        <Text style={[s.lineMain, { color: fg, textAlign: align }]}>{e.name}</Text>
                        <Text style={[s.lineSub, { color: mt }]}>{e.sets}×{e.repsMin}–{e.repsMax} · {e.restSeconds}s</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            ) : <Empty text={t('noPlanYet')} color={mt} />}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: pr }]}
              onPress={() => router.push({ pathname: '/meal-builder', params: { traineeId: String(traineeId), name: displayName } } as any)}
              activeOpacity={0.85}
            >
              <Text style={[s.btnText, { color: colors.primaryInk }]}>{plans.data?.mealPlan ? t('editMeals') : t('assignMeals')}</Text>
            </TouchableOpacity>
            {plans.data?.mealPlan ? (
              <>
                <View style={[s.card, card]}>
                  <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{plans.data.mealPlan.name}</Text>
                  {(['trainingDay', 'restDay'] as const).map((k) => {
                    const m = plans.data!.mealPlan![k];
                    return (
                      <View key={k} style={[s.line, { borderColor: colors.border, flexDirection: rowDir }]}>
                        <Text style={[s.lineMain, { color: mt, textAlign: align }]}>{k === 'trainingDay' ? 'Training day' : 'Rest day'}</Text>
                        <Text style={[s.lineSub, { color: fg }]}>{m.calories} kcal · P{m.protein} C{m.carbs} F{m.fat}</Text>
                      </View>
                    );
                  })}
                </View>
                {plans.data.mealPlan.meals.map((m) => {
                  const tot = m.foods.reduce((a, f) => ({ p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fat }), { p: 0, c: 0, f: 0 });
                  return (
                    <View key={m.mealNumber} style={[s.card, card]}>
                      <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{m.mealNumber}. {m.name}{m.time ? ` · ${m.time}` : ''}</Text>
                      {m.foods.map((f, i) => (
                        <View key={i} style={[s.line, { borderColor: colors.border, flexDirection: rowDir }]}>
                          <Text style={[s.lineMain, { color: fg, textAlign: align }]}>{f.foodName} ({f.servingGrams}g)</Text>
                          <Text style={[s.lineSub, { color: mt }]}>{f.calories} kcal</Text>
                        </View>
                      ))}
                      <Text style={[s.meta, { color: pr, textAlign: align }]}>{macroCalories(tot.p, tot.c, tot.f)} kcal · P{Math.round(tot.p)} C{Math.round(tot.c)} F{Math.round(tot.f)}</Text>
                      {!!m.notes && <Text style={[s.cardBody, { color: mt, textAlign: align }]}>{m.notes}</Text>}
                    </View>
                  );
                })}
              </>
            ) : <Empty text={t('noPlanYet')} color={mt} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children, card, fg, align }: { title: string; children: React.ReactNode; card: object; fg: string; align: 'left' | 'right' }) {
  return (
    <View style={[s.card, card]}>
      <Text style={[s.cardTitle, { color: fg, textAlign: align }]}>{title}</Text>
      {children}
    </View>
  );
}

function Empty({ text, color }: { text: string; color: string }) {
  return <Text style={[s.cardBody, { color }]}>{text}</Text>;
}

const s = StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1 },
  headerSide: { width: 90 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  segRow: { margin: 16, marginBottom: 4, borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13, fontWeight: '700' },
  container: { padding: 16, paddingBottom: 60, gap: 12 },
  err: { fontSize: 13 },
  statRow: { gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statV: { fontSize: 24, fontWeight: '800' },
  statL: { fontSize: 11, marginTop: 2 },
  meta: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 19 },
  spark: { height: 60, alignItems: 'flex-end', gap: 3 },
  sparkBar: { flex: 1, borderRadius: 2, minHeight: 4 },
  line: { justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  lineMain: { fontSize: 13, flex: 1 },
  lineSub: { fontSize: 12, fontWeight: '600' },
  btn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
});
