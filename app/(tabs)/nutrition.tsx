// ============================================================
// NUTRITION TAB — Fixed: proper storage, quantity stepper,
// multi-add without closing modal, manual food entry + DB append
// ============================================================
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ScrollView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { FoodEntry, SupplementCheck, generateId } from '@/lib/types';
import { DailyNutrition } from '@/lib/nutrition-store';
import {
  getDailyNutrition,
  saveDailyNutrition,
  getRecentNutrition,
} from '@/lib/nutrition-store';
import { NUTRITION_TARGETS, MEAL_SCHEDULE, SUPPLEMENTS, isTrainingDay } from '@/lib/training-program';
import * as Haptics from 'expo-haptics';
import uaeFoodDb from '@/lib/data/uae-food-database.json';
import { WaterTracker } from '@/components/water-tracker';

// ── Food database typed ──────────────────────────────────────
type FoodItem = {
  id: string;
  name: string;
  category: string;
  per100g: { protein: number; carbs: number; fat: number; calories: number };
  servingSizes?: { label: string; grams: number }[];
};
const BASE_FOOD_DB = uaeFoodDb as FoodItem[];

// ── Custom food storage key ──────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
const CUSTOM_FOODS_KEY = '@gym_tracker_custom_foods';

async function loadCustomFoods(): Promise<FoodItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_FOODS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function saveCustomFoods(foods: FoodItem[]): Promise<void> {
  try { await AsyncStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods)); } catch { /* ignore */ }
}

// ── Categories ───────────────────────────────────────────────
const CATEGORIES = [
  'All',
  'Protein Foods',
  'Carbohydrates',
  'UAE Street Food',
  'UAE Traditional',
  'Arabic Breakfast',
  'Fast Food',
  'Dairy',
  'Fruits',
  'Vegetables',
  'Nuts & Seeds',
  'Snacks',
  'Beverages',
  'Supplements',
  'Restaurant',
  'Supermarket',
  'Fats & Oils',
  'Custom',
];

// ── Macro ring colors ────────────────────────────────────────
const MACRO_COLORS = {
  calories: '#FF6B6B',
  protein: '#4FC3F7',
  carbs: '#81C784',
  fat: '#FFB74D',
};

// ── Default supplements ──────────────────────────────────────
const DEFAULT_SUPPLEMENTS: SupplementCheck[] = SUPPLEMENTS.map(s => ({
  name: s.name,
  dose: s.dose,
  timing: s.timing,
  taken: false,
}));

// ── Circular Ring component ──────────────────────────────────
function MacroRing({
  value, target, color, label, unit, size = 72,
}: {
  value: number; target: number; color: string; label: string; unit: string; size?: number;
}) {
  const pct = Math.min(1, value / Math.max(target, 1));
  return (
    <View style={{ alignItems: 'center', width: size + 16 }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 5, borderColor: color + '33',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', width: size * 2, height: size * 2,
          borderRadius: size, borderWidth: 5, borderColor: color,
          top: -size / 2, left: -size / 2,
          transform: [{ rotate: `${-90 + pct * 360}deg` }],
        }} />
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
          {Math.round(value)}
        </Text>
        <Text style={{ color: '#888', fontSize: 9 }}>{unit}</Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 6 }}>{label}</Text>
      <Text style={{ color: '#666', fontSize: 10 }}>{target}{unit}</Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────
