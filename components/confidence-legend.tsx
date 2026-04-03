import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface ConfidenceLegendProps {
  visible?: boolean;
  compact?: boolean;
}

interface LegendItem {
  color: string;
  label: string;
  description: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    color: '#22C55E',
    label: 'Strong',
    description: '70%+',
  },
  {
    color: '#F59E0B',
    label: 'Moderate',
    description: '50-70%',
  },
  {
    color: '#EF4444',
    label: 'Weak',
    description: '30-50%',
  },
];

export function ConfidenceLegend({ 
  visible = true,
  compact = false,
}: ConfidenceLegendProps) {
  const colors = useColors();

  if (!visible) {
    return null;
  }

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <Text style={styles.compactTitle}>Tracking</Text>
        <View style={styles.compactItems}>
          {LEGEND_ITEMS.map((item, index) => (
            <View key={index} style={styles.compactItem}>
              <View style={[styles.compactDot, { backgroundColor: item.color }]} />
              <Text style={styles.compactLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
      <Text style={[styles.title, { color: colors.cardForeground }]}>
        Joint Tracking Quality
      </Text>
      <View style={styles.itemsContainer}>
        {LEGEND_ITEMS.map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={styles.colorIndicator}>
              <View style={[styles.outerRing, { borderColor: item.color }]} />
              <View style={[styles.innerDot, { backgroundColor: item.color }]} />
            </View>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: '#ffffff' }]}>
                {item.label}
              </Text>
              <Text style={[styles.description, { color: 'rgba(255,255,255,0.7)' }]}>
                {item.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#ffffff',
  },
  itemsContainer: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    opacity: 0.6,
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 10,
  },
  // Compact styles
  compactContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compactTitle: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    textAlign: 'center',
  },
  compactItems: {
    flexDirection: 'row',
    gap: 8,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactLabel: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default ConfidenceLegend;
