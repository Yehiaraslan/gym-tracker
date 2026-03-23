// ============================================================
// PROFILE SCREEN
// User profile: name, date of birth, profile photo
// Data stored in lib/profile-store.ts
// ============================================================
import { useState, useEffect } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import {
  loadUserProfile,
  saveUserProfile,
  calculateAge,
  type UserProfile,
} from '@/lib/profile-store';
import { loadPinSyncState, type PinSyncState } from '@/lib/pin-sync-store';

const GOALS: { key: UserProfile['fitnessGoal']; label: string; emoji: string }[] = [
  { key: 'muscle_gain', label: 'Muscle Gain', emoji: '💪' },
  { key: 'fat_loss', label: 'Fat Loss', emoji: '🔥' },
  { key: 'strength', label: 'Strength', emoji: '🏋️' },
  { key: 'endurance', label: 'Endurance', emoji: '🏃' },
];

const GENDERS: { key: UserProfile['gender']; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  dateOfBirth: '',
  profilePhotoUri: null,
  gender: '',
  heightCm: '',
  weightKg: '',
  fitnessGoal: '',
};

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncState, setSyncState] = useState<PinSyncState | null>(null);

  useEffect(() => {
    loadUserProfile().then(setProfile);
    loadPinSyncState().then(setSyncState);
  }, []);

  // Refresh sync state when returning from pin-sync screen
  useFocusEffect(useCallback(() => {
    loadPinSyncState().then(setSyncState);
  }, []));

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfile(p => ({ ...p, profilePhotoUri: result.assets[0].uri }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access to take a profile picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfile(p => ({ ...p, profilePhotoUri: result.assets[0].uri }));
    }
  };

  const handlePhotoPress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Profile Photo', 'Choose how to set your profile picture', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to save your profile.');
      return;
    }
    setSaving(true);
    await saveUserProfile(profile);
    setSaving(false);
    setSaved(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2000);
  };

  const age = calculateAge(profile.dateOfBirth);

  const formatSyncDate = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color={colors.muted} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handlePhotoPress} activeOpacity={0.85} style={styles.photoWrapper}>
            {profile.profilePhotoUri ? (
              <Image
                source={{ uri: profile.profilePhotoUri }}
                style={[styles.photo, { borderColor: colors.primary }]}
              />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.photoEmoji}>👤</Text>
              </View>
            )}
            <View style={[styles.photoEditBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.photoEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          {profile.name ? (
            <Text style={[styles.photoName, { color: colors.foreground }]}>{profile.name}</Text>
          ) : null}
          {age !== null ? (
            <Text style={[styles.photoAge, { color: colors.muted }]}>{age} years old</Text>
          ) : null}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.muted }]}>FULL NAME</Text>
            <TextInput
              value={profile.name}
              onChangeText={v => setProfile(p => ({ ...p, name: v }))}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              returnKeyType="done"
            />
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.muted }]}>DATE OF BIRTH</Text>
            <TextInput
              value={profile.dateOfBirth}
              onChangeText={v => setProfile(p => ({ ...p, dateOfBirth: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="done"
            />
            {age !== null && (
              <Text style={[styles.hint, { color: colors.primary }]}>Age: {age} years old</Text>
            )}
          </View>

          {/* Gender */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.muted }]}>GENDER</Text>
            <View style={styles.chipRow}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setProfile(p => ({ ...p, gender: g.key }))}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: profile.gender === g.key ? colors.primary : colors.surface,
                      borderColor: profile.gender === g.key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: profile.gender === g.key ? '#FFFFFF' : colors.foreground }]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Height & Weight */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>HEIGHT (CM)</Text>
              <TextInput
                value={profile.heightCm}
                onChangeText={v => setProfile(p => ({ ...p, heightCm: v }))}
                placeholder="175"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.label, { color: colors.muted }]}>WEIGHT (KG)</Text>
              <TextInput
                value={profile.weightKg}
                onChangeText={v => setProfile(p => ({ ...p, weightKg: v }))}
                placeholder="80"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Fitness Goal */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.muted }]}>FITNESS GOAL</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setProfile(p => ({ ...p, fitnessGoal: g.key }))}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: profile.fitnessGoal === g.key ? colors.primary + '20' : colors.surface,
                      borderColor: profile.fitnessGoal === g.key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.goalEmoji}>{g.emoji}</Text>
                  <Text style={[styles.goalLabel, { color: profile.fitnessGoal === g.key ? colors.primary : colors.foreground }]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Cloud Sync Card */}
        <View style={[styles.syncCard, {
          backgroundColor: colors.surface,
          borderColor: syncState?.linked ? '#22C55E40' : colors.border,
          borderLeftColor: syncState?.linked ? '#22C55E' : colors.border,
        }]}>
          <View style={styles.syncRow}>
            <View style={[styles.syncDot, { backgroundColor: syncState?.linked ? '#22C55E' : '#94A3B8' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.syncTitle, { color: colors.foreground }]}>Cloud Sync</Text>
              <Text style={[styles.syncSubtitle, { color: colors.muted }]}>
                {syncState?.linked
                  ? `Linked · Last sync: ${formatSyncDate(syncState.lastSyncAt)}`
                  : 'Tap to set up cross-device sync'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/pin-sync' as any)}
              style={[styles.syncBtn, {
                backgroundColor: syncState?.linked ? '#22C55E15' : colors.primary + '15',
                borderColor: syncState?.linked ? '#22C55E' : colors.primary,
              }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.syncBtnText, { color: syncState?.linked ? '#22C55E' : colors.primary }]}>
                {syncState?.linked ? 'Manage' : 'Set Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: saved ? '#10B981' : colors.primary }]}
          >
            <Text style={styles.saveBtnText}>
              {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  photoSection: { alignItems: 'center', paddingVertical: 24 },
  photoWrapper: { position: 'relative', marginBottom: 12 },
  photo: { width: 100, height: 100, borderRadius: 50, borderWidth: 3 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  photoEmoji: { fontSize: 40 },
  photoEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  photoEditIcon: { fontSize: 14 },
  photoName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  photoAge: { fontSize: 14 },
  form: { paddingHorizontal: 16 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  hint: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600' },
  goalChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalEmoji: { fontSize: 16 },
  goalLabel: { fontSize: 13, fontWeight: '600' },
  // Cloud sync card
  syncCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, padding: 14, borderWidth: 1, borderLeftWidth: 4 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  syncDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  syncTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  syncSubtitle: { fontSize: 12, lineHeight: 16 },
  syncBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, flexShrink: 0 },
  syncBtnText: { fontSize: 13, fontWeight: '600' },
  // Save
  saveSection: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  saveBtn: { height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
