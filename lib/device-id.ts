/**
 * Persistent device identifier.
 * Generated once on first launch and stored in AsyncStorage.
 * Used as the user identifier for WHOOP OAuth and cloud sync
 * when the app runs without user authentication.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@gym_tracker_device_id';
let _cachedDeviceId: string | null = null;

function generateId(): string {
  // UUID v4 without crypto dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  if (_cachedDeviceId) return _cachedDeviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      _cachedDeviceId = stored;
      return stored;
    }
    const newId = generateId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    _cachedDeviceId = newId;
    return newId;
  } catch {
    // Fallback — not persisted but won't crash
    _cachedDeviceId = generateId();
    return _cachedDeviceId;
  }
}
