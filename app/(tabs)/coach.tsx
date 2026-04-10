// ============================================================
// AI COACH TAB — Redirects directly to Zaki AI Coaching Dashboard
// Form Coach has been removed; Zaki is the single AI interface.
// ============================================================
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function CoachTab() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ai-coaching-dashboard' as any);
  }, []);
  return <View style={{ flex: 1 }} />;
}
