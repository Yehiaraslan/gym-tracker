import { notificationService } from './notification-service';
import { getTodayRecovery } from './whoop-api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecoveryAlertConfig {
  lowRecoveryThreshold: number; // Default: 50
  criticalRecoveryThreshold: number; // Default: 30
  checkIntervalHours: number; // Default: 24
}

export class RecoveryAlertMonitor {
  private static instance: RecoveryAlertMonitor;
  private monitoringInterval: any = null;
  private config: RecoveryAlertConfig = {
    lowRecoveryThreshold: 50,
    criticalRecoveryThreshold: 30,
    checkIntervalHours: 24,
  };

  private constructor() {}

  static getInstance(): RecoveryAlertMonitor {
    if (!RecoveryAlertMonitor.instance) {
      RecoveryAlertMonitor.instance = new RecoveryAlertMonitor();
    }
    return RecoveryAlertMonitor.instance;
  }

  /**
   * Initialize recovery alert monitoring
   */
  async initialize(config?: Partial<RecoveryAlertConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Check recovery immediately on app launch
    await this.checkRecovery();

    // Set up periodic checks
    this.startMonitoring();
  }

  /**
   * Start periodic recovery monitoring
   */
  private startMonitoring(): void {
    // Check every hour (in milliseconds)
    const checkInterval = 60 * 60 * 1000;

    this.monitoringInterval = setInterval(async () => {
      await this.checkRecovery();
    }, checkInterval);
  }

  /**
   * Stop recovery monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check current recovery and send alert if needed
   */
  async checkRecovery(): Promise<void> {
    try {
      // Get notification settings
      const settings = await notificationService.getNotificationSettings();
      if (!settings.recoveryAlertsEnabled) {
        console.log('Recovery alerts disabled');
        return;
      }

      // Check if we can send alert (avoid spam)
      const canSend = await notificationService.canSendRecoveryAlert();
      if (!canSend) {
        console.log('Recovery alert already sent recently');
        return;
      }

      // Get current recovery score
      const recovery = await getTodayRecovery();
      if (!recovery) {
        console.log('No recovery data available');
        return;
      }

      // Check if recovery is below threshold
      const score = recovery.score || (recovery as any).recoveryScore || 0;
      if (score < this.config.lowRecoveryThreshold) {
        await notificationService.sendRecoveryAlert(score);
        await notificationService.recordRecoveryAlert();

        // Log alert for analytics
        await this.logRecoveryAlert(score);
      }
    } catch (error) {
      console.error('Error checking recovery:', error);
    }
  }

  /**
   * Manually trigger recovery check
   */
  async manualCheck(): Promise<void> {
    await this.checkRecovery();
  }

  /**
   * Log recovery alert for analytics
   */
  private async logRecoveryAlert(recoveryScore: number): Promise<void> {
    try {
      const alerts = await AsyncStorage.getItem('recovery_alerts_log');
      const log = alerts ? JSON.parse(alerts) : [];

      log.push({
        timestamp: new Date().toISOString(),
        recoveryScore,
        threshold: this.config.lowRecoveryThreshold,
      });

      // Keep only last 30 days of logs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const filteredLog = log.filter((entry: any) => {
        return new Date(entry.timestamp) > thirtyDaysAgo;
      });

      await AsyncStorage.setItem('recovery_alerts_log', JSON.stringify(filteredLog));
    } catch (error) {
      console.error('Error logging recovery alert:', error);
    }
  }

  /**
   * Get recovery alert history
   */
  async getAlertHistory(): Promise<Array<{ timestamp: string; recoveryScore: number }>> {
    try {
      const alerts = await AsyncStorage.getItem('recovery_alerts_log');
      return alerts ? JSON.parse(alerts) : [];
    } catch (error) {
      console.error('Error getting alert history:', error);
      return [];
    }
  }

  /**
   * Update alert configuration
   */
  updateConfig(config: Partial<RecoveryAlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RecoveryAlertConfig {
    return { ...this.config };
  }
}

export const recoveryAlertMonitor = RecoveryAlertMonitor.getInstance();
