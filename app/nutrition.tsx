import { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import {
  FoodEntry,
  DailyNutrition,
  SupplementCheck,
  generateId,
} from '@/lib/types';
import * as Haptics from 'expo-haptics';
import uaeFoodDb from '@/lib/data/uae-food-database.json';

const DEFAULT_SUPPLEMENTS: SupplementCheck[] = [
  { name: 'Creatine', dose: '5g', timing: 'Post-workout', taken: false },
  { name: 'Whey Protein', dose: '30g', timing: 'Post-workout', taken: false },
  { name: 'Vitamin D3', dose: '2000 IU', timing: 'Morning', taken: false },
  { name: 'Omega-3', dose: '2g', timing: 'With meal', taken: false },
  { name: 'Magnesium', dose: '400mg', timing: 'Before bed', taken: false },
];

const MEAL_NAMES = ['', 'Breakfast', 'Lunch', 'Snack', 'Dinner', 'Post-Workout'];

export default function NutritionScreen() {
  const router = useRouter();
  const colors = useColors();
  const { store, updateStore } = useGym();
  const today = new Date().toISOString().split('T')[0];

  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [servingGrams, setServingGrams] = useState('100');

  // Get or create today's nutrition log
  const todayLog = store.nutritionLogs.find(l => l.date === today) || {
    date: today,
    isTrainingDay: true,
    meals: [],
    targetCalories: 2800,
    targetProtein: 180,
    targetCarbs: 350,
    targetFat: 80,
    supplementsChecked: DEFAULT_SUPPLEMENTS,
  };

  // Calculate totals
  const totals = todayLog.meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Filter food database
  const filteredFoods = searchQuery.length > 1
    ? (uaeFoodDb as any[]).filter((f: any) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.category.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20)
    : [];

  const addFood = useCallback((food: any) => {
    const grams = parseFloat(servingGrams) || 100;
    const multiplier = grams / 100;

    const entry: FoodEntry = {
      id: generateId(),
      mealNumber: selectedMeal,
      foodName: food.name,
      protein: Math.round(food.per100g.protein * multiplier * 10) / 10,
      carbs: Math.round(food.per100g.carbs * multiplier * 10) / 10,
      fat: Math.round(food.per100g.fat * multiplier * 10) / 10,
      calories: Math.round(food.per100g.calories * multiplier),
      servingGrams: grams,
      timestamp: new Date().toISOString(),
    };

    const updatedMeals = [...todayLog.meals, entry];
    const updatedLog: DailyNutrition = { ...todayLog, meals: updatedMeals };

    const existingIndex = store.nutritionLogs.findIndex(l => l.date === today);
    const updatedLogs = existingIndex >= 0
      ? store.nutritionLogs.map((l, i) => i === existingIndex ? updatedLog : l)
      : [...store.nutritionLogs, updatedLog];

    updateStore({ ...store, nutritionLogs: updatedLogs });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFoodSearch(false);
    setSearchQuery('');
    setServingGrams('100');
  }, [selectedMeal, servingGrams, todayLog, store, today, updateStore]);

  const removeFood = useCallback((foodId: string) => {
    const updatedMeals = todayLog.meals.filter(m => m.id !== foodId);
    const updatedLog: DailyNutrition = { ...todayLog, meals: updatedMeals };

    const existingIndex = store.nutritionLogs.findIndex(l => l.date === today);
    const updatedLogs = existingIndex >= 0
      ? store.nutritionLogs.map((l, i) => i === existingIndex ? updatedLog : l)
      : [...store.nutritionLogs, updatedLog];

    updateStore({ ...store, nutritionLogs: updatedLogs });
  }, [todayLog, store, today, updateStore]);

  const toggleSupplement = useCallback((index: number) => {
    const updatedSupplements = todayLog.supplementsChecked.map((s, i) =>
      i === index ? { ...s, taken: !s.taken } : s
    );
    const updatedLog: DailyNutrition = { ...todayLog, supplementsChecked: updatedSupplements };

    const existingIndex = store.nutritionLogs.findIndex(l => l.date === today);
    const updatedLogs = existingIndex >= 0
      ? store.nutritionLogs.map((l, i) => i === existingIndex ? updatedLog : l)
      : [...store.nutritionLogs, updatedLog];

    updateStore({ ...store, nutritionLogs: updatedLogs });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [todayLog, store, today, updateStore]);

  const progressPercent = (value: number, target: number) =>
    Math.min(100, Math.round((value / target) * 100));

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 8 }}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: '700', flex: 1 }}>
            Nutrition
          </Text>
        </View>

        {/* Macro Summary Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Calories', value: totals.calories, target: todayLog.targetCalories, color: '#FF6B6B', unit: '' },
            { label: 'Protein', value: totals.protein, target: todayLog.targetProtein, color: '#4ECDC4', unit: 'g' },
            { label: 'Carbs', value: totals.carbs, target: todayLog.targetCarbs, color: '#FFE66D', unit: 'g' },
            { label: 'Fat', value: totals.fat, target: todayLog.targetFat, color: '#A78BFA', unit: 'g' },
          ].map((macro) => (
            <View
              key={macro.label}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>{macro.label}</Text>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700' }}>
                {Math.round(macro.value)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>/ {macro.target}{macro.unit}</Text>
              <View style={{
                width: '100%',
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
                marginTop: 6,
                overflow: 'hidden',
              }}>
                <View style={{
                  width: `${progressPercent(macro.value, macro.target)}%`,
                  height: '100%',
                  backgroundColor: macro.color,
                  borderRadius: 2,
                }} />
              </View>
            </View>
          ))}
        </View>

        {/* Meal Sections */}
        {([1, 2, 3, 4, 5] as const).map((mealNum) => {
          const mealFoods = todayLog.meals.filter(m => m.mealNumber === mealNum);
          const mealCals = mealFoods.reduce((s, m) => s + m.calories, 0);

          return (
            <View key={mealNum} style={{ marginHorizontal: 16, marginBottom: 12 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>
                  {MEAL_NAMES[mealNum]}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {mealCals > 0 && (
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{mealCals} cal</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedMeal(mealNum);
                      setShowFoodSearch(true);
                    }}
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {mealFoods.map((food) => (
                <View
                  key={food.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 4,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '500' }}>
                      {food.foodName}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {food.servingGrams}g · P:{food.protein}g · C:{food.carbs}g · F:{food.fat}g
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 14, marginRight: 8 }}>
                    {food.calories} cal
                  </Text>
                  <TouchableOpacity onPress={() => removeFood(food.id)}>
                    <Text style={{ color: colors.error, fontSize: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {mealFoods.length === 0 && (
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  padding: 16,
                  alignItems: 'center',
                  opacity: 0.5,
                }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>No foods logged</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Supplements Checklist */}
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Supplements
          </Text>
          {todayLog.supplementsChecked.map((supp, index) => (
            <TouchableOpacity
              key={supp.name}
              onPress={() => toggleSupplement(index)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 10,
                padding: 12,
                marginBottom: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: supp.taken ? colors.primary : colors.border,
                backgroundColor: supp.taken ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {supp.taken && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: colors.foreground,
                  fontSize: 14,
                  fontWeight: '500',
                  textDecorationLine: supp.taken ? 'line-through' : 'none',
                  opacity: supp.taken ? 0.6 : 1,
                }}>
                  {supp.name} — {supp.dose}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{supp.timing}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Food Search Modal */}
      <Modal visible={showFoodSearch} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity onPress={() => { setShowFoodSearch(false); setSearchQuery(''); }}>
              <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>
              Add to {MEAL_NAMES[selectedMeal]}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search UAE foods..."
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                color: colors.foreground,
                fontSize: 16,
              }}
              autoFocus
            />
          </View>

          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Serving size (grams):</Text>
            <TextInput
              value={servingGrams}
              onChangeText={setServingGrams}
              keyboardType="numeric"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 10,
                color: colors.foreground,
                fontSize: 14,
                marginTop: 4,
                width: 100,
              }}
            />
          </View>

          <FlatList
            data={filteredFoods}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }: { item: any }) => {
              const grams = parseFloat(servingGrams) || 100;
              const mult = grams / 100;
              return (
                <TouchableOpacity
                  onPress={() => addFood(item)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: '600' }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {item.category} · {grams}g
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Text style={{ color: '#FF6B6B', fontSize: 12 }}>
                      {Math.round(item.per100g.calories * mult)} cal
                    </Text>
                    <Text style={{ color: '#4ECDC4', fontSize: 12 }}>
                      P: {Math.round(item.per100g.protein * mult * 10) / 10}g
                    </Text>
                    <Text style={{ color: '#FFE66D', fontSize: 12 }}>
                      C: {Math.round(item.per100g.carbs * mult * 10) / 10}g
                    </Text>
                    <Text style={{ color: '#A78BFA', fontSize: 12 }}>
                      F: {Math.round(item.per100g.fat * mult * 10) / 10}g
                    </Text>
                  </View>
                  {item.servingSizes && item.servingSizes.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {item.servingSizes.map((s: any) => (
                        <TouchableOpacity
                          key={s.label}
                          onPress={() => {
                            setServingGrams(String(s.grams));
                          }}
                          style={{
                            backgroundColor: colors.border,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 11 }}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              searchQuery.length > 1 ? (
                <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
                  No foods found for "{searchQuery}"
                </Text>
              ) : (
                <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
                  Search 150+ UAE foods and restaurants
                </Text>
              )
            }
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}
