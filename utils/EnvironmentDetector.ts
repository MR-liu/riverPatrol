/**
 * 环境检测工具
 * 用于检测应用运行环境（Expo Go、Development Build、生产环境等）
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

export class EnvironmentDetector {
  /**
   * 检测是否在Expo Go环境中运行
   */
  static isExpoGo(): boolean {
    try {
      // 多种检测方法组合，提高准确性
      const checks = [
        // 检查Expo常量
        Constants.appOwnership === 'expo',
        
        // 检查是否有expo全局对象
        typeof (global as any).expo !== 'undefined',
        
        // 检查bundle identifier是否为Expo Go
        Constants.manifest?.bundleUrl?.includes('exp.host'),
        
        // 检查是否为Expo开发模式
        __DEV__ && Constants.manifest?.developer,
        
        // 检查React Native bridge
        !!(global as any).__fbBatchedBridge,
      ];

      const isExpo = checks.some(check => check === true);
      
      console.log('[EnvironmentDetector] Expo Go检测结果:', {
        isExpoGo: isExpo,
        appOwnership: Constants.appOwnership,
        bundleUrl: Constants.manifest?.bundleUrl,
        isDev: __DEV__,
      });

      return isExpo;
    } catch (error) {
      console.warn('[EnvironmentDetector] Expo Go检测失败:', error);
      return false;
    }
  }

  /**
   * 检测是否为Development Build
   */
  static isDevelopmentBuild(): boolean {
    try {
      return (
        !this.isExpoGo() &&
        __DEV__ &&
        Platform.OS !== 'web'
      );
    } catch (error) {
      console.warn('[EnvironmentDetector] Development Build检测失败:', error);
      return false;
    }
  }

  /**
   * 检测是否为生产环境
   */
  static isProduction(): boolean {
    try {
      return (
        !this.isExpoGo() &&
        !__DEV__ &&
        Platform.OS !== 'web'
      );
    } catch (error) {
      console.warn('[EnvironmentDetector] 生产环境检测失败:', error);
      return false;
    }
  }

  /**
   * 检测原生模块是否可用
   */
  static areNativeModulesAvailable(): boolean {
    return !this.isExpoGo() && Platform.OS !== 'web';
  }

  /**
   * 获取环境描述
   */
  static getEnvironmentDescription(): string {
    if (Platform.OS === 'web') {
      return 'Web Browser';
    }
    
    if (this.isExpoGo()) {
      return 'Expo Go';
    }
    
    if (this.isDevelopmentBuild()) {
      return 'Development Build';
    }
    
    if (this.isProduction()) {
      return 'Production Build';
    }
    
    return 'Unknown Environment';
  }

  /**
   * 记录环境信息到控制台
   */
  static logEnvironmentInfo(): void {
    const info = {
      environment: this.getEnvironmentDescription(),
      platform: Platform.OS,
      isExpoGo: this.isExpoGo(),
      isDevelopmentBuild: this.isDevelopmentBuild(),
      isProduction: this.isProduction(),
      nativeModulesAvailable: this.areNativeModulesAvailable(),
      appOwnership: Constants.appOwnership,
      expoVersion: Constants.expoVersion,
    };

    console.log('[EnvironmentDetector] 环境信息:', info);
  }
}

export default EnvironmentDetector;