export default function NutritionTab() {
  const colors = useColors();
  const today = new Date().toLocaleDateString('en-CA');

  // ── Local state ──────────────────────────────────────────
  const [todayLog, setTodayLog] = useState<DailyNutrition | null>(null);
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMeal, setSelectedMeal] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingGrams, setServingGrams] = useState('100');
  const [quantity, setQuantity] = useState(1); // NEW: quantity stepper
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [copyingYesterday, setCopyingYesterday] = useState(false);
  const [weeklyAdherence, setWeeklyAdherence] = useState<{ daysHit: number; total: number; pct: number } | null>(null);

  // ── Load data on mount ───────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [log, custom, recent] = await Promise.all([
        getDailyNutrition(today),
        loadCustomFoods(),
        getRecentNutrition(7),
      ]);
      if (mounted) {
        setTodayLog(log);
        setCustomFoods(custom);
        // Compute weekly protein adherence
        const daysWithData = recent.filter(d => d.meals.length > 0);
        const daysHit = daysWithData.filter(d => {
          const prot = d.meals.reduce((s, m) => s + m.protein, 0);
          return prot >= d.targetProtein * 0.9; // 90% threshold
        }).length;
        const total = Math.max(daysWithData.length, 1);
        setWeeklyAdherence({ daysHit, total, pct: Math.round((daysHit / total) * 100) });
      }
    };
    load();
    return () => { mounted = false; };
  }, [today]);

  // ── Reload when modal closes ─────────────────────────────
  const reloadLog = useCallback(async () => {
    const log = await getDailyNutrition(today);
    setTodayLog(log);
  }, [today]);

  // ── Effective log (with defaults while loading) ──────────
  const isTrain = isTrainingDay(new Date());
  const targets = isTrain ? NUTRITION_TARGETS.training : NUTRITION_TARGETS.rest;
  const log: DailyNutrition = todayLog ?? {
    date: today,
    isTrainingDay: isTrain,
    meals: [],
    targetCalories: targets.calories,
    targetProtein: targets.protein,
    targetCarbs: targets.carbs,
    targetFat: targets.fat,
    supplementsChecked: DEFAULT_SUPPLEMENTS,
  };

  // ── Macro totals ─────────────────────────────────────────
  const totals = log.meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // ── Combined food DB ─────────────────────────────────────
  const FOOD_DB = useMemo(() => [...BASE_FOOD_DB, ...customFoods], [customFoods]);

  // ── Filtered foods ───────────────────────────────────────
  const filteredFoods = useMemo(() => {
    let list = FOOD_DB;
    if (selectedCategory !== 'All') {
      list = list.filter(f => f.category === selectedCategory);
    }
    if (searchQuery.length > 0) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [searchQuery, selectedCategory, FOOD_DB]);

  // ── Quick add foods ──────────────────────────────────────
  const quickAddFoods = useMemo(() => {
    return FOOD_DB.filter(f => f.category === 'Protein Foods').slice(0, 5);
  }, [FOOD_DB]);

  // ── Save log helper ──────────────────────────────────────
  const saveLog = useCallback(async (updatedLog: DailyNutrition) => {
    setTodayLog(updatedLog);
    await saveDailyNutrition(updatedLog);
  }, []);

  // ── Add food (stays in modal for multi-add) ──────────────
  const addFood = useCallback(async (food: FoodItem) => {
    const grams = parseFloat(servingGrams) || 100;
    const mult = (grams / 100) * quantity;
    const entry: FoodEntry = {
      id: generateId(),
      mealNumber: selectedMeal,
      foodName: quantity > 1 ? `${food.name} ×${quantity}` : food.name,
      protein: Math.round(food.per100g.protein * mult * 10) / 10,
      carbs: Math.round(food.per100g.carbs * mult * 10) / 10,
      fat: Math.round(food.per100g.fat * mult * 10) / 10,
      calories: Math.round(food.per100g.calories * mult),
      servingGrams: grams * quantity,
      timestamp: new Date().toISOString(),
    };
    const updatedLog = { ...log, meals: [...log.meals, entry] };
    await saveLog(updatedLog);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Reset selection but KEEP modal open for multi-add
    setSelectedFood(null);
    setQuantity(1);
    setServingGrams('100');
  }, [selectedMeal, servingGrams, quantity, log, saveLog]);

  // ── Remove food ──────────────────────────────────────────
  const removeFood = useCallback(async (foodId: string) => {
    const updatedLog = { ...log, meals: log.meals.filter(m => m.id !== foodId) };
    await saveLog(updatedLog);
  }, [log, saveLog]);

  // ── Toggle supplement ────────────────────────────────────
  const toggleSupplement = useCallback(async (index: number) => {
    const updated = log.supplementsChecked.map((s, i) =>
      i === index ? { ...s, taken: !s.taken } : s
    );
    await saveLog({ ...log, supplementsChecked: updated });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [log, saveLog]);

  // ── Save custom food to DB ───────────────────────────────
  const saveCustomFood = useCallback(async () => {
    if (!customName.trim() || !customCalories) {
      Alert.alert('Required', 'Please enter at least a name and calories.');
      return;
    }
    const cal = parseFloat(customCalories) || 0;
    const prot = parseFloat(customProtein) || 0;
    const carb = parseFloat(customCarbs) || 0;
    const fat = parseFloat(customFat) || 0;
    const newFood: FoodItem = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      category: 'Custom',
      per100g: { calories: cal, protein: prot, carbs: carb, fat: fat },
      servingSizes: [{ label: '1 serving', grams: 100 }],
    };
    const updated = [...customFoods, newFood];
    setCustomFoods(updated);
    await saveCustomFoods(updated);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Reset form and go back to search
    setCustomName(''); setCustomCalories(''); setCustomProtein('');
    setCustomCarbs(''); setCustomFat('');
    setShowCustomForm(false);
    setSearchQuery(newFood.name);
    Alert.alert('✅ Saved', `"${newFood.name}" added to your food database.`);
  }, [customName, customCalories, customProtein, customCarbs, customFat, customFoods]);

  const bg = colors.background;
  const surf = colors.surface;
  const fg = colors.cardForeground;
  const mut = colors.cardMuted;
  const pri = colors.primary;
  const bord = colors.cardBorder;

  // ── Copy yesterday's meals ──────────────────────────────
  const copyYesterday = useCallback(async () => {
    try {
      setCopyingYesterday(true);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toLocaleDateString('en-CA');
      const yLog = await getDailyNutrition(yStr);
      if (!yLog || yLog.meals.length === 0) {
        Alert.alert('No Data', 'No meals logged yesterday.');
        setCopyingYesterday(false);
        return;
      }
      const copiedMeals: FoodEntry[] = yLog.meals.map(m => ({
        id: generateId(),
        mealNumber: m.mealNumber,
        foodName: m.foodName,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        calories: m.calories,
        servingGrams: (m as any).servingGrams ?? 100,
        timestamp: new Date().toISOString(),
      }));
      const updatedLog = { ...log, meals: [...log.meals, ...copiedMeals] };
      await saveLog(updatedLog);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied', `${copiedMeals.length} items from yesterday added.`);
    } catch { Alert.alert('Error', 'Could not copy yesterday\'s meals.'); }
    setCopyingYesterday(false);
  }, [log, saveLog]);

  const supplementsTaken = log.supplementsChecked.filter(s => s.taken).length;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={[s.headerTitle, { color: fg }]}>Nutrition</Text>
            <Text style={[s.headerSub, { color: mut }]}>
              {isTrain ? '💪 Training Day' : '😴 Rest Day'} · {targets.calories} kcal target
            </Text>
          </View>
          <TouchableOpacity
            style={[s.searchBtn, { backgroundColor: pri }]}
            onPress={() => { setShowFoodSearch(true); setShowCustomForm(false); }}
          >
            <Text style={s.searchBtnText}>🔍 Search Foods</Text>
          </TouchableOpacity>
        </View>

        {/* ── Same as Yesterday Button ───────────────────── */}
        {log.meals.length === 0 && (
          <TouchableOpacity
            style={[s.yesterdayBtn, { backgroundColor: surf, borderColor: bord }]}
            onPress={copyYesterday}
            activeOpacity={0.7}
            disabled={copyingYesterday}
          >
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔁</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: fg }}>
                {copyingYesterday ? 'Copying...' : 'Same as Yesterday'}
              </Text>
              <Text style={{ fontSize: 11, color: mut }}>Copy all meals from yesterday</Text>
            </View>
            <Text style={{ fontSize: 16, color: mut }}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Circular Macro Rings ────────────────────────── */}
        <View style={[s.macroCard, { backgroundColor: surf }]}>
          <View style={s.macroRings}>
            <MacroRing value={totals.calories} target={log.targetCalories} color={MACRO_COLORS.calories} label="Calories" unit="" />
            <MacroRing value={totals.protein} target={log.targetProtein} color={MACRO_COLORS.protein} label="Protein" unit="g" />
            <MacroRing value={totals.carbs} target={log.targetCarbs} color={MACRO_COLORS.carbs} label="Carbs" unit="g" />
            <MacroRing value={totals.fat} target={log.targetFat} color={MACRO_COLORS.fat} label="Fat" unit="g" />
          </View>
          <View style={s.remainingRow}>
            {[
              { label: 'Remaining', value: Math.max(0, log.targetCalories - totals.calories), color: MACRO_COLORS.calories, unit: '' },
              { label: 'Protein', value: Math.max(0, log.targetProtein - totals.protein), color: MACRO_COLORS.protein, unit: 'g' },
              { label: 'Carbs', value: Math.max(0, log.targetCarbs - totals.carbs), color: MACRO_COLORS.carbs, unit: 'g' },
              { label: 'Fat', value: Math.max(0, log.targetFat - totals.fat), color: MACRO_COLORS.fat, unit: 'g' },
            ].map(m => (
              <View key={m.label} style={s.remainingItem}>
                <Text style={[s.remainingLabel, { color: mut }]}>{m.label}</Text>
                <Text style={[s.remainingValue, { color: m.color }]}>{Math.round(m.value)}{m.unit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Macro Remaining Card ───────────────────────────── */}
        <View style={{ backgroundColor: pri + '10', borderRadius: 14, padding: 14, marginTop: 12, marginHorizontal: 16, borderWidth: 1, borderColor: pri + '20' }}>
          <Text style={{ color: pri, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
            Still needed today
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { label: 'Calories', remaining: Math.max(0, log.targetCalories - totals.calories), unit: 'kcal', color: '#FF6B6B' },
              { label: 'Protein', remaining: Math.max(0, log.targetProtein - totals.protein), unit: 'g', color: '#4FC3F7' },
              { label: 'Carbs', remaining: Math.max(0, log.targetCarbs - totals.carbs), unit: 'g', color: '#81C784' },
              { label: 'Fat', remaining: Math.max(0, log.targetFat - totals.fat), unit: 'g', color: '#FFB74D' },
            ].map(m => (
              <View key={m.label} style={{ alignItems: 'center' }}>
                <Text style={{ color: m.color, fontSize: 18, fontWeight: '800' }}>{m.remaining}</Text>
                <Text style={{ color: mut, fontSize: 10 }}>{m.unit} {m.label.toLowerCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Water Tracker ──────────────────────────────────── */}
        <View style={{ marginHorizontal: 16 }}>
          <WaterTracker />
        </View>

        {/* ── Weekly Protein Adherence ────────────────────────── */}
        {weeklyAdherence && weeklyAdherence.total > 0 && (
          <View style={[s.macroCard, { backgroundColor: surf, paddingVertical: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: fg }}>Weekly Protein Adherence</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '800',
                color: weeklyAdherence.pct >= 80 ? '#C8F53C' : weeklyAdherence.pct >= 50 ? '#F59E0B' : '#EF4444',
              }}>
                {weeklyAdherence.pct}%
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const hit = i < weeklyAdherence.daysHit;
                const logged = i < weeklyAdherence.total;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: hit ? '#C8F53C' : logged ? '#EF4444' : colors.cardBorder,
                    }}
                  />
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: mut, marginTop: 6 }}>
              {weeklyAdherence.daysHit}/{weeklyAdherence.total} days hit protein target (≥90%)
            </Text>
          </View>
        )}
        {/* ── Meals ────────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: mut }]}>MEALS</Text>
        {MEAL_SCHEDULE.map(meal => {
          const mealFoods = log.meals.filter(m => m.mealNumber === meal.meal);
          const mealCals = mealFoods.reduce((s, m) => s + m.calories, 0);
          const isExpanded = expandedMeal === meal.meal;

          return (
            <View key={meal.meal} style={[s.mealCard, { backgroundColor: surf, borderColor: bord }]}>
              <TouchableOpacity
                style={s.mealHeader}
                onPress={() => setExpandedMeal(isExpanded ? null : meal.meal)}
              >
                <View style={[s.mealBadge, { backgroundColor: pri + '22' }]}>
                  <Text style={[s.mealBadgeText, { color: pri }]}>{meal.meal}</Text>
                </View>
                <View style={s.mealInfo}>
                  <View style={s.mealTitleRow}>
                    <Text style={[s.mealName, { color: fg }]}>Meal {meal.meal}</Text>
                    <Text style={[s.mealCals, { color: mealCals > 0 ? fg : mut }]}>
                      {mealCals > 0 ? mealCals : 0} kcal
                    </Text>
                  </View>
                  <View style={s.mealTitleRow}>
                    <Text style={[s.mealTime, { color: mut }]}>🕐 {meal.time}</Text>
                    <Text style={[s.mealTarget, { color: mut }]}>{meal.kcal} target</Text>
                  </View>
                  <Text style={[s.mealFocus, { color: mut }]} numberOfLines={1}>{meal.focus}</Text>
                </View>
                <Text style={[s.mealChevron, { color: mut }]}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={[s.mealExpanded, { borderTopColor: bord }]}>
                  {mealFoods.map(food => (
                    <View key={food.id} style={[s.foodRow, { borderBottomColor: bord }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.foodName, { color: fg }]}>{food.foodName}</Text>
                        <Text style={[s.foodMacros, { color: mut }]}>
                          {food.calories} kcal · P:{food.protein}g · C:{food.carbs}g · F:{food.fat}g
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFood(food.id)} style={s.removeBtn}>
                        <Text style={{ color: colors.error, fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[s.addFoodBtn, { borderColor: pri + '44' }]}
                    onPress={() => {
                      setSelectedMeal(meal.meal as 1 | 2 | 3 | 4 | 5);
                      setShowFoodSearch(true);
                      setShowCustomForm(false);
                    }}
                  >
                    <Text style={[s.addFoodBtnText, { color: pri }]}>+ Add Food to Meal {meal.meal}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Supplements ────────────────────────────────── */}
        <TouchableOpacity
          style={[s.suppCard, { backgroundColor: surf, borderColor: bord }]}
          onPress={() => setExpandedMeal(expandedMeal === 99 ? null : 99)}
        >
          <View style={s.suppHeader}>
            <Text style={s.suppIcon}>💊</Text>
            <Text style={[s.suppTitle, { color: fg }]}>Supplements</Text>
            <Text style={[s.suppCount, { color: mut }]}>
              {supplementsTaken}/{log.supplementsChecked.length} taken
            </Text>
          </View>
          {expandedMeal === 99 && (
            <View style={[s.suppList, { borderTopColor: bord }]}>
              {log.supplementsChecked.map((supp, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[s.suppItem, { borderBottomColor: bord }]}
                  onPress={() => toggleSupplement(idx)}
                >
                  <View style={[s.suppCheck, {
                    borderColor: supp.taken ? colors.success : bord,
                    backgroundColor: supp.taken ? colors.success + '22' : 'transparent',
                  }]}>
                    {supp.taken && <Text style={{ color: colors.success, fontSize: 12 }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.suppName, { color: fg }]}>{supp.name}</Text>
                    <Text style={[s.suppDose, { color: mut }]}>{supp.dose} · {supp.timing}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* ── Food Search Modal ───────────────────────────── */}
      <Modal
        visible={showFoodSearch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowFoodSearch(false);
          setSelectedFood(null);
          setShowCustomForm(false);
          reloadLog();
        }}
      >
        <View style={[s.modal, { backgroundColor: bg }]}>

          {/* Modal header */}
          <View style={[s.modalHeader, { borderBottomColor: bord }]}>
            <TouchableOpacity
              onPress={() => {
                setShowFoodSearch(false);
                setSelectedFood(null);
                setSearchQuery('');
                setShowCustomForm(false);
                reloadLog();
              }}
            >
              <Text style={{ color: pri, fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: fg }]}>
              {showCustomForm ? 'Add Custom Food' : `Add to Meal ${selectedMeal}`}
            </Text>
            <TouchableOpacity
              onPress={() => setShowCustomForm(!showCustomForm)}
            >
              <Text style={{ color: pri, fontSize: 14 }}>
                {showCustomForm ? '← Search' : '+ Custom'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomForm ? (
            /* ── Custom Food Form ─────────────────────── */
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={[s.customFormLabel, { color: mut }]}>FOOD NAME *</Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder="e.g. Homemade Oats Bowl"
                placeholderTextColor={mut}
                style={[s.customFormInput, { backgroundColor: surf, color: fg, borderColor: bord }]}
              />

              <Text style={[s.customFormLabel, { color: mut, marginTop: 16 }]}>CALORIES (per serving) *</Text>
              <TextInput
                value={customCalories}
                onChangeText={setCustomCalories}
                placeholder="e.g. 350"
                placeholderTextColor={mut}
                keyboardType="numeric"
                style={[s.customFormInput, { backgroundColor: surf, color: fg, borderColor: bord }]}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.customFormLabel, { color: MACRO_COLORS.protein }]}>PROTEIN (g)</Text>
                  <TextInput
                    value={customProtein}
                    onChangeText={setCustomProtein}
                    placeholder="0"
                    placeholderTextColor={mut}
                    keyboardType="numeric"
                    style={[s.customFormInput, { backgroundColor: surf, color: fg, borderColor: bord }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.customFormLabel, { color: MACRO_COLORS.carbs }]}>CARBS (g)</Text>
                  <TextInput
                    value={customCarbs}
                    onChangeText={setCustomCarbs}
                    placeholder="0"
                    placeholderTextColor={mut}
                    keyboardType="numeric"
                    style={[s.customFormInput, { backgroundColor: surf, color: fg, borderColor: bord }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.customFormLabel, { color: MACRO_COLORS.fat }]}>FAT (g)</Text>
                  <TextInput
                    value={customFat}
                    onChangeText={setCustomFat}
                    placeholder="0"
                    placeholderTextColor={mut}
                    keyboardType="numeric"
                    style={[s.customFormInput, { backgroundColor: surf, color: fg, borderColor: bord }]}
                  />
                </View>
              </View>

              <Text style={[s.customFormHint, { color: mut }]}>
                💡 Values are per 100g serving. This food will be saved to your personal database and available for future use.
              </Text>

              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: pri, marginTop: 24 }]}
                onPress={saveCustomFood}
              >
                <Text style={s.addBtnText}>Save to My Food Database</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              {/* Search bar */}
              <View style={[s.searchBar, { backgroundColor: surf }]}>
                <Text style={{ color: mut, marginRight: 8 }}>🔍</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search 150+ UAE foods..."
                  placeholderTextColor={mut}
                  style={[s.searchInput, { color: fg }]}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={{ color: mut }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Category chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ height: 48, flexShrink: 0 }}
                contentContainerStyle={s.chips}
              >
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.chip, {
                      backgroundColor: selectedCategory === cat ? pri : surf,
                      borderColor: selectedCategory === cat ? pri : bord,
                    }]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[s.chipText, { color: selectedCategory === cat ? '#fff' : mut }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quick Add row */}
              {searchQuery.length === 0 && selectedCategory === 'All' && (
                <View style={s.quickAddSection}>
                  <Text style={[s.quickAddLabel, { color: mut }]}>QUICK ADD</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {quickAddFoods.map(food => (
                      <TouchableOpacity
                        key={food.id}
                        style={[s.quickAddCard, { backgroundColor: surf, borderColor: bord }]}
                        onPress={() => {
                          setServingGrams(food.servingSizes?.[0]?.grams?.toString() || '100');
                          setQuantity(1);
                          addFood(food);
                        }}
                      >
                        <Text style={[s.quickAddName, { color: fg }]} numberOfLines={2}>{food.name}</Text>
                        <Text style={[s.quickAddServing, { color: mut }]}>{food.servingSizes?.[0]?.label || '100g'}</Text>
                        <Text style={[s.quickAddCals, { color: MACRO_COLORS.calories }]}>
                          {Math.round(food.per100g.calories * (food.servingSizes?.[0]?.grams || 100) / 100)} kcal
                        </Text>
                        <Text style={[s.quickAddProtein, { color: MACRO_COLORS.protein }]}>
                          P:{Math.round(food.per100g.protein * (food.servingSizes?.[0]?.grams || 100) / 100)}g
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Food list */}
              <FlatList
                data={filteredFoods}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const grams = parseFloat(servingGrams) || 100;
                  const mult = (grams / 100) * quantity;
                  const isSelected = selectedFood?.id === item.id;

                  return (
                    <TouchableOpacity
                      style={[s.foodItem, {
                        backgroundColor: isSelected ? pri + '22' : surf,
                        borderColor: isSelected ? pri : bord,
                      }]}
                      onPress={() => {
                        setSelectedFood(isSelected ? null : item);
                        if (!isSelected) {
                          setServingGrams(item.servingSizes?.[0]?.grams?.toString() || '100');
                          setQuantity(1);
                        }
                      }}
                    >
                      <View style={s.foodItemTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.foodItemName, { color: fg }]}>{item.name}</Text>
                          <Text style={[s.foodItemCat, { color: mut }]}>
                            {item.servingSizes?.[0]?.label || '100g'} · {item.category}
                          </Text>
                        </View>
                        <Text style={[s.foodItemCals, { color: fg }]}>
                          {Math.round(item.per100g.calories * (parseFloat(servingGrams) || 100) / 100)}
                        </Text>
                        <Text style={[s.foodItemCalsUnit, { color: mut }]}> kcal</Text>
                        <Text style={[s.foodItemChevron, { color: mut }]}>›</Text>
                      </View>

                      {isSelected && (
                        <View style={[s.foodItemExpanded, { borderTopColor: bord }]}>
                          {/* Macro row */}
                          <View style={s.foodMacroRow}>
                            {[
                              { label: 'Protein', value: item.per100g.protein * mult, color: MACRO_COLORS.protein },
                              { label: 'Carbs', value: item.per100g.carbs * mult, color: MACRO_COLORS.carbs },
                              { label: 'Fat', value: item.per100g.fat * mult, color: MACRO_COLORS.fat },
                            ].map(m => (
                              <View key={m.label} style={s.foodMacroItem}>
                                <Text style={[s.foodMacroValue, { color: m.color }]}>
                                  {Math.round(m.value * 10) / 10}g
                                </Text>
                                <Text style={[s.foodMacroLabel, { color: mut }]}>{m.label}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Serving size chips */}
                          {item.servingSizes && item.servingSizes.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                              {item.servingSizes.map(sv => (
                                <TouchableOpacity
                                  key={sv.label}
                                  style={[s.servingChip, {
                                    backgroundColor: servingGrams === String(sv.grams) ? pri : bord,
                                  }]}
                                  onPress={() => setServingGrams(String(sv.grams))}
                                >
                                  <Text style={[s.servingChipText, {
                                    color: servingGrams === String(sv.grams) ? '#fff' : fg,
                                  }]}>{sv.label}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}

                          {/* Custom grams */}
                          <View style={s.customGramsRow}>
                            <Text style={[s.customGramsLabel, { color: mut }]}>Grams:</Text>
                            <TextInput
                              value={servingGrams}
                              onChangeText={setServingGrams}
                              keyboardType="numeric"
                              style={[s.customGramsInput, { backgroundColor: bord, color: fg }]}
                            />
                            <Text style={[s.customGramsLabel, { color: mut }]}>g</Text>
                          </View>

                          {/* ── Quantity stepper ──────────────────── */}
                          <View style={s.quantityRow}>
                            <Text style={[s.customGramsLabel, { color: mut }]}>Quantity:</Text>
                            <View style={s.stepper}>
                              <TouchableOpacity
                                style={[s.stepperBtn, { backgroundColor: bord }]}
                                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                              >
                                <Text style={[s.stepperBtnText, { color: fg }]}>−</Text>
                              </TouchableOpacity>
                              <Text style={[s.stepperValue, { color: fg }]}>{quantity}</Text>
                              <TouchableOpacity
                                style={[s.stepperBtn, { backgroundColor: bord }]}
                                onPress={() => setQuantity(q => q + 1)}
                              >
                                <Text style={[s.stepperBtnText, { color: fg }]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Total preview */}
                          <View style={[s.totalPreview, { backgroundColor: pri + '15', borderColor: pri + '33' }]}>
                            <Text style={[s.totalPreviewText, { color: pri }]}>
                              Total: {Math.round(item.per100g.calories * mult)} kcal
                              · P:{Math.round(item.per100g.protein * mult * 10) / 10}g
                              · C:{Math.round(item.per100g.carbs * mult * 10) / 10}g
                              · F:{Math.round(item.per100g.fat * mult * 10) / 10}g
                            </Text>
                          </View>

                          {/* Add button */}
                          <TouchableOpacity
                            style={[s.addBtn, { backgroundColor: pri }]}
                            onPress={() => addFood(item)}
                          >
                            <Text style={s.addBtnText}>
                              ✓ Add {quantity > 1 ? `×${quantity} ` : ''}{Math.round(item.per100g.calories * mult)} kcal to Meal {selectedMeal}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Text style={[s.emptyText, { color: mut }]}>
                      {searchQuery.length > 0
                        ? `No foods found for "${searchQuery}"`
                        : 'No foods in this category'}
                    </Text>
                    <TouchableOpacity
                      style={[s.addCustomBtn, { backgroundColor: pri + '22', borderColor: pri }]}
                      onPress={() => setShowCustomForm(true)}
                    >
                      <Text style={[s.addCustomBtnText, { color: pri }]}>
                        + Add "{searchQuery || 'Custom Food'}" manually
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  yesterdayBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 2 },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  macroCard: { marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 20 },
  macroRings: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  remainingRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#333' },
  remainingItem: { alignItems: 'center' },
  remainingLabel: { fontSize: 10, marginBottom: 2 },
  remainingValue: { fontSize: 16, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginHorizontal: 16, marginBottom: 8 },
  mealCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  mealHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  mealBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  mealBadgeText: { fontSize: 16, fontWeight: '700' },
  mealInfo: { flex: 1 },
  mealTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealName: { fontSize: 15, fontWeight: '600' },
  mealCals: { fontSize: 14, fontWeight: '600' },
  mealTime: { fontSize: 12, marginTop: 2 },
  mealTarget: { fontSize: 12 },
  mealFocus: { fontSize: 11, marginTop: 2 },
  mealChevron: { fontSize: 12 },
  mealExpanded: { borderTopWidth: 0.5, padding: 12 },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5 },
  foodName: { fontSize: 14, fontWeight: '500' },
  foodMacros: { fontSize: 11, marginTop: 2 },
  removeBtn: { padding: 8 },
  addFoodBtn: { marginTop: 10, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderStyle: 'dashed' },
  addFoodBtnText: { fontSize: 14, fontWeight: '600' },
  suppCard: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, borderWidth: 0.5, overflow: 'hidden' },
  suppHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  suppIcon: { fontSize: 18 },
  suppTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  suppCount: { fontSize: 13 },
  suppList: { borderTopWidth: 0.5, padding: 12 },
  suppItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 12 },
  suppCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  suppName: { fontSize: 14, fontWeight: '500' },
  suppDose: { fontSize: 12, marginTop: 1 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 16 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  quickAddSection: { paddingHorizontal: 16, marginBottom: 12 },
  quickAddLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  quickAddCard: { width: 130, borderRadius: 12, borderWidth: 0.5, padding: 12, marginRight: 10 },
  quickAddName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  quickAddServing: { fontSize: 11, marginBottom: 4 },
  quickAddCals: { fontSize: 14, fontWeight: '700' },
  quickAddProtein: { fontSize: 12, marginTop: 2 },
  foodItem: { borderRadius: 12, borderWidth: 0.5, marginBottom: 6, overflow: 'hidden' },
  foodItemTop: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  foodItemName: { fontSize: 15, fontWeight: '600' },
  foodItemCat: { fontSize: 12, marginTop: 2 },
  foodItemCals: { fontSize: 16, fontWeight: '700' },
  foodItemCalsUnit: { fontSize: 12 },
  foodItemChevron: { fontSize: 18, marginLeft: 4 },
  foodItemExpanded: { borderTopWidth: 0.5, padding: 14 },
  foodMacroRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  foodMacroItem: { alignItems: 'center' },
  foodMacroValue: { fontSize: 16, fontWeight: '700' },
  foodMacroLabel: { fontSize: 11, marginTop: 2 },
  servingChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  servingChipText: { fontSize: 12, fontWeight: '500' },
  customGramsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  customGramsLabel: { fontSize: 13 },
  customGramsInput: { width: 70, borderRadius: 8, padding: 8, fontSize: 14, textAlign: 'center' },
  // Quantity stepper
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepperBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 20, fontWeight: '600' },
  stepperValue: { fontSize: 18, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  totalPreview: { borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1 },
  totalPreviewText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  addBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyText: { textAlign: 'center', fontSize: 14, marginBottom: 16 },
  addCustomBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, marginTop: 8 },
  addCustomBtnText: { fontSize: 14, fontWeight: '600' },
  // Custom food form
  customFormLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  customFormInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15 },
  customFormHint: { fontSize: 12, marginTop: 16, lineHeight: 18 },
});
