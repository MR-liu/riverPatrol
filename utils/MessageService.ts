import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

// 检查是否在 Expo Go 中运行
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// 动态导入通知功能，只在非 Expo Go 环境中使用
// 注释掉Expo通知，因为我们使用极光推送
let Notifications: any = null;
/* 使用极光推送，不使用expo-notifications
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('Notifications module not available:', error);
  }
}
*/

export interface Message {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'workorder' | 'reminder' | 'announcement' | 'alert' | 'maintenance' | 'emergency';
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  category: string;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  timestamp: number;
  expiresAt?: number;
  readAt?: number;
  deliveredAt?: number;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    department: string;
  };
  recipients?: string[];
  relatedWorkOrderId?: string;
  relatedPatrolId?: string;
  metadata?: {
    [key: string]: any;
  };
  attachments?: {
    id: string;
    name: string;
    type: 'image' | 'document' | 'audio' | 'video';
    url: string;
    size: number;
    mimeType: string;
    checksum?: string;
  }[];
  actions?: {
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger' | 'warning';
    action: string;
    parameters?: { [key: string]: any };
    requiresConfirmation?: boolean;
  }[];
  signature?: string;
  encryptionLevel?: 'none' | 'standard' | 'high';
  complianceFlags?: string[];
  auditTrail?: {
    action: string;
    userId: string;
    timestamp: number;
    details?: any;
  }[];
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
    weekendsOnly?: boolean;
    holidays?: string[];
  };
  categories: {
    [key: string]: {
      enabled: boolean;
      sound: string;
      priority: 'min' | 'low' | 'default' | 'high' | 'max';
      escalationRules?: {
        retryCount: number;
        retryInterval: number;
        escalateTo?: string[];
      };
    };
  };
  locationBasedRules?: {
    enabled: boolean;
    workSiteOnly: boolean;
    radius: number;
  };
  complianceSettings: {
    auditNotifications: boolean;
    dataRetentionDays: number;
    encryptSensitiveMessages: boolean;
  };
}

export interface MessageFilter {
  type?: string[];
  priority?: string[];
  category?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  isRead?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  isExpired?: boolean;
  searchKeyword?: string;
  senderId?: string;
  recipientId?: string;
  hasAttachments?: boolean;
  complianceFlags?: string[];
  encryptionLevel?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'priority' | 'readStatus' | 'sender';
  sortOrder?: 'asc' | 'desc';
}

export interface MessageStats {
  total: number;
  unread: number;
  starred: number;
  archived: number;
  expired: number;
  encrypted: number;
  byType: { [key: string]: number };
  byPriority: { [key: string]: number };
  byCategory: { [key: string]: number };
  bySender: { [key: string]: number };
  recentActivity: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    last24Hours: number;
    last7Days: number;
  };
  complianceMetrics: {
    auditedMessages: number;
    retentionCompliant: number;
    encryptionCompliant: number;
  };
  performanceMetrics: {
    averageDeliveryTime: number;
    averageReadTime: number;
    deliverySuccessRate: number;
  };
}

class MessageService {
  private readonly STORAGE_KEYS = {
    MESSAGES: 'messages',
    NOTIFICATION_SETTINGS: 'notification_settings',
    LAST_SYNC: 'messages_last_sync',
    PUSH_TOKEN: 'push_notification_token',
  };

