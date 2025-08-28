import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { LoadingState } from '@/components/LoadingState';
import { PageContainer } from '@/components/PageContainer';

interface PrivacySetting {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
  level: 'high' | 'medium' | 'low';
}

export default function PrivacySettingsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySetting[]>([
    {
      key: 'location',
      title: '位置信息',
      description: '允许应用访问您的位置信息用于工单定位',
      enabled: true,
      level: 'high',
    },
    {
      key: 'camera',
      title: '相机权限',
      description: '允许应用使用相机拍摄工单照片',
      enabled: true,
      level: 'high',
    },
    {
      key: 'storage',
      title: '存储权限',
      description: '允许应用读取和保存文件到设备存储',
      enabled: true,
      level: 'medium',
    },
    {
      key: 'contacts',
      title: '通讯录访问',
      description: '允许应用访问通讯录用于紧急联系',
      enabled: false,
      level: 'low',
    },
    {
      key: 'microphone',
      title: '麦克风权限',
      description: '允许应用使用麦克风录制语音备注',
      enabled: false,
      level: 'low',
    },
  ]);

  const [dataSettings, setDataSettings] = useState({
    dataCollection: true,
    analytics: true,
    crashReporting: true,
    personalizedAds: false,
    thirdPartySharing: false,
  });

  const [usageSettings, setUsageSettings] = useState({
    usageStats: true,
    performanceData: true,
    featureUsage: false,
    errorReporting: true,
  });

  const togglePrivacySetting = async (key: string) => {
    const settingIndex = privacySettings.findIndex(s => s.key === key);
    if (settingIndex === -1) return;

    const setting = privacySettings[settingIndex];
    const newValue = !setting.enabled;

    // 对于重要权限，显示确认对话框
    if (setting.level === 'high' && !newValue) {
      Alert.alert(
        '权限警告',
        `关闭${setting.title}可能会影响应用的正常使用，确定要关闭吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定关闭',
            style: 'destructive',
            onPress: () => updatePrivacySetting(settingIndex, newValue)
          }
        ]
      );
      return;
    }

    updatePrivacySetting(settingIndex, newValue);
  };

  const updatePrivacySetting = async (index: number, newValue: boolean) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPrivacySettings(prev => {
        const newSettings = [...prev];
        newSettings[index] = { ...newSettings[index], enabled: newValue };
        return newSettings;
      });

      const settingName = privacySettings[index].title;
      Alert.alert('设置成功', `${settingName}权限已${newValue ? '开启' : '关闭'}`);
    } catch (error) {
      Alert.alert('设置失败', '权限设置失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDataSetting = async (key: keyof typeof dataSettings) => {
    const newValue = !dataSettings[key];
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setDataSettings(prev => ({
        ...prev,
        [key]: newValue
      }));

      const settingNames = {
        dataCollection: '数据收集',
        analytics: '分析统计',
        crashReporting: '崩溃报告',
        personalizedAds: '个性化广告',
        thirdPartySharing: '第三方共享'
      };
      
      Alert.alert('设置成功', `${settingNames[key]}已${newValue ? '开启' : '关闭'}`);
    } catch (error) {
      setDataSettings(prev => ({
        ...prev,
        [key]: !newValue
      }));
      Alert.alert('设置失败', '设置保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUsageSetting = async (key: keyof typeof usageSettings) => {
    const newValue = !usageSettings[key];
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUsageSettings(prev => ({
        ...prev,
        [key]: newValue
      }));

      const settingNames = {
        usageStats: '使用统计',
        performanceData: '性能数据',
        featureUsage: '功能使用',
        errorReporting: '错误报告'
      };
      
      Alert.alert('设置成功', `${settingNames[key]}已${newValue ? '开启' : '关闭'}`);
    } catch (error) {
      setUsageSettings(prev => ({
        ...prev,
        [key]: !newValue
      }));
      Alert.alert('设置失败', '设置保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllData = () => {
    Alert.alert(
      '清除数据',
      '这将清除所有本地缓存数据，包括工单、照片等信息。此操作不可恢复，确定要继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定清除',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await new Promise(resolve => setTimeout(resolve, 2000));
              Alert.alert('清除成功', '所有本地数据已清除');
            } catch (error) {
              Alert.alert('清除失败', '数据清除失败，请重试');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const exportPersonalData = () => {
    Alert.alert(
      '导出个人数据',
      '我们将为您打包所有个人数据，包括工单记录、考勤信息等。导出文件将发送到您的邮箱。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定导出',
          onPress: async () => {
            setIsLoading(true);
            try {
              await new Promise(resolve => setTimeout(resolve, 2000));
              Alert.alert('导出成功', '个人数据导出文件已发送到您的邮箱');
            } catch (error) {
              Alert.alert('导出失败', '数据导出失败，请重试');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const getLevelColor = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getLevelText = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return '重要';
      case 'medium': return '一般';
      case 'low': return '可选';
      default: return '';
    }
  };

  const renderPrivacyItem = (setting: PrivacySetting) => (
    <View key={setting.key} style={styles.privacyItem}>
      <View style={styles.privacyItemLeft}>
        <View style={styles.privacyInfo}>
          <View style={styles.privacyHeader}>
            <Text style={styles.privacyTitle}>{setting.title}</Text>
            <View style={[styles.levelBadge, { backgroundColor: getLevelColor(setting.level) }]}>
              <Text style={styles.levelText}>{getLevelText(setting.level)}</Text>
            </View>
          </View>
          <Text style={styles.privacyDescription}>{setting.description}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.switch}
        onPress={() => togglePrivacySetting(setting.key)}
      >
        <View style={[styles.switchTrack, setting.enabled && styles.switchTrackActive]}>
          <View style={[styles.switchThumb, setting.enabled && styles.switchThumbActive]} />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderDataSettingItem = (
    key: keyof typeof dataSettings,
    title: string,
    description: string
  ) => (
    <View key={key} style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <TouchableOpacity
        style={styles.switch}
        onPress={() => toggleDataSetting(key)}
      >
        <View style={[styles.switchTrack, dataSettings[key] && styles.switchTrackActive]}>
          <View style={[styles.switchThumb, dataSettings[key] && styles.switchThumbActive]} />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderUsageSettingItem = (
    key: keyof typeof usageSettings,
    title: string,
    description: string
  ) => (
    <View key={key} style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <TouchableOpacity
        style={styles.switch}
        onPress={() => toggleUsageSetting(key)}
      >
        <View style={[styles.switchTrack, usageSettings[key] && styles.switchTrackActive]}>
          <View style={[styles.switchThumb, usageSettings[key] && styles.switchThumbActive]} />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderActionButton = (
    title: string,
    description: string,
    icon: string,
    color: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.actionInfo}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );

  return (
    <PageContainer title="隐私设置">
      <LoadingState isLoading={isLoading}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 权限管理 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="security" size={16} color="#374151" />
                <Text style={styles.cardTitle}>权限管理</Text>
              </View>
              <Text style={styles.cardDescription}>
                管理应用所需的各项权限，您可以随时调整这些设置
              </Text>
              <View style={styles.privacyList}>
                {privacySettings.map(renderPrivacyItem)}
              </View>
            </View>

            {/* 数据收集 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="analytics" size={16} color="#374151" />
                <Text style={styles.cardTitle}>数据收集设置</Text>
              </View>
              <Text style={styles.cardDescription}>
                控制我们收集哪些数据来改善应用体验
              </Text>
              <View style={styles.settingsList}>
                {renderDataSettingItem('dataCollection', '基础数据收集', '收集应用使用数据以改善功能')}
                {renderDataSettingItem('analytics', '分析统计', '收集匿名化分析数据')}
                {renderDataSettingItem('crashReporting', '崩溃报告', '自动发送崩溃日志帮助修复问题')}
                {renderDataSettingItem('personalizedAds', '个性化广告', '基于使用习惯显示相关广告')}
                {renderDataSettingItem('thirdPartySharing', '第三方数据共享', '允许与合作伙伴共享数据')}
              </View>
            </View>

            {/* 使用情况 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="insights" size={16} color="#374151" />
                <Text style={styles.cardTitle}>使用情况分析</Text>
              </View>
              <Text style={styles.cardDescription}>
                帮助我们了解功能使用情况以优化体验
              </Text>
              <View style={styles.settingsList}>
                {renderUsageSettingItem('usageStats', '使用统计', '收集功能使用频率和时长')}
                {renderUsageSettingItem('performanceData', '性能数据', '收集应用性能和响应时间数据')}
                {renderUsageSettingItem('featureUsage', '功能使用分析', '分析各功能的使用模式')}
                {renderUsageSettingItem('errorReporting', '错误报告', '自动报告应用错误和异常')}
              </View>
            </View>

            {/* 数据管理 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="folder-shared" size={16} color="#374151" />
                <Text style={styles.cardTitle}>数据管理</Text>
              </View>
              <Text style={styles.cardDescription}>
                管理您的个人数据，包括导出和删除选项
              </Text>
              <View style={styles.actionsList}>
                {renderActionButton(
                  '导出个人数据',
                  '获取您在应用中的所有个人数据副本',
                  'cloud-download',
                  '#3B82F6',
                  exportPersonalData
                )}
                {renderActionButton(
                  '清除所有数据',
                  '删除设备上存储的所有应用数据',
                  'delete-forever',
                  '#EF4444',
                  clearAllData
                )}
              </View>
            </View>

            {/* 隐私政策 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="policy" size={16} color="#374151" />
                <Text style={styles.cardTitle}>隐私政策</Text>
              </View>
              <Text style={styles.policyText}>
                我们重视您的隐私权。请阅读我们的隐私政策以了解我们如何收集、使用和保护您的个人信息。
              </Text>
              <TouchableOpacity 
                style={styles.policyButton}
                onPress={() => Alert.alert('隐私政策', '跳转到隐私政策页面...')}
              >
                <Text style={styles.policyButtonText}>阅读完整隐私政策</Text>
                <MaterialIcons name="open-in-new" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>

            {/* 最后更新时间 */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                隐私设置最后更新: {new Date().toLocaleDateString('zh-CN')}
              </Text>
            </View>
          </ScrollView>
        </LoadingState>
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  privacyList: {
    gap: 16,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  privacyItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 16,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  privacyDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  settingsList: {
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  switch: {
    marginLeft: 12,
  },
  switchTrack: {
    width: 44,
    height: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#3B82F6',
  },
  switchThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  actionsList: {
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  policyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  policyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
    gap: 8,
  },
  policyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});