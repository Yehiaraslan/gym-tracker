// ============================================================
// NUTRITION PAGE — Daily macro tracking, meals, supplements
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Text, View, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FoodSearch, type FoodSearchResult } from '@/components/food-search';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import { MEAL_SCHEDULE } from '@/lib/training-program';
import {
  getDailyNutrition,
  saveDailyNutrition,
  addFoodEntry,
  removeFoodEntry,
  toggleSupplement,
  getMacroTotals,
  type DailyNutrition,
  type FoodEntry,
} from '@/lib/nutrition-store';

// ---- Macro Ring ----
function MacroRing({ value, max, label, color, unit = 'g' }: {
  value: number; max: number; label: string; color: string; unit?: string;
}) {
  const pct = Math.min(value / max, 1);
  const remaining = Math.max(0, max - value);

  return (
    <View className="items-center">
      <View className="w-16 h-16 items-center justify-center">
        {/* Simple circular indicator */}
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{
            borderWidth: 4,
            borderColor: color + '25',
          }}
        >
          <View
            className="absolute w-16 h-16 rounded-full"
            style={{
              borderWidth: 4,
              borderColor: color,
              borderTopColor: pct >= 0.25 ? color : 'transparent',
              borderRightColor: pct >= 0.5 ? color : 'transparent',
              borderBottomColor: pct >= 0.75 ? color : 'transparent',
              borderLeftColor: pct >= 1 ? color : 'transparent',
              transform: [{ rotate: '-90deg' }],
            }}
          />
          <Text className="text-sm font-bold" style={{ color }}>{Math.round(value)}</Text>
        </View>
      </View>
      <Text className="text-xs font-medium text-foreground mt-1">{label}</Text>
      <Text className="text-xs text-muted">{max}{unit}</Text>
    </View>
  );
}

