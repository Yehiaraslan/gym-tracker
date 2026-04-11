// ============================================================
// ZAKI VOICE RECORDER — Native only (Android / iOS)
// Uses static import of expo-audio so hooks work correctly
// with the New Architecture (TurboModules).
// This file is ONLY bundled on native (Metro resolves .native.tsx first).
// ============================================================
import { useCallback, useState } from 'react';
import { TouchableOpacity, Text, TextInput, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';

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
  deviceId,
  chatInput,
  setChatInput,
  onSend,
  chatLoading,
  isRecording,
  setIsRecording,
  isTranscribing,
  setIsTranscribing,
  transcribeAsync,
  colors,
}: ZakiVoiceRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const handleVoiceTap = useCallback(async () => {
    if (isTranscribing) return;
    if (isRecording) {
      setIsRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      setIsTranscribing(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const result = await transcribeAsync(base64, 'audio/m4a');
        if (result.text) {
          setChatInput(prev => (prev ? prev + ' ' + result.text : result.text));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.error('[Voice]', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await recorder.record();
      setIsRecording(true);
    }
  }, [isRecording, isTranscribing, recorder, transcribeAsync, setChatInput, setIsRecording, setIsTranscribing]);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={handleVoiceTap}
        style={[
          styles.micBtn,
          {
            backgroundColor: isRecording ? '#EF4444' : isTranscribing ? colors.cardBorder : colors.background,
            borderColor: isRecording ? '#EF4444' : colors.cardBorder,
          },
        ]}
      >
        {isTranscribing ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : (
          <Text style={{ fontSize: 18 }}>{isRecording ? '🔴' : '🎤'}</Text>
        )}
      </TouchableOpacity>
      <TextInput
        style={[styles.input, { backgroundColor: colors.cardBorder, color: colors.foreground }]}
        value={chatInput}
        onChangeText={setChatInput}
        placeholder={isRecording ? 'Recording... tap mic to stop' : 'Ask Zaki anything...'}
        placeholderTextColor={isRecording ? '#EF4444' : colors.cardMuted}
        multiline
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!chatLoading && !isRecording}
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
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
