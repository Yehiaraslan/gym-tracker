import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym_water_tracking';

export interface WaterData {
  date: string;
  glasses: number;
  target: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getWaterData(): Promise<WaterData> {
  const key = todayKey();
  const raw = await AsyncStorage.getItem(`${STORAGE_KEY}_${key}`);
  if (raw) return JSON.parse(raw);
  return { date: key, glasses: 0, target: 8 };
}

export async function addGlass(): Promise<WaterData> {
  const data = await getWaterData();
  data.glasses = Math.min(data.glasses + 1, 20);
  await AsyncStorage.setItem(`${STORAGE_KEY}_${data.date}`, JSON.stringify(data));
  return data;
}

export async function removeGlass(): Promise<WaterData> {
  const data = await getWaterData();
  data.glasses = Math.max(data.glasses - 1, 0);
  await AsyncStorage.setItem(`${STORAGE_KEY}_${data.date}`, JSON.stringify(data));
  return data;
}