export default function NutritionScreen() {
  const colors = useColors();
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [activeMeal, setActiveMeal] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [expandedMeals, setExpandedMeals] = useState<number[]>([]);

  useEffect(() => {
    getDailyNutrition(today).then(setNutrition);
  }, []);

  const totals = nutrition ? getMacroTotals(nutrition.meals) : { protein: 0, carbs: 0, fat: 0, calories: 0 };

  const handleAddFood = useCallback(async (food: FoodSearchResult) => {
    const updated = await addFoodEntry(today, {
      mealNumber: activeMeal,
      foodName: `${food.name} (${food.servingLabel})`,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      calories: food.calories,
    });
    setNutrition(updated);
    setShowFoodSearch(false);
  }, [activeMeal, today]);

  const handleDeleteFood = async (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await removeFoodEntry(today, id);
    setNutrition(updated);
  };

  const handleToggleSupplement = async (index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await toggleSupplement(today, index);
    setNutrition(updated);
  };

  const openFoodSearch = (mealNum: 1 | 2 | 3 | 4 | 5) => {
    setActiveMeal(mealNum);
    setShowFoodSearch(true);
  };

  const getMealFoods = (mealNum: number): FoodEntry[] =>
    nutrition?.meals.filter(m => m.mealNumber === mealNum) || [];

  const getMealCals = (mealNum: number): number =>
    getMealFoods(mealNum).reduce((s, f) => s + f.calories, 0);

  const toggleMeal = (meal: number) => {
    setExpandedMeals(prev =>
      prev.includes(meal) ? prev.filter(m => m !== meal) : [...prev, meal]
    );
  };

  if (!nutrition) return null;

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <IconSymbol name="chevron.left" size={24} color={colors.muted} />
        </TouchableOpacity>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Nutrition</Text>
            <Text className="text-xs text-muted mt-0.5">
              {nutrition.isTrainingDay ? '🏋️ Training Day' : '😴 Rest Day'} · {nutrition.targetCalories} kcal target
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => openFoodSearch(1)}
            className="flex-row items-center px-3 py-2 rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <IconSymbol name="magnifyingglass" size={14} color="#FFFFFF" />
            <Text className="text-white text-sm font-medium ml-1.5">Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Macro rings */}
        <View className="mx-6 mb-4 rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View className="flex-row justify-around">
            <MacroRing value={totals.calories} max={nutrition.targetCalories} label="Calories" color="#F59E0B" unit="kcal" />
            <MacroRing value={totals.protein} max={nutrition.targetProtein} label="Protein" color="#3B82F6" />
            <MacroRing value={totals.carbs} max={nutrition.targetCarbs} label="Carbs" color="#10B981" />
            <MacroRing value={totals.fat} max={nutrition.targetFat} label="Fat" color="#EF4444" />
          </View>

          {/* Remaining */}
          <View className="flex-row mt-4 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
            {[
              { label: 'Cal', value: Math.max(0, nutrition.targetCalories - totals.calories), color: '#F59E0B' },
              { label: 'Protein', value: Math.max(0, nutrition.targetProtein - totals.protein), color: '#3B82F6' },
              { label: 'Carbs', value: Math.max(0, nutrition.targetCarbs - totals.carbs), color: '#10B981' },
              { label: 'Fat', value: Math.max(0, nutrition.targetFat - totals.fat), color: '#EF4444' },
            ].map(r => (
              <View key={r.label} className="flex-1 items-center">
                <Text className="text-xs text-muted">{r.label} left</Text>
                <Text className="text-sm font-bold" style={{ color: r.color }}>{Math.round(r.value)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Meals */}
        <View className="px-6 mb-4">
          <Text className="text-xs font-medium text-muted mb-3" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Meals
          </Text>

          {MEAL_SCHEDULE.map(meal => {
            const foods = getMealFoods(meal.meal as 1 | 2 | 3 | 4 | 5);
            const cals = getMealCals(meal.meal);
            const isExpanded = expandedMeals.includes(meal.meal);

            return (
              <View key={meal.meal} className="mb-2">
                <TouchableOpacity
                  onPress={() => toggleMeal(meal.meal)}
                  className="flex-row items-center rounded-2xl px-4 py-3"
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                >
                  <View
                    className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + '15' }}
                  >
                    <Text className="text-xs font-bold" style={{ color: colors.primary }}>{meal.meal}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Meal {meal.meal}</Text>
                    <Text className="text-xs text-muted">{meal.time} · {meal.focus.split('(')[0].trim()}</Text>
                  </View>
                  <View className="items-end mr-2">
                    <Text className="text-sm font-semibold text-foreground">{cals} kcal</Text>
                    <Text className="text-xs text-muted">{meal.kcal} target</Text>
                  </View>
                  <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={14} color={colors.muted} />
                </TouchableOpacity>

                {isExpanded && (
                  <View className="mt-1 ml-2 mr-2 px-3 pb-3 rounded-b-xl" style={{ backgroundColor: colors.surface }}>
                    {foods.map(food => (
                      <View key={food.id} className="flex-row items-center py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.border + '50' }}>
                        <View className="flex-1">
                          <Text className="text-sm text-foreground">{food.foodName}</Text>
                          <Text className="text-xs text-muted">
                            P:{food.protein}g C:{food.carbs}g F:{food.fat}g · {food.calories}kcal
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteFood(food.id)} className="p-2">
                          <IconSymbol name="trash" size={14} color={colors.error || '#EF4444'} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={() => openFoodSearch(meal.meal as 1 | 2 | 3 | 4 | 5)}
                      className="flex-row items-center justify-center py-3 mt-2 rounded-xl"
                      style={{ borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}
                    >
                      <IconSymbol name="magnifyingglass" size={14} color={colors.muted} />
                      <Text className="text-sm text-muted ml-2">Search UAE Foods</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Supplements */}
        <View className="px-6 mb-4">
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <View className="flex-row items-center mb-3">
              <Text style={{ fontSize: 16 }}>💊</Text>
              <Text className="text-sm font-semibold text-foreground ml-2">Supplements</Text>
              <Text className="ml-auto text-xs text-muted">
                {nutrition.supplementsChecked.filter(s => s.taken).length}/{nutrition.supplementsChecked.length} taken
              </Text>
            </View>

            {nutrition.supplementsChecked.map((supp, i) => (
              <TouchableOpacity
                key={supp.name}
                onPress={() => handleToggleSupplement(i)}
                className="flex-row items-center p-3 rounded-xl mb-1"
                style={{
                  backgroundColor: supp.taken ? '#8B5CF6' + '10' : colors.background,
                  borderWidth: 1,
                  borderColor: supp.taken ? '#8B5CF6' + '30' : 'transparent',
                }}
              >
                <View
                  className="w-6 h-6 rounded-full items-center justify-center mr-3"
                  style={{
                    borderWidth: 2,
                    borderColor: supp.taken ? '#8B5CF6' : colors.border,
                    backgroundColor: supp.taken ? '#8B5CF6' : 'transparent',
                  }}
                >
                  {supp.taken && <IconSymbol name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium" style={{ color: supp.taken ? '#8B5CF6' : colors.foreground }}>
                    {supp.name}
                  </Text>
                  <Text className="text-xs text-muted">{supp.dose} · {supp.timing}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Food Search Modal */}
      <Modal visible={showFoodSearch} animationType="slide" presentationStyle="pageSheet">
        <FoodSearch
          onAdd={handleAddFood}
          onClose={() => setShowFoodSearch(false)}
          mealNumber={activeMeal}
        />
      </Modal>
    </ScreenContainer>
  );
}
