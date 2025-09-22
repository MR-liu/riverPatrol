import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

const PRIVACY_SETTINGS_KEY = '@privacy_settings';
const DATA_SETTINGS_KEY = '@data_collection_settings';
const USAGE_SETTINGS_KEY = '@usage_settings';

export interface PrivacySetting {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
  level: 'high' | 'medium' | 'low';
  systemPermission?: string;
}

export interface DataSettings {
  dataCollection: boolean;
  analytics: boolean;
  crashReporting: boolean;
  personalizedAds: boolean;
  thirdPartySharing: boolean;
}

export interface UsageSettings {
  usageStats: boolean;
  performanceData: boolean;
  featureUsage: boolean;
  errorReporting: boolean;
}

class PrivacyService {
  // 默认隐私设置
  private defaultPrivacySettings: PrivacySetting[] = [
    {
      key: 'location',
      title: '位置信息',
      description: '允许应用访问您的位置信息用于工单定位',
      enabled: false,
      level: 'high',
      systemPermission: 'location'
    },
    {
      key: 'camera',
      title: '相机权限',
      description: '允许应用使用相机拍摄工单照片',
      enabled: false,
      level: 'high',
      systemPermission: 'camera'
    },
    {
      key: 'storage',
      title: '存储权限',
      description: '允许应用读取和保存文件到设备存储',
      enabled: false,
      level: 'medium',
      systemPermission: 'mediaLibrary'
    },
    {
      key: 'contacts',
      title: '通讯录访问',
      description: '允许应用访问通讯录用于紧急联系',
      enabled: false,
      level: 'low',
      systemPermission: 'contacts'
    },
    {
      key: 'microphone',
      title: '麦克风权限',
      description: '允许应用使用麦克风录制语音备注',
      enabled: false,
      level: 'low',
      systemPermission: 'microphone'
    },
  ];

  // 默认数据设置
  private defaultDataSettings: DataSettings = {
    dataCollection: true,
    analytics: true,
    crashReporting: true,
    personalizedAds: false,
    thirdPartySharing: false,
  };

  // 默认使用设置
  private defaultUsageSettings: UsageSettings = {
    usageStats: true,
    performanceData: true,
    featureUsage: false,
    errorReporting: true,
  };

  /**
   * 加载隐私设置
   */
  async loadPrivacySettings(): Promise<PrivacySetting[]> {
    try {
      const savedSettings = await AsyncStorage.getItem(PRIVACY_SETTINGS_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        // 同步系统权限状态
        return await this.syncPermissionStatus(settings);
      }
      // 首次加载，检查系统权限状态
      return await this.syncPermissionStatus(this.defaultPrivacySettings);
    } catch (error) {
      console.error('加载隐私设置失败:', error);
      return this.defaultPrivacySettings;
    }
  }

  /**
   * 同步系统权限状态
   */
  private async syncPermissionStatus(settings: PrivacySetting[]): Promise<PrivacySetting[]> {
    const updatedSettings = await Promise.all(settings.map(async (setting) => {
      const status = await this.checkSystemPermission(setting.systemPermission);
      return {
        ...setting,
        enabled: status === 'granted'
      };
    }));
    return updatedSettings;
  }

  /**
   * 检查系统权限状态
   */
  private async checkSystemPermission(permission?: string): Promise<string> {
    if (!permission) return 'denied';

    try {
      switch (permission) {
        case 'location': {
          const { status } = await Location.getForegroundPermissionsAsync();
          return status;
        }
        case 'camera': {
          const { status } = await ImagePicker.getCameraPermissionsAsync();
          return status;
        }
        case 'mediaLibrary': {
          const { status } = await MediaLibrary.getPermissionsAsync();
          return status;
        }
        case 'contacts': {
          const { status } = await Contacts.getPermissionsAsync();
          return status;
        }
        case 'microphone': {
          const { status } = await Audio.getPermissionsAsync();
          return status;
        }
        default:
          return 'denied';
      }
    } catch (error) {
      console.error(`检查权限 ${permission} 失败:`, error);
      return 'denied';
    }
  }

  /**
   * 请求系统权限
   */
  async requestSystemPermission(permission: string): Promise<boolean> {
    try {
      let result;
      switch (permission) {
        case 'location': {
          result = await Location.requestForegroundPermissionsAsync();
          break;
        }
        case 'camera': {
          result = await ImagePicker.requestCameraPermissionsAsync();
          break;
        }
        case 'mediaLibrary': {
          result = await MediaLibrary.requestPermissionsAsync();
          break;
        }
        case 'contacts': {
          result = await Contacts.requestPermissionsAsync();
          break;
        }
        case 'microphone': {
          result = await Audio.requestPermissionsAsync();
          break;
        }
        default:
          return false;
      }
      return result.status === 'granted';
    } catch (error) {
      console.error(`请求权限 ${permission} 失败:`, error);
      return false;
    }
  }

  /**
   * 切换隐私设置
   */
  async togglePrivacySetting(key: string, settings: PrivacySetting[]): Promise<PrivacySetting[]> {
    const settingIndex = settings.findIndex(s => s.key === key);
    if (settingIndex === -1) return settings;

    const setting = settings[settingIndex];
    const newValue = !setting.enabled;

    // 如果要开启权限，需要请求系统权限
    if (newValue && setting.systemPermission) {
      const granted = await this.requestSystemPermission(setting.systemPermission);
      if (!granted) {
        Alert.alert(
          '权限未授予',
          `请在系统设置中授予${setting.title}权限`,
          [
            { text: '取消', style: 'cancel' },
            { text: '去设置', onPress: () => this.openAppSettings() }
          ]
        );
        return settings;
      }
    }

    // 更新设置
    const updatedSettings = [...settings];
    updatedSettings[settingIndex] = { ...setting, enabled: newValue };

    // 保存到存储
    await this.savePrivacySettings(updatedSettings);
    
    return updatedSettings;
  }

