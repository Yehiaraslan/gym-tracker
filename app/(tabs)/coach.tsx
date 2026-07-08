// ============================================================
// AI COACH TAB — Redirects directly to Zaki AI Coaching Dashboard
// Wrapped in a REAL error boundary (componentDidCatch) so dashboard
// crashes show an on-screen error instead of killing the app.
// ============================================================
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

function CoachRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('../ai-coaching-dashboard' as any);
  }, [router]);
  return <View style={{ flex: 1 }} />;
}

type BoundaryState = { error: Error | null };

class CoachErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CoachBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0B0A', padding: 20, justifyContent: 'center' }}>
        <View style={{
          backgroundColor: '#1A1D1A',
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: '#F8717140',
        }}>
          <Text style={{ color: '#F87171', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            AI Coach hit an error
          </Text>
          <Text style={{ color: '#F5F5F5', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            {error.name}: {error.message}
          </Text>
          <ScrollView style={{ maxHeight: 220, marginBottom: 16 }}>
            <Text style={{ color: '#7A8070', fontSize: 11, fontFamily: 'monospace' }}>
              {error.stack || 'No stack trace available'}
            </Text>
          </ScrollView>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={{
              backgroundColor: '#C8F53C',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#0A0B0A', fontSize: 15, fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

export default function CoachTab() {
  return (
    <CoachErrorBoundary>
      <CoachRedirect />
    </CoachErrorBoundary>
  );
}
