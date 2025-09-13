import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppContext } from '@/contexts/AppContext';
import { PageContainer } from '@/components/PageContainer';
import SettingsService, { UserSettings } from '@/utils/SettingsService';
import JPushService from '@/utils/JPushService';

export default function EnhancedSettingsScreen() {
  const {
    userSettings,
    setUserSettings,
    offlineStats,
    isOfflineMode,
    setIsOfflineMode,
  } = useAppContext();

  const [isLoading, setIsLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const settings = userSettings;

  useEffect(() => {
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    const enabled = await JPushService.checkNotificationEnabled();
    setPushEnabled(enabled);
  };

  const handleSettingChange = async (category: string, setting: string, value: boolean | string | number) => {
    const success = await SettingsService.updateSetting(category as keyof UserSettings, setting, value);
    
    if (success) {
      const updatedSettings = await SettingsService.getUserSettings();
      setUserSettings(updatedSettings);
    } else {
      Alert.alert('设置失败', '设置更新失败，请重试');
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      '清理缓存',
      '确定要清理应用缓存吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            setIsLoading(true);
            const success = await SettingsService.clearCache();
            if (success) {
              Alert.alert('清理成功', '缓存已清理完成');
            } else {
              Alert.alert('清理失败', '缓存清理失败，请重试');
            }
            setIsLoading(false);
          },
        },
      ]
    );
  };

  const handleOfflineModeToggle = (value: boolean) => {
    setIsOfflineMode(value);
    Alert.alert(
      value ? '离线模式已开启' : '离线模式已关闭',
      value ? '应用将在无网络环境下使用本地数据' : '应用将优先使用网络数据'
    );
  };

  const renderSettingItem = (
    title: string,
    subtitle: string,
    value: boolean,
    onValueChange: (value: boolean) => void
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
        thumbColor={value ? '#3B82F6' : '#F3F4F6'}
      />
    </View>
  );

  return (
    <PageContainer title="系统设置">
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 通知设置 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="notifications" size={16} color="#374151" />
              <Text style={styles.cardTitle}>通知设置</Text>
            </View>
            {renderSettingItem(
              '推送通知',
              pushEnabled ? '推送通知已启用' : '点击开启推送通知',
              pushEnabled,
              async (value) => {
                if (value && !pushEnabled) {
                  // 打开系统设置
                  JPushService.openNotificationSettings();
                  Alert.alert(
                    '开启推送',
                    '请在系统设置中开启推送通知权限',
                    [{ text: '知道了' }]
                  );
                } else if (!value && pushEnabled) {
                  // 停止推送
                  JPushService.stopPush();
                  setPushEnabled(false);
                }
              }
            )}
            {renderSettingItem(
              '工单更新通知',
              '接收工单状态变更推送',
              settings.notifications.workOrderUpdates,
              (value) => handleSettingChange('notifications', 'workOrderUpdates', value)
            )}
            {renderSettingItem(
              '系统消息',
              '接收系统重要消息',
              settings.notifications.systemMessages,
              (value) => handleSettingChange('notifications', 'systemMessages', value)
            )}
            {renderSettingItem(
              '提醒通知',
              '接收任务提醒和预警',
              settings.notifications.reminderAlerts,
              (value) => handleSettingChange('notifications', 'reminderAlerts', value)
            )}
          </View>

          {/* 外观设置 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="brightness-6" size={16} color="#374151" />
              <Text style={styles.cardTitle}>外观设置</Text>
            </View>
            {renderSettingItem(
              '深色主题',
              '使用深色主题界面',
              settings.appearance.theme === 'dark',
              (value) => handleSettingChange('appearance', 'theme', value ? 'dark' : 'light')
            )}
          </View>

          {/* 离线数据管理 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="cloud-off" size={16} color="#374151" />
              <Text style={styles.cardTitle}>离线数据管理</Text>
            </View>
            {renderSettingItem(
              '离线模式',
              '支持无网络环境使用',
              isOfflineMode,
              handleOfflineModeToggle
            )}

            <View style={styles.offlineStatsContainer}>
              <Text style={styles.offlineStatsTitle}>离线数据统计</Text>
              <View style={styles.offlineStatsGrid}>
                <View style={styles.offlineStatItem}>
                  <Text style={styles.offlineStatValue}>{offlineStats.workOrdersCount}</Text>
                  <Text style={styles.offlineStatLabel}>工单</Text>
                </View>
                <View style={styles.offlineStatItem}>
                  <Text style={styles.offlineStatValue}>{offlineStats.offlineReportsCount}</Text>
                  <Text style={styles.offlineStatLabel}>待同步</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.cacheButton} onPress={handleClearCache}>
              <MaterialIcons name="cleaning-services" size={16} color="#3B82F6" />
              <Text style={styles.cacheButtonText}>清理缓存</Text>
            </TouchableOpacity>
          </View>

          {/* 关于应用 */}
          <View style={styles.card}>
            <View style={styles.aboutSection}>
              <Text style={styles.appName}>智慧河道巡查系统</Text>
              <Text style={styles.appVersion}>版本 1.0.0</Text>
              <Text style={styles.appCopyright}>© 2024 智慧河道管理团队</Text>
            </View>
          </View>
        </ScrollView>
      </PageContainer>
    );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  appCopyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  offlineStatsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offlineStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  offlineStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offlineStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  offlineStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  offlineStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  cacheButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 6,
    marginTop: 16,
  },
  cacheButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
});