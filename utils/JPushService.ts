/**
 * 极光推送服务
 * 处理推送初始化、设备注册、消息接收等功能
 */

import { Platform } from 'react-native';
import JPush from 'jpush-react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SupabaseService from './SupabaseService';

const JPUSH_STORAGE_KEY = 'jpush_registration_id';

class JPushService {
  private isInitialized = false;
  private registrationId: string | null = null;
  private notificationListeners: Array<(notification: any) => void> = [];
  private localNotificationListeners: Array<(notification: any) => void> = [];
  private customMessageListeners: Array<(message: any) => void> = [];

  /**
   * 初始化极光推送
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[JPush] 已经初始化，跳过');
      return;
    }

    try {
      console.log('[JPush] 开始初始化...');
      
      // 初始化极光推送
      JPush.init();
      
      // 设置调试模式（生产环境应设为false）
      if (__DEV__) {
        JPush.setLoggerEnable(true);
      }

      // 注册监听器
      this.registerListeners();
      
      // 获取RegistrationID
      await this.getRegistrationId();
      
      // 请求通知权限（iOS）
      if (Platform.OS === 'ios') {
        JPush.requestPermission();
      }
      
      this.isInitialized = true;
      console.log('[JPush] 初始化成功');
    } catch (error) {
      console.error('[JPush] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 注册所有监听器
   */
  private registerListeners() {
    // 监听远程通知
    JPush.addReceiveNotificationListener((notification) => {
      console.log('[JPush] 收到远程通知:', notification);
      this.handleRemoteNotification(notification);
    });

    // 监听本地通知
    JPush.addReceiveOpenNotificationListener((notification) => {
      console.log('[JPush] 打开通知:', notification);
      this.handleNotificationOpen(notification);
    });

    // 监听自定义消息
    JPush.addReceiveCustomMsgListener((message) => {
      console.log('[JPush] 收到自定义消息:', message);
      this.handleCustomMessage(message);
    });

    // 监听RegistrationID变化
    JPush.addGetRegistrationIdListener((registrationId) => {
      console.log('[JPush] RegistrationID更新:', registrationId);
      this.registrationId = registrationId;
      this.saveRegistrationId(registrationId);
      this.registerDevice(registrationId);
    });

    // 监听连接状态
    JPush.addConnectEventListener((connected) => {
      console.log('[JPush] 连接状态:', connected ? '已连接' : '已断开');
    });
  }

  /**
   * 获取RegistrationID
   */
  async getRegistrationId(): Promise<string | null> {
    try {
      // 先从缓存获取
      if (this.registrationId) {
        return this.registrationId;
      }

      // 从存储获取
      const savedId = await AsyncStorage.getItem(JPUSH_STORAGE_KEY);
      if (savedId) {
        this.registrationId = savedId;
        return savedId;
      }

      // 从极光获取
      return new Promise((resolve) => {
        JPush.getRegistrationID((registrationId: string) => {
          if (registrationId) {
            console.log('[JPush] 获取到RegistrationID:', registrationId);
            this.registrationId = registrationId;
            this.saveRegistrationId(registrationId);
            this.registerDevice(registrationId);
            resolve(registrationId);
          } else {
            console.log('[JPush] RegistrationID暂未生成');
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('[JPush] 获取RegistrationID失败:', error);
      return null;
    }
  }

  /**
   * 保存RegistrationID到本地
   */
  private async saveRegistrationId(registrationId: string) {
    try {
      await AsyncStorage.setItem(JPUSH_STORAGE_KEY, registrationId);
      console.log('[JPush] RegistrationID已保存');
    } catch (error) {
      console.error('[JPush] 保存RegistrationID失败:', error);
    }
  }

  /**
   * 注册设备到服务器
   */
  private async registerDevice(registrationId: string) {
    try {
      const user = await SupabaseService.getCurrentUser();
      if (!user) {
        console.log('[JPush] 用户未登录，跳过设备注册');
        return;
      }

      const deviceInfo = {
        user_id: user.id,
        device_id: await DeviceInfo.getUniqueId(),
        device_type: Platform.OS === 'ios' ? 'iOS' : 'Android',
        device_model: DeviceInfo.getModel(),
        os_version: DeviceInfo.getSystemVersion(),
        app_version: DeviceInfo.getVersion(),
        jpush_registration_id: registrationId,
        push_channel: 'jpush',
        push_enabled: true,
      };

      console.log('[JPush] 注册设备信息:', deviceInfo);

      // 注册到Supabase
      const { error } = await SupabaseService.supabase
        .from('mobile_devices')
        .upsert(deviceInfo, {
          onConflict: 'device_id',
        });

      if (error) {
        console.error('[JPush] 设备注册失败:', error);
      } else {
        console.log('[JPush] 设备注册成功');
      }
    } catch (error) {
      console.error('[JPush] 设备注册异常:', error);
    }
  }

  /**
   * 处理远程通知
   */
  private handleRemoteNotification(notification: any) {
    // 通知所有监听器
    this.notificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('[JPush] 通知监听器执行失败:', error);
      }
    });
  }

  /**
   * 处理通知打开
   */
  private handleNotificationOpen(notification: any) {
    // 通知所有本地监听器
    this.localNotificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('[JPush] 本地通知监听器执行失败:', error);
      }
    });

