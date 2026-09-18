// ============================================================
// TAB LAYOUT — two views, one app.
//   Trainee: Home · Workout · Library · Nutrition · Coach · More
//   Coach:   Athletes · Messages · More
// Role comes from the signed-in account (server-issued), never
// from local state, so a trainee cannot flip themselves into
// the coach view.
// ============================================================
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export function isCoachRole(role: string | null | undefined): boolean {
  return role === "trainer" || role === "admin";
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useAuth();
  const coach = isCoachRole(user?.role);
  const unread = trpc.coach.unreadCount.useQuery(undefined, {
    enabled: !!user && user.id > 0,
    refetchInterval: 30000,
  });
  const badge = unread.data && unread.data > 0 ? unread.data : undefined;

  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.primaryInk, fontSize: 10, fontWeight: '800' },
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 0.5,
        },
      }}
    >
      {/* ── Trainee tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          href: coach ? null : undefined,
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: coach ? null : undefined,
          title: "Workout",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="dumbbell.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          href: coach ? null : undefined,
          title: "Library",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          href: coach ? null : undefined,
          title: "Nutrition",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="fork.knife" color={color} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          href: coach ? null : undefined,
          title: t('coachTab'),
          tabBarBadge: coach ? undefined : badge,
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.fill" color={color} />,
        }}
      />

      {/* ── Coach tabs ── */}
      <Tabs.Screen
        name="athletes"
        options={{
          href: coach ? undefined : null,
          title: t('athletes'),
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="figure.strengthtraining.traditional" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: coach ? undefined : null,
          title: t('messagesTitle'),
          tabBarBadge: coach ? badge : undefined,
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="paperplane.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="square.grid.2x2.fill" color={color} />,
        }}
      />
      {/* Hidden tabs — accessible via router.push from the More screen */}
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="sleep" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
  );
}
