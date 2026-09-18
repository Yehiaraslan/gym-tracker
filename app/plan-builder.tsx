// ============================================================
// PLAN BUILDER (coach) — author a workout plan for one athlete.
// Start blank or from a template, add sessions + exercises, map
// the week, assign. Assigning archives the previous active plan.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Chip, Field, NumField } from '@/components/coach/form-fields';
import { useColors } from '@/hooks/use-colors';
import { PROGRAM_TEMPLATES } from '@/lib/custom-program-store';
import { EXERCISE_LIBRARY } from '@/lib/data/exercise-library';
import { useI18n } from '@/lib/i18n';
import { PROGRAM_SESSIONS } from '@/lib/training-program';
import { trpc } from '@/lib/trpc';
import { emptyWorkoutPlan, type CoachPlanExercise, type CoachPlanSession, type CoachWorkoutPlanBody, type WeekDay } from '@/shared/coach-types';

const DAYS: WeekDay[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other'];

function bodyPartToGroup(bp: string): CoachPlanExercise['muscleGroup'] {
  if (bp === 'Legs') return 'lower';
  if (bp === 'Core') return 'core';
  return 'upper';
}

/** Every exercise name the app already knows, for autocomplete. */
const KNOWN: Array<{ name: string; bodyPart: string; category: 'compound' | 'isolation' }> = (() => {
  const map = new Map<string, { name: string; bodyPart: string; category: 'compound' | 'isolation' }>();
  const add = (e: { name: string; bodyPart: string; category: 'compound' | 'isolation' }) => { if (!map.has(e.name)) map.set(e.name, e); };
  Object.values(PROGRAM_SESSIONS).forEach((list) => list.forEach((e) => add({ name: e.name, bodyPart: e.bodyPart, category: e.category })));
  PROGRAM_TEMPLATES.forEach((tpl) => Object.values(tpl.sessions).forEach((list) => list.forEach((e) => add({ name: e.name, bodyPart: e.bodyPart, category: e.category }))));
  EXERCISE_LIBRARY.forEach((e) => add({ name: e.name, bodyPart: 'Other', category: e.category === 'isolation' ? 'isolation' : 'compound' }));
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
})();

function newExercise(name = ''): CoachPlanExercise {
  return { name, sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, notes: '', muscleGroup: 'upper', bodyPart: 'Other', category: 'compound' };
}

function nextSessionId(sessions: CoachPlanSession[]): string {
  let n = sessions.length + 1;
  while (sessions.some((s) => s.id === `day-${n}`)) n++;
  return `day-${n}`;
}

export default function PlanBuilder() {
  const { traineeId, name } = useLocalSearchParams<{ traineeId: string; name?: string }>();
  const tid = Number(traineeId);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const existing = trpc.coach.traineePlans.useQuery({ traineeId: tid }, { enabled: tid > 0 });
  const [plan, setPlan] = useState<CoachWorkoutPlanBody>(emptyWorkoutPlan());
  const [seeded, setSeeded] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ sessionId: string; query: string } | null>(null);

  useEffect(() => {
    if (seeded || !existing.data) return;
    const w = existing.data.workoutPlan;
    if (w) {
      setPlan({ name: w.name, description: w.description, durationWeeks: w.durationWeeks, sessions: w.sessions, weeklySchedule: w.weeklySchedule, notes: w.notes });
      setOpenSession(w.sessions[0]?.id ?? null);
    }
    setSeeded(true);
  }, [existing.data, seeded]);

  const assign = trpc.coach.assignWorkoutPlan.useMutation({
    onSuccess: () => {
      utils.coach.traineePlans.invalidate({ traineeId: tid });
      utils.coach.roster.invalidate();
      Alert.alert('✓', `${plan.name} → ${name ?? 'athlete'}`);
      router.back();
    },
    onError: (e) => Alert.alert(t('assignPlan'), e.message),
  });

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const card = { backgroundColor: colors.surface, borderColor: colors.cardBorder };

  // ── mutators ──
  const update = (patch: Partial<CoachWorkoutPlanBody>) => setPlan((p) => ({ ...p, ...patch }));
  const updateSession = (id: string, patch: Partial<CoachPlanSession>) =>
    setPlan((p) => ({ ...p, sessions: p.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const updateExercise = (sid: string, idx: number, patch: Partial<CoachPlanExercise>) =>
    setPlan((p) => ({
      ...p,
      sessions: p.sessions.map((s) => (s.id === sid ? { ...s, exercises: s.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) } : s)),
    }));
  const removeExercise = (sid: string, idx: number) =>
    setPlan((p) => ({ ...p, sessions: p.sessions.map((s) => (s.id === sid ? { ...s, exercises: s.exercises.filter((_, i) => i !== idx) } : s)) }));
  const addSession = () => {
    const id = nextSessionId(plan.sessions);
    const sess: CoachPlanSession = { id, name: `Day ${plan.sessions.length + 1}`, exercises: [] };
    update({ sessions: [...plan.sessions, sess] });
    setOpenSession(id);
  };
  const removeSession = (id: string) => {
    const schedule = { ...plan.weeklySchedule };
    DAYS.forEach((d) => { if (schedule[d] === id) schedule[d] = 'rest'; });
    update({ sessions: plan.sessions.filter((s) => s.id !== id), weeklySchedule: schedule });
  };
  const cycleDay = (d: WeekDay) => {
    const options = ['rest', ...plan.sessions.map((s) => s.id)];
    const i = options.indexOf(plan.weeklySchedule[d]);
    update({ weeklySchedule: { ...plan.weeklySchedule, [d]: options[(i + 1) % options.length] } });
  };
  const loadTemplate = (tplId: string) => {
    const tpl = PROGRAM_TEMPLATES.find((x) => x.id === tplId);
    if (!tpl) return;
    const srcSessions = Object.keys(tpl.sessions).length ? tpl.sessions : PROGRAM_SESSIONS;
    const srcNames = Object.keys(tpl.sessionNames).length ? tpl.sessionNames : { 'upper-a': 'Upper A', 'lower-a': 'Lower A', 'upper-b': 'Upper B', 'lower-b': 'Lower B' };
    const sessions: CoachPlanSession[] = Object.entries(srcSessions).map(([id, list]) => ({
      id, name: srcNames[id] ?? id,
      exercises: list.map((e) => ({ name: e.name, sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, restSeconds: e.restSeconds, notes: e.notes, muscleGroup: e.muscleGroup, bodyPart: e.bodyPart, category: e.category })),
    }));
    const weeklySchedule = { ...emptyWorkoutPlan().weeklySchedule };
    DAYS.forEach((d) => { weeklySchedule[d] = tpl.weeklySchedule[d] ?? 'rest'; });
    setPlan({ name: tpl.name, description: tpl.description, durationWeeks: 4, sessions, weeklySchedule, notes: '' });
    setOpenSession(sessions[0]?.id ?? null);
  };

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!plan.name.trim()) out.push('Name the plan.');
    if (plan.sessions.length === 0) out.push('Add at least one session.');
    plan.sessions.forEach((s) => {
      if (s.exercises.length === 0) out.push(`${s.name}: add exercises.`);
      s.exercises.forEach((e) => { if (!e.name.trim()) out.push(`${s.name}: an exercise has no name.`); if (e.repsMax < e.repsMin) out.push(`${s.name}: ${e.name} reps max < min.`); });
    });
    if (!DAYS.some((d) => plan.weeklySchedule[d] !== 'rest')) out.push('Schedule at least one training day.');
    return out;
  }, [plan]);

  const suggestions = useMemo(() => {
    if (!picker) return [];
    const q = picker.query.trim().toLowerCase();
    return KNOWN.filter((k) => !q || k.name.toLowerCase().includes(q)).slice(0, 12);
  }, [picker]);

  const submit = () => {
    if (problems.length) { Alert.alert(t('assignPlan'), problems.join('\n')); return; }
    const clean: CoachWorkoutPlanBody = {
      ...plan,
      name: plan.name.trim(),
      sessions: plan.sessions.map((s) => ({ ...s, name: s.name.trim(), exercises: s.exercises.map((e) => ({ ...e, name: e.name.trim(), muscleGroup: bodyPartToGroup(e.bodyPart) })) })),
    };
    assign.mutate({ traineeId: tid, plan: clean });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 4, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.headerSide}><Text style={{ color: pr, fontSize: 16, fontWeight: '700' }}>‹ {t('back')}</Text></TouchableOpacity>
        <Text style={[s.title, { color: fg }]} numberOfLines={1}>{t('workoutPlanLabel')}{name ? ` · ${name}` : ''}</Text>
        <View style={s.headerSide} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          {existing.isLoading && !seeded ? <ActivityIndicator color={mt} /> : null}

          {/* Templates */}
          <View style={[s.card, card]}>
            <Text style={[s.cardTitle, { color: fg }]}>Start from a template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PROGRAM_TEMPLATES.map((tpl) => <Chip key={tpl.id} label={tpl.name} active={plan.name === tpl.name} onPress={() => loadTemplate(tpl.id)} />)}
            </ScrollView>
          </View>

          {/* Basics */}
          <View style={[s.card, card]}>
            <Field label="Plan name" value={plan.name} onChangeText={(v) => update({ name: v })} placeholder="e.g. Lean Bulk — Phase 1" />
            <Field label="Description" value={plan.description} onChangeText={(v) => update({ description: v })} placeholder="What this block is for" />
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
              <NumField label="Weeks" value={plan.durationWeeks} onChange={(v) => update({ durationWeeks: Math.max(1, Math.min(52, Math.round(v))) })} />
              <View style={{ flex: 1 }}><Field label="Coach notes" value={plan.notes} onChangeText={(v) => update({ notes: v })} placeholder="Tempo, warm-up, reminders…" /></View>
            </View>
          </View>

          {/* Week map */}
          <View style={[s.card, card]}>
            <Text style={[s.cardTitle, { color: fg }]}>Week</Text>
            <Text style={[s.hint, { color: mt }]}>Tap a day to cycle through Rest → sessions.</Text>
            {DAYS.map((d) => {
              const sid = plan.weeklySchedule[d];
              const sess = plan.sessions.find((x) => x.id === sid);
              return (
                <TouchableOpacity key={d} onPress={() => cycleDay(d)} activeOpacity={0.8}
                  style={[s.dayRow, { borderColor: sess ? colors.primaryEdge : colors.border, backgroundColor: sess ? colors.primarySoft : colors.surface2 }]}>
                  <Text style={[s.dayName, { color: mt }]}>{d.slice(0, 3)}</Text>
                  <Text style={[s.daySess, { color: sess ? pr : mt }]}>{sess?.name ?? 'Rest'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sessions */}
          {plan.sessions.map((sess) => {
            const open = openSession === sess.id;
            return (
              <View key={sess.id} style={[s.card, card]}>
                <TouchableOpacity onPress={() => setOpenSession(open ? null : sess.id)} style={s.sessHead} activeOpacity={0.8}>
                  <Text style={[s.cardTitle, { color: fg, flex: 1 }]}>{sess.name} <Text style={{ color: mt, fontSize: 12 }}>· {sess.exercises.length} ex</Text></Text>
                  <Text style={{ color: mt }}>{open ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {open && (
                  <>
                    <Field label="Session name" value={sess.name} onChangeText={(v) => updateSession(sess.id, { name: v })} />
                    {sess.exercises.map((e, idx) => (
                      <View key={idx} style={[s.exCard, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[s.exIdx, { color: pr }]}>{idx + 1}</Text>
                          <TextInput
                            style={[s.exName, { color: fg }]}
                            value={e.name}
                            onChangeText={(v) => updateExercise(sess.id, idx, { name: v })}
                            placeholder="Exercise name"
                            placeholderTextColor={mt}
                          />
                          <TouchableOpacity onPress={() => removeExercise(sess.id, idx)} hitSlop={8}><Text style={{ color: colors.error, fontSize: 18 }}>×</Text></TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          <NumField label="Sets" width={58} value={e.sets} onChange={(v) => updateExercise(sess.id, idx, { sets: Math.max(1, Math.round(v)) })} />
                          <NumField label="Min" width={58} value={e.repsMin} onChange={(v) => updateExercise(sess.id, idx, { repsMin: Math.max(1, Math.round(v)) })} />
                          <NumField label="Max" width={58} value={e.repsMax} onChange={(v) => updateExercise(sess.id, idx, { repsMax: Math.max(1, Math.round(v)) })} />
                          <NumField label="Rest" suffix="s" width={70} value={e.restSeconds} onChange={(v) => updateExercise(sess.id, idx, { restSeconds: Math.max(0, Math.round(v)) })} />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {BODY_PARTS.map((bp) => <Chip key={bp} label={bp} active={e.bodyPart === bp} onPress={() => updateExercise(sess.id, idx, { bodyPart: bp, muscleGroup: bodyPartToGroup(bp) })} />)}
                        </ScrollView>
                        <TextInput
                          style={[s.notes, { color: fg, borderColor: colors.border }]}
                          value={e.notes}
                          onChangeText={(v) => updateExercise(sess.id, idx, { notes: v })}
                          placeholder="Cue / note for the athlete"
                          placeholderTextColor={mt}
                        />
                      </View>
                    ))}

                    {picker?.sessionId === sess.id ? (
                      <View style={[s.picker, { borderColor: colors.primaryEdge, backgroundColor: colors.surface2 }]}>
                        <TextInput
                          style={[s.exName, { color: fg, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 6 }]}
                          autoFocus
                          value={picker.query}
                          onChangeText={(q) => setPicker({ sessionId: sess.id, query: q })}
                          placeholder="Search or type a new exercise"
                          placeholderTextColor={mt}
                          onSubmitEditing={() => {
                            const q = picker.query.trim();
                            if (!q) return;
                            updateSession(sess.id, { exercises: [...sess.exercises, newExercise(q)] });
                            setPicker(null);
                          }}
                        />
                        {suggestions.map((k) => (
                          <TouchableOpacity key={k.name} style={[s.sugg, { borderColor: colors.border }]} activeOpacity={0.7}
                            onPress={() => { updateSession(sess.id, { exercises: [...sess.exercises, { ...newExercise(k.name), bodyPart: k.bodyPart, category: k.category, muscleGroup: bodyPartToGroup(k.bodyPart) }] }); setPicker(null); }}>
                            <Text style={{ color: fg, fontSize: 14 }}>{k.name}</Text>
                            <Text style={{ color: mt, fontSize: 11 }}>{k.bodyPart}</Text>
                          </TouchableOpacity>
                        ))}
                        {picker.query.trim() && !suggestions.some((k) => k.name.toLowerCase() === picker.query.trim().toLowerCase()) ? (
                          <TouchableOpacity style={[s.sugg, { borderColor: colors.border }]} activeOpacity={0.7}
                            onPress={() => { updateSession(sess.id, { exercises: [...sess.exercises, newExercise(picker.query.trim())] }); setPicker(null); }}>
                            <Text style={{ color: pr, fontSize: 14, fontWeight: '700' }}>+ Add “{picker.query.trim()}”</Text>
                          </TouchableOpacity>
                        ) : null}
                        <Btn label={t('cancel')} kind="ghost" small onPress={() => setPicker(null)} />
                      </View>
                    ) : (
                      <Btn label="+ Add exercise" kind="ghost" small onPress={() => setPicker({ sessionId: sess.id, query: '' })} />
                    )}
                    <Btn label="Remove session" kind="danger" small onPress={() => removeSession(sess.id)} />
                  </>
                )}
              </View>
            );
          })}
          <Btn label="+ Add session" kind="ghost" onPress={addSession} />

          {problems.length > 0 && (
            <Text style={[s.hint, { color: colors.warningStrong }]}>{problems[0]}</Text>
          )}
          <Btn label={assign.isPending ? '…' : `${t('assignPlan')} → ${name ?? ''}`} onPress={submit} disabled={assign.isPending || problems.length > 0} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1 },
  headerSide: { width: 80 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  container: { padding: 16, paddingBottom: 80, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  dayName: { fontSize: 13, fontWeight: '700', width: 40 },
  daySess: { fontSize: 14, fontWeight: '700' },
  sessHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  exIdx: { fontSize: 12, fontWeight: '800', width: 16 },
  exName: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 4 },
  notes: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  picker: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  sugg: { borderBottomWidth: 1, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
