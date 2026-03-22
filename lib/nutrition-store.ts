// ============================================================
// NUTRITION STORE — Daily meal tracking with macro targets
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncNutritionDay } from './db-sync-fetch';
import { isTrainingDay, NUTRITION_TARGETS, SUPPLEMENTS } from './training-program';

// ---- Types ----

export interface FoodEntry {
  id: string;
  mealNumber: 1 | 2 | 3 | 4 | 5;
  foodName: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  timestamp: string;
}

export interface SupplementCheck {
  name: string;
  dose: string;
  timing: string;
  taken: boolean;
}

export interface DailyNutrition {
  date: string;
  isTrainingDay: boolean;
  meals: FoodEntry[];
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  supplementsChecked: SupplementCheck[];
}

// ---- Storage ----

const NUTRITION_KEY = '@gym_tracker_nutrition';

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultNutrition(date?: string): DailyNutrition {
  const d = date || getTodayString();
  const training = isTrainingDay(new Date(d + 'T00:00:00'));
  const targets = training ? NUTRITION_TARGETS.training : NUTRITION_TARGETS.rest;
  return {
    date: d,
    isTrainingDay: training,
    meals: [],
    targetCalories: targets.calories,
    targetProtein: targets.protein,
    targetCarbs: targets.carbs,
    targetFat: targets.fat,
    supplementsChecked: SUPPLEMENTS.map(s => ({ ...s, taken: false })),
  };
}

export async function getDailyNutrition(date?: string): Promise<DailyNutrition> {
  const d = date || getTodayString();
  try {
    const allData = await AsyncStorage.getItem(NUTRITION_KEY);
    if (allData) {
      const parsed: Record<string, DailyNutrition> = JSON.parse(allData);
      if (parsed[d]) return parsed[d];
    }
  } catch (_e) { /* ignore */ }
  return getDefaultNutrition(d);
}

export async function saveDailyNutrition(nutrition: DailyNutrition): Promise<void> {
  try {
    const allData = await AsyncStorage.getItem(NUTRITION_KEY);
    const parsed: Record<string, DailyNutrition> = allData ? JSON.parse(allData) : {};
    parsed[nutrition.date] = nutrition;
    await AsyncStorage.setItem(NUTRITION_KEY, JSON.stringify(parsed));
  } catch (_e) { /* ignore */ }
  // Mirror to cloud DB — fire-and-forget, never blocks UX
  const totals = nutrition.meals.reduce(
    (acc, m) => ({ cal: acc.cal + m.calories, prot: acc.prot + m.protein, carb: acc.carb + m.carbs, fat: acc.fat + m.fat }),
    { cal: 0, prot: 0, carb: 0, fat: 0 },
  );
  syncNutritionDay({
    date: nutrition.date,
    isTrainingDay: nutrition.isTrainingDay,
    targetCalories: nutrition.targetCalories,
    targetProtein: nutrition.targetProtein,
    targetCarbs: nutrition.targetCarbs,
    targetFat: nutrition.targetFat,
    totalCalories: totals.cal,
    totalProtein: totals.prot,
    totalCarbs: totals.carb,
    totalFat: totals.fat,
    meals: nutrition.meals.map(food => ({
      mealNumber: food.mealNumber,
      foodName: food.foodName,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      servingGrams: 100,
      timestamp: food.timestamp,
    })),
    supplementsTaken: nutrition.supplementsChecked?.filter(s => s.taken).length ?? 0,
    supplementsTotal: nutrition.supplementsChecked?.length ?? 0,
  });
}

export async function addFoodEntry(date: string, entry: Omit<FoodEntry, 'id' | 'timestamp'>): Promise<DailyNutrition> {
  const nutrition = await getDailyNutrition(date);
  const newEntry: FoodEntry = {
    ...entry,
    id: makeId(),
    timestamp: new Date().toISOString(),
  };
  nutrition.meals.push(newEntry);
  await saveDailyNutrition(nutrition);
  return nutrition;
}

export async function removeFoodEntry(date: string, entryId: string): Promise<DailyNutrition> {
  const nutrition = await getDailyNutrition(date);
  nutrition.meals = nutrition.meals.filter(m => m.id !== entryId);
  await saveDailyNutrition(nutrition);
  return nutrition;
}

export async function toggleSupplement(date: string, index: number): Promise<DailyNutrition> {
  const nutrition = await getDailyNutrition(date);
  if (nutrition.supplementsChecked[index]) {
    nutrition.supplementsChecked[index].taken = !nutrition.supplementsChecked[index].taken;
  }
  await saveDailyNutrition(nutrition);
  return nutrition;
}

export async function getRecentNutrition(days = 7): Promise<DailyNutrition[]> {
  try {
    const allData = await AsyncStorage.getItem(NUTRITION_KEY);
    if (!allData) return [];
    const parsed: Record<string, DailyNutrition> = JSON.parse(allData);
    return Object.values(parsed)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  } catch (_e) {
    return [];
  }
}

// ---- Macro helpers ----

export function getMacroTotals(meals: FoodEntry[]) {
  return meals.reduce(
    (acc, food) => ({
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fat: acc.fat + food.fat,
      calories: acc.calories + food.calories,
    }),
    { protein: 0, carbs: 0, fat: 0, calories: 0 },
  );
}

export function getMacroCalories(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}
