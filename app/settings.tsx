import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppContext } from '@/contexts/AppContext';
import SettingsService, { UserSettings, AppInfo } from '@/utils/SettingsService';

export default function SettingsScreen() {
  const {
    userSettings,
    setUserSettings,
    offlineStats,
    isOfflineMode,
    setIsOfflineMode,
    syncOfflineData,
    clearOfflineData,
  } = useAppContext();

  const handleSettingChange = (category: string, setting: string, value: boolean | string) => {
    setUserSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [setting]: value,
      },
    }));

    Alert.alert('设置已更新', '设置已成功保存');
  };

  const handleOfflineModeToggle = (value: boolean) => {
    setIsOfflineMode(value);
    Alert.alert(
      value ? '离线模式已开启' : '离线模式已关闭',
      value ? '应用将在无网络环境下使用本地数据' : '应用将优先使用网络数据'
    );
  };

  const handleSyncOfflineData = async () => {
    Alert.alert(
      '同步离线数据',
      '确定要同步所有离线数据吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              await syncOfflineData();
              Alert.alert('同步成功', '离线数据已成功同步到服务器');
            } catch (error) {
              console.error('Sync failed:', error);
              Alert.alert('同步失败', '请检查网络连接后重试');
            }
          },
        },
      ]
    );
  };

  const handleClearOfflineData = () => {
    Alert.alert(
      '清空离线数据',
      '确定要清空所有离线数据吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            const success = await clearOfflineData();
            if (success) {
              Alert.alert('清空成功', '所有离线数据已清空');
            } else {
              Alert.alert('清空失败', '请稍后重试');
            }
          },
        },
      ]
    );
  };

  const handleAccountManagement = () => {
    Alert.alert('账户管理', '账户管理功能开发中，敬请期待');
  };

  const handleNetworkSettings = () => {
    Alert.alert('网络设置', '网络设置功能开发中，敬请期待');
  };

  const handleSecuritySettings = () => {
    Alert.alert('安全设置', '安全设置功能开发中，敬请期待');
  };

  const handleCheckUpdate = () => {
    Alert.alert('检查更新', '当前已是最新版本 v1.0.0');
  };

  const handleUserAgreement = () => {
    Alert.alert('用户协议', '用户协议功能开发中，敬请期待');
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

  const renderFontSizeSelector = () => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>字体大小</Text>
        <Text style={styles.settingSubtitle}>调整界面字体大小</Text>
      </View>
      <View style={styles.fontSizeButtons}>
        {['small', 'medium', 'large'].map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.fontSizeButton,
              userSettings.appearance.fontSize === size && styles.fontSizeButtonActive,
            ]}
            onPress={() => handleSettingChange('appearance', 'fontSize', size)}
          >
            <Text style={[
              styles.fontSizeButtonText,
              userSettings.appearance.fontSize === size && styles.fontSizeButtonTextActive,
            ]}>
              {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderMenuOption = (icon: string, title: string, subtitle: string, onPress: () => void) => (
    <TouchableOpacity style={styles.menuOption} onPress={onPress}>
      <View style={styles.menuOptionLeft}>
        <MaterialIcons name={icon as any} size={20} color="#6B7280" />
        <View style={styles.menuOptionInfo}>
          <Text style={styles.menuOptionTitle}>{title}</Text>
          <Text style={styles.menuOptionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <MaterialIcons name="keyboard-arrow-right" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 自定义头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>系统设置</Text>
        <View style={styles.headerButton} />
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 通知设置 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="notifications" size={16} color="#374151" />
              <Text style={styles.cardTitle}>通知设置</Text>
            </View>
            {renderSettingItem(
              '工单更新通知',
              '接收工单状态变更推送',
              userSettings.notifications.workOrderUpdates,
              (value) => handleSettingChange('notifications', 'workOrderUpdates', value)
            )}
            {renderSettingItem(
              '系统消息',
              '接收系统重要消息',
              userSettings.notifications.systemMessages,
              (value) => handleSettingChange('notifications', 'systemMessages', value)
            )}
            {renderSettingItem(
              '提醒通知',
              '接收任务提醒和截止日期通知',
              userSettings.notifications.reminderAlerts,
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
              userSettings.appearance.theme === 'dark',
              (value) => handleSettingChange('appearance', 'theme', value ? 'dark' : 'light')
            )}
            {renderFontSizeSelector()}
          </View>

          {/* 隐私设置 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="security" size={16} color="#374151" />
              <Text style={styles.cardTitle}>隐私设置</Text>
            </View>
            {renderSettingItem(
              '位置追踪',
              '允许应用获取和使用位置信息',
              userSettings.privacy.locationTracking,
              (value) => handleSettingChange('privacy', 'locationTracking', value)
            )}
            {renderSettingItem(
              '数据收集',
              '允许收集使用数据以改进服务',
              userSettings.privacy.dataCollection,
              (value) => handleSettingChange('privacy', 'dataCollection', value)
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
                <View style={styles.offlineStatItem}>
                  <Text style={styles.offlineStatValue}>{offlineStats.cachedPhotosCount}</Text>
                  <Text style={styles.offlineStatLabel}>照片</Text>
                </View>
                <View style={styles.offlineStatItem}>
                  <Text style={styles.offlineStatValue}>{offlineStats.totalStorageSize}</Text>
                  <Text style={styles.offlineStatLabel}>存储空间</Text>
                </View>
              </View>
            </View>

            <View style={styles.offlineActions}>
              <TouchableOpacity style={styles.offlineActionButton} onPress={handleSyncOfflineData}>
                <MaterialIcons name="sync" size={16} color="#3B82F6" />
                <Text style={styles.offlineActionText}>同步数据</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offlineActionButton, styles.offlineActionButtonDanger]}
                onPress={handleClearOfflineData}
              >
                <MaterialIcons name="delete-sweep" size={16} color="#EF4444" />
                <Text style={[styles.offlineActionText, styles.offlineActionTextDanger]}>清空数据</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 其他选项 */}
          <View style={styles.card}>
            {renderMenuOption('person', '账户管理', '修改个人信息、密码', handleAccountManagement)}
            {renderMenuOption('wifi', '网络设置', 'WiFi、移动网络配置', handleNetworkSettings)}
            {renderMenuOption('lock', '安全设置', '指纹解锁、应用锁', handleSecuritySettings)}
          </View>

          {/* 关于应用 */}
          <View style={styles.card}>
            <View style={styles.aboutSection}>
              <Text style={styles.appName}>智慧河道巡查系统</Text>
              <Text style={styles.appVersion}>版本 1.0.0</Text>
              <Text style={styles.appCopyright}>© 2024 智慧河道管理团队</Text>
            </View>
            <View style={styles.aboutButtons}>
              <TouchableOpacity style={styles.aboutButton} onPress={handleCheckUpdate}>
                <Text style={styles.aboutButtonText}>检查更新</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aboutButton} onPress={handleUserAgreement}>
                <Text style={styles.aboutButtonText}>用户协议</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3B82F6',
  },
  header: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  background: {
    flex: 1,
  },
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
  fontSizeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  fontSizeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fontSizeButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  fontSizeButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  fontSizeButtonTextActive: {
    color: '#FFFFFF',
  },
  menuOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  menuOptionInfo: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuOptionSubtitle: {
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
  aboutButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  aboutButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aboutButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
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
  offlineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  offlineActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 6,
  },
  offlineActionButtonDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  offlineActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  offlineActionTextDanger: {
    color: '#EF4444',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  languageButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  languageButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  languageButtonTextActive: {
    color: '#FFFFFF',
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  qualityButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qualityButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  qualityButtonText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  qualityButtonTextActive: {
    color: '#FFFFFF',
  },
  cacheInfoContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cacheInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cacheInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  cacheInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  cacheInfoLabel: {
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
  },
  cacheButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  logLevelButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  logLevelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logLevelButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  logLevelButtonText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  logLevelButtonTextActive: {
    color: '#FFFFFF',
  },
  deviceInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  deviceInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  resetButtonContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
});