import { MaterialIcons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LoadingState } from '@/components/LoadingState';
import { PageContainer } from '@/components/PageContainer';
import { useAppContext } from '@/contexts/AppContext';
import BiometricAuthService from '@/utils/BiometricAuthService';

export default function AccountSecurityScreen() {
  const { currentUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // 密码修改相关状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 手机号修改相关状态 - 暂时保留但未使用
  const [newPhone, setNewPhone] = useState('');
  const [phoneVerifyCode, setPhoneVerifyCode] = useState('');
  // const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  // const [phoneCountdown, setPhoneCountdown] = useState(0);
  
  // 邮箱修改相关状态
  const [newEmail, setNewEmail] = useState('');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);

  // 安全设置状态
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    loginNotification: true,
    deviceBinding: false,
    autoLogout: true,
    biometricAuth: false,
  });
  
  // 初始化时检查生物认证状态
  useEffect(() => {
    checkBiometricStatus();
  }, []);
  
  const checkBiometricStatus = async () => {
    const isEnabled = await BiometricAuthService.isBiometricEnabled();
    setSecuritySettings(prev => ({ ...prev, biometricAuth: isEnabled }));
  };
  
  const handleBiometricToggle = async (value: boolean) => {
    setIsLoading(true);
    try {
      let success = false;
      if (value) {
        success = await BiometricAuthService.enableBiometric();
      } else {
        success = await BiometricAuthService.disableBiometric();
      }
      
      if (success) {
        setSecuritySettings(prev => ({ ...prev, biometricAuth: value }));
      } else {
        // 如果操作失败，保持原状态
        const currentStatus = await BiometricAuthService.isBiometricEnabled();
        setSecuritySettings(prev => ({ ...prev, biometricAuth: currentStatus }));
      }
    } catch (error) {
      console.error('切换生物认证失败:', error);
      Alert.alert('错误', '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('提示', '请填写所有密码字段');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('提示', '新密码长度不能少于6位');
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
          oldPassword: oldPassword,
          newPassword: newPassword,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        Alert.alert('修改成功', '密码已成功修改', [
          {
            text: '确定',
            onPress: () => {
              setShowPasswordModal(false);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }
          }
        ]);
      } else {
        Alert.alert('修改失败', result.error || '密码修改失败，请重试');
      }
    } catch (error) {
      Alert.alert('修改失败', '网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 手机号验证码发送 - 暂时禁用
  // const handleSendPhoneCode = async () => {
  //   if (!newPhone || newPhone.length !== 11) {
  //     Alert.alert('提示', '请输入正确的手机号码');
  //     return;
  //   }
  //   setPhoneCodeSent(true);
  //   setPhoneCountdown(60);
  //   const timer = setInterval(() => {
  //     setPhoneCountdown(prev => {
  //       if (prev <= 1) {
  //         clearInterval(timer);
  //         setPhoneCodeSent(false);
  //         return 0;
  //       }
  //       return prev - 1;
  //     });
  //   }, 1000);
  //   // TODO: 调用发送验证码API
  // };

  const handleSendEmailCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      Alert.alert('提示', '请输入正确的邮箱地址');
      return;
    }

    setEmailCodeSent(true);
    setEmailCountdown(60);
    
    const timer = setInterval(() => {
      setEmailCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setEmailCodeSent(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // TODO: 调用发送验证码API
  };

  const renderSecurityItem = (icon: string, title: string, value: string, onPress: () => void) => (
    <TouchableOpacity style={styles.securityItem} onPress={onPress}>
      <View style={styles.securityItemLeft}>
        <MaterialIcons name={icon as any} size={20} color="#6B7280" />
        <Text style={styles.securityItemTitle}>{title}</Text>
      </View>
      <View style={styles.securityItemRight}>
        <Text style={styles.securityItemValue}>{value}</Text>
        <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );

  const renderSecuritySwitch = (title: string, description: string, key: keyof typeof securitySettings) => (
    <View style={styles.switchItem}>
      <View style={styles.switchLeft}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <TouchableOpacity
        style={[styles.switch, securitySettings[key] && styles.switchActive]}
        onPress={() => setSecuritySettings(prev => ({ ...prev, [key]: !prev[key] }))}
      >
        <View style={[styles.switchThumb, securitySettings[key] && styles.switchThumbActive]} />
      </TouchableOpacity>
    </View>
  );

  const renderModal = (visible: boolean, onClose: () => void, title: string, children: React.ReactNode) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <PageContainer title="账户安全">
      <LoadingState isLoading={isLoading}>
        <ScrollView style={styles.content}>
          {/* 安全设置 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>安全设置</Text>
            <View style={styles.cardContent}>
              {renderSecurityItem(
                'lock',
                '登录密码',
                '定期更换密码可提高账户安全性',
                () => setShowPasswordModal(true)
              )}
              
              {renderSecurityItem(
                'phone',
                '绑定手机',
                currentUser?.phone ? currentUser.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定',
                () => setShowPhoneModal(true)
              )}
              
              {/* {renderSecurityItem(
                'email',
                '绑定邮箱',
                currentUser?.email || '未绑定',
                () => setShowEmailModal(true)
              )} */}
            </View>
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>安全设置</Text>
            <View style={styles.menuCard}>
              {renderSecuritySwitch('双因素认证', '提供额外的账户安全保障', 'twoFactorAuth')}
              {renderSecuritySwitch('登录通知', '登录时发送通知提醒', 'loginNotification')}
              {renderSecuritySwitch('设备绑定', '限制仅可从授权设备登录', 'deviceBinding')}
              {renderSecuritySwitch('自动登出', '长时间未操作自动登出', 'autoLogout')}
              <View style={styles.switchItem}>
                <View style={styles.switchLeft}>
                  <Text style={styles.switchTitle}>生物认证</Text>
                  <Text style={styles.switchDescription}>启用指纹或面容识别</Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, securitySettings.biometricAuth && styles.switchActive]}
                  onPress={() => handleBiometricToggle(!securitySettings.biometricAuth)}
                  disabled={isLoading}
                >
                  <View style={[styles.switchThumb, securitySettings.biometricAuth && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </LoadingState>

      {/* 修改密码Modal */}
      {renderModal(
        showPasswordModal,
        () => setShowPasswordModal(false),
        '修改密码',
        <View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>原密码</Text>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
              placeholder="请输入原密码"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>新密码</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="请输入新密码"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>确认密码</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="请再次输入新密码"
            />
          </View>
          
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleChangePassword}
            disabled={isLoading}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? '修改中...' : '确认修改'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 修改手机号Modal */}
      {renderModal(
        showPhoneModal,
        () => setShowPhoneModal(false),
        '修改手机号',
        <View>
          <View style={styles.disabledNotice}>
            <MaterialIcons name="info-outline" size={20} color="#F59E0B" />
            <Text style={styles.disabledNoticeText}>该功能暂未开放，敬请期待</Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>新手机号</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="请输入新手机号"
              keyboardType="numeric"
              maxLength={11}
              editable={false}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>验证码</Text>
            <View style={styles.codeInputContainer}>
              <TextInput
                style={[styles.input, styles.codeInput, styles.inputDisabled]}
                value={phoneVerifyCode}
                onChangeText={setPhoneVerifyCode}
                placeholder="请输入验证码"
                keyboardType="numeric"
                maxLength={6}
                editable={false}
              />
              <TouchableOpacity
                style={[styles.sendCodeButton, styles.sendCodeButtonDisabled]}
                disabled={true}
              >
                <Text style={styles.sendCodeButtonText}>发送验证码</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity style={[styles.submitButton, styles.submitButtonDisabled]} disabled={true}>
            <Text style={styles.submitButtonText}>确认修改</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 修改邮箱Modal */}
      {renderModal(
        showEmailModal,
        () => setShowEmailModal(false),
        '修改邮箱',
        <View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>新邮箱</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="请输入新邮箱地址"
              keyboardType="email-address"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>验证码</Text>
            <View style={styles.codeInputContainer}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={emailVerifyCode}
                onChangeText={setEmailVerifyCode}
                placeholder="请输入验证码"
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.sendCodeButton, emailCodeSent && styles.sendCodeButtonDisabled]}
                onPress={handleSendEmailCode}
                disabled={emailCodeSent}
              >
                <Text style={styles.sendCodeButtonText}>
                  {emailCodeSent ? `${emailCountdown}s` : '发送验证码'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity style={styles.submitButton}>
            <Text style={styles.submitButtonText}>确认修改</Text>
          </TouchableOpacity>
        </View>
      )}        
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardContent: {
    padding: 0,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  securityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 12,
  },
  securityItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityItemValue: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  menuSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  switchLeft: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: '#3B82F6',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  codeInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    flex: 1,
  },
  sendCodeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendCodeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendCodeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  disabledNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  disabledNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
  },
});