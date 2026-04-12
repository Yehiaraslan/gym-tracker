import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym_streak_shields';

interface StreakShieldData {
  totalShields: number;
  usedDates: string[]; // ISO date strings when shields were used
  lastEarnedMonth: string; // 'YYYY-MM' — earn 1 shield per month
}

export async function getStreakShieldData(): Promise<StreakShieldData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { totalShields: 1, usedDates: [], lastEarnedMonth: '' };
  return JSON.parse(raw);
}

export async function earnMonthlyShield(): Promise<boolean> {
  const data = await getStreakShieldData();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (data.lastEarnedMonth === currentMonth) return false;
  data.totalShields++;
  data.lastEarnedMonth = currentMonth;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return true;
}

export async function useStreakShield(): Promise<boolean> {
  const data = await getStreakShieldData();
  const availableShields = data.totalShields - data.usedDates.length;
  if (availableShields <= 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (data.usedDates.includes(today)) return false;
  data.usedDates.push(today);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return true;
}

export async function getAvailableShields(): Promise<number> {
  const data = await getStreakShieldData();
  return data.totalShields - data.usedDates.length;
}
