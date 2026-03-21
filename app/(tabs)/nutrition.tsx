// ============================================================
// NUTRITION TAB — Phy-style with circular macro rings,
// numbered meal cards, grouped food search with category chips
// ============================================================
import { useState, useCallback, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import { FoodEntry, DailyNutrition, SupplementCheck, generateId } from '@/lib/types';
import { NUTRITION_TARGETS, MEAL_SCHEDULE, SUPPLEMENTS, isTrainingDay } from '@/lib/training-program';
import * as Haptics from 'expo-haptics';
import uaeFoodDb from '@/lib/data/uae-food-database.json';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Food database typed ──────────────────────────────────────
type FoodItem = {
  id: string;
  name: string;
  category: string;
  per100g: { protein: number; carbs: number; fat: number; calories: number };
  servingSizes?: { label: string; grams: number }[];
};
const FOOD_DB = uaeFoodDb as FoodItem[];

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
];

// ── Quick Add items (high-protein staples) ───────────────────
const QUICK_ADD_IDS = [
  'uae_protein_001', // Chicken Breast
  'uae_protein_003', // Whole Egg
  'uae_protein_004', // Egg Whites
  'uae_protein_005', // Greek Yogurt
  'uae_protein_009', // Whey Protein
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
  value,
  target,
  color,
  label,
  unit,
  size = 72,
}: {
  value: number;
  target: number;
  color: string;
  label: string;
  unit: string;
  size?: number;
}) {
  const pct = Math.min(1, value / Math.max(target, 1));
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <View style={{ alignItems: 'center', width: size + 16 }}>
      {/* SVG-style ring using border trick */}
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 5,
        borderColor: color + '33',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Progress arc using rotation trick */}
        <View style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 5,
          borderColor: color,
          borderTopColor: pct > 0.75 ? color : 'transparent',
          borderRightColor: pct > 0.5 ? color : 'transparent',
          borderBottomColor: pct > 0.25 ? color : 'transparent',
          borderLeftColor: pct > 0 ? color : 'transparent',
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
  const { store, updateStore } = useGym();
  const today = new Date().toISOString().split('T')[0];

  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMeal, setSelectedMeal] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingGrams, setServingGrams] = useState('100');
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);

  // ── Today's log ──────────────────────────────────────────
  const isTrain = isTrainingDay(new Date());
  const targets = isTrain ? NUTRITION_TARGETS.training : NUTRITION_TARGETS.rest;

  const todayLog: DailyNutrition = store.nutritionLogs.find(l => l.date === today) || {
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
  const totals = todayLog.meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

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
  }, [searchQuery, selectedCategory]);

  // ── Quick add foods ──────────────────────────────────────
  const quickAddFoods = useMemo(() => {
    return FOOD_DB.filter(f => f.category === 'Protein Foods').slice(0, 5);
  }, []);

  // ── Save log helper ──────────────────────────────────────
  const saveLog = useCallback((updatedLog: DailyNutrition) => {
    const idx = store.nutritionLogs.findIndex(l => l.date === today);
    const updatedLogs = idx >= 0
      ? store.nutritionLogs.map((l, i) => i === idx ? updatedLog : l)
      : [...store.nutritionLogs, updatedLog];
    updateStore({ ...store, nutritionLogs: updatedLogs });
  }, [store, today, updateStore]);

  // ── Add food ─────────────────────────────────────────────
  const addFood = useCallback((food: FoodItem) => {
    const grams = parseFloat(servingGrams) || 100;
    const mult = grams / 100;
    const entry: FoodEntry = {
      id: generateId(),
      mealNumber: selectedMeal,
      foodName: food.name,
      protein: Math.round(food.per100g.protein * mult * 10) / 10,
      carbs: Math.round(food.per100g.carbs * mult * 10) / 10,
      fat: Math.round(food.per100g.fat * mult * 10) / 10,
      calories: Math.round(food.per100g.calories * mult),
      servingGrams: grams,
      timestamp: new Date().toISOString(),
    };
    saveLog({ ...todayLog, meals: [...todayLog.meals, entry] });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFoodSearch(false);
    setSelectedFood(null);
    setSearchQuery('');
    setServingGrams('100');
  }, [selectedMeal, servingGrams, todayLog, saveLog]);

  // ── Remove food ──────────────────────────────────────────
  const removeFood = useCallback((foodId: string) => {
    saveLog({ ...todayLog, meals: todayLog.meals.filter(m => m.id !== foodId) });
  }, [todayLog, saveLog]);

  // ── Toggle supplement ────────────────────────────────────
  const toggleSupplement = useCallback((index: number) => {
    const updated = todayLog.supplementsChecked.map((s, i) =>
      i === index ? { ...s, taken: !s.taken } : s
    );
    saveLog({ ...todayLog, supplementsChecked: updated });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [todayLog, saveLog]);

  const bg = colors.background;
  const surf = colors.surface;
  const fg = colors.foreground;
  const mut = colors.muted;
  const pri = colors.primary;
  const bord = colors.border;

  const supplementsTaken = todayLog.supplementsChecked.filter(s => s.taken).length;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={[s.headerTitle, { color: fg }]}>Nutrition</Text>
            <Text style={[s.headerSub, { color: mut }]}>
              {isTrain ? '💪 Training Day' : '😴 Rest Day'} · {targets.calories} kcal target
            </Text>
          </View>
          <TouchableOpacity
            style={[s.searchBtn, { backgroundColor: pri }]}
            onPress={() => setShowFoodSearch(true)}
          >
            <Text style={s.searchBtnText}>🔍 Search Foods</Text>
          </TouchableOpacity>
        </View>

        {/* ── Circular Macro Rings ────────────────────────── */}
        <View style={[s.macroCard, { backgroundColor: surf }]}>
          <View style={s.macroRings}>
            <MacroRing
              value={totals.calories}
              target={todayLog.targetCalories}
              color={MACRO_COLORS.calories}
              label="Calories"
              unit=""
            />
            <MacroRing
              value={totals.protein}
              target={todayLog.targetProtein}
              color={MACRO_COLORS.protein}
              label="Protein"
              unit="g"
            />
            <MacroRing
              value={totals.carbs}
              target={todayLog.targetCarbs}
              color={MACRO_COLORS.carbs}
              label="Carbs"
              unit="g"
            />
            <MacroRing
              value={totals.fat}
              target={todayLog.targetFat}
              color={MACRO_COLORS.fat}
              label="Fat"
              unit="g"
            />
          </View>
          {/* Remaining row */}
          <View style={s.remainingRow}>
            {[
              { label: 'Remaining', value: Math.max(0, todayLog.targetCalories - totals.calories), color: MACRO_COLORS.calories, unit: '' },
              { label: 'Protein', value: Math.max(0, todayLog.targetProtein - totals.protein), color: MACRO_COLORS.protein, unit: 'g' },
              { label: 'Carbs', value: Math.max(0, todayLog.targetCarbs - totals.carbs), color: MACRO_COLORS.carbs, unit: 'g' },
              { label: 'Fat', value: Math.max(0, todayLog.targetFat - totals.fat), color: MACRO_COLORS.fat, unit: 'g' },
            ].map(m => (
              <View key={m.label} style={s.remainingItem}>
                <Text style={[s.remainingLabel, { color: mut }]}>{m.label}</Text>
                <Text style={[s.remainingValue, { color: m.color }]}>
                  {Math.round(m.value)}{m.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Meals ──────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: mut }]}>MEALS</Text>

        {MEAL_SCHEDULE.map(meal => {
          const mealFoods = todayLog.meals.filter(m => m.mealNumber === meal.meal);
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
                      <TouchableOpacity
                        onPress={() => removeFood(food.id)}
                        style={s.removeBtn}
                      >
                        <Text style={{ color: colors.error, fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[s.addFoodBtn, { borderColor: pri + '44' }]}
                    onPress={() => {
                      setSelectedMeal(meal.meal as 1 | 2 | 3 | 4 | 5);
                      setShowFoodSearch(true);
                    }}
                  >
                    <Text style={[s.addFoodBtnText, { color: pri }]}>+ Add Food</Text>
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
            <Text style={[s.suppIcon]}>💊</Text>
            <Text style={[s.suppTitle, { color: fg }]}>Supplements</Text>
            <Text style={[s.suppCount, { color: mut }]}>
              {supplementsTaken}/{todayLog.supplementsChecked.length} taken
            </Text>
          </View>
          {expandedMeal === 99 && (
            <View style={[s.suppList, { borderTopColor: bord }]}>
              {todayLog.supplementsChecked.map((supp, idx) => (
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
        onRequestClose={() => { setShowFoodSearch(false); setSelectedFood(null); }}
      >
        <View style={[s.modal, { backgroundColor: bg }]}>

          {/* Modal header */}
          <View style={[s.modalHeader, { borderBottomColor: bord }]}>
            <TouchableOpacity
              onPress={() => { setShowFoodSearch(false); setSelectedFood(null); setSearchQuery(''); }}
            >
              <Text style={{ color: pri, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: fg }]}>
              Add to Meal {selectedMeal}
            </Text>
            <View style={{ width: 60 }} />
          </View>

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
                      addFood(food);
                    }}
                  >
                    <Text style={[s.quickAddName, { color: fg }]} numberOfLines={2}>
                      {food.name}
                    </Text>
                    <Text style={[s.quickAddServing, { color: mut }]}>
                      {food.servingSizes?.[0]?.label || '100g'}
                    </Text>
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
              const mult = grams / 100;
              const isSelected = selectedFood?.id === item.id;

              return (
                <TouchableOpacity
                  style={[s.foodItem, {
                    backgroundColor: isSelected ? pri + '22' : surf,
                    borderColor: isSelected ? pri : bord,
                  }]}
                  onPress={() => setSelectedFood(isSelected ? null : item)}
                >
                  <View style={s.foodItemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.foodItemName, { color: fg }]}>{item.name}</Text>
                      <Text style={[s.foodItemCat, { color: mut }]}>
                        {item.servingSizes?.[0]?.label || '100g'} · {item.category}
                      </Text>
                    </View>
                    <Text style={[s.foodItemCals, { color: fg }]}>
                      {Math.round(item.per100g.calories * mult)}
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
                        <Text style={[s.customGramsLabel, { color: mut }]}>Custom grams:</Text>
                        <TextInput
                          value={servingGrams}
                          onChangeText={setServingGrams}
                          keyboardType="numeric"
                          style={[s.customGramsInput, { backgroundColor: bord, color: fg }]}
                        />
                        <Text style={[s.customGramsLabel, { color: mut }]}>g</Text>
                      </View>

                      {/* Add button */}
                      <TouchableOpacity
                        style={[s.addBtn, { backgroundColor: pri }]}
                        onPress={() => addFood(item)}
                      >
                        <Text style={s.addBtnText}>
                          Add {Math.round(item.per100g.calories * mult)} kcal to Meal {selectedMeal}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={[s.emptyText, { color: mut }]}>
                {searchQuery.length > 0
                  ? `No foods found for "${searchQuery}"`
                  : 'No foods in this category'}
              </Text>
            }
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 2 },
  searchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  macroCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  macroRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
  },
  remainingItem: { alignItems: 'center' },
  remainingLabel: { fontSize: 10, marginBottom: 2 },
  remainingValue: { fontSize: 16, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  mealCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  mealBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  foodName: { fontSize: 14, fontWeight: '500' },
  foodMacros: { fontSize: 11, marginTop: 2 },
  removeBtn: { padding: 8 },
  addFoodBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  addFoodBtnText: { fontSize: 14, fontWeight: '600' },
  suppCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  suppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  suppIcon: { fontSize: 18 },
  suppTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  suppCount: { fontSize: 13 },
  suppList: { borderTopWidth: 0.5, padding: 12 },
  suppItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  suppCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suppName: { fontSize: 14, fontWeight: '500' },
  suppDose: { fontSize: 12, marginTop: 1 },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.5,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  quickAddSection: { paddingHorizontal: 16, marginBottom: 12 },
  quickAddLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  quickAddCard: {
    width: 130,
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 12,
    marginRight: 10,
  },
  quickAddName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  quickAddServing: { fontSize: 11, marginBottom: 4 },
  quickAddCals: { fontSize: 14, fontWeight: '700' },
  quickAddProtein: { fontSize: 12, marginTop: 2 },
  foodItem: {
    borderRadius: 12,
    borderWidth: 0.5,
    marginBottom: 6,
    overflow: 'hidden',
  },
  foodItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  foodItemName: { fontSize: 15, fontWeight: '600' },
  foodItemCat: { fontSize: 12, marginTop: 2 },
  foodItemCals: { fontSize: 16, fontWeight: '700' },
  foodItemCalsUnit: { fontSize: 12 },
  foodItemChevron: { fontSize: 18, marginLeft: 4 },
  foodItemExpanded: {
    borderTopWidth: 0.5,
    padding: 14,
  },
  foodMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  foodMacroItem: { alignItems: 'center' },
  foodMacroValue: { fontSize: 16, fontWeight: '700' },
  foodMacroLabel: { fontSize: 11, marginTop: 2 },
  servingChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  servingChipText: { fontSize: 12, fontWeight: '500' },
  customGramsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  customGramsLabel: { fontSize: 13 },
  customGramsInput: {
    width: 70,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  addBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
