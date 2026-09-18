// ============================================================
// MEAL BUILDER (coach) — daily macro targets (training / rest)
// plus up to 5 meals with foods from the UAE database or typed
// in. Assigning archives the previous active meal plan.
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Field, NumField } from '@/components/coach/form-fields';
import { FoodSearch } from '@/components/food-search';
import { useColors } from '@/hooks/use-colors';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { emptyMealPlan, macroCalories, type CoachMeal, type CoachMealPlanBody, type MacroTargets } from '@/shared/coach-types';

const DEFAULT_MEALS: Array<Pick<CoachMeal, 'name' | 'time'>> = [
  { name: 'Breakfast', time: '08:00' }, { name: 'Lunch', time: '13:00' }, { name: 'Pre-workout', time: '17:00' },
  { name: 'Post-workout / Dinner', time: '20:30' }, { name: 'Before bed', time: '23:00' },
];

export default function MealBuilder() {
  const { traineeId, name } = useLocalSearchParams<{ traineeId: string; name?: string }>();
  const tid = Number(traineeId);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const existing = trpc.coach.traineePlans.useQuery({ traineeId: tid }, { enabled: tid > 0 });
  const [plan, setPlan] = useState<CoachMealPlanBody>(emptyMealPlan());
  const [seeded, setSeeded] = useState(false);
  const [foodFor, setFoodFor] = useState<number | null>(null);

  useEffect(() => {
    if (seeded || !existing.data) return;
    const m = existing.data.mealPlan;
    if (m) setPlan({ name: m.name, trainingDay: m.trainingDay, restDay: m.restDay, meals: m.meals, notes: m.notes });
    setSeeded(true);
  }, [existing.data, seeded]);

  const assign = trpc.coach.assignMealPlan.useMutation({
    onSuccess: () => {
      utils.coach.traineePlans.invalidate({ traineeId: tid });
      utils.coach.roster.invalidate();
      Alert.alert('✓', `${plan.name} → ${name ?? 'athlete'}`);
      router.back();
    },
    onError: (e) => Alert.alert(t('assignMeals'), e.message),
  });

  const fg = colors.foreground, mt = colors.muted, pr = colors.primary;
  const card = { backgroundColor: colors.surface, borderColor: colors.cardBorder };

  const update = (patch: Partial<CoachMealPlanBody>) => setPlan((p) => ({ ...p, ...patch }));
  const setTargets = (k: 'trainingDay' | 'restDay', patch: Partial<MacroTargets>) =>
    setPlan((p) => ({ ...p, [k]: { ...p[k], ...patch } }));
  const updateMeal = (n: number, patch: Partial<CoachMeal>) =>
    setPlan((p) => ({ ...p, meals: p.meals.map((m) => (m.mealNumber === n ? { ...m, ...patch } : m)) }));
  const addMeal = () => {
    const used = new Set(plan.meals.map((m) => m.mealNumber));
    const n = [1, 2, 3, 4, 5].find((x) => !used.has(x));
    if (!n) return;
    const d = DEFAULT_MEALS[n - 1];
    update({ meals: [...plan.meals, { mealNumber: n, name: d.name, time: d.time, foods: [], notes: '' }].sort((a, b) => a.mealNumber - b.mealNumber) });
  };
  const removeMeal = (n: number) => update({ meals: plan.meals.filter((m) => m.mealNumber !== n) });
  const removeFood = (n: number, idx: number) => {
    const m = plan.meals.find((x) => x.mealNumber === n);
    if (m) updateMeal(n, { foods: m.foods.filter((_, i) => i !== idx) });
  };

  const planTotals = useMemo(() => {
    const all = plan.meals.flatMap((m) => m.foods);
    const p = all.reduce((a, f) => a + f.protein, 0), c = all.reduce((a, f) => a + f.carbs, 0), f = all.reduce((a, f2) => a + f2.fat, 0);
    return { p: Math.round(p), c: Math.round(c), f: Math.round(f), kcal: macroCalories(p, c, f) };
  }, [plan.meals]);

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!plan.name.trim()) out.push('Name the meal plan.');
    plan.meals.forEach((m) => { if (!m.name.trim()) out.push(`Meal ${m.mealNumber} has no name.`); });
    return out;
  }, [plan]);

  const submit = () => {
    if (problems.length) { Alert.alert(t('assignMeals'), problems.join('\n')); return; }
    const clean: CoachMealPlanBody = {
      ...plan,
      name: plan.name.trim(),
      trainingDay: roundTargets(plan.trainingDay),
      restDay: roundTargets(plan.restDay),
      meals: plan.meals.map((m) => ({ ...m, name: m.name.trim() })),
    };
    assign.mutate({ traineeId: tid, plan: clean });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.header, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 4, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.headerSide}><Text style={{ color: pr, fontSize: 16, fontWeight: '700' }}>‹ {t('back')}</Text></TouchableOpacity>
        <Text style={[s.title, { color: fg }]} numberOfLines={1}>{t('mealPlanLabel')}{name ? ` · ${name}` : ''}</Text>
        <View style={s.headerSide} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          {existing.isLoading && !seeded ? <ActivityIndicator color={mt} /> : null}

          <View style={[s.card, card]}>
            <Field label="Plan name" value={plan.name} onChangeText={(v) => update({ name: v })} placeholder="e.g. Cut — 2,300 kcal" />
            <Field label="Coach notes" value={plan.notes} onChangeText={(v) => update({ notes: v })} placeholder="Hydration, timing, swaps allowed…" multiline />
          </View>

          {(['trainingDay', 'restDay'] as const).map((k) => {
            const m = plan[k];
            const fromMacros = macroCalories(m.protein, m.carbs, m.fat);
            return (
              <View key={k} style={[s.card, card]}>
                <Text style={[s.cardTitle, { color: fg }]}>{k === 'trainingDay' ? 'Training day targets' : 'Rest day targets'}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <NumField label="kcal" width={78} value={m.calories} onChange={(v) => setTargets(k, { calories: v })} />
                  <NumField label="Protein" suffix="g" width={78} value={m.protein} onChange={(v) => setTargets(k, { protein: v })} />
                  <NumField label="Carbs" suffix="g" width={78} value={m.carbs} onChange={(v) => setTargets(k, { carbs: v })} />
                  <NumField label="Fat" suffix="g" width={70} value={m.fat} onChange={(v) => setTargets(k, { fat: v })} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[s.hint, { color: Math.abs(fromMacros - m.calories) > 150 ? colors.warningStrong : mt }]}>Macros add up to {fromMacros} kcal</Text>
                  <Btn label="Use macros" kind="ghost" small onPress={() => setTargets(k, { calories: fromMacros })} />
                </View>
              </View>
            );
          })}

          {plan.meals.map((m) => {
            const tot = m.foods.reduce((a, f) => ({ p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fat }), { p: 0, c: 0, f: 0 });
            return (
              <View key={m.mealNumber} style={[s.card, card]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[s.mealNo, { backgroundColor: colors.primarySoft }]}><Text style={{ color: pr, fontWeight: '800' }}>{m.mealNumber}</Text></View>
                  <TextInput style={[s.mealName, { color: fg }]} value={m.name} onChangeText={(v) => updateMeal(m.mealNumber, { name: v })} placeholder="Meal name" placeholderTextColor={mt} />
                  <TextInput style={[s.mealTime, { color: mt, borderColor: colors.border }]} value={m.time} onChangeText={(v) => updateMeal(m.mealNumber, { time: v })} placeholder="HH:MM" placeholderTextColor={mt} />
                  <TouchableOpacity onPress={() => removeMeal(m.mealNumber)} hitSlop={8}><Text style={{ color: colors.error, fontSize: 18 }}>×</Text></TouchableOpacity>
                </View>
                {m.foods.map((f, i) => (
                  <View key={i} style={[s.foodRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: fg, fontSize: 14, fontWeight: '600' }}>{f.foodName} <Text style={{ color: mt, fontWeight: '400' }}>· {f.servingGrams}g</Text></Text>
                      <Text style={{ color: mt, fontSize: 11 }}>{f.calories} kcal · P{f.protein} C{f.carbs} F{f.fat}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeFood(m.mealNumber, i)} hitSlop={8}><Text style={{ color: colors.error, fontSize: 16 }}>×</Text></TouchableOpacity>
                  </View>
                ))}
                <Text style={[s.hint, { color: pr }]}>{macroCalories(tot.p, tot.c, tot.f)} kcal · P{Math.round(tot.p)} C{Math.round(tot.c)} F{Math.round(tot.f)}</Text>
                <TextInput style={[s.notes, { color: fg, borderColor: colors.border }]} value={m.notes} onChangeText={(v) => updateMeal(m.mealNumber, { notes: v })} placeholder="Note for the athlete (swaps, portions…)" placeholderTextColor={mt} />
                <Btn label="+ Add food" kind="ghost" small onPress={() => setFoodFor(m.mealNumber)} />
              </View>
            );
          })}
          {plan.meals.length < 5 && <Btn label="+ Add meal" kind="ghost" onPress={addMeal} />}

          <View style={[s.card, card]}>
            <Text style={[s.cardTitle, { color: fg }]}>Plan total (from foods)</Text>
            <Text style={[s.hint, { color: mt }]}>{planTotals.kcal} kcal · P{planTotals.p} C{planTotals.c} F{planTotals.f} — vs training target {plan.trainingDay.calories} kcal</Text>
          </View>

          {problems.length > 0 && <Text style={[s.hint, { color: colors.warningStrong }]}>{problems[0]}</Text>}
          <Btn label={assign.isPending ? '…' : `${t('assignMeals')} → ${name ?? ''}`} onPress={submit} disabled={assign.isPending || problems.length > 0} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={foodFor != null} animationType="slide" onRequestClose={() => setFoodFor(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 0 : insets.top }}>
          {foodFor != null && (
            <FoodSearch
              mealNumber={foodFor}
              onClose={() => setFoodFor(null)}
              onAdd={(f) => {
                const m = plan.meals.find((x) => x.mealNumber === foodFor);
                if (m) updateMeal(foodFor, { foods: [...m.foods, { foodName: f.name, servingGrams: Math.round(f.grams), calories: Math.round(f.calories), protein: r1(f.protein), carbs: r1(f.carbs), fat: r1(f.fat) }] });
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function r1(n: number) { return Math.round(n * 10) / 10; }
function roundTargets(m: MacroTargets): MacroTargets {
  return { calories: Math.round(m.calories), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1 },
  headerSide: { width: 80 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  container: { padding: 16, paddingBottom: 80, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17 },
  mealNo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mealName: { flex: 1, fontSize: 15, fontWeight: '700', paddingVertical: 4 },
  mealTime: { width: 64, fontSize: 12, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center' },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  notes: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
});
