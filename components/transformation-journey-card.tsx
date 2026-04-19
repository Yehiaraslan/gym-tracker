import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import {
  Radius,
  Space,
  FontSize,
  FontWeight,
  Shadow,
  ActiveOpacity,
} from '@/lib/design-tokens';

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
      ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`
      : null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: Radius.hero,
        padding: Space._4,
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
              fontSize: FontSize.section,
              fontWeight: FontWeight.bold,
              marginBottom: Space._3,
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
              marginBottom: Space._3,
            }}
          >
            {/* Earliest photo */}
            <View style={{ alignItems: 'center' }}>
              <Image
                source={{ uri: earliestPhoto.uri }}
                style={{
                  width: 120,
                  height: 160,
                  borderRadius: Radius.button,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              />
              <Text
                style={{
                  color: colors.cardForeground,
                  fontSize: FontSize.meta,
                  fontWeight: FontWeight.semi,
                  marginTop: Space._2,
                }}
              >
                Day 1
              </Text>
              <Text
                style={{
                  color: colors.cardMuted,
                  fontSize: FontSize.tiny + 1,
                  marginTop: 2,
                }}
              >
                {earliestPhoto.date}
              </Text>
            </View>

            {/* Arrow */}
            <Text
              style={{
                color: colors.mute3,
                fontSize: 22,
                marginHorizontal: Space._3,
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
                  borderRadius: Radius.button,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              />
              <Text
                style={{
                  color: colors.cardForeground,
                  fontSize: FontSize.meta,
                  fontWeight: FontWeight.semi,
                  marginTop: Space._2,
                }}
              >
                Now
              </Text>
              <Text
                style={{
                  color: colors.cardMuted,
                  fontSize: FontSize.tiny + 1,
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
              gap: Space._4,
              marginBottom: Space._3,
            }}
          >
            <View
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.14)',
                paddingHorizontal: Space._2,
                paddingVertical: Space._1,
                borderRadius: Radius.full,
              }}
            >
              <Text
                style={{
                  color: '#60A5FA',
                  fontSize: FontSize.eyebrow,
                  fontWeight: FontWeight.semi,
                }}
              >
                {daysSinceStart} days tracked
              </Text>
            </View>
            {weightLabel != null && (
              <View
                style={{
                  backgroundColor: weightColor + '1A',
                  paddingHorizontal: Space._2,
                  paddingVertical: Space._1,
                  borderRadius: Radius.full,
                }}
              >
                <Text
                  style={{
                    color: weightColor,
                    fontSize: FontSize.eyebrow,
                    fontWeight: FontWeight.semi,
                  }}
                >
                  {weightLabel}
                </Text>
              </View>
            )}
          </View>

          {/* View journey button */}
          <TouchableOpacity onPress={onViewJourney} activeOpacity={ActiveOpacity.secondary}>
            <Text
              style={{
                color: colors.primary,
                fontSize: FontSize.bodySm,
                fontWeight: FontWeight.semi,
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
              fontSize: FontSize.section,
              fontWeight: FontWeight.bold,
              marginBottom: Space._3,
              textAlign: 'center',
            }}
          >
            Start Your Transformation
          </Text>

          <Text
            style={{
              fontSize: 48,
              textAlign: 'center',
              marginBottom: Space._2,
            }}
          >
            📸
          </Text>

          <Text
            style={{
              color: colors.cardMuted,
              fontSize: FontSize.bodySm,
              textAlign: 'center',
              marginBottom: Space._4,
            }}
          >
            Take your Day 1 photo to track your progress
          </Text>

          <TouchableOpacity
            onPress={onTakePhoto}
            activeOpacity={ActiveOpacity.primary}
            style={{
              backgroundColor: colors.primary,
              borderRadius: Radius.button,
              paddingVertical: Space._3,
              alignItems: 'center',
              ...Shadow.cta(),
            }}
          >
            <Text
              style={{
                color: colors.primaryInk,
                fontSize: FontSize.body,
                fontWeight: FontWeight.bold,
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
