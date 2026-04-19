import { View, Text, Image } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getLevelInfo, getLevelProgress } from '@/lib/xp-system';
import {
  LevelColors,
  Radius,
  Space,
  FontSize,
  FontWeight,
  Shadow,
} from '@/lib/design-tokens';
import type { XPState } from '@/lib/types';

interface PlayerCardProps {
  userName: string;
  profilePhoto: string | null;
  xpState: XPState;
  streak: number;
  shields: number;
}

export function PlayerCard({
  userName,
  profilePhoto,
  xpState,
  streak,
  shields,
}: PlayerCardProps) {
  const colors = useColors();
  const levelInfo = getLevelInfo(xpState.level);
  const levelProgress = getLevelProgress(xpState);
  const levelColor = LevelColors[xpState.level as string] ?? LevelColors.Beginner;

  const currentXP = xpState.totalXP;
  const nextLevelXP = levelInfo.nextLevelXP ?? currentXP;

  const formatNumber = (n: number) => n.toLocaleString();

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
      {/* Top row: Avatar + Info */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar with level-colored ring */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: Radius.full,
            borderWidth: 3,
            borderColor: levelColor,
            overflow: 'hidden',
            backgroundColor: colors.surface3,
          }}
        >
          {profilePhoto ? (
            <Image
              source={{ uri: profilePhoto }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24, color: colors.cardForeground }}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Name + Level badge */}
        <View style={{ flex: 1, marginLeft: Space._3 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: FontSize.title,
              fontWeight: FontWeight.bold,
            }}
            numberOfLines={1}
          >
            {userName}
          </Text>

          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: levelColor + '22',
              borderWidth: 1,
              borderColor: levelColor,
              borderRadius: Radius.pill,
              paddingHorizontal: Space._2,
              paddingVertical: 3,
              marginTop: Space._1,
            }}
          >
            <Text style={{ fontSize: FontSize.meta }}>{levelInfo.icon} </Text>
            <Text
              style={{
                color: levelColor,
                fontSize: FontSize.meta,
                fontWeight: FontWeight.semi,
              }}
            >
              {xpState.level}
            </Text>
          </View>
        </View>

        {/* Streak + Shield counters */}
        <View style={{ alignItems: 'flex-end', gap: Space._1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: FontSize.bodySm }}>🔥</Text>
            <Text
              style={{
                color: streak >= 3 ? '#F59E0B' : colors.muted,
                fontSize: FontSize.body,
                fontWeight: FontWeight.bold,
                ...(streak >= 7 ? Shadow.fire : {}),
              }}
            >
              {streak}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: FontSize.bodySm }}>🛡️</Text>
            <Text
              style={{
                color: shields > 0 ? '#3B82F6' : colors.muted,
                fontSize: FontSize.body,
                fontWeight: FontWeight.bold,
              }}
            >
              {shields}
            </Text>
          </View>
        </View>
      </View>

      {/* XP Progress bar */}
      <View style={{ marginTop: Space._3 }}>
        <View
          style={{
            height: 8,
            borderRadius: Radius.bar,
            backgroundColor: colors.cardBorder,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(Math.max(levelProgress, 0), 100)}%`,
              borderRadius: Radius.bar,
              backgroundColor: colors.primary,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: Space._1,
          }}
        >
          <Text
            style={{
              color: colors.cardMuted,
              fontSize: FontSize.eyebrow,
              fontWeight: FontWeight.semi,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            XP to next level
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontSize: FontSize.eyebrow,
              fontWeight: FontWeight.semi,
            }}
          >
            {formatNumber(currentXP)} / {formatNumber(nextLevelXP)}
          </Text>
        </View>
      </View>
    </View>
  );
}
