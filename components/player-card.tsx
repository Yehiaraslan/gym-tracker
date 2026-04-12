import { View, Text, Image } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { getLevelInfo, getLevelProgress } from '@/lib/xp-system';
import type { XPState, PlayerLevel } from '@/lib/types';

interface PlayerCardProps {
  userName: string;
  profilePhoto: string | null;
  xpState: XPState;
  streak: number;
  shields: number;
}

const LEVEL_COLORS: Record<string, string> = {
  Beginner: '#22C55E',
  Novice: '#3B82F6',
  Intermediate: '#8B5CF6',
  Advanced: '#F59E0B',
  Elite: '#EF4444',
  Legend: '#F97316',
};

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
  const levelColor = LEVEL_COLORS[xpState.level as string] ?? '#22C55E';

  const currentXP = xpState.totalXP;
  const nextLevelXP = levelInfo.nextLevelXP ?? currentXP;

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <View
      style={{
        backgroundColor: '#1A1D1A',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2D2A',
      }}
    >
      {/* Top row: Avatar + Info */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Avatar */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 3,
            borderColor: levelColor,
            overflow: 'hidden',
            backgroundColor: '#2A2D2A',
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
              <Text style={{ fontSize: 24 }}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Name + Level badge */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: '#F5F5F5',
              fontSize: 18,
              fontWeight: 'bold',
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
              backgroundColor: levelColor + '33',
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 12 }}>{levelInfo.icon} </Text>
            <Text
              style={{
                color: levelColor,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {xpState.level}
            </Text>
          </View>
        </View>
      </View>

      {/* XP Progress bar */}
      <View style={{ marginTop: 14 }}>
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: '#2A2D2A',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(Math.max(levelProgress, 0), 100)}%`,
              borderRadius: 4,
              backgroundColor: '#C8F53C',
            }}
          />
        </View>

        <Text
          style={{
            color: '#7A8070',
            fontSize: 11,
            marginTop: 4,
          }}
        >
          {formatNumber(currentXP)} / {formatNumber(nextLevelXP)} XP
        </Text>
      </View>

      {/* Streak + Shields row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginTop: 10,
          gap: 12,
        }}
      >
        <Text style={{ color: '#7A8070', fontSize: 13 }}>
          {streak} days
        </Text>
        <Text style={{ color: '#7A8070', fontSize: 13 }}>
          {shields}
        </Text>
      </View>
    </View>
  );
}
