import { messaging } from '../config/firebase';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Notification categories
export const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'new_message',
  SCAN_RESULT: 'scan_result',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  SYSTEM_UPDATE: 'system_update',
  URGENT_ALERT: 'urgent_alert'
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const { data } = notification.request.content;
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: data?.type === NOTIFICATION_TYPES.URGENT_ALERT,
      shouldSetBadge: true,
    };
  },
});

class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.fcmToken = null;
    this.expoPushToken = null;
  }

  /**
   * Initialize push notification service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing push notification service...');
      
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Push notification permission not granted');
        return false;
      }

      // Get Expo push token
      try {
        const expoPushToken = await Notifications.getExpoPushTokenAsync({
          projectId: 'diabeticfootulcer-9e9d9' // Your Firebase project ID
        });
        this.expoPushToken = expoPushToken.data;
        console.log('📱 Expo Push Token:', this.expoPushToken);
        
        // Store token locally
        await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
      } catch (error) {
        console.error('❌ Failed to get Expo push token:', error);
      }

      // Get FCM token (if supported)
      if (messaging && Platform.OS === 'web') {
        try {
          this.fcmToken = await messaging.getToken();
          console.log('🔥 FCM Token:', this.fcmToken);
          
          // Store token locally
          await AsyncStorage.setItem('fcmToken', this.fcmToken);
        } catch (error) {
          console.error('❌ Failed to get FCM token:', error);
        }
      }

      // Set up notification listeners
      this.setupNotificationListeners();
      
      this.isInitialized = true;
      console.log('✅ Push notification service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Push notification initialization failed:', error);
      return false;
    }
  }

  /**
   * Set up notification event listeners
   */
  setupNotificationListeners() {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(this.handleNotificationReceived);
    
    // Handle notification tapped by user
    Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);
    
    // FCM message listeners (for web)
    if (messaging) {
      messaging.onMessage((payload) => {
        console.log('📨 FCM Message received:', payload);
        this.handleFCMMessage(payload);
      });
    }
  }

  /**
   * Handle notification received while app is active
   */
  handleNotificationReceived = (notification) => {
    console.log('📨 Notification received:', notification);
    
    const { title, body, data } = notification.request.content;
    
    // Handle different notification types
    switch (data?.type) {
      case NOTIFICATION_TYPES.NEW_MESSAGE:
        this.handleNewMessage(data);
        break;
      case NOTIFICATION_TYPES.SCAN_RESULT:
        this.handleScanResult(data);
        break;
      case NOTIFICATION_TYPES.URGENT_ALERT:
        this.handleUrgentAlert(data);
        break;
      default:
        console.log('📨 General notification received');
    }
  };

  /**
   * Handle notification tap
   */
  handleNotificationResponse = (response) => {
    console.log('👆 Notification tapped:', response);
    
    const { data } = response.notification.request.content;
    
    // Navigate to appropriate screen based on notification type
    if (data?.screen) {
      // This would integrate with your navigation system
      console.log(`🔄 Should navigate to: ${data.screen}`);
    }
  };

  /**
   * Handle FCM message (web only)
   */
  handleFCMMessage = (payload) => {
    const { notification, data } = payload;
    
    // Show local notification
    if (notification) {
      this.showLocalNotification(
        notification.title,
        notification.body,
        data
      );
    }
  };

  /**
   * Handle new message notification
   */
  handleNewMessage = (data) => {
    console.log('💬 New message notification:', data);
    // Update unread message count, refresh message list, etc.
  };

  /**
   * Handle scan result notification
   */
  handleScanResult = (data) => {
    console.log('🔬 Scan result notification:', data);
    // Update scan history, show result details, etc.
  };

  /**
   * Handle urgent alert
   */
  handleUrgentAlert = (data) => {
    console.log('🚨 Urgent alert:', data);
    // Show immediate alert, play sound, etc.
  };

  /**
   * Send push token to server
   */
  async sendTokenToServer(userId, userRole) {
    try {
      if (!this.expoPushToken && !this.fcmToken) {
        console.warn('⚠️ No push tokens available to send');
        return false;
      }

      const tokenData = {
        userId,
        userRole,
        expoPushToken: this.expoPushToken,
        fcmToken: this.fcmToken,
        platform: Platform.OS,
        updatedAt: new Date().toISOString()
      };

      // Send to your backend API
      const response = await fetch('http://localhost:3000/api/auth/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add your auth headers here
        },
        body: JSON.stringify(tokenData)
      });

      if (response.ok) {
        console.log('✅ Push token sent to server');
        return true;
      } else {
        console.error('❌ Failed to send push token to server');
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending push token:', error);
      return false;
    }
  }

  /**
   * Show local notification
   */
  async showLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('❌ Failed to show local notification:', error);
    }
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(title, body, triggerDate, data = {}) {
    try {
      const trigger = {
        date: triggerDate,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger,
      });

      console.log('⏰ Notification scheduled for:', triggerDate);
    } catch (error) {
      console.error('❌ Failed to schedule notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🗑️ All notifications cancelled');
    } catch (error) {
      console.error('❌ Failed to cancel notifications:', error);
    }
  }

  /**
   * Get notification permissions status
   */
  async getPermissionsStatus() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('❌ Failed to get permissions status:', error);
      return 'undetermined';
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Failed to request permissions:', error);
      return false;
    }
  }

  /**
   * Get stored tokens
   */
  async getStoredTokens() {
    try {
      const expoPushToken = await AsyncStorage.getItem('expoPushToken');
      const fcmToken = await AsyncStorage.getItem('fcmToken');
      
      return {
        expoPushToken,
        fcmToken
      };
    } catch (error) {
      console.error('❌ Failed to get stored tokens:', error);
      return null;
    }
  }
}

// Create and export singleton instance
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;

// Export utility functions
export const initializePushNotifications = () => pushNotificationService.initialize();
export const sendTokenToServer = (userId, userRole) => pushNotificationService.sendTokenToServer(userId, userRole);
export const showNotification = (title, body, data) => pushNotificationService.showLocalNotification(title, body, data);
export const scheduleNotification = (title, body, date, data) => pushNotificationService.scheduleNotification(title, body, date, data);
