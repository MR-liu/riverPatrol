import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JPushService from '@/utils/JPushService';
import { Ionicons } from '@expo/vector-icons';

interface PushConfig {
  enable_alarm_push: boolean;
  enable_workorder_push: boolean;
  enable_notification_push: boolean;
  enable_inspection_push: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  min_priority: 'low' | 'normal' | 'high' | 'urgent';
}

export default function PushSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [config, setConfig] = useState<PushConfig>({
    enable_alarm_push: true,
    enable_workorder_push: true,
    enable_notification_push: true,
    enable_inspection_push: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    min_priority: 'normal',
  });

  useEffect(() => {
    loadPushConfig();
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    const enabled = await JPushService.checkNotificationEnabled();
    setNotificationEnabled(enabled);
  };

  const loadPushConfig = async () => {
    try {
      const token = await AsyncStorage.getItem('app-auth-token');
      if (!token) {
        Alert.alert('错误', '请先登录');
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/app-push-config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setConfig(result.data.config);
      }
    } catch (error) {
      console.error('加载推送配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePushConfig = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('app-auth-token');
      if (!token) {
        Alert.alert('错误', '请先登录');
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/app-push-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('成功', '推送配置已保存');
      } else {
        Alert.alert('错误', result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存推送配置失败:', error);
      Alert.alert('错误', '保存推送配置失败');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof PushConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const openNotificationSettings = () => {
    JPushService.openNotificationSettings();
  };

  const testPushNotification = async () => {
    try {
      const token = await AsyncStorage.getItem('app-auth-token');
      if (!token) {
        Alert.alert('错误', '请先登录');
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/app-push-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: '测试推送',
          content: '这是一条测试推送消息',
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('成功', '测试推送已发送，请查看通知栏');
      } else {
        Alert.alert('错误', result.message || '发送失败');
      }
    } catch (error) {
      console.error('测试推送失败:', error);
      Alert.alert('错误', '测试推送失败');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '推送设置' }} />
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '推送设置' }} />
      <ScrollView style={styles.scrollView}>
        {!notificationEnabled && (
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={openNotificationSettings}
          >
            <Ionicons name="warning" size={20} color="#FF6B6B" />
            <Text style={styles.warningText}>
              通知权限未开启，点击前往设置
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>推送类型</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>告警推送</Text>
              <Text style={styles.settingDescription}>接收告警通知</Text>
            </View>
            <Switch
              value={config.enable_alarm_push}
              onValueChange={(value) => updateConfig('enable_alarm_push', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>工单推送</Text>
              <Text style={styles.settingDescription}>接收工单相关通知</Text>
            </View>
            <Switch
              value={config.enable_workorder_push}
              onValueChange={(value) => updateConfig('enable_workorder_push', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>通知推送</Text>
              <Text style={styles.settingDescription}>接收系统通知</Text>
            </View>
            <Switch
              value={config.enable_notification_push}
              onValueChange={(value) => updateConfig('enable_notification_push', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>巡检推送</Text>
              <Text style={styles.settingDescription}>接收巡检提醒</Text>
            </View>
            <Switch
              value={config.enable_inspection_push}
              onValueChange={(value) => updateConfig('enable_inspection_push', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>免打扰时段</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>开始时间</Text>
            <Text style={styles.settingValue}>{config.quiet_hours_start}</Text>
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>结束时间</Text>
            <Text style={styles.settingValue}>{config.quiet_hours_end}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>优先级设置</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>最低接收优先级</Text>
            <Text style={styles.settingValue}>
              {config.min_priority === 'urgent' ? '紧急' :
               config.min_priority === 'high' ? '高' :
               config.min_priority === 'normal' ? '普通' : '低'}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={testPushNotification}
          >
            <Text style={styles.testButtonText}>测试推送</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, saving && styles.disabledButton]}
            onPress={savePushConfig}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? '保存中...' : '保存设置'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  warningText: {
    flex: 1,
    marginLeft: 10,
    color: '#333',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 15,
    marginHorizontal: 15,
    borderRadius: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    padding: 15,
    gap: 10,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});