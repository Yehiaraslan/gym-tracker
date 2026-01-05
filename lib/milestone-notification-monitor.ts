import { notificationService } from './notification-service';
import { checkStreakStatus } from './streak-tracker';
import { checkNewMilestoneUnlocked } from './streak-milestones';
import { getUnlockedRewards } from './milestone-rewards';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class MilestoneNotificationMonitor {
  private static instance: MilestoneNotificationMonitor;
  private monitoringInterval: any = null;

  private constructor() {}

  static getInstance(): MilestoneNotificationMonitor {
    if (!MilestoneNotificationMonitor.instance) {
      MilestoneNotificationMonitor.instance = new MilestoneNotificationMonitor();
    }
    return MilestoneNotificationMonitor.instance;
  }

  /**
   * Initialize milestone notification monitoring
   */
  async initialize(): Promise<void> {
    // Check for milestones immediately on app launch
    await this.checkMilestones();

    // Set up periodic checks (every hour)
    this.startMonitoring();
  }

  /**
   * Start periodic milestone monitoring
   */
  private startMonitoring(): void {
    const checkInterval = 60 * 60 * 1000; // Check every hour

    this.monitoringInterval = setInterval(async () => {
      await this.checkMilestones();
    }, checkInterval);
  }

  /**
   * Stop milestone monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check for new milestone unlocks and send notifications
   */
  async checkMilestones(): Promise<void> {
    try {
      // Get notification settings
      const settings = await notificationService.getNotificationSettings();
      if (!settings.milestoneNotificationsEnabled) {
        console.log('Milestone notifications disabled');
        return;
      }

      // Get current streak data
      const streakData = await checkStreakStatus();
      if (!streakData) {
        console.log('No streak data available');
        return;
      }

      // Check for new milestone
      const milestone = checkNewMilestoneUnlocked(streakData.bestStreak, streakData.currentStreak);
      if (!milestone) {
        console.log('No new milestone unlocked');
        return;
      }

      // Check if notification was already sent for this milestone
      const canSend = await notificationService.canSendMilestoneNotification(milestone.name);
      if (!canSend) {
        console.log(`Milestone notification already sent for ${milestone.name}`);
        return;
      }

      // Get unlocked rewards for this milestone
      const rewards = getUnlockedRewards(streakData.currentStreak);
      const milestoneReward = rewards.find((r) => (r as any).unlockedAtStreak === (milestone as any).streakDays);

      // Send notification
      await notificationService.sendMilestoneNotification(
        milestone.name,
        (milestone as any).streakDays || streakData.currentStreak,
        milestoneReward?.icon || '🏆'
      );

      // Record that notification was sent
      await notificationService.recordMilestoneNotification(milestone.name);

      // Log milestone for analytics
      await this.logMilestoneUnlock(milestone.name, streakData.currentStreak);
    } catch (error) {
      console.error('Error checking milestones:', error);
    }
  }

  /**
   * Manually trigger milestone check
   */
  async manualCheck(): Promise<void> {
    await this.checkMilestones();
  }

  /**
   * Log milestone unlock for analytics
   */
  private async logMilestoneUnlock(milestoneName: string, streakDays: number): Promise<void> {
    try {
      const milestones = await AsyncStorage.getItem('milestone_unlocks_log');
      const log = milestones ? JSON.parse(milestones) : [];

      log.push({
        timestamp: new Date().toISOString(),
        milestoneName,
        streakDays,
      });

      await AsyncStorage.setItem('milestone_unlocks_log', JSON.stringify(log));
    } catch (error) {
      console.error('Error logging milestone unlock:', error);
    }
  }

  /**
   * Get milestone unlock history
   */
  async getUnlockHistory(): Promise<Array<{ timestamp: string; milestoneName: string; streakDays: number }>> {
    try {
      const milestones = await AsyncStorage.getItem('milestone_unlocks_log');
      return milestones ? JSON.parse(milestones) : [];
    } catch (error) {
      console.error('Error getting unlock history:', error);
      return [];
    }
  }

  /**
   * Clear notification sent history (for testing)
   */
  async clearNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('sent_milestone_notifications');
      await AsyncStorage.removeItem('last_recovery_alert_time');
      await AsyncStorage.removeItem('milestone_unlocks_log');
      await AsyncStorage.removeItem('recovery_alerts_log');
    } catch (error) {
      console.error('Error clearing notification history:', error);
    }
  }
}

export const milestoneNotificationMonitor = MilestoneNotificationMonitor.getInstance();
