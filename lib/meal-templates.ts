import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym_meal_templates';

export interface MealTemplate {
  id: string;
  name: string;
  foods: Array<{
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingGrams: number;
  }>;
  totalCalories: number;
  totalProtein: number;
  createdAt: string;
}

export async function getMealTemplates(): Promise<MealTemplate[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveMealTemplate(template: Omit<MealTemplate, 'id' | 'createdAt'>): Promise<MealTemplate> {
  const templates = await getMealTemplates();
  const newTemplate: MealTemplate = {
    ...template,
    id: `tpl_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  templates.unshift(newTemplate);
  if (templates.length > 20) templates.pop();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return newTemplate;
}

export async function deleteMealTemplate(id: string): Promise<void> {
  const templates = await getMealTemplates();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(templates.filter(t => t.id !== id)));
}
