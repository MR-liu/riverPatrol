import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { LoadingState } from '@/components/LoadingState';

export default function AccountSecurityScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // 密码修改相关状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 手机号修改相关状态
  const [newPhone, setNewPhone] = useState('');
  const [phoneVerifyCode, setPhoneVerifyCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  
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
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      Alert.alert('修改成功', '密码已成功修改，请重新登录', [
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
    } catch (error) {
      Alert.alert('修改失败', '密码修改失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const sendPhoneVerifyCode = async () => {
    if (!newPhone) {
      Alert.alert('提示', '请输入新手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      Alert.alert('提示', '请输入正确的手机号格式');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhoneCodeSent(true);
      setPhoneCountdown(60);
      
      // 倒计时
      const timer = setInterval(() => {
        setPhoneCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setPhoneCodeSent(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      Alert.alert('发送成功', '验证码已发送到新手机号');
    } catch (error) {
      Alert.alert('发送失败', '验证码发送失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePhone = async () => {
    if (!newPhone || !phoneVerifyCode) {
      Alert.alert('提示', '请填写手机号和验证码');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('修改成功', '手机号已成功修改', [
        {
          text: '确定',
          onPress: () => {
            setShowPhoneModal(false);
            setNewPhone('');
            setPhoneVerifyCode('');
            setPhoneCodeSent(false);
          }
        }
      ]);
    } catch (error) {
      Alert.alert('修改失败', '手机号修改失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmailVerifyCode = async () => {
    if (!newEmail) {
      Alert.alert('提示', '请输入新邮箱地址');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      Alert.alert('提示', '请输入正确的邮箱格式');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
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
      
      Alert.alert('发送成功', '验证码已发送到新邮箱');
    } catch (error) {
      Alert.alert('发送失败', '验证码发送失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !emailVerifyCode) {
      Alert.alert('提示', '请填写邮箱和验证码');
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('修改成功', '邮箱已成功修改', [
        {
          text: '确定',
          onPress: () => {
            setShowEmailModal(false);
            setNewEmail('');
            setEmailVerifyCode('');
            setEmailCodeSent(false);
          }
        }
      ]);
    } catch (error) {
      Alert.alert('修改失败', '邮箱修改失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSecuritySetting = async (key: keyof typeof securitySettings) => {
    const newValue = !securitySettings[key];
    setSecuritySettings(prev => ({
      ...prev,
      [key]: newValue
    }));

    // 模拟保存设置
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const settingNames = {
        twoFactorAuth: '双重认证',
        loginNotification: '登录通知',
        deviceBinding: '设备绑定',
        autoLogout: '自动登出',
        biometricAuth: '生物识别'
      };
      
      Alert.alert('设置成功', `${settingNames[key]}已${newValue ? '开启' : '关闭'}`);
    } catch (error) {
      // 回滚设置
      setSecuritySettings(prev => ({
        ...prev,
        [key]: !newValue
      }));
      Alert.alert('设置失败', '设置保存失败，请重试');
    }
  };

  const renderSecurityItem = (
    icon: string, 
    title: string, 
    subtitle: string, 
    action: () => void,
    rightElement?: React.ReactNode
  ) => (
    <TouchableOpacity style={styles.securityItem} onPress={action}>
      <View style={styles.securityItemLeft}>
        <View style={styles.securityIcon}>
          <MaterialIcons name={icon as any} size={20} color="#3B82F6" />
        </View>
        <View style={styles.securityInfo}>
          <Text style={styles.securityTitle}>{title}</Text>
          <Text style={styles.securitySubtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightElement || <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />}
    </TouchableOpacity>
  );

  const renderModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    children: React.ReactNode
  ) => (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.modalCloseButton} />
        </View>
        <ScrollView style={styles.modalContent}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>账户安全</Text>
        <View style={styles.headerButton} />
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <LoadingState isLoading={isLoading && !showPasswordModal && !showPhoneModal && !showEmailModal}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 账户信息 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="account-circle" size={16} color="#374151" />
                <Text style={styles.cardTitle}>账户信息</Text>
              </View>
              
              {renderSecurityItem(
                'lock',
                '登录密码',
                '定期更换密码可提高账户安全性',
                () => setShowPasswordModal(true)
              )}
              
              {renderSecurityItem(
                'phone',
                '绑定手机',
                '138****5678',
                () => setShowPhoneModal(true)
              )}
              
              {renderSecurityItem(
                'email',
                '绑定邮箱',
                'user@example.com',
                () => setShowEmailModal(true)
              )}
            </View>

            {/* 安全设置 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="security" size={16} color="#374151" />
                <Text style={styles.cardTitle}>安全设置</Text>
              </View>
              
              {renderSecurityItem(
                'verified-user',
                '双重认证',
                '为账户添加额外的安全保护',
                () => toggleSecuritySetting('twoFactorAuth'),
                <View style={styles.switch}>
                  <View style={[styles.switchTrack, securitySettings.twoFactorAuth && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, securitySettings.twoFactorAuth && styles.switchThumbActive]} />
                  </View>
                </View>
              )}
              
              {renderSecurityItem(
                'notifications',
                '登录通知',
                '账户登录时发送通知提醒',
                () => toggleSecuritySetting('loginNotification'),
                <View style={styles.switch}>
                  <View style={[styles.switchTrack, securitySettings.loginNotification && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, securitySettings.loginNotification && styles.switchThumbActive]} />
                  </View>
                </View>
              )}
              
              {renderSecurityItem(
                'devices',
                '设备绑定',
                '限制登录设备数量',
                () => toggleSecuritySetting('deviceBinding'),
                <View style={styles.switch}>
                  <View style={[styles.switchTrack, securitySettings.deviceBinding && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, securitySettings.deviceBinding && styles.switchThumbActive]} />
                  </View>
                </View>
              )}
              
              {renderSecurityItem(
                'timer',
                '自动登出',
                '长时间未操作时自动登出',
                () => toggleSecuritySetting('autoLogout'),
                <View style={styles.switch}>
                  <View style={[styles.switchTrack, securitySettings.autoLogout && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, securitySettings.autoLogout && styles.switchThumbActive]} />
                  </View>
                </View>
              )}
              
              {renderSecurityItem(
                'fingerprint',
                '生物识别',
                '使用指纹或面容登录',
                () => toggleSecuritySetting('biometricAuth'),
                <View style={styles.switch}>
                  <View style={[styles.switchTrack, securitySettings.biometricAuth && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, securitySettings.biometricAuth && styles.switchThumbActive]} />
                  </View>
                </View>
              )}
            </View>

            {/* 登录记录 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="history" size={16} color="#374151" />
                <Text style={styles.cardTitle}>最近登录</Text>
              </View>
              
              <View style={styles.loginRecord}>
                <View style={styles.loginItem}>
                  <MaterialIcons name="smartphone" size={20} color="#10B981" />
                  <View style={styles.loginInfo}>
                    <Text style={styles.loginDevice}>iPhone 15 Pro</Text>
                    <Text style={styles.loginTime}>今天 14:32 • 上海市</Text>
                    <Text style={styles.loginStatus}>当前设备</Text>
                  </View>
                </View>
                
                <View style={styles.loginItem}>
                  <MaterialIcons name="computer" size={20} color="#6B7280" />
                  <View style={styles.loginInfo}>
                    <Text style={styles.loginDevice}>Windows PC</Text>
                    <Text style={styles.loginTime}>昨天 09:15 • 上海市</Text>
                    <Text style={styles.loginStatus}>已退出</Text>
                  </View>
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
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>当前密码</Text>
              <TextInput
                style={styles.textInput}
                placeholder="请输入当前密码"
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>新密码</Text>
              <TextInput
                style={styles.textInput}
                placeholder="请输入新密码（至少6位）"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>确认新密码</Text>
              <TextInput
                style={styles.textInput}
                placeholder="请再次输入新密码"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>新手机号</Text>
              <TextInput
                style={styles.textInput}
                placeholder="请输入新手机号"
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>验证码</Text>
              <View style={styles.codeInputContainer}>
                <TextInput
                  style={[styles.textInput, styles.codeInput]}
                  placeholder="请输入验证码"
                  keyboardType="number-pad"
                  value={phoneVerifyCode}
                  onChangeText={setPhoneVerifyCode}
                />
                <TouchableOpacity 
                  style={[styles.codeButton, phoneCodeSent && styles.codeButtonDisabled]}
                  onPress={sendPhoneVerifyCode}
                  disabled={phoneCodeSent || isLoading}
                >
                  <Text style={styles.codeButtonText}>
                    {phoneCodeSent ? `${phoneCountdown}s` : '发送验证码'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleChangePhone}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? '修改中...' : '确认修改'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 修改邮箱Modal */}
        {renderModal(
          showEmailModal,
          () => setShowEmailModal(false),
          '修改邮箱',
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>新邮箱地址</Text>
              <TextInput
                style={styles.textInput}
                placeholder="请输入新邮箱地址"
                keyboardType="email-address"
                value={newEmail}
                onChangeText={setNewEmail}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>验证码</Text>
              <View style={styles.codeInputContainer}>
                <TextInput
                  style={[styles.textInput, styles.codeInput]}
                  placeholder="请输入验证码"
                  keyboardType="number-pad"
                  value={emailVerifyCode}
                  onChangeText={setEmailVerifyCode}
                />
                <TouchableOpacity 
                  style={[styles.codeButton, emailCodeSent && styles.codeButtonDisabled]}
                  onPress={sendEmailVerifyCode}
                  disabled={emailCodeSent || isLoading}
                >
                  <Text style={styles.codeButtonText}>
                    {emailCodeSent ? `${emailCountdown}s` : '发送验证码'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleChangeEmail}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? '修改中...' : '确认修改'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  securityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EBF4FF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  securitySubtitle: {
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
  loginRecord: {
    gap: 16,
  },
  loginItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  loginInfo: {
    flex: 1,
  },
  loginDevice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  loginTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  loginStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  
  // Modal样式
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  codeInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    flex: 1,
  },
  codeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  codeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});