import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface TransformationJourneyCardProps {
  earliestPhoto: { uri: string; date: string } | null;
  latestPhoto: { uri: string; date: string } | null;
  daysSinceStart: number;
  weightChange: number | null;
  onViewJourney: () => void;
  onTakePhoto: () => void;
}

export function TransformationJourneyCard({
  earliestPhoto,
  latestPhoto,
  daysSinceStart,
  weightChange,
  onViewJourney,
  onTakePhoto,
}: TransformationJourneyCardProps) {
  const colors = useColors();

  const hasPhotos = earliestPhoto != null && latestPhoto != null;

  const weightColor = weightChange != null && weightChange < 0 ? '#22C55E' : '#F59E0B';
  const weightLabel =
    weightChange != null
      ? `${weightChange > 0 ? '+' : ''}${weightChange} lbs`
      : null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      {hasPhotos ? (
        <>
          {/* Header */}
          <Text
            style={{
              color: colors.cardForeground,
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 14,
            }}
          >
            📈 Transformation Journey
          </Text>

          {/* Photo comparison */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            {/* Earliest photo */}
            <View style={{ alignItems: 'center' }}>
              <Image
                source={{ uri: earliestPhoto.uri }}
                style={{
                  width: 120,
                  height: 160,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              />
              <Text
                style={{
                  color: colors.cardForeground,
                  fontSize: 12,
                  fontWeight: '600',
                  marginTop: 6,
                }}
              >
                Day 1
              </Text>
              <Text
                style={{
                  color: colors.cardMuted,
                  fontSize: 10,
                  marginTop: 2,
                }}
              >
                {earliestPhoto.date}
              </Text>
            </View>

            {/* Arrow */}
            <Text
              style={{
                color: colors.cardMuted,
                fontSize: 22,
                marginHorizontal: 14,
              }}
            >
              →
            </Text>

            {/* Latest photo */}
            <View style={{ alignItems: 'center' }}>
              <Image
                source={{ uri: latestPhoto.uri }}
                style={{
                  width: 120,
                  height: 160,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              />
              <Text
                style={{
                  color: colors.cardForeground,
                  fontSize: 12,
                  fontWeight: '600',
                  marginTop: 6,
                }}
              >
                Now
              </Text>
              <Text
                style={{
                  color: colors.cardMuted,
                  fontSize: 10,
                  marginTop: 2,
                }}
              >
                {latestPhoto.date}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 16,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: colors.cardMuted,
                fontSize: 12,
                fontWeight: '500',
              }}
            >
              {daysSinceStart} days tracked
            </Text>
            {weightLabel != null && (
              <Text
                style={{
                  color: weightColor,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {weightLabel}
              </Text>
            )}
          </View>

          {/* View journey button */}
          <TouchableOpacity onPress={onViewJourney}>
            <Text
              style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              View Full Journey →
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Empty state */}
          <Text
            style={{
              color: colors.cardForeground,
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            Start Your Transformation
          </Text>

          <Text
            style={{
              fontSize: 48,
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            📸
          </Text>

          <Text
            style={{
              color: colors.cardMuted,
              fontSize: 13,
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            Take your Day 1 photo to track your progress
          </Text>

          <TouchableOpacity
            onPress={onTakePhoto}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#0A0B0A',
                fontSize: 14,
                fontWeight: '700',
              }}
            >
              Take Photo
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
