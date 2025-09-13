/**
 * 认证服务 - 完整的Supabase Auth集成
 * 使用Supabase Auth进行用户认证管理
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import SupabaseAuthStorage from './SupabaseAuthStorage';
import CryptoJS from 'crypto-js';

// Supabase配置
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// 创建Supabase客户端
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SupabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 用户类型定义
export interface User {
  id: string;
  username: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  role_id: string;
  department_id?: string;
  status: 'active' | 'inactive' | 'suspended';
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;

  private constructor() {
    // 监听认证状态变化
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthService] Auth state changed:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        await this.loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        await AsyncStorage.removeItem('currentUser');
      }
    });
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 生成密码哈希
   */
  private async generatePasswordHash(password: string): Promise<string> {
    // 使用crypto-js生成SHA256哈希
    const salt = 'smart_river_salt';
    const hash = CryptoJS.SHA256(password + salt).toString();
    console.log('[AuthService] Generated hash for password:', hash);
    return hash;
  }

  /**
   * 用户登录 - 使用移动端专用 API
   */
  async login(username: string, password: string, rememberMe: boolean = true): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Attempting mobile login for:', username);

      // 使用移动端专用 API 端点
      const API_URL = process.env.EXPO_PUBLIC_API_URL || SUPABASE_URL;
      const loginUrl = `${API_URL}/api/app-auth/login`;

      console.log('[AuthService] Calling Mobile API:', loginUrl);

      // 获取设备信息（如果可用）
      const deviceInfo = {
        platform: 'mobile',
        model: 'unknown',
        version: '1.0.0'
      };

      // 调用移动端登录接口
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          remember_me: rememberMe,
          device_info: deviceInfo
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('[AuthService] Login failed:', result.error || result.message);
        return {
          success: false,
          error: result.error || result.message || '登录失败'
        };
      }

      console.log('[AuthService] Mobile login successful:', {
        user: result.data.user.name,
        role: result.data.user.role?.code,
        area: result.data.user.area_name || '无区域限制'
      });

      // 保存用户信息（包含区域信息）
      const userData = result.data.user;
      this.currentUser = {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        avatar: userData.avatar,
        role_id: userData.role_id,
        role: userData.role, // 保存完整的角色信息
        role_code: userData.role?.code, // 角色代码
        department_id: userData.department_id,
        department: userData.department,
        area_id: userData.area_id, // 区域ID
        area_name: userData.area_name, // 区域名称
        area_code: userData.area_code, // 区域代码
        permissions: userData.permissions, // 移动端权限
        status: userData.status,
        last_login_at: userData.last_login_at,
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString()
      };
      
      await AsyncStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      
      // 保存 token
      if (result.data.token) {
        await AsyncStorage.setItem('authToken', result.data.token);
      }

      return {
        success: true,
        data: {
          user: this.currentUser,
          session: null,
          token: result.data.token
        }
      };
    } catch (error: any) {
      console.error('[AuthService] Login error:', error);
      return { 
        success: false, 
        error: error.message || '网络连接失败，请检查网络设置' 
      };
    }
  }

  /**
   * 用户登出 - 使用移动端专用 API
   */
  async logout(): Promise<AuthResponse> {
    try {
      // 调用移动端登出API
      const API_URL = process.env.EXPO_PUBLIC_API_URL || SUPABASE_URL;
      const logoutUrl = `${API_URL}/api/app-auth/logout`;
      
      // 获取token用于验证
      const token = await AsyncStorage.getItem('authToken');
      
      if (token) {
        const response = await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        const result = await response.json();
        console.log('[AuthService] Logout response:', result);
      }

      // 清除本地存储
      this.currentUser = null;
      await AsyncStorage.multiRemove([
        'currentUser', 
        'authToken',
        'supabase.auth.token'
      ]);

      console.log('[AuthService] User logged out successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[AuthService] Logout error:', error);
      // 即使API调用失败，也清除本地数据
      this.currentUser = null;
      await AsyncStorage.multiRemove([
        'currentUser', 
        'authToken',
        'supabase.auth.token'
      ]);
      
      return { 
        success: true, // 本地登出成功
        error: error.message 
      };
    }
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<User | null> {
    // 优先返回内存中的用户
    if (this.currentUser) {
      return this.currentUser;
    }

    // 从本地存储获取
    try {
      const userStr = await AsyncStorage.getItem('currentUser');
      if (userStr) {
        this.currentUser = JSON.parse(userStr);
        return this.currentUser;
      }
    } catch (error) {
      console.error('[AuthService] Get current user error:', error);
    }

    // 从Supabase Auth获取
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await this.loadUserProfile(user.id);
      return this.currentUser;
    }

    return null;
  }

  /**
   * 获取当前会话
   */
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * 刷新会话
   */
  async refreshSession(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }

      return { 
        success: true, 
        data: data.session 
      };
    } catch (error: any) {
      console.error('[AuthService] Refresh session error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 验证会话是否有效
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  }

  /**
   * 加载用户详细信息
   */
  private async loadUserProfile(_authUserId: string): Promise<void> {
    try {
      // 通过auth user的metadata获取实际的用户ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.user_metadata?.user_id;

      if (!userId) {
        console.error('[AuthService] No user_id in metadata');
        return;
      }

      // 查询用户表获取详细信息
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthService] Load user profile error:', error);
        return;
      }

      this.currentUser = data;
      await AsyncStorage.setItem('currentUser', JSON.stringify(data));
    } catch (error) {
      console.error('[AuthService] Load user profile error:', error);
    }
  }

  /**
   * 获取Supabase客户端实例
   */
  getSupabaseClient(): SupabaseClient {
    return supabase;
  }

  /**
   * 处理登录失败次数
   */
  async handleLoginFailure(username: string): Promise<void> {
    try {
      // 增加登录失败次数
      const { data, error } = await supabase
        .from('users')
        .select('login_attempts')
        .eq('username', username)
        .single();

      if (!error && data) {
        const attempts = (data.login_attempts || 0) + 1;
        
        // 更新失败次数和时间
        await supabase
          .from('users')
          .update({
            login_attempts: attempts,
            last_login_attempt: new Date().toISOString(),
            // 超过5次尝试，锁定账号
            status: attempts >= 5 ? 'suspended' : (data as any).status
          })
          .eq('username', username);

        if (attempts >= 5) {
          console.warn('[AuthService] Account locked due to too many failed attempts:', username);
        }
      }
    } catch (error) {
      console.error('[AuthService] Handle login failure error:', error);
    }
  }
}

// 导出单例
export default AuthService.getInstance();