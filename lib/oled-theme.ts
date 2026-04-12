import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym_oled_mode';

export const OLED_OVERRIDES = {
  background: '#000000',
  surface: '#0A0A0A',
  border: '#1A1A1A',
  cardBorder: '#1E1E1E',
};

export async function isOLEDMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === 'true';
}

export async function toggleOLEDMode(): Promise<boolean> {
  const current = await isOLEDMode();
  await AsyncStorage.setItem(STORAGE_KEY, (!current).toString());
  return !current;
}
