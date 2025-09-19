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
    // 监听远程通知 (3.2.0版本使用 addNotificationListener)
    JPush.addNotificationListener((notification) => {
      console.log('[JPush] 收到远程通知:', notification);
      this.handleRemoteNotification(notification);
      // 如果是点击通知打开APP，也处理打开事件
      if (notification.notificationEventType === 'notificationOpened') {
        this.handleNotificationOpen(notification);
      }
    });

    // 监听本地通知 (使用 addLocalNotificationListener)
    JPush.addLocalNotificationListener((notification) => {
      console.log('[JPush] 收到本地通知:', notification);
      this.handleNotificationOpen(notification);
    });

    // 监听自定义消息
    JPush.addCustomMessageListener((message) => {
      console.log('[JPush] 收到自定义消息:', message);
      this.handleCustomMessage(message);
    });

    // 监听Tag/Alias操作结果
    JPush.addTagAliasListener((result) => {
      console.log('[JPush] Tag/Alias操作结果:', result);
    });

    // 监听连接状态
    JPush.addConnectEventListener((connected) => {
      console.log('[JPush] 连接状态:', connected ? '已连接' : '已断开');
    });
    
    // 初始化后主动获取RegistrationID
    setTimeout(() => {
      this.getRegistrationId();
    }, 2000);
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
        JPush.getRegistrationID((result: any) => {
          // 3.2.0版本返回对象格式 {registerID: string}
          const registrationId = typeof result === 'string' ? result : result?.registerID;
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
   * 注册设备到服务器（内部使用）
   */
  private async registerDevice(registrationId: string) {
    try {
      // 暂时只记录日志，实际注册需要在登录后调用 registerDeviceToBackend
      console.log('[JPush] 获取到RegistrationID，等待用户登录后注册:', registrationId);
      // 保存到实例变量，登录后使用
      this.registrationId = registrationId;
    } catch (error) {
      console.error('[JPush] 设备注册异常:', error);
    }
  }

  /**
   * 注册设备到后端服务器（需要在登录后调用）
   */
  async registerDeviceToBackend(authToken: string): Promise<boolean> {
    try {
      if (!this.registrationId) {
        console.log('[JPush] 没有RegistrationID，无法注册设备');
        return false;
      }

      const deviceInfo = {
        jpush_registration_id: this.registrationId,
        device_type: Platform.OS === 'ios' ? 'iOS' : 'Android',
        device_model: DeviceInfo.getModel(),
        os_version: DeviceInfo.getSystemVersion(),
        app_version: DeviceInfo.getVersion(),
      };

      console.log('[JPush] 向后端注册设备信息:', deviceInfo);

      // 调用后端API注册设备
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.16:3000';
      const response = await fetch(`${apiUrl}/api/app-device-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth-token=${authToken}`,
        },
        body: JSON.stringify(deviceInfo),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[JPush] 设备注册到后端成功:', result.data);
        return true;
      } else {
        console.error('[JPush] 设备注册到后端失败:', result.error || result.message);
        return false;
      }
    } catch (error) {
      console.error('[JPush] 设备注册到后端异常:', error);
      return false;
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
      // 3.2.0版本需要传入对象格式
      const params = {
        sequence: Date.now(), // 用时间戳作为序列号
        tags: tags
      };
      JPush.updateTags(params);
      console.log('[JPush] 设置标签:', tags);
    } catch (error) {
      console.error('[JPush] 设置标签失败:', error);
    }
  }

  /**
   * 设置别名
   */
  async setAlias(alias: string) {
    try {
      // 3.2.0版本需要传入对象格式
      const params = {
        sequence: Date.now(), // 用时间戳作为序列号
        alias: alias
      };
      JPush.setAlias(params);
      console.log('[JPush] 设置别名:', alias);
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