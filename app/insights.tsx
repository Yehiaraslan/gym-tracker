import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useGym } from '@/lib/gym-context';
import * as Haptics from 'expo-haptics';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const SUGGESTED_QUESTIONS = [
  'What exercises should I focus on for better leg strength?',
  'How is my recovery looking this week?',
  'What\'s my average workout duration?',
  'Suggest a workout plan based on my history',
  'How can I improve my form?',
];

export default function InsightsScreen() {
  const colors = useColors();
  const { store } = useGym();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [openAiKey, setOpenAiKey] = useState(store.settings.openAiKey || '');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    if (!openAiKey) {
      Alert.alert(
        'OpenAI Key Required',
        'Please add your OpenAI API key in Settings to use AI insights.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setLoading(true);

    try {
      // Prepare workout data for context
      const workoutStats = {
        totalExercises: store.exercises.length,
        totalWorkouts: store.workoutLogs.length,
        currentStreak: 0,
        averageExercisesPerWorkout: store.workoutLogs.length > 0
          ? store.exercises.length / store.workoutLogs.length
          : 0,
      };

      const systemPrompt = `You are a fitness coach AI assistant. You have access to the user's workout data and should provide personalized fitness advice based on their training history. Be encouraging, specific, and actionable in your recommendations.

User's Workout Stats:
- Total Exercises: ${workoutStats.totalExercises}
- Total Workouts: ${workoutStats.totalWorkouts}
- Current Streak: ${workoutStats.currentStreak} days (track your consistency)
- Exercises per Workout: ${workoutStats.averageExercisesPerWorkout.toFixed(1)}

Available Exercises: ${store.exercises.map(e => e.name).join(', ')}`;

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text.trim() },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to get response from OpenAI');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.choices[0]?.message?.content || 'Sorry, I could not generate a response.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to get AI response. Please check your API key.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      className={`mb-4 ${item.role === 'user' ? 'items-end' : 'items-start'}`}
    >
      <View
        className={`rounded-2xl px-4 py-3 max-w-xs ${
          item.role === 'user'
            ? 'rounded-br-none'
            : 'rounded-bl-none'
        }`}
        style={{
          backgroundColor: item.role === 'user' ? colors.primary : colors.surface,
          borderWidth: item.role === 'user' ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            color: item.role === 'user' ? 'white' : colors.foreground,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {messages.length === 0 ? (
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 24 }}>
            <Text className="text-2xl font-bold text-foreground mb-2">
              AI Fitness Coach
            </Text>
            <Text className="text-muted mb-8">
              Ask me anything about your workouts, recovery, and training progress.
            </Text>

            {!openAiKey && (
              <View
                className="bg-warning rounded-xl p-4 mb-6"
                style={{ backgroundColor: colors.warning + '20' }}
              >
                <Text style={{ color: colors.warning, fontWeight: '600', marginBottom: 4 }}>
                  ⚠️ OpenAI Key Required
                </Text>
                <Text style={{ color: colors.warning, fontSize: 12 }}>
                  Add your OpenAI API key in Settings to enable AI insights.
                </Text>
              </View>
            )}

            <Text className="text-base font-semibold text-foreground mb-3">
              Suggested Questions:
            </Text>

            {SUGGESTED_QUESTIONS.map((question, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => sendMessage(question)}
                disabled={!openAiKey || loading}
                className="bg-surface rounded-xl p-4 mb-3 border"
                style={{
                  borderColor: colors.border,
                  opacity: !openAiKey || loading ? 0.5 : 1,
                }}
              >
                <Text className="text-foreground text-sm">{question}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            onEndReachedThreshold={0.1}
          />
        )}

        {/* Input Area */}
        <View
          className="px-4 py-4 border-t"
          style={{ borderTopColor: colors.border, backgroundColor: colors.background }}
        >
          <View className="flex-row items-center gap-2">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask me about your workouts..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              editable={!loading && !!openAiKey}
              className="flex-1 bg-surface rounded-xl p-3 text-foreground"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                maxHeight: 100,
              }}
            />
            <TouchableOpacity
              onPress={() => sendMessage(inputText)}
              disabled={loading || !inputText.trim() || !openAiKey}
              className="p-3 rounded-xl"
              style={{
                backgroundColor: loading || !inputText.trim() || !openAiKey ? colors.muted : colors.primary,
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-xl">📤</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
