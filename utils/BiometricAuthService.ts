import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = '@biometric_auth_enabled';
const BIOMETRIC_SETUP_KEY = '@biometric_auth_setup';

export interface BiometricResult {
  success: boolean;
  error?: string;
  type?: string;
}

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  supportedTypesText: string[];
}

class BiometricAuthService {
  /**
   * 检查设备是否支持生物认证
   */
  async checkBiometricSupport(): Promise<BiometricCapabilities> {
    try {
      // 检查硬件是否支持
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      
      // 检查是否已注册生物信息
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      // 获取支持的认证类型
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      // 将类型转换为文字描述
      const supportedTypesText: string[] = [];
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        supportedTypesText.push('指纹');
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        supportedTypesText.push('面容');
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        supportedTypesText.push('虹膜');
      }
      
      return {
        hasHardware,
        isEnrolled,
        supportedTypes,
        supportedTypesText
      };
    } catch (error) {
      console.error('检查生物认证支持失败:', error);
      return {
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        supportedTypesText: []
      };
    }
  }

  /**
   * 执行生物认证
   */
  async authenticate(promptMessage?: string): Promise<BiometricResult> {
    try {
      const { hasHardware, isEnrolled } = await this.checkBiometricSupport();
      
      if (!hasHardware) {
        return {
          success: false,
          error: '设备不支持生物认证'
        };
      }
      
      if (!isEnrolled) {
        return {
          success: false,
          error: '请先在系统设置中录入生物信息'
        };
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || '请验证您的身份',
        cancelLabel: '取消',
        fallbackLabel: '使用密码',
        disableDeviceFallback: false,
        requireConfirmation: Platform.OS === 'android',
      });
      
      if (result.success) {
        return {
          success: true,
          type: '生物认证'
        };
      } else {
        let errorMessage = '认证失败';
        switch (result.error) {
          case 'UserCancel':
            errorMessage = '用户取消了认证';
            break;
          case 'UserFallback':
            errorMessage = '用户选择使用密码';
            break;
          case 'SystemCancel':
            errorMessage = '系统取消了认证';
            break;
          case 'NotEnrolled':
            errorMessage = '设备未录入生物信息';
            break;
          case 'BiometryNotAvailable':
            errorMessage = '生物认证不可用';
            break;
          case 'BiometryNotEnrolled':
            errorMessage = '未设置生物认证';
            break;
          case 'BiometryLockout':
            errorMessage = '生物认证已锁定，请稍后再试';
            break;
          default:
            errorMessage = result.error || '认证失败';
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('生物认证失败:', error);
      return {
        success: false,
        error: '生物认证过程出错'
      };
    }
  }

  /**
   * 启用生物认证
   */
  async enableBiometric(): Promise<boolean> {
    try {
      const { hasHardware, isEnrolled, supportedTypesText } = await this.checkBiometricSupport();
      
      if (!hasHardware) {
        Alert.alert('不支持', '您的设备不支持生物认证功能');
        return false;
      }
      
      if (!isEnrolled) {
        Alert.alert(
          '未设置生物信息',
          '请先在系统设置中录入您的生物信息（指纹或面容）',
          [
            { text: '取消', style: 'cancel' },
            { text: '去设置', onPress: () => this.openSecuritySettings() }
          ]
        );
        return false;
      }
      
      // 先进行一次认证以确认用户身份
      const authResult = await this.authenticate(
        `启用生物认证\n支持的认证方式: ${supportedTypesText.join('、')}`
      );
      
      if (authResult.success) {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        await AsyncStorage.setItem(BIOMETRIC_SETUP_KEY, JSON.stringify({
          enabled: true,
          enabledAt: new Date().toISOString(),
          supportedTypes: supportedTypesText
        }));
        
        Alert.alert('成功', '生物认证已启用');
        return true;
      } else {
        Alert.alert('启用失败', authResult.error || '无法启用生物认证');
        return false;
      }
    } catch (error) {
      console.error('启用生物认证失败:', error);
      Alert.alert('错误', '启用生物认证时出现错误');
      return false;
    }
  }

  /**
   * 禁用生物认证
   */
  async disableBiometric(): Promise<boolean> {
    try {
      // 先进行一次认证以确认用户身份
      const authResult = await this.authenticate('请验证身份以禁用生物认证');
      
      if (authResult.success) {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
        await AsyncStorage.setItem(BIOMETRIC_SETUP_KEY, JSON.stringify({
          enabled: false,
          disabledAt: new Date().toISOString()
        }));
        
        Alert.alert('成功', '生物认证已禁用');
        return true;
      } else {
        // 如果用户取消认证，也允许禁用
        if (authResult.error === '用户取消了认证') {
          await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
          await AsyncStorage.setItem(BIOMETRIC_SETUP_KEY, JSON.stringify({
            enabled: false,
            disabledAt: new Date().toISOString()
          }));
          
          Alert.alert('成功', '生物认证已禁用');
          return true;
        }
        
        Alert.alert('禁用失败', authResult.error || '无法禁用生物认证');
        return false;
      }
    } catch (error) {
      console.error('禁用生物认证失败:', error);
      Alert.alert('错误', '禁用生物认证时出现错误');
      return false;
    }
  }

  /**
   * 检查生物认证是否已启用
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('检查生物认证状态失败:', error);
      return false;
    }
  }

  /**
   * 获取生物认证设置信息
   */
  async getBiometricSetup(): Promise<any> {
    try {
      const setup = await AsyncStorage.getItem(BIOMETRIC_SETUP_KEY);
      return setup ? JSON.parse(setup) : null;
    } catch (error) {
      console.error('获取生物认证设置失败:', error);
      return null;
    }
  }

  /**
   * 打开系统安全设置
   */
  private openSecuritySettings() {
    // 注意：React Native 不能直接打开系统设置的特定页面
    // 这里只是一个提示，实际需要用户手动去设置
    Alert.alert(
      '打开设置',
      '请手动打开系统设置 > 安全/生物识别，并录入您的指纹或面容信息'
    );
  }

  /**
   * 用于登录时的生物认证
   */
  async authenticateForLogin(): Promise<BiometricResult> {
    const isEnabled = await this.isBiometricEnabled();
    
    if (!isEnabled) {
      return {
        success: false,
        error: '生物认证未启用'
      };
    }
    
    return this.authenticate('使用生物认证登录');
  }

  /**
   * 用于敏感操作的生物认证
   */
  async authenticateForSensitiveOperation(operation: string): Promise<BiometricResult> {
    const isEnabled = await this.isBiometricEnabled();
    
    if (!isEnabled) {
      // 对于敏感操作，即使未启用生物认证，也可以临时使用
      return this.authenticate(`验证身份以${operation}`);
    }
    
    return this.authenticate(`验证身份以${operation}`);
  }
}

export default new BiometricAuthService();