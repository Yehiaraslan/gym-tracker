import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
}

export class NotificationService {
  private static instance: NotificationService;
  private notificationListener: any;
  private responseListener: any;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get notification permissions');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('recovery', {
        name: 'Recovery Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });

      await Notifications.setNotificationChannelAsync('milestone', {
        name: 'Milestone Unlocks',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FFD700',
      });
    }

    return true;
  }

  setupListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        onNotificationReceived?.(notification);
      }
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        onNotificationResponse?.(response);
      }
    );
  }

  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }

  async sendNotification(payload: NotificationPayload, delay: number = 1): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          badge: payload.badge,
          sound: true,
        },
        trigger: delay as any,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return null;
    }
  }

  async sendRecoveryAlert(recoveryScore: number): Promise<string | null> {
    const title = 'Low Recovery Alert';
    let body = '';

    if (recoveryScore < 30) {
      body = `Your recovery is critically low (${recoveryScore}%). Consider taking a rest day.`;
    } else if (recoveryScore < 50) {
      body = `Your recovery is low (${recoveryScore}%). Light training recommended today.`;
    } else {
      body = `Your recovery is moderate (${recoveryScore}%). Proceed with caution.`;
    }

    return this.sendNotification(
      {
        title,
        body,
        data: {
          type: 'recovery_alert',
          recoveryScore,
          timestamp: new Date().toISOString(),
        },
      },
      1
    );
  }

  async sendMilestoneNotification(milestoneName: string, streakDays: number, rewardIcon: string): Promise<string | null> {
    return this.sendNotification(
      {
        title: '🎉 Milestone Unlocked!',
        body: `You've reached ${streakDays} days! Unlocked: ${milestoneName}`,
        data: {
          type: 'milestone_unlock',
          milestoneName,
          streakDays,
          rewardIcon,
          timestamp: new Date().toISOString(),
        },
        badge: 1,
      },
      1
    );
  }

  async canSendRecoveryAlert(): Promise<boolean> {
    const lastAlertTime = await AsyncStorage.getItem('last_recovery_alert_time');
    
    if (!lastAlertTime) {
      return true;
    }

    const lastTime = new Date(lastAlertTime).getTime();
    const now = new Date().getTime();
    const hoursSinceLastAlert = (now - lastTime) / (1000 * 60 * 60);

    return hoursSinceLastAlert >= 12;
  }

  async recordRecoveryAlert(): Promise<void> {
    await AsyncStorage.setItem('last_recovery_alert_time', new Date().toISOString());
  }

  async canSendMilestoneNotification(milestoneName: string): Promise<boolean> {
    const sentMilestones = await AsyncStorage.getItem('sent_milestone_notifications');
    const milestones = sentMilestones ? JSON.parse(sentMilestones) : [];
    return !milestones.includes(milestoneName);
  }

  async recordMilestoneNotification(milestoneName: string): Promise<void> {
    const sentMilestones = await AsyncStorage.getItem('sent_milestone_notifications');
    const milestones = sentMilestones ? JSON.parse(sentMilestones) : [];
    
    if (!milestones.includes(milestoneName)) {
      milestones.push(milestoneName);
      await AsyncStorage.setItem('sent_milestone_notifications', JSON.stringify(milestones));
    }
  }

  async getNotificationSettings(): Promise<{
    recoveryAlertsEnabled: boolean;
    milestoneNotificationsEnabled: boolean;
  }> {
    const settings = await AsyncStorage.getItem('notification_settings');
    
    if (!settings) {
      return {
        recoveryAlertsEnabled: true,
        milestoneNotificationsEnabled: true,
      };
    }

    return JSON.parse(settings);
  }

  async updateNotificationSettings(settings: {
    recoveryAlertsEnabled?: boolean;
    milestoneNotificationsEnabled?: boolean;
  }): Promise<void> {
    const current = await this.getNotificationSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem('notification_settings', JSON.stringify(updated));
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}

export const notificationService = NotificationService.getInstance();
