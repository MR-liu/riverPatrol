import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

export interface UserSettings {
  notifications: {
    workOrderUpdates: boolean;
    systemMessages: boolean;
    reminderAlerts: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    language: 'zh-CN' | 'en-US';
  };
  privacy: {
    locationTracking: boolean;
    dataCollection: boolean;
    analyticsEnabled: boolean;
  };
  performance: {
    autoSync: boolean;
    imageQuality: 'low' | 'medium' | 'high';
    cacheSize: number; // MB
    backgroundRefresh: boolean;
  };
  advanced: {
    developerMode: boolean;
    debugMode: boolean;
    logLevel: 'none' | 'error' | 'info' | 'debug';
  };
}

export interface AppInfo {
  version: string;
  buildNumber: string;
  deviceInfo: {
    brand: string;
    modelName: string;
    osName: string;
    osVersion: string;
  };
  storageInfo: {
    totalSpace: number;
    freeSpace: number;
    usedByApp: number;
  };
}

class SettingsService {
  private readonly SETTINGS_KEY = 'user_settings';
  private readonly CACHE_SIZE_LIMIT = 100; // MB

  // 默认设置
  private defaultSettings: UserSettings = {
    notifications: {
      workOrderUpdates: true,
      systemMessages: true,
      reminderAlerts: true,
      soundEnabled: true,
      vibrationEnabled: true,
    },
    appearance: {
      theme: 'light',
      fontSize: 'medium',
      language: 'zh-CN',
    },
    privacy: {
      locationTracking: true,
      dataCollection: false,
      analyticsEnabled: false,
    },
    performance: {
      autoSync: true,
      imageQuality: 'medium',
      cacheSize: 50,
      backgroundRefresh: true,
    },
    advanced: {
      developerMode: false,
      debugMode: false,
      logLevel: 'error',
    },
  };

  // 获取用户设置
  async getUserSettings(): Promise<UserSettings> {
    try {
      const settingsData = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (settingsData) {
        const settings = JSON.parse(settingsData);
        // 合并默认设置，确保新增的设置项有默认值
        return this.mergeSettings(this.defaultSettings, settings);
      }
      
      // 首次使用，保存默认设置
      await this.saveUserSettings(this.defaultSettings);
      return this.defaultSettings;
    } catch (error) {
      console.error('Get user settings error:', error);
      return this.defaultSettings;
    }
  }

