import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { GymProvider } from "@/lib/gym-context";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { notificationService } from "@/lib/notification-service";
import { recoveryAlertMonitor } from "@/lib/recovery-alert-monitor";
import { milestoneNotificationMonitor } from "@/lib/milestone-notification-monitor";
import { runCoachingChecks } from "@/lib/ai-coaching-notifications";
import { runMigrationIfNeeded } from "@/lib/migration-service";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Initialize notification services
  useEffect(() => {
    const initNotifications = async () => {
      try {
        // Run one-time migration of AsyncStorage data to cloud DB
        runMigrationIfNeeded().catch((e: unknown) => console.warn('[Layout] Migration error:', e));

        const hasPermission = await notificationService.requestPermissions();
        if (hasPermission) {
          notificationService.setupListeners();
          await recoveryAlertMonitor.initialize();
          await milestoneNotificationMonitor.initialize();
          // Run AI coaching checks (daily message, missed workout, recovery)
          await runCoachingChecks();
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    if (Platform.OS !== 'web') {
      initNotifications();
    }

    return () => {
      recoveryAlertMonitor.stopMonitoring();
      milestoneNotificationMonitor.stopMonitoring();
      notificationService.cleanup();
    };
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GymProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="split-workout" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="next-week" options={{ presentation: 'modal' }} />
            <Stack.Screen name="pr-board" options={{ presentation: 'modal' }} />
            <Stack.Screen name="weekly-report" options={{ presentation: 'modal' }} />
            <Stack.Screen name="nutrition" options={{ presentation: 'modal' }} />
            <Stack.Screen name="whoop" options={{ presentation: 'modal' }} />
            <Stack.Screen name="form-coach" options={{ presentation: 'modal' }} />
            <Stack.Screen name="form-coach-tracking" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
      </GymProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
