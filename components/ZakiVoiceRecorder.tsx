// ============================================================
// ZAKI VOICE RECORDER — Web fallback (no audio recording)
// Just renders the text input + send button for web.
// The .native.tsx version is used on iOS/Android.
// ============================================================
import { TouchableOpacity, Text, TextInput, View, StyleSheet, ActivityIndicator } from 'react-native';

export interface ZakiVoiceRecorderProps {
  deviceId: string | null;
  chatInput: string;
  setChatInput: (v: string | ((prev: string) => string)) => void;
  onSend: () => void;
  chatLoading: boolean;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
  isTranscribing: boolean;
  setIsTranscribing: (v: boolean) => void;
  transcribeAsync: (base64: string, mimeType: string) => Promise<{ text: string }>;
  colors: {
    background: string;
    cardBorder: string;
    cardMuted: string;
    foreground: string;
  };
}

export function ZakiVoiceRecorder({
  chatInput,
  setChatInput,
  onSend,
  chatLoading,
  colors,
}: ZakiVoiceRecorderProps) {
  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.foreground }]}
        value={chatInput}
        onChangeText={setChatInput}
        placeholder="Ask Zaki anything..."
        placeholderTextColor={colors.cardMuted}
        multiline
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!chatLoading}
      />
      <TouchableOpacity
        onPress={onSend}
        disabled={chatLoading || !chatInput.trim()}
        style={[styles.sendBtn, { opacity: chatLoading || !chatInput.trim() ? 0.4 : 1 }]}
      >
        {chatLoading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text style={styles.sendText}>↑</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C8F53C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
});
