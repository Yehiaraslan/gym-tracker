/**
 * PIN Sync Store
 *
 * Manages the cross-device identity state:
 * - Whether this device has linked to a PIN
 * - The resolved userOpenId for cloud sync
 * - Last sync timestamp
 *
 * The userOpenId is stored locally so the app doesn't need to
 * call the server on every launch — only when setting up or
 * changing the PIN.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_SYNC_KEY = '@gym_tracker_pin_sync';

export interface PinSyncState {
  linked: boolean;
  userOpenId: string | null;
  displayName: string | null;
  linkedAt: string | null; // ISO timestamp
  lastSyncAt: string | null; // ISO timestamp
}

const DEFAULT_STATE: PinSyncState = {
  linked: false,
  userOpenId: null,
  displayName: null,
  linkedAt: null,
  lastSyncAt: null,
};

export async function loadPinSyncState(): Promise<PinSyncState> {
  try {
    const raw = await AsyncStorage.getItem(PIN_SYNC_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function savePinSyncState(state: PinSyncState): Promise<void> {
  await AsyncStorage.setItem(PIN_SYNC_KEY, JSON.stringify(state));
}

export async function setPinLinked(userOpenId: string, displayName: string | null): Promise<void> {
  await savePinSyncState({
    linked: true,
    userOpenId,
    displayName,
    linkedAt: new Date().toISOString(),
    lastSyncAt: null,
  });
}

export async function clearPinLink(): Promise<void> {
  await savePinSyncState(DEFAULT_STATE);
}

export async function updateLastSync(): Promise<void> {
  const state = await loadPinSyncState();
  await savePinSyncState({ ...state, lastSyncAt: new Date().toISOString() });
}
