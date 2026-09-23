// ============================================================
// COACH GATE — "linked to a coach but no plan yet" state.
//
// When a trainee is linked to Coach Mohamad the app must NOT fall back to
// the built-in default schedule / default exercises: the trainee waits for
// the coach's plan, and everything they train comes from that plan.
// This module holds that one flag so schedule-store, custom-program-store
// and the Home screen can all read it without importing each other.
// Written by coach-plan-sync on every sync.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@coach_gate_v1';

export interface CoachGateState {
  /** Trainee has an active link to a coach. */
  linked: boolean;
  /** A coach workout plan is applied locally. */
  hasPlan: boolean;
  coachName: string | null;
  updatedAt: string;
}

const NONE: CoachGateState = { linked: false, hasPlan: false, coachName: null, updatedAt: '' };

export async function loadCoachGate(): Promise<CoachGateState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...NONE, ...JSON.parse(raw) } : NONE;
  } catch {
    return NONE;
  }
}

export async function saveCoachGate(state: Omit<CoachGateState, 'updatedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
  } catch {
    // best-effort
  }
}

export async function clearCoachGate(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* best-effort */ }
}

/**
 * True whenever no coach plan is applied — linked or not. There is no
 * built-in default programme any more: every athlete trains what their
 * coach sends, and an unlinked athlete is told to link first
 * (Yehia, 2026-09-23: "anyone who signs in ... always wait for the coach plans").
 */
export async function isWaitingForCoachPlan(): Promise<boolean> {
  const g = await loadCoachGate();
  return !g.hasPlan;
}
