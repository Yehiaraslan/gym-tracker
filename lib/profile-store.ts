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

export interface UserProfile {
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  profilePhotoUri: string | null;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: string;
  weightKg: string;
  fitnessGoal: 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance' | '';
  experienceLevel: ExperienceLevel;
  equipment: EquipmentAccess;
  onboardingCompleted: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  dateOfBirth: '',
  profilePhotoUri: null,
  gender: '',
  heightCm: '',
  weightKg: '',
  fitnessGoal: '',
  experienceLevel: '',
  equipment: '',
  onboardingCompleted: false,
};

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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
