// ============================================================
// PROFILE STORE
// User profile: name, date of birth, profile photo, fitness goal,
// experience level, available equipment, onboarding status
// Stored locally in AsyncStorage
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@gym_user_profile';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | '';
export type EquipmentAccess = 'full_gym' | 'home_dumbbells' | 'bodyweight' | '';
/** 1 = mostly sedentary … 4 = walking + physical activity; 0 = not set */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;
export type FocusMuscle =
  | 'chest' | 'triceps' | 'lats' | 'biceps' | 'shoulders' | 'abs'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'back' | 'forearms';
/** 1 = Monday … 7 = Sunday (ISO weekday) */
export type ReminderDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface ReminderSettings {
  enabled: boolean;
  /** ISO weekday → "HH:mm" (24h). Days absent are off. */
  times: Partial<Record<ReminderDay, string>>;
}

export interface UserProfile {
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  profilePhotoUri: string | null;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: string;
  weightKg: string;
  heightUnit: 'cm' | 'ft';
  weightUnit: 'kg' | 'lb';
  fitnessGoal: 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance' | '';
  activityLevel: ActivityLevel;
  experienceLevel: ExperienceLevel;
  focusMuscles: FocusMuscle[];
  trainingDaysPerWeek: number; // 0 = not set
  equipment: EquipmentAccess;
  reminders: ReminderSettings;
  onboardingCompleted: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  dateOfBirth: '',
  profilePhotoUri: null,
  gender: '',
  heightCm: '',
  weightKg: '',
  heightUnit: 'cm',
  weightUnit: 'kg',
  fitnessGoal: '',
  activityLevel: 0,
  experienceLevel: '',
  focusMuscles: [],
  trainingDaysPerWeek: 0,
  equipment: '',
  reminders: { enabled: false, times: {} },
  onboardingCompleted: false,
};

// The profile is stored PER ACCOUNT. A phone that signs out of one account and
// into another must not carry the first account's name, goal or "onboarding
// done" flag across (2026-09-18: a fresh sign-up skipped onboarding because the
// previous tester's profile sat under one shared key). Signed-out / guest
// sessions fall back to the legacy shared key.
async function profileKey(): Promise<string> {
  try {
    const Auth = await import('@/lib/_core/auth');
    const info = await Auth.getUserInfo();
    if (info?.openId && info.id !== 0) return `${PROFILE_KEY}:${info.openId}`;
  } catch {
    // fall through
  }
  return PROFILE_KEY;
}

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(await profileKey());
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Called right after a NEW account is created: start that account from a blank
 * profile (carrying only the sign-up name) so the onboarding always runs for it.
 */
export async function resetProfileForNewAccount(openId: string, name?: string | null): Promise<void> {
  const fresh: UserProfile = { ...DEFAULT_PROFILE, name: (name ?? '').trim() };
  await AsyncStorage.setItem(`${PROFILE_KEY}:${openId}`, JSON.stringify(fresh));
  profileListeners.forEach((listener) => listener());
}

/** Sign-out hygiene: drop the legacy shared profile so it can never leak into the next login. */
export async function clearLegacySharedProfile(): Promise<void> {
  try { await AsyncStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
}

// The root AuthGate caches "needs onboarding" from a one-time profile read;
// saves must notify it (and any other subscriber) or completing onboarding
// bounces the user back to step 1.
const profileListeners = new Set<() => void>();

export function subscribeProfileChanges(listener: () => void): () => void {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(await profileKey(), JSON.stringify(profile));
  // Keep the signed-in identity's display name in step with the profile so
  // the account never shows as a generic "Guest".
  if (profile.name && profile.name.trim()) {
    try {
      const Auth = await import('@/lib/_core/auth');
      const info = await Auth.getUserInfo();
      if (info && info.name !== profile.name.trim()) {
        await Auth.setUserInfo({ ...info, name: profile.name.trim() });
      }
    } catch {
      // non-fatal — profile save already succeeded
    }
  }
  profileListeners.forEach((listener) => listener());
}

export function calculateAge(dob: string): number | null {
  if (!dob || dob.length < 10) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
