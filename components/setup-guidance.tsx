/**
 * Setup Guidance Component
 * 
 * Provides exercise-specific setup instructions for optimal tracking
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { ExerciseType } from '@/lib/pose-detection';
import { getSetupGuidance, SetupGuidance } from '@/lib/tracking-reliability';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

interface SetupGuidanceProps {
  exerciseType: ExerciseType;
  onContinue: () => void;
  onBack?: () => void;
}

export function SetupGuidanceScreen({ exerciseType, onContinue, onBack }: SetupGuidanceProps) {
  const colors = useColors();
  const guidance = getSetupGuidance(exerciseType);

  const exerciseNames: Record<ExerciseType, string> = {
    pushup: 'Push-ups',
    pullup: 'Pull-ups',
    squat: 'Squats',
    rdl: 'Romanian Deadlifts',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <Pressable 
            onPress={onBack} 
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color={colors.foreground} />
          </Pressable>
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>
          Setup for {exerciseNames[exerciseType]}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Camera Angle */}
        <GuidanceCard
          icon="📷"
          title="Camera Angle"
          description={guidance.cameraAngle}
          colors={colors}
        />

        {/* Distance */}
        <GuidanceCard
          icon="📏"
          title="Distance"
          description={guidance.distance}
          colors={colors}
        />

        {/* Positioning */}
        <GuidanceCard
          icon="🎯"
          title="Positioning"
          description={guidance.positioning}
          colors={colors}
        />

        {/* Lighting */}
        <GuidanceCard
          icon="💡"
          title="Lighting"
          description={guidance.lighting}
          colors={colors}
        />

        {/* Tips */}
        <View style={[styles.tipsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.tipsTitle, { color: colors.foreground }]}>
            💪 Tips for Best Results
          </Text>
          {guidance.tips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <Text style={[styles.tipBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.tipText, { color: colors.muted }]}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Checklist */}
        <View style={[styles.checklistContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.checklistTitle, { color: colors.foreground }]}>
            ✅ Before You Start
          </Text>
          <ChecklistItem text="Phone is stable (tripod or propped)" colors={colors} />
          <ChecklistItem text="Full body visible in frame" colors={colors} />
          <ChecklistItem text="Good, even lighting" colors={colors} />
          <ChecklistItem text="Wearing fitted clothing" colors={colors} />
          <ChecklistItem text="Clear space around you" colors={colors} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]}
        >
          <Text style={styles.continueButtonText}>I'm Ready - Start Tracking</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface GuidanceCardProps {
  icon: string;
  title: string;
  description: string;
  colors: ReturnType<typeof useColors>;
}

function GuidanceCard({ icon, title, description, colors }: GuidanceCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      <Text style={[styles.cardDescription, { color: colors.muted }]}>{description}</Text>
    </View>
  );
}

interface ChecklistItemProps {
  text: string;
  colors: ReturnType<typeof useColors>;
}

function ChecklistItem({ text, colors }: ChecklistItemProps) {
  return (
    <View style={styles.checklistItem}>
      <View style={[styles.checkbox, { borderColor: colors.success, backgroundColor: colors.success + '20' }]}>
        <Text style={{ color: colors.success, fontSize: 12 }}>✓</Text>
      </View>
      <Text style={[styles.checklistText, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

/**
 * Compact Setup Reminder
 * 
 * Shows a brief reminder during tracking when confidence is low
 */
interface SetupReminderProps {
  message: string;
  onDismiss?: () => void;
}

export function SetupReminder({ message, onDismiss }: SetupReminderProps) {
  const colors = useColors();

  return (
    <View style={[styles.reminderContainer, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
      <View style={styles.reminderContent}>
        <Text style={[styles.reminderIcon]}>⚠️</Text>
        <Text style={[styles.reminderText, { color: colors.foreground }]}>{message}</Text>
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.reminderDismiss}>
          <Text style={{ color: colors.muted }}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Confidence Indicator
 * 
 * Shows tracking quality status
 */
interface ConfidenceIndicatorProps {
  quality: 'good' | 'weak' | 'lost';
  confidence: number;
  showDetails?: boolean;
}

export function ConfidenceIndicator({ quality, confidence, showDetails = false }: ConfidenceIndicatorProps) {
  const colors = useColors();

  const getQualityColor = () => {
    switch (quality) {
      case 'good': return colors.success;
      case 'weak': return colors.warning;
      case 'lost': return colors.error;
    }
  };

  const getQualityLabel = () => {
    switch (quality) {
      case 'good': return 'Good';
      case 'weak': return 'Weak';
      case 'lost': return 'Lost';
    }
  };

  return (
    <View style={[styles.confidenceContainer, { backgroundColor: getQualityColor() + '20', borderColor: getQualityColor() }]}>
      <View style={[styles.confidenceDot, { backgroundColor: getQualityColor() }]} />
      <Text style={[styles.confidenceLabel, { color: getQualityColor() }]}>
        Tracking: {getQualityLabel()}
      </Text>
      {showDetails && (
        <Text style={[styles.confidenceValue, { color: colors.muted }]}>
          {Math.round(confidence * 100)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  tipsContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: 'bold',
  },
  tipText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  checklistContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checklistText: {
    fontSize: 14,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  continueButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Reminder styles
  reminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  reminderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  reminderText: {
    fontSize: 14,
    flex: 1,
  },
  reminderDismiss: {
    padding: 4,
  },
  // Confidence indicator styles
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceValue: {
    fontSize: 12,
    marginLeft: 8,
  },
});
