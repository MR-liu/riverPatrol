import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Alert } from 'react-native';
import OptimizedApiService from './OptimizedApiService';

// 检查是否在 Expo Go 中运行
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// 动态导入通知功能，只在非 Expo Go 环境中使用
let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('Notifications module not available:', error);
  }
}

export interface EnhancedMessage {
  id: string;
  user_id: string;
  type: 'system' | 'workorder' | 'reminder' | 'announcement' | 'alert' | 'emergency';
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  category: string;
  related_workorder_id?: string;
  related_report_id?: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  expires_at?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
  emergencyOverride: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  categories: {
    [key: string]: {
      enabled: boolean;
      sound: string;
      priority: 'min' | 'low' | 'default' | 'high' | 'max';
    };
  };
}

class EnhancedNotificationService {
  private readonly STORAGE_KEYS = {
    MESSAGES: 'enhanced_messages',
    NOTIFICATION_SETTINGS: 'enhanced_notification_settings',
    PUSH_TOKEN: 'expo_push_token',
    DEVICE_ID: 'device_id',
    LAST_SYNC: 'messages_last_sync',
  };

  private messages: EnhancedMessage[] = [];
  private isInitialized = false;
  private pushToken: string | null = null;
  private deviceId: string | null = null;
  private supabaseClient: any = null;
  private realtimeChannel: RealtimeChannel | null = null;

  // 默认通知设置
  private defaultNotificationSettings: NotificationSettings = {
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    badgeEnabled: true,
    emergencyOverride: true,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
    categories: {
      system: {
        enabled: true,
        sound: 'default',
        priority: 'high',
      },
      workorder: {
        enabled: true,
        sound: 'workorder',
        priority: 'high',
      },
      reminder: {
        enabled: true,
        sound: 'reminder',
        priority: 'default',
      },
      announcement: {
        enabled: false,
        sound: 'default',
        priority: 'low',
      },
      alert: {
        enabled: true,
        sound: 'alert',
        priority: 'max',
      },
      emergency: {
        enabled: true,
        sound: 'emergency',
        priority: 'max',
      },
    },
  };