  private messages: Message[] = [];
  private isInitialized = false;
  private pushToken: string | null = null;

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
        escalationRules: {
          retryCount: 3,
          retryInterval: 60000,
          escalateTo: ['supervisor', 'admin'],
        },
      },
    },
    complianceSettings: {
      auditNotifications: true,
      dataRetentionDays: 365,
      encryptSensitiveMessages: true,
    },
  };

  // 初始化服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 配置通知处理器 (仅在非 Expo Go 环境中)
      if (Notifications) {
        Notifications.setNotificationHandler({
          handleNotification: async () => {
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
      }

      // 加载消息
      await this.loadMessages();
      
      // 请求通知权限 (仅在非 Expo Go 环境中)
      if (Notifications) {
        await this.requestNotificationPermissions();
        
        // 注册推送通知
        await this.registerForPushNotifications();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Initialize message service error:', error);
    }
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
      
      // 这里可以将token发送到服务器
      console.log('Push token registered:', token);
    } catch (error) {
      console.error('Register push notifications error:', error);
    }
  }

  // 加载消息
  async loadMessages(): Promise<void> {
    try {
      // 先尝试从后端加载消息
      const apiMessages = await this.fetchMessagesFromAPI();
      
      if (apiMessages && apiMessages.length > 0) {
        // 如果成功获取后端消息，使用后端数据
        this.messages = apiMessages;
        // 保存到本地缓存
        await this.saveMessages();
        console.log('[MessageService] 从后端加载了', apiMessages.length, '条消息');
      } else {
        // 如果后端没有数据或请求失败，尝试从本地缓存加载
        const messagesStr = await AsyncStorage.getItem(this.STORAGE_KEYS.MESSAGES);
        if (messagesStr) {
          this.messages = JSON.parse(messagesStr);
          console.log('[MessageService] 从本地缓存加载了', this.messages.length, '条消息');
        } else {
          // 如果本地也没有，初始化默认消息
          this.messages = await this.initializeMessages();
          console.log('[MessageService] 初始化默认消息');
        }
      }
    } catch (error) {
      console.error('Load messages error:', error);
      // 出错时尝试从本地缓存恢复
      try {
        const messagesStr = await AsyncStorage.getItem(this.STORAGE_KEYS.MESSAGES);
        if (messagesStr) {
          this.messages = JSON.parse(messagesStr);
        } else {
          this.messages = [];
        }
      } catch (cacheError) {
        console.error('Load from cache error:', cacheError);
        this.messages = [];
      }
    }
  }

  // 从后端API获取消息
  private async fetchMessagesFromAPI(): Promise<Message[] | null> {
    try {
      // 获取认证token
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('[MessageService] 没有认证token，跳过API请求');
        return null;
      }

      // 获取API地址
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.68:3000';
      const response = await fetch(`${apiUrl}/api/app-notifications?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `app-auth-token=${token}`,  // 修正cookie名称
          'Authorization': `Bearer ${token}`,    // 同时支持Authorization header
        },
      });

      if (!response.ok) {
        console.log('[MessageService] API请求失败:', response.status);
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // 处理返回的数据结构（可能是notifications数组或直接的数据数组）
        const notifications = result.data.notifications || result.data;
        
        // 转换后端数据格式为本地Message格式
        const messages: Message[] = notifications.map((item: any) => {
          // 检查用户的已读状态
          const userNotification = item.user_notifications?.[0];
          const isRead = userNotification?.is_read || false;
          const readAt = userNotification?.read_at;
          
          return {
            id: item.id || `msg_${Date.now()}_${Math.random()}`,
            title: item.title || item.message_title || '系统消息',
            content: item.content || item.message_content || '',
            type: this.mapMessageType(item.type || item.message_type),
            priority: this.mapPriority(item.priority),
            category: item.category || item.type || item.message_type || '系统通知',
            isRead: isRead,
            isStarred: item.is_starred || false,
            isArchived: item.is_archived || false,
            timestamp: new Date(item.created_at).getTime(),
            expiresAt: item.expires_at ? new Date(item.expires_at).getTime() : undefined,
            readAt: readAt ? new Date(readAt).getTime() : undefined,
            sender: item.created_by ? {
              id: item.created_by,
              name: item.created_by,
              role: '系统',
              department: '',
            } : undefined,
            relatedWorkOrderId: item.related_id,
            metadata: item.metadata || {},
          };
        });
        
        return messages;
      }
      
      return null;
    } catch (error) {
      console.error('[MessageService] 从API获取消息失败:', error);
      return null;
    }
  }

  // 映射消息类型
  private mapMessageType(type: string): Message['type'] {
    const typeMap: { [key: string]: Message['type'] } = {
      'workorder': 'workorder',
      'alarm': 'alert',
      'system': 'system',
      'reminder': 'reminder',
      'announcement': 'announcement',
      'maintenance': 'maintenance',
      'emergency': 'emergency',
      'info': 'system',  // 映射info到system
      'warning': 'alert',  // 映射warning到alert
      'error': 'emergency',  // 映射error到emergency
    };
    return typeMap[type?.toLowerCase()] || 'system';
  }

  // 映射优先级
  private mapPriority(priority: string | number): Message['priority'] {
    const priorityMap: { [key: string]: Message['priority'] } = {
      '1': 'low',
      '2': 'normal',
      '3': 'high',
      '4': 'urgent',
      '5': 'critical',
      'low': 'low',
      'normal': 'normal',
      'high': 'high',
      'urgent': 'urgent',
      'critical': 'critical',
    };
    return priorityMap[String(priority)] || 'normal';
  }

  // 保存消息
  private async saveMessages(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.MESSAGES, JSON.stringify(this.messages));
    } catch (error) {
      console.error('Save messages error:', error);
    }
  }

  // 获取所有消息
  async getMessages(filter?: MessageFilter): Promise<Message[]> {
    await this.initialize();
    
    let filteredMessages = [...this.messages];

    if (filter) {
      // 按类型过滤
      if (filter.type && filter.type.length > 0) {
        filteredMessages = filteredMessages.filter(msg => filter.type!.includes(msg.type));
      }

      // 按优先级过滤
      if (filter.priority && filter.priority.length > 0) {
        filteredMessages = filteredMessages.filter(msg => filter.priority!.includes(msg.priority));
      }

      // 按分类过滤
      if (filter.category && filter.category.length > 0) {
        filteredMessages = filteredMessages.filter(msg => filter.category!.includes(msg.category));
      }

      // 按日期过滤
      if (filter.dateRange) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.timestamp >= filter.dateRange!.start && 
          msg.timestamp <= filter.dateRange!.end
        );
      }

      // 按阅读状态过滤
      if (filter.isRead !== undefined) {
        filteredMessages = filteredMessages.filter(msg => msg.isRead === filter.isRead);
      }

      // 按收藏状态过滤
      if (filter.isStarred !== undefined) {
        filteredMessages = filteredMessages.filter(msg => msg.isStarred === filter.isStarred);
      }

      // 关键词搜索
      if (filter.searchKeyword) {
        const keyword = filter.searchKeyword.toLowerCase();
        filteredMessages = filteredMessages.filter(msg => 
          msg.title.toLowerCase().includes(keyword) ||
          msg.content.toLowerCase().includes(keyword) ||
          msg.category.toLowerCase().includes(keyword)
        );
      }
    }

    // 按时间戳降序排列
    return filteredMessages.sort((a, b) => b.timestamp - a.timestamp);
  }

  // 获取未读消息数量
  async getUnreadCount(): Promise<number> {
    await this.initialize();
    return this.messages.filter(msg => !msg.isRead).length;
  }

  // 获取未读消息
  async getUnreadMessages(): Promise<Message[]> {
    return this.getMessages({ isRead: false });
  }

  // 按类型获取消息
  async getMessagesByType(type: Message['type']): Promise<Message[]> {
    return this.getMessages({ type: [type] });
  }

  // 标记消息为已读
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex >= 0) {
        // 先更新本地状态
        this.messages[messageIndex].isRead = true;
        this.messages[messageIndex].readAt = Date.now();
        await this.saveMessages();
        
        // 同步到后端（不等待结果，避免影响用户体验）
        this.markAsReadOnServer(messageId).catch(err => 
          console.error('[MessageService] 同步已读状态到服务器失败:', err)
        );
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Mark as read error:', error);
      return false;
    }
  }

  // 在服务器上标记消息为已读
  private async markAsReadOnServer(messageId: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.68:3000';
      const response = await fetch(`${apiUrl}/api/app-notifications/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `app-auth-token=${token}`,  // 修正cookie名称
          'Authorization': `Bearer ${token}`,    // 同时支持Authorization header
        },
      });

      if (!response.ok) {
        console.error('[MessageService] 标记服务器消息已读失败:', response.status);
      }
    } catch (error) {
      console.error('[MessageService] 标记服务器消息已读异常:', error);
    }
  }

  // 批量标记为已读
  async markMultipleAsRead(messageIds: string[]): Promise<boolean> {
    try {
      let hasChanges = false;
      for (const messageId of messageIds) {
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex >= 0 && !this.messages[messageIndex].isRead) {
          this.messages[messageIndex].isRead = true;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.saveMessages();
      }
      return true;
    } catch (error) {
      console.error('Mark multiple as read error:', error);
      return false;
    }
  }

  // 标记所有消息为已读
  async markAllAsRead(): Promise<boolean> {
    try {
      let hasChanges = false;
      for (const message of this.messages) {
        if (!message.isRead) {
          message.isRead = true;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.saveMessages();
      }
      return true;
    } catch (error) {
      console.error('Mark all as read error:', error);
      return false;
    }
  }

  // 切换收藏状态
  async toggleStar(messageId: string): Promise<boolean> {
    try {
      const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex >= 0) {
        this.messages[messageIndex].isStarred = !this.messages[messageIndex].isStarred;
        await this.saveMessages();
        return this.messages[messageIndex].isStarred;
      }
      return false;
    } catch (error) {
      console.error('Toggle star error:', error);
      return false;
    }
  }

  // 删除消息
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex >= 0) {
        this.messages.splice(messageIndex, 1);
        await this.saveMessages();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Delete message error:', error);
      return false;
    }
  }

  // 批量删除消息
  async deleteMultipleMessages(messageIds: string[]): Promise<boolean> {
    try {
      this.messages = this.messages.filter(msg => !messageIds.includes(msg.id));
      await this.saveMessages();
      return true;
    } catch (error) {
      console.error('Delete multiple messages error:', error);
      return false;
    }
  }

  // 删除已读消息
  async deleteReadMessages(): Promise<boolean> {
    try {
      this.messages = this.messages.filter(msg => !msg.isRead);
      await this.saveMessages();
      return true;
    } catch (error) {
      console.error('Delete read messages error:', error);
      return false;
    }
  }

  // 添加新消息
  async addMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    try {
      const newMessage: Message = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
      };

      this.messages.unshift(newMessage);
      await this.saveMessages();

      // 发送本地通知
      await this.sendLocalNotification(newMessage);

      return newMessage.id;
    } catch (error) {
      console.error('Add message error:', error);
      throw error;
    }
  }

  // 发送本地通知
  async sendLocalNotification(message: Message): Promise<void> {
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
            workOrderId: message.relatedWorkOrderId,
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

  // 获取通知设置
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settingsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        // 合并默认设置，确保新增字段有默认值
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
      // 同一天内的时间段
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // 跨天的时间段
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // 解析时间字符串
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 100 + minutes;
  }

  // 获取消息统计
  async getMessageStats(): Promise<MessageStats> {
    await this.initialize();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const stats: MessageStats = {
      total: this.messages.length,
      unread: this.messages.filter(msg => !msg.isRead).length,
      starred: this.messages.filter(msg => msg.isStarred).length,
      byType: {},
      byPriority: {},
      byCategory: {},
      recentActivity: {
        today: this.messages.filter(msg => msg.timestamp >= todayStart).length,
        thisWeek: this.messages.filter(msg => msg.timestamp >= weekStart).length,
        thisMonth: this.messages.filter(msg => msg.timestamp >= monthStart).length,
        last24Hours: this.messages.filter(msg => msg.timestamp >= Date.now() - 86400000).length,
        last7Days: this.messages.filter(msg => msg.timestamp >= Date.now() - 604800000).length,
      },
      archived: this.messages.filter(msg => msg.isArchived).length,
      expired: this.messages.filter(msg => msg.expiresAt && Date.now() > msg.expiresAt).length,
      encrypted: this.messages.filter(msg => msg.encryptionLevel && msg.encryptionLevel !== 'none').length,
      bySender: this.calculateSenderStats(),
      complianceMetrics: {
        auditedMessages: this.messages.filter(msg => msg.auditTrail && msg.auditTrail.length > 0).length,
        retentionCompliant: this.messages.filter(msg => msg.timestamp > Date.now() - (365 * 24 * 60 * 60 * 1000)).length,
        encryptionCompliant: this.messages.filter(msg => msg.encryptionLevel && msg.encryptionLevel !== 'none').length,
      },
      performanceMetrics: {
        averageDeliveryTime: this.calculateAverageDeliveryTime(),
        averageReadTime: this.calculateAverageReadTime(),
        deliverySuccessRate: this.calculateDeliverySuccessRate(),
      },
    };

    // 统计各类型数量
    for (const message of this.messages) {
      stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
      stats.byPriority[message.priority] = (stats.byPriority[message.priority] || 0) + 1;
      stats.byCategory[message.category] = (stats.byCategory[message.category] || 0) + 1;
    }

    return stats;
  }

  // 同步服务器消息
  async syncMessages(): Promise<boolean> {
    try {
      const lastSync = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
      // const since = lastSync ? parseInt(lastSync) : 0;

      console.log('[MessageService] 开始同步消息...');
      
      // 从服务器获取最新消息
      const newMessages = await this.fetchMessagesFromAPI();
      
      if (newMessages && newMessages.length > 0) {
        // 合并新消息到现有消息列表
        for (const message of newMessages) {
          const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
          if (existingIndex >= 0) {
            // 更新现有消息（保留本地的已读状态如果服务器没有更新）
            const localMessage = this.messages[existingIndex];
            this.messages[existingIndex] = {
              ...message,
              isRead: message.isRead || localMessage.isRead,
            };
          } else {
            // 添加新消息
            this.messages.unshift(message);
          }
        }

        // 按时间戳排序
        this.messages.sort((a, b) => b.timestamp - a.timestamp);
        
        // 限制本地缓存的消息数量（保留最新的200条）
        if (this.messages.length > 200) {
          this.messages = this.messages.slice(0, 200);
        }
        
        // 保存到本地缓存
        await this.saveMessages();
        await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, Date.now().toString());
        
        console.log('[MessageService] 同步完成，共', this.messages.length, '条消息');
        return true;
      } else {
        console.log('[MessageService] 没有新消息或同步失败，使用本地缓存');
        return false;
      }
    } catch (error) {
      console.error('Sync messages error:', error);
      return false;
    }
  }

  // 清理过期消息
  async cleanupOldMessages(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const importantTypes = ['system', 'workorder']; // 重要消息类型不删除

      this.messages = this.messages.filter(msg => 
        msg.timestamp > cutoffTime || 
        importantTypes.includes(msg.type) ||
        msg.isStarred
      );

      await this.saveMessages();
    } catch (error) {
      console.error('Cleanup old messages error:', error);
    }
  }

  // 清空所有消息
  async clearAllMessages(): Promise<boolean> {
    try {
      this.messages = [];
      await this.saveMessages();
      return true;
    } catch (error) {
      console.error('Clear all messages error:', error);
      return false;
    }
  }

  // 导出消息数据
  async exportMessages(filter?: MessageFilter): Promise<string | null> {
    try {
      const messages = await this.getMessages(filter);
      return JSON.stringify(messages, null, 2);
    } catch (error) {
      console.error('Export messages error:', error);
      return null;
    }
  }

  // 获取推送令牌
  getPushToken(): string | null {
    return this.pushToken;
  }

  // 处理通知点击事件
  async handleNotificationResponse(response: any): Promise<void> {
    const data = response.notification.request.content.data;
    
    if (data.messageId) {
      await this.markAsRead(data.messageId);
    }

    // 根据消息类型执行不同的操作
    if (data.type === 'workorder' && data.workOrderId) {
      // 跳转到工单详情页面
      console.log('Navigate to work order:', data.workOrderId);
    }
  }

  // 工单相关消息
  async addWorkOrderMessage(
    workOrderId: string,
    workOrderTitle: string,
    type: 'assigned' | 'completed' | 'rejected' | 'approved'
  ): Promise<string> {
    const messageTemplates = {
      assigned: {
        title: '新工单分配',
        content: `您有新的工单待处理：${workOrderTitle}`,
        priority: 'normal' as const,
      },
      completed: {
        title: '工单完成通知',
        content: `工单"${workOrderTitle}"已提交处理结果，等待审核`,
        priority: 'low' as const,
      },
      approved: {
        title: '工单审核通过',
        content: `工单"${workOrderTitle}"审核通过，处理完成`,
        priority: 'low' as const,
      },
      rejected: {
        title: '工单需要重新处理',
        content: `工单"${workOrderTitle}"审核未通过，需要重新处理`,
        priority: 'high' as const,
      },
    };

    const template = messageTemplates[type];
    
    return this.addMessage({
      type: 'workorder',
      title: template.title,
      content: template.content,
      priority: template.priority,
      category: '工单管理',
      isRead: false,
      isStarred: false,
      isArchived: false,
      relatedWorkOrderId: workOrderId,
      actions: [
        {
          id: 'view_workorder',
          label: '查看工单',
          type: 'primary',
          action: 'navigate',
        },
      ],
    });
  }

  // 系统消息
  async addSystemMessage(
    title: string,
    content: string,
    priority: Message['priority'] = 'normal'
  ): Promise<string> {
    return this.addMessage({
      type: 'system',
      title,
      content,
      priority,
      category: '系统通知',
      isRead: false,
      isStarred: false,
      isArchived: false,
    });
  }

  // 提醒消息
  async addReminderMessage(
    title: string,
    content: string,
    priority: Message['priority'] = 'low'
  ): Promise<string> {
    return this.addMessage({
      type: 'reminder',
      title,
      content,
      priority,
      category: '提醒通知',
      isRead: false,
      isStarred: false,
      isArchived: false,
    });
  }

  // 格式化时间显示
  formatMessageTime(timestamp: number): string {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? '刚刚' : `${diffInMinutes}分钟前`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小时前`;
    } else if (diffInHours < 48) {
      return '昨天';
    } else {
      return messageDate.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  // 初始化消息数据
  private async initializeMessages(): Promise<Message[]> {
    const initialMessages: Message[] = [
      {
        id: `msg_${Date.now()}_1`,
        type: 'system',
        title: '欢迎使用河道巡查系统',
        content: '欢迎使用河道巡查移动端，请确保GPS定位已开启，以便正常记录巡查轨迹。',
        timestamp: Date.now() - 5 * 60 * 1000, // 5分钟前
        isRead: false,
        isStarred: false,
        isArchived: false,
        priority: 'normal',
        category: '系统通知',
      },
      {
        id: `msg_${Date.now()}_2`,
        type: 'reminder',
        title: '巡查提醒',
        content: '请记得及时完成今日的巡查任务，并上传相关照片和处理结果。',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2小时前
        isRead: true,
        isStarred: false,
        isArchived: false,
        priority: 'low',
        category: '提醒通知',
      },
    ];

    await this.saveMessages();
    return initialMessages;
  }

  // 计算发送者统计
  private calculateSenderStats(): { [key: string]: number } {
    const senderStats: { [key: string]: number } = {};
    
    for (const message of this.messages) {
      if (message.sender?.name) {
        const senderName = message.sender.name;
        senderStats[senderName] = (senderStats[senderName] || 0) + 1;
      } else {
        senderStats['系统'] = (senderStats['系统'] || 0) + 1;
      }
    }
    
    return senderStats;
  }
  private calculateAverageDeliveryTime(): number {
    const messagesWithDelivery = this.messages.filter(msg => msg.deliveredAt);
    if (messagesWithDelivery.length === 0) return 0;
    
    const totalTime = messagesWithDelivery.reduce((sum, msg) => {
      return sum + (msg.deliveredAt! - msg.timestamp);
    }, 0);
    
    return totalTime / messagesWithDelivery.length;
  }

  // 计算平均阅读时间
  private calculateAverageReadTime(): number {
    const readMessages = this.messages.filter(msg => msg.readAt);
    if (readMessages.length === 0) return 0;
    
    const totalTime = readMessages.reduce((sum, msg) => {
      return sum + (msg.readAt! - msg.timestamp);
    }, 0);
    
    return totalTime / readMessages.length;
  }

  // 计算送达成功率
  private calculateDeliverySuccessRate(): number {
    if (this.messages.length === 0) return 0;
    const deliveredCount = this.messages.filter(msg => msg.deliveredAt).length;
    return (deliveredCount / this.messages.length) * 100;
  }

  // 归档消息
  async archiveMessage(messageId: string): Promise<boolean> {
    try {
      const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex >= 0) {
        this.messages[messageIndex].isArchived = true;
        this.messages[messageIndex].auditTrail = [
          ...(this.messages[messageIndex].auditTrail || []),
          {
            action: 'archived',
            userId: 'current_user',
            timestamp: Date.now(),
          }
        ];
        await this.saveMessages();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Archive message error:', error);
      return false;
    }
  }

  // 批量归档消息
  async archiveMultipleMessages(messageIds: string[]): Promise<boolean> {
    try {
      let hasChanges = false;
      for (const messageId of messageIds) {
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex >= 0 && !this.messages[messageIndex].isArchived) {
          this.messages[messageIndex].isArchived = true;
          this.messages[messageIndex].auditTrail = [
            ...(this.messages[messageIndex].auditTrail || []),
            {
              action: 'archived',
              userId: 'current_user', 
              timestamp: Date.now(),
            }
          ];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.saveMessages();
      }
      return true;
    } catch (error) {
      console.error('Archive multiple messages error:', error);
      return false;
    }
  }

  // 检查是否需要发送定期提醒
  async checkAndSendReminders(): Promise<void> {
    try {
      // 这里可以根据业务逻辑添加定期提醒
      // 例如：每日巡查提醒、未完成工单提醒等
      
      const now = new Date();
      const hour = now.getHours();
      
      // 每天早上8点发送巡查提醒（如果还没有发送过）
      if (hour === 8) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMessages = await this.getMessages();
        
        const hasReminderToday = todayMessages.some(msg => 
          msg.type === 'reminder' && 
          msg.timestamp >= today.getTime() &&
          msg.title.includes('巡查提醒')
        );
        
        if (!hasReminderToday) {
          await this.addReminderMessage(
            '每日巡查提醒',
            '新的一天开始了，请及时完成今日的巡查任务。'
          );
        }
      }
    } catch (error) {
      console.error('Check reminders error:', error);
    }
  }
}

export default new MessageService();