  /**
   * 保存隐私设置
   */
  async savePrivacySettings(settings: PrivacySetting[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('保存隐私设置失败:', error);
      return false;
    }
  }

  /**
   * 加载数据收集设置
   */
  async loadDataSettings(): Promise<DataSettings> {
    try {
      const saved = await AsyncStorage.getItem(DATA_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : this.defaultDataSettings;
    } catch (error) {
      console.error('加载数据设置失败:', error);
      return this.defaultDataSettings;
    }
  }

  /**
   * 保存数据收集设置
   */
  async saveDataSettings(settings: DataSettings): Promise<boolean> {
    try {
      await AsyncStorage.setItem(DATA_SETTINGS_KEY, JSON.stringify(settings));
      
      // 根据设置执行相应操作
      if (!settings.analytics) {
        // 禁用分析
        console.log('Analytics disabled');
      }
      
      if (!settings.crashReporting) {
        // 禁用崩溃报告
        console.log('Crash reporting disabled');
      }
      
      return true;
    } catch (error) {
      console.error('保存数据设置失败:', error);
      return false;
    }
  }

  /**
   * 加载使用情况设置
   */
  async loadUsageSettings(): Promise<UsageSettings> {
    try {
      const saved = await AsyncStorage.getItem(USAGE_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : this.defaultUsageSettings;
    } catch (error) {
      console.error('加载使用设置失败:', error);
      return this.defaultUsageSettings;
    }
  }

  /**
   * 保存使用情况设置
   */
  async saveUsageSettings(settings: UsageSettings): Promise<boolean> {
    try {
      await AsyncStorage.setItem(USAGE_SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('保存使用设置失败:', error);
      return false;
    }
  }

  /**
   * 清除所有应用数据
   */
  async clearAllData(): Promise<boolean> {
    try {
      // 获取所有存储的键
      const allKeys = await AsyncStorage.getAllKeys();
      
      // 清除AsyncStorage
      await AsyncStorage.multiRemove(allKeys);
      
      // 清除文档目录
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        const files = await FileSystem.readDirectoryAsync(documentDir);
        await Promise.all(files.map(file => 
          FileSystem.deleteAsync(`${documentDir}${file}`, { idempotent: true })
        ));
      }
      
      // 清除缓存目录
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const cacheFiles = await FileSystem.readDirectoryAsync(cacheDir);
        await Promise.all(cacheFiles.map(file => 
          FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true })
        ));
      }
      
      console.log('所有数据已清除');
      return true;
    } catch (error) {
      console.error('清除数据失败:', error);
      return false;
    }
  }

  /**
   * 导出个人数据
   */
  async exportPersonalData(): Promise<boolean> {
    try {
      // 收集所有个人数据
      const allKeys = await AsyncStorage.getAllKeys();
      const allData: any = {};
      
      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          try {
            allData[key] = JSON.parse(value);
          } catch {
            allData[key] = value;
          }
        }
      }
      
      // 创建导出文件
      const exportData = {
        exportDate: new Date().toISOString(),
        appName: '智慧河道巡查系统',
        version: '1.0.0',
        data: allData
      };
      
      const fileName = `personal_data_export_${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // 写入文件
      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(exportData, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      
      // 检查是否可以分享
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: '导出个人数据',
        });
        return true;
      } else {
        Alert.alert('导出成功', `数据已保存到: ${fileName}`);
        return true;
      }
    } catch (error) {
      console.error('导出数据失败:', error);
      Alert.alert('导出失败', '无法导出个人数据，请重试');
      return false;
    }
  }

  /**
   * 获取存储使用情况
   */
  async getStorageInfo(): Promise<{ used: string; files: number }> {
    try {
      let totalSize = 0;
      let fileCount = 0;
      
      // 计算文档目录大小
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        const files = await FileSystem.readDirectoryAsync(documentDir);
        for (const file of files) {
          const info = await FileSystem.getInfoAsync(`${documentDir}${file}`);
          if (info.exists && info.size) {
            totalSize += info.size;
            fileCount++;
          }
        }
      }
      
      // 计算缓存目录大小
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const cacheFiles = await FileSystem.readDirectoryAsync(cacheDir);
        for (const file of cacheFiles) {
          const info = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
          if (info.exists && info.size) {
            totalSize += info.size;
            fileCount++;
          }
        }
      }
      
      // 格式化大小
      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      };
      
      return {
        used: formatSize(totalSize),
        files: fileCount
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return { used: '0 KB', files: 0 };
    }
  }

  /**
   * 打开应用设置页面
   */
  private openAppSettings() {
    if (Platform.OS === 'ios') {
      // iOS: 打开应用设置
      // Linking.openSettings();
      Alert.alert('提示', '请在 设置 > 智慧河道巡查 中管理权限');
    } else {
      // Android: 打开应用详情页
      Alert.alert('提示', '请在 设置 > 应用 > 智慧河道巡查 > 权限 中管理');
    }
  }
}

export default new PrivacyService();