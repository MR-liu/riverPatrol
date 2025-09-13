/**
 * Supabase Auth 存储适配器
 * 解决 AsyncStorage 在服务端渲染时的兼容性问题
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

class SupabaseAuthStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      // 检查是否在客户端环境
      if (typeof window === 'undefined') {
        return null;
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('SupabaseAuthStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // 检查是否在客户端环境
      if (typeof window === 'undefined') {
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('SupabaseAuthStorage setItem error:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      // 检查是否在客户端环境
      if (typeof window === 'undefined') {
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('SupabaseAuthStorage removeItem error:', error);
    }
  }
}

export default new SupabaseAuthStorage();