    // 处理通知点击跳转
    this.handleNotificationNavigation(notification);
  }

  /**
   * 处理自定义消息
   */
  private handleCustomMessage(message: any) {
    // 通知所有自定义消息监听器
    this.customMessageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[JPush] 自定义消息监听器执行失败:', error);
      }
    });
  }

  /**
   * 处理通知点击后的页面跳转
   */
  private handleNotificationNavigation(notification: any) {
    try {
      const extras = notification.extras || {};
      const { type, target_id } = extras;

      console.log('[JPush] 处理通知跳转:', { type, target_id });

      // 根据类型跳转到不同页面
      switch (type) {
        case 'workorder':
          // 跳转到工单详情
          if (target_id) {
            // TODO: 使用路由跳转到工单详情页
            console.log('[JPush] 跳转到工单详情:', target_id);
          }
          break;
        case 'alarm':
          // 跳转到告警详情
          if (target_id) {
            console.log('[JPush] 跳转到告警详情:', target_id);
          }
          break;
        case 'announcement':
          // 跳转到公告列表
          console.log('[JPush] 跳转到公告列表');
          break;
        default:
          console.log('[JPush] 未知的跳转类型:', type);
      }
    } catch (error) {
      console.error('[JPush] 处理通知跳转失败:', error);
    }
  }

  /**
   * 添加通知监听器
   */
  addNotificationListener(listener: (notification: any) => void) {
    this.notificationListeners.push(listener);
    return () => {
      const index = this.notificationListeners.indexOf(listener);
      if (index > -1) {
        this.notificationListeners.splice(index, 1);
      }
    };
  }

  /**
   * 添加本地通知监听器
   */
  addLocalNotificationListener(listener: (notification: any) => void) {
    this.localNotificationListeners.push(listener);
    return () => {
      const index = this.localNotificationListeners.indexOf(listener);
      if (index > -1) {
        this.localNotificationListeners.splice(index, 1);
      }
    };
  }

  /**
   * 添加自定义消息监听器
   */
  addCustomMessageListener(listener: (message: any) => void) {
    this.customMessageListeners.push(listener);
    return () => {
      const index = this.customMessageListeners.indexOf(listener);
      if (index > -1) {
        this.customMessageListeners.splice(index, 1);
      }
    };
  }

  /**
   * 设置标签
   */
  async setTags(tags: string[]) {
    try {
      JPush.setTags(tags, (result) => {
        console.log('[JPush] 设置标签结果:', result);
      });
    } catch (error) {
      console.error('[JPush] 设置标签失败:', error);
    }
  }

  /**
   * 设置别名
   */
  async setAlias(alias: string) {
    try {
      JPush.setAlias(alias, (result) => {
        console.log('[JPush] 设置别名结果:', result);
      });
    } catch (error) {
      console.error('[JPush] 设置别名失败:', error);
    }
  }

  /**
   * 清除所有通知
   */
  clearAllNotifications() {
    JPush.clearAllNotifications();
  }

  /**
   * 设置角标数量（iOS）
   */
  setBadge(badge: number) {
    if (Platform.OS === 'ios') {
      JPush.setBadge(badge);
    }
  }

  /**
   * 检查通知权限
   */
  async checkNotificationEnabled(): Promise<boolean> {
    return new Promise((resolve) => {
      JPush.isNotificationEnabled((enabled: boolean) => {
        resolve(enabled);
      });
    });
  }

  /**
   * 打开通知设置页面
   */
  openNotificationSettings() {
    JPush.openSettingsForNotification();
  }

  /**
   * 停止推送服务
   */
  stopPush() {
    JPush.stopPush();
  }

  /**
   * 恢复推送服务
   */
  resumePush() {
    JPush.resumePush();
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.notificationListeners = [];
    this.localNotificationListeners = [];
    this.customMessageListeners = [];
    this.isInitialized = false;
  }
}

export default new JPushService();