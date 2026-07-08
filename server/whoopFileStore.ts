/**
 * File-backed WHOOP storage for DB-less single-user deployments.
 * Holds OAuth CSRF states, tokens, the data cache and recovery history in a
 * mode-0600 JSON file next to the server. Swapped in by whoopStateDb/whoopDb
 * whenever DATABASE_URL is unset.
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync } from "fs";
import { join, dirname } from "path";

const STORE_PATH = join(process.cwd(), "server", "data", "whoop-store.json");

type Store = {
  states: Record<string, { userOpenId: string | null; expiresAt: number }>;
  tokens: Record<string, {
    userOpenId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope?: string | null;
    whoopUserId?: string | null;
  }>;
  cache: Record<string, {
    userOpenId: string;
    recoveryJson: string | null;
    sleepJson: string | null;
    cycleJson: string | null;
    workoutJson: string | null;
    lastSyncedAt: string;
  }>;
  recoveryHistory: Record<string, Record<string, unknown>[]>; // openId -> rows
};

function load(): Store {
  try {
    return { states: {}, tokens: {}, cache: {}, recoveryHistory: {}, ...JSON.parse(readFileSync(STORE_PATH, "utf8")) };
  } catch {
    return { states: {}, tokens: {}, cache: {}, recoveryHistory: {} };
  }
}

function save(store: Store): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, STORE_PATH);
  try {
    chmodSync(STORE_PATH, 0o600);
  } catch {
    // best effort
  }
}

// ── OAuth states ─────────────────────────────────────────────
export function fileCreateState(state: string, userOpenId: string | null, expiresAt: number): void {
  const s = load();
  // opportunistic cleanup of expired states
  for (const [k, v] of Object.entries(s.states)) {
    if (v.expiresAt < Date.now()) delete s.states[k];
  }
  s.states[state] = { userOpenId, expiresAt };
  save(s);
}

export function fileConsumeState(state: string): { valid: boolean; userOpenId?: string } {
  const s = load();
  const row = s.states[state];
  if (!row) return { valid: false };
  delete s.states[state];
  save(s);
  if (row.expiresAt < Date.now()) return { valid: false };
  return { valid: true, userOpenId: row.userOpenId ?? undefined };
}

// ── Tokens ───────────────────────────────────────────────────
export function fileSaveTokens(data: Store["tokens"][string]): void {
  const s = load();
  s.tokens[data.userOpenId] = { ...s.tokens[data.userOpenId], ...data };
  save(s);
}

export function fileGetTokens(userOpenId: string) {
  return load().tokens[userOpenId] ?? null;
}

export function fileDeleteTokens(userOpenId: string): void {
  const s = load();
  delete s.tokens[userOpenId];
  delete s.cache[userOpenId];
  save(s);
}

// ── Data cache ───────────────────────────────────────────────
export function fileSaveCache(userOpenId: string, data: {
  recoveryJson?: string; sleepJson?: string; cycleJson?: string; workoutJson?: string;
}): void {
  const s = load();
  const prev = s.cache[userOpenId] ?? {
    userOpenId, recoveryJson: null, sleepJson: null, cycleJson: null, workoutJson: null,
    lastSyncedAt: new Date().toISOString(),
  };
  s.cache[userOpenId] = {
    ...prev,
    ...(data.recoveryJson !== undefined && { recoveryJson: data.recoveryJson }),
    ...(data.sleepJson !== undefined && { sleepJson: data.sleepJson }),
    ...(data.cycleJson !== undefined && { cycleJson: data.cycleJson }),
    ...(data.workoutJson !== undefined && { workoutJson: data.workoutJson }),
    lastSyncedAt: new Date().toISOString(),
  };
  save(s);
}

export function fileGetCache(userOpenId: string) {
  const row = load().cache[userOpenId];
  return row ? { ...row, lastSyncedAt: new Date(row.lastSyncedAt) } : null;
}

// ── Recovery history ─────────────────────────────────────────
export function fileUpsertRecoveryHistory(data: { userOpenId: string; date: string } & Record<string, unknown>): void {
  const s = load();
  const rows = s.recoveryHistory[data.userOpenId] ?? [];
  s.recoveryHistory[data.userOpenId] = [
    ...rows.filter((r) => r.date !== data.date),
    data,
  ];
  save(s);
}

export function fileGetRecoveryHistory(userOpenId: string, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return (load().recoveryHistory[userOpenId] ?? [])
    .filter((r) => String(r.date) >= cutoffStr)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, days);
}