  // 初始化服务
  async initialize(supabaseUrl?: string, supabaseAnonKey?: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 初始化Supabase客户端
      if (supabaseUrl && supabaseAnonKey) {
        this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      }

      // 生成或获取设备ID
      await this.initializeDeviceId();

      // 配置通知处理器
      if (Notifications) {
        await this.setupNotificationHandler();
      }

      // 加载本地消息
      await this.loadLocalMessages();
      
      // 请求通知权限并注册推送
      if (Notifications) {
        await this.requestNotificationPermissions();
        await this.registerForPushNotifications();
      }

      // 设置实时订阅
      await this.setupRealtimeSubscription();

      // 同步服务器消息
      await this.syncMessagesFromServer();

      this.isInitialized = true;
      console.log('Enhanced notification service initialized successfully');
    } catch (error) {
      console.error('Initialize enhanced notification service error:', error);
    }
  }

  // 初始化设备ID
  private async initializeDeviceId(): Promise<void> {
    try {
      let deviceId = await AsyncStorage.getItem(this.STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem(this.STORAGE_KEYS.DEVICE_ID, deviceId);
      }
      this.deviceId = deviceId;
    } catch (error) {
      console.error('Initialize device ID error:', error);
    }
  }

  // 设置通知处理器
  private async setupNotificationHandler(): Promise<void> {
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const settings = await this.getNotificationSettings();
        const now = new Date();
        
        // 检查静默时间
        if (this.isQuietHours(now, settings)) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: settings.badgeEnabled,
          };
        }

        return {
          shouldShowAlert: settings.enabled,
          shouldPlaySound: settings.soundEnabled,
          shouldSetBadge: settings.badgeEnabled,
        };
      },
    });

    // 处理通知点击事件
    Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      await this.handleNotificationResponse(response);
    });
  }

  // 请求通知权限
  async requestNotificationPermissions(): Promise<boolean> {
    try {
      if (!Notifications) {
        console.warn('Notifications not available in Expo Go');
        return false;
      }
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('通知权限', '请在设置中开启通知权限以接收重要消息');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Request notification permissions error:', error);
      return false;
    }
  }

  // 注册推送通知
  async registerForPushNotifications(): Promise<void> {
    try {
      if (!Notifications) {
        console.warn('Push notifications not available in Expo Go');
        return;
      }
      
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      this.pushToken = token;
      await AsyncStorage.setItem(this.STORAGE_KEYS.PUSH_TOKEN, token);
      
      // 向服务器注册推送令牌
      await this.registerPushTokenWithServer(token);
      
      console.log('Push token registered:', token);
    } catch (error) {
      console.error('Register push notifications error:', error);
    }
  }

  // 向服务器注册推送令牌
  private async registerPushTokenWithServer(token: string): Promise<void> {
    try {
      if (!this.supabaseClient || !this.deviceId) return;

      // 更新或创建设备记录
      const { error } = await this.supabaseClient
        .from('mobile_devices')
        .upsert({
          device_id: this.deviceId,
          user_id: OptimizedApiService.getCurrentUserId(), // 从OptimizedApiService获取当前用户ID
          push_token: token,
          device_name: Constants.deviceName || 'Unknown Device',
          os_version: Constants.platform?.ios ? `iOS ${Constants.platform.ios.systemVersion}` : `Android ${Constants.platform?.android?.osVersion}`,
          app_version: Constants.manifest?.version || '1.0.0',
          is_active: true,
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'device_id,user_id'
        });

      if (error) {
        console.error('Register push token with server error:', error);
      }
    } catch (error) {
      console.error('Register push token with server error:', error);
    }
  }

  // 设置实时订阅
  private async setupRealtimeSubscription(): Promise<void> {
    try {
      if (!this.supabaseClient) return;

      const userId = OptimizedApiService.getCurrentUserId();
      if (!userId) return;

      // 订阅用户消息表的变化
      this.realtimeChannel = this.supabaseClient
        .channel('user_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_messages',
          filter: `user_id=eq.${userId}`
        }, async (payload: any) => {
          console.log('New message received:', payload);
          const newMessage = payload.new as EnhancedMessage;
          await this.handleRealtimeMessage(newMessage);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_messages',
          filter: `user_id=eq.${userId}`
        }, async (payload: any) => {
          console.log('Message updated:', payload);
          const updatedMessage = payload.new as EnhancedMessage;
          await this.updateLocalMessage(updatedMessage);
        })
        .subscribe();

      console.log('Realtime subscription setup completed');
    } catch (error) {
      console.error('Setup realtime subscription error:', error);
    }
  }

  // 处理实时消息
  private async handleRealtimeMessage(message: EnhancedMessage): Promise<void> {
    try {
      // 添加到本地消息列表
      this.messages.unshift(message);
      await this.saveLocalMessages();

      // 发送本地通知（如果应用在后台）
      await this.sendLocalNotification(message);

      console.log('Realtime message handled:', message.id);
    } catch (error) {
      console.error('Handle realtime message error:', error);
    }
  }

  // 更新本地消息
  private async updateLocalMessage(updatedMessage: EnhancedMessage): Promise<void> {
    try {
      const index = this.messages.findIndex(msg => msg.id === updatedMessage.id);
      if (index >= 0) {
        this.messages[index] = updatedMessage;
        await this.saveLocalMessages();
      }
    } catch (error) {
      console.error('Update local message error:', error);
    }
  }

  // 同步服务器消息
  async syncMessagesFromServer(): Promise<boolean> {
    try {
      if (!this.supabaseClient) return false;

      const userId = OptimizedApiService.getCurrentUserId();
      if (!userId) return false;

      const lastSync = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
      
      const result = await OptimizedApiService.syncMessages({
        user_id: userId,
        device_id: this.deviceId,
        last_sync: lastSync,
      });

      if (result.success && result.data) {
        const { messages, sync_timestamp } = result.data;
        
        // 合并服务器消息到本地
        for (const serverMessage of messages) {
          const existingIndex = this.messages.findIndex(msg => msg.id === serverMessage.id);
          if (existingIndex >= 0) {
            this.messages[existingIndex] = serverMessage;
          } else {
            this.messages.push(serverMessage);
          }
        }

        // 按时间排序
        this.messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        await this.saveLocalMessages();
        await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, sync_timestamp);

        console.log(`Synced ${messages.length} messages from server`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Sync messages from server error:', error);
      return false;
    }
  }

  // 加载本地消息
  private async loadLocalMessages(): Promise<void> {
    try {
      const messagesStr = await AsyncStorage.getItem(this.STORAGE_KEYS.MESSAGES);
      if (messagesStr) {
        this.messages = JSON.parse(messagesStr);
      }
    } catch (error) {
      console.error('Load local messages error:', error);
      this.messages = [];
    }
  }

  // 保存本地消息
  private async saveLocalMessages(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.MESSAGES, JSON.stringify(this.messages));
    } catch (error) {
      console.error('Save local messages error:', error);
    }
  }

  // 发送本地通知
  private async sendLocalNotification(message: EnhancedMessage): Promise<void> {
    try {
      if (!Notifications) {
        console.warn('Local notifications not available in Expo Go');
        return;
      }
      
      const settings = await this.getNotificationSettings();
      
      if (!settings.enabled) return;

      const categorySettings = settings.categories[message.type];
      if (!categorySettings?.enabled) return;

      // 检查静默时间
      const now = new Date();
      if (this.isQuietHours(now, settings)) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.content,
          data: {
            messageId: message.id,
            type: message.type,
            workOrderId: message.related_workorder_id,
            reportId: message.related_report_id,
          },
          sound: settings.soundEnabled ? categorySettings.sound : undefined,
          badge: await this.getUnreadCount(),
        },
        trigger: null, // 立即显示
      });
    } catch (error) {
      console.error('Send local notification error:', error);
    }
  }

  // 获取所有消息
  async getMessages(): Promise<EnhancedMessage[]> {
    await this.initialize();
    return [...this.messages];
  }

  // 获取未读消息数量
  async getUnreadCount(): Promise<number> {
    await this.initialize();
    return this.messages.filter(msg => !msg.is_read).length;
  }

  // 获取未读消息
  async getUnreadMessages(): Promise<EnhancedMessage[]> {
    await this.initialize();
    return this.messages.filter(msg => !msg.is_read);
  }

  // 标记消息为已读
  async markAsRead(messageIds: string[]): Promise<boolean> {
    try {
      const userId = OptimizedApiService.getCurrentUserId();
      if (!userId) return false;

      // 更新服务器
      const result = await OptimizedApiService.request('/mark-messages-read', {
        method: 'POST',
        body: JSON.stringify({
          message_ids: messageIds,
          user_id: userId,
        }),
      });

      if (result.success) {
        // 更新本地消息
        for (const messageId of messageIds) {
          const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
          if (messageIndex >= 0) {
            this.messages[messageIndex].is_read = true;
            this.messages[messageIndex].read_at = new Date().toISOString();
          }
        }
        await this.saveLocalMessages();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Mark as read error:', error);
      return false;
    }
  }

  // 获取通知设置
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settingsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        return { ...this.defaultNotificationSettings, ...settings };
      }
      return this.defaultNotificationSettings;
    } catch (error) {
      console.error('Get notification settings error:', error);
      return this.defaultNotificationSettings;
    }
  }

  // 更新通知设置
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<boolean> {
    try {
      const currentSettings = await this.getNotificationSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.NOTIFICATION_SETTINGS, 
        JSON.stringify(updatedSettings)
      );
      
      return true;
    } catch (error) {
      console.error('Update notification settings error:', error);
      return false;
    }
  }

  // 检查是否在静默时间内
  private isQuietHours(date: Date, settings: NotificationSettings): boolean {
    if (!settings.quietHours.enabled) return false;

    const currentTime = date.getHours() * 100 + date.getMinutes();
    const startTime = this.parseTime(settings.quietHours.startTime);
    const endTime = this.parseTime(settings.quietHours.endTime);

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // 解析时间字符串
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  // 处理通知点击事件
  private async handleNotificationResponse(response: any): Promise<void> {
    const data = response.notification.request.content.data;
    
    if (data.messageId) {
      await this.markAsRead([data.messageId]);
    }

    // 根据消息类型执行不同的操作
    if (data.type === 'workorder' && data.workOrderId) {
      console.log('Navigate to work order:', data.workOrderId);
    }
  }

  // 获取推送令牌
  getPushToken(): string | null {
    return this.pushToken;
  }

  // 获取设备ID
  getDeviceId(): string | null {
    return this.deviceId;
  }

  // 清理服务
  cleanup(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
    this.isInitialized = false;
  }
}

export default new EnhancedNotificationService();