  // 保存用户设置
  async saveUserSettings(settings: UserSettings): Promise<boolean> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Save user settings error:', error);
      return false;
    }
  }

  // 更新特定设置
  async updateSetting(
    category: keyof UserSettings,
    key: string,
    value: any
  ): Promise<boolean> {
    try {
      const currentSettings = await this.getUserSettings();
      
      (currentSettings[category] as any)[key] = value;
      
      const success = await this.saveUserSettings(currentSettings);
      
      // 应用某些设置的立即效果
      await this.applySettingChange(category, key, value);
      
      return success;
    } catch (error) {
      console.error('Update setting error:', error);
      return false;
    }
  }

  // 重置设置到默认值
  async resetSettings(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.SETTINGS_KEY);
      await this.saveUserSettings(this.defaultSettings);
      return true;
    } catch (error) {
      console.error('Reset settings error:', error);
      return false;
    }
  }

  // 导出设置
  async exportSettings(): Promise<string | null> {
    try {
      const settings = await this.getUserSettings();
      return JSON.stringify(settings, null, 2);
    } catch (error) {
      console.error('Export settings error:', error);
      return null;
    }
  }

  // 导入设置
  async importSettings(settingsJson: string): Promise<boolean> {
    try {
      const settings = JSON.parse(settingsJson);
      const mergedSettings = this.mergeSettings(this.defaultSettings, settings);
      return await this.saveUserSettings(mergedSettings);
    } catch (error) {
      console.error('Import settings error:', error);
      return false;
    }
  }

  // 获取应用信息
  async getAppInfo(): Promise<AppInfo> {
    try {
      const version = Application.nativeApplicationVersion || '1.0.0';
      const buildNumber = Application.nativeBuildVersion || '1';
      
      return {
        version,
        buildNumber,
        deviceInfo: {
          brand: Device.brand || 'Unknown',
          modelName: Device.modelName || 'Unknown',
          osName: Device.osName || 'Unknown',
          osVersion: Device.osVersion || 'Unknown',
        },
        storageInfo: {
          totalSpace: 0, // 需要原生模块支持
          freeSpace: 0,
          usedByApp: await this.calculateAppStorageUsage(),
        },
      };
    } catch (error) {
      console.error('Get app info error:', error);
      return {
        version: '1.0.0',
        buildNumber: '1',
        deviceInfo: {
          brand: 'Unknown',
          modelName: 'Unknown',
          osName: 'Unknown',
          osVersion: 'Unknown',
        },
        storageInfo: {
          totalSpace: 0,
          freeSpace: 0,
          usedByApp: 0,
        },
      };
    }
  }

  // 检查缓存使用情况
  async getCacheInfo(): Promise<{
    size: number;
    itemCount: number;
    lastCleanup: number;
  }> {
    try {
      const cacheInfoData = await AsyncStorage.getItem('cache_info');
      if (cacheInfoData) {
        return JSON.parse(cacheInfoData);
      }
      
      return {
        size: 0,
        itemCount: 0,
        lastCleanup: 0,
      };
    } catch (error) {
      console.error('Get cache info error:', error);
      return {
        size: 0,
        itemCount: 0,
        lastCleanup: 0,
      };
    }
  }

  // 清理缓存
  async clearCache(): Promise<boolean> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('cache_') || 
        key.startsWith('temp_') ||
        key.includes('_cached')
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
      
      // 更新缓存信息
      await AsyncStorage.setItem('cache_info', JSON.stringify({
        size: 0,
        itemCount: 0,
        lastCleanup: Date.now(),
      }));
      
      return true;
    } catch (error) {
      console.error('Clear cache error:', error);
      return false;
    }
  }

  // 检查权限状态
  async checkPermissions(): Promise<{
    location: 'granted' | 'denied' | 'restricted';
    camera: 'granted' | 'denied' | 'restricted';
    notification: 'granted' | 'denied' | 'restricted';
  }> {
    // 这里需要根据实际权限检查逻辑实现
    return {
      location: 'granted',
      camera: 'granted',
      notification: 'granted',
    };
  }

  // 应用设置变更
  private async applySettingChange(
    category: keyof UserSettings,
    key: string,
    value: any
  ): Promise<void> {
    try {
      switch (category) {
        case 'performance':
          if (key === 'cacheSize' && value > this.CACHE_SIZE_LIMIT) {
            Alert.alert(
              '设置提示',
              `缓存大小不能超过 ${this.CACHE_SIZE_LIMIT}MB，已自动调整为最大值`
            );
            await this.updateSetting(category, key, this.CACHE_SIZE_LIMIT);
          }
          break;
          
        case 'advanced':
          if (key === 'developerMode' && value) {
            Alert.alert(
              '开发者模式',
              '开发者模式已开启，这将显示额外的调试信息和选项。'
            );
          }
          break;
          
        case 'privacy':
          if (key === 'locationTracking' && !value) {
            Alert.alert(
              '位置服务',
              '关闭位置追踪可能会影响巡查轨迹记录功能。'
            );
          }
          break;
      }
    } catch (error) {
      console.error('Apply setting change error:', error);
    }
  }

  // 合并设置对象
  private mergeSettings(
    defaultSettings: UserSettings,
    userSettings: Partial<UserSettings>
  ): UserSettings {
    const merged = { ...defaultSettings };
    
    Object.keys(userSettings).forEach(category => {
      const categoryKey = category as keyof UserSettings;
      if (merged[categoryKey] && userSettings[categoryKey]) {
        merged[categoryKey] = {
          ...merged[categoryKey],
          ...userSettings[categoryKey],
        } as any;
      }
    });
    
    return merged;
  }

  // 计算应用存储使用量
  private async calculateAppStorageUsage(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      // 简单估算，实际需要更精确的计算
      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
      
      return Math.round(totalSize / (1024 * 1024)); // 转换为MB
    } catch (error) {
      console.error('Calculate storage usage error:', error);
      return 0;
    }
  }

  // 系统诊断
  async runDiagnostics(): Promise<{
    settingsHealth: boolean;
    cacheStatus: boolean;
    permissionsOk: boolean;
    storageOk: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // 检查设置健康状况
      const settings = await this.getUserSettings();
      const settingsHealth = settings !== null;
      if (!settingsHealth) {
        issues.push('设置数据损坏或丢失');
      }
      
      // 检查缓存状态
      const cacheInfo = await this.getCacheInfo();
      const cacheStatus = cacheInfo.size < this.CACHE_SIZE_LIMIT;
      if (!cacheStatus) {
        issues.push('缓存使用量过大，建议清理');
      }
      
      // 检查权限
      const permissions = await this.checkPermissions();
      const permissionsOk = Object.values(permissions).every(p => p === 'granted');
      if (!permissionsOk) {
        issues.push('部分权限未授予，可能影响功能使用');
      }
      
      // 检查存储
      const appInfo = await this.getAppInfo();
      const storageOk = appInfo.storageInfo.usedByApp < 500; // 500MB限制
      if (!storageOk) {
        issues.push('应用存储使用量过大');
      }
      
      return {
        settingsHealth,
        cacheStatus,
        permissionsOk,
        storageOk,
        issues,
      };
    } catch (error) {
      console.error('Run diagnostics error:', error);
      return {
        settingsHealth: false,
        cacheStatus: false,
        permissionsOk: false,
        storageOk: false,
        issues: ['诊断过程中发生错误'],
      };
    }
  }
}

export default new SettingsService();