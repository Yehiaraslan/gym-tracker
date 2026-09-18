/**
 * Route-level error screen for expo-router: export as `ErrorBoundary` from a
 * route or layout and render errors show this instead of killing the app.
 */
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

export function RouteErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0B0A', padding: 20, justifyContent: 'center' }}>
      <View
        style={{
          backgroundColor: '#1A1D1A',
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: '#F8717140',
        }}
      >
        <Text style={{ color: '#F87171', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
          Something went wrong on this screen
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
          onPress={retry}
          style={{
            backgroundColor: '#2EBFBF',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#0A0B0A', fontSize: 15, fontWeight: '700' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
