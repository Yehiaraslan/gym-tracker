// ============================================================
// PHOTO DEBUG LOGGER
// In-memory + AsyncStorage logger for diagnosing photo issues.
// Access the debug panel by long-pressing "Progress Photos" title.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_KEY = '@photo_debug_log';
const MAX_ENTRIES = 80;

export interface DebugEntry {
  ts: string;
  tag: string;
  msg: string;
  data?: string;
}

let memLog: DebugEntry[] = [];

/**
 * Log a debug entry. Writes to both in-memory array and AsyncStorage.
 * Safe to call anywhere — never throws.
 */
export function photoDebug(tag: string, msg: string, data?: any): void {
  const entry: DebugEntry = {
    ts: new Date().toISOString(),
    tag,
    msg,
    data: data !== undefined ? safeStringify(data, 600) : undefined,
  };
  memLog.push(entry);
  if (memLog.length > MAX_ENTRIES) memLog.shift();

  // Console log for adb logcat / metro
  console.log(`[PhotoDebug:${tag}] ${msg}`, data ?? '');

  // Persist (fire-and-forget — never block caller)
  AsyncStorage.getItem(DEBUG_KEY)
    .then((raw) => {
      const arr: DebugEntry[] = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      if (arr.length > MAX_ENTRIES) arr.splice(0, arr.length - MAX_ENTRIES);
      return AsyncStorage.setItem(DEBUG_KEY, JSON.stringify(arr));
    })
    .catch(() => {});
}

/**
 * Retrieve the full debug log (merged memory + persisted).
 */
export async function getPhotoDebugLog(): Promise<DebugEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DEBUG_KEY);
    const persisted: DebugEntry[] = raw ? JSON.parse(raw) : [];
    const seen = new Set(persisted.map((e) => e.ts + e.msg));
    const merged = [
      ...persisted,
      ...memLog.filter((e) => !seen.has(e.ts + e.msg)),
    ];
    return merged.sort((a, b) => a.ts.localeCompare(b.ts)).slice(-MAX_ENTRIES);
  } catch {
    return [...memLog];
  }
}

/**
 * Clear all debug log entries.
 */
export async function clearPhotoDebugLog(): Promise<void> {
  memLog = [];
  await AsyncStorage.removeItem(DEBUG_KEY).catch(() => {});
}

/**
 * Format the entire log as a copyable string (for sharing / pasting).
 */
export async function exportPhotoDebugLog(): Promise<string> {
  const entries = await getPhotoDebugLog();
  if (entries.length === 0) return '(empty debug log)';
  return entries
    .map((e) => {
      const time = e.ts.replace('T', ' ').replace('Z', '');
      const dataStr = e.data ? `\n   ↳ ${e.data}` : '';
      return `[${time}] [${e.tag}] ${e.msg}${dataStr}`;
    })
    .join('\n');
}

// ── Helpers ──────────────────────────────────────────────────

function safeStringify(obj: any, maxLen: number): string {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  } catch {
    return String(obj).slice(0, maxLen);
  }
}
