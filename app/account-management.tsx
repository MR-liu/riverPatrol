import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PageContainer } from '@/components/PageContainer';
import { LoadingState } from '@/components/LoadingState';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/hooks/useTheme';

export default function AccountManagementScreen() {
  const { currentUser, logout } = useAppContext();
  const { theme, fontSize } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('提示', '请填写所有密码字段');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      Alert.alert('提示', '新密码长度至少6位');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/app-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        Alert.alert('成功', '密码已更新', [
          {
            text: '确定',
            onPress: () => {
              setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
              setShowPasswordChange(false);
            },
          },
        ]);
      } else {
        Alert.alert('失败', result.error || '密码更新失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      '退出登录',
      '确定要退出当前账号吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '注销账号',
      '注销账号将永久删除所有数据，此操作不可恢复。确定要继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定注销',
          style: 'destructive',
          onPress: () => {
            Alert.alert('提示', '请联系管理员进行账号注销');
          },
        },
      ]
    );
  };

  const renderAccountInfo = () => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="lock" size={16} color={theme.colors.text} />
        <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: fontSize(16) }]}>安全设置</Text>
      </View>
      
      <TouchableOpacity
        style={[styles.menuItem, { borderBottomColor: theme.colors.borderLight }]}
        onPress={() => Alert.alert('提示', '双因素认证功能开发中')}
      >
        <View style={styles.menuItemLeft}>
          <MaterialIcons name="security" size={20} color={theme.colors.textSecondary} />
          <View style={styles.menuItemInfo}>
            <Text style={[styles.menuItemText, { color: theme.colors.text, fontSize: fontSize(14) }]}>双因素认证</Text>
            <Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize(12) }]}>提供额外的账户安全保障</Text>
          </View>
        </View>
        <Switch
          value={false}
          disabled={true}
          trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
          thumbColor={theme.colors.surface}
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.menuItem, { borderBottomColor: theme.colors.borderLight }]}
        onPress={() => setShowPasswordChange(!showPasswordChange)}
      >
        <View style={styles.menuItemLeft}>
          <MaterialIcons name="vpn-key" size={20} color={theme.colors.textSecondary} />
          <View style={styles.menuItemInfo}>
            <Text style={[styles.menuItemText, { color: theme.colors.text, fontSize: fontSize(14) }]}>登录密码</Text>
            <Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize(12) }]}>定期更换密码可提高账户安全性</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textTertiary} />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.menuItem, { borderBottomColor: theme.colors.borderLight }]}
        onPress={() => Alert.alert('提示', '设备管理功能开发中')}
      >
        <View style={styles.menuItemLeft}>
          <MaterialIcons name="devices" size={20} color={theme.colors.textSecondary} />
          <View style={styles.menuItemInfo}>
            <Text style={[styles.menuItemText, { color: theme.colors.text, fontSize: fontSize(14) }]}>设备绑定</Text>
            <Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize(12) }]}>限制仅可从授权设备登录</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textTertiary} />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.menuItem, { borderBottomColor: theme.colors.borderLight }]}
        onPress={() => Alert.alert('提示', '操作日志功能开发中')}
      >
        <View style={styles.menuItemLeft}>
          <MaterialIcons name="history" size={20} color={theme.colors.textSecondary} />
          <View style={styles.menuItemInfo}>
            <Text style={[styles.menuItemText, { color: theme.colors.text, fontSize: fontSize(14) }]}>自动登出</Text>
            <Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize(12) }]}>长时间未操作自动登出</Text>
          </View>
        </View>
        <Switch
          value={true}
          disabled={false}
          onValueChange={(value) => Alert.alert('提示', value ? '已开启自动登出' : '已关闭自动登出')}
          trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
          thumbColor={theme.colors.primary}
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.menuItem, { borderBottomColor: theme.colors.borderLight }]}
        onPress={() => Alert.alert('提示', '生物认证功能开发中')}
      >
        <View style={styles.menuItemLeft}>
          <MaterialIcons name="fingerprint" size={20} color={theme.colors.textSecondary} />
          <View style={styles.menuItemInfo}>
            <Text style={[styles.menuItemText, { color: theme.colors.text, fontSize: fontSize(14) }]}>生物认证</Text>
            <Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary, fontSize: fontSize(12) }]}>启用指纹或面容识别</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderPasswordChange = () => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="lock" size={16} color={theme.colors.text} />
        <Text style={[styles.cardTitle, { color: theme.colors.text, fontSize: fontSize(16) }]}>修改密码</Text>
      </View>
      
      {!showPasswordChange ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowPasswordChange(true)}
        >
          <Text style={styles.actionButtonText}>修改密码</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.passwordForm}>
          <TextInput
            style={styles.input}
            placeholder="当前密码"
            value={passwordForm.oldPassword}
            onChangeText={(text) => setPasswordForm(prev => ({ ...prev, oldPassword: text }))}
            secureTextEntry
          />
          
          <TextInput
            style={styles.input}
            placeholder="新密码（至少6位）"
            value={passwordForm.newPassword}
            onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
            secureTextEntry
          />
          
          <TextInput
            style={styles.input}
            placeholder="确认新密码"
            value={passwordForm.confirmPassword}
            onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
            secureTextEntry
          />
          
          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => {
                setShowPasswordChange(false);
                setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
              }}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.formButton, styles.submitButton]}
              onPress={handlePasswordChange}
            >
              <Text style={styles.submitButtonText}>确认修改</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );


  return (
    <PageContainer title="账户管理">
      <LoadingState isLoading={isLoading}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderAccountInfo()}
          {showPasswordChange && renderPasswordChange()}
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
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordForm: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  menuItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  dangerMenuItem: {
    borderBottomColor: '#FEE2E2',
  },
  dangerText: {
    color: '#EF4444',
  },
});