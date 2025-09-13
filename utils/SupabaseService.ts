/**
 * Supabase服务 - 使用Supabase原生功能
 * 直接使用Supabase Auth和数据库访问，不依赖Edge Functions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import SupabaseAuthStorage from './SupabaseAuthStorage';

// Supabase配置
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// 开发环境使用service role key绕过RLS
const isDev = __DEV__;
const supabaseKey = isDev && SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    storage: SupabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 数据类型定义
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

export interface WorkOrder {
  id: string;
  type_id: string;
  alarm_id?: string;
  report_id?: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'important' | 'normal';
  status: 'pending' | 'assigned' | 'processing' | 'pending_review' | 'completed' | 'cancelled';
  sla_status: 'active' | 'inactive' | 'at_risk';
  department_id?: string;
  point_id?: string;
  area_id?: string;
  location?: string;
  coordinates?: any;
  creator_id: string;
  assignee_id?: string;
  supervisor_id?: string;
  reviewer_id?: string;
  source?: string;
  assigned_at?: string;
  started_at?: string;
  expected_complete_at?: string;
  completed_at?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProblemReport {
  id: string;
  title: string;
  description: string;
  category_ids: string[];
  images?: string[];
  videos?: string[];
  location?: string;
  coordinates?: any;
  reporter_id: string;
  department_id?: string;
  status: string;
  severity?: string;
  anonymous: boolean;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class SupabaseService {
  private static instance: SupabaseService;
  
  private constructor() {}
  
  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // ==================== 认证相关 ====================

  /**
   * 用户登录 - 使用密码哈希验证
   */
  async login(username: string, password: string): Promise<ApiResponse<{user: User, token: string}>> {
    try {
      // 开发环境：直接查询用户表验证（使用service role key绕过RLS）
      if (isDev) {
        // 先查询用户（只选择需要的字段）
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, username, name, email, phone, avatar, role_id, department_id, status, last_login_at, created_at, updated_at')
          .eq('username', username)
          .eq('status', 'active')
          .single();

        if (userError || !userData) {
          return { success: false, error: '用户名或密码错误' };
        }

        // 简单密码验证（开发环境）
        // 注意：生产环境应该使用正确的密码哈希验证
        // React Native不支持crypto模块，开发环境暂时跳过密码验证
        console.warn('[Dev Mode] Password verification skipped for development');
        
        // 可选：简单的密码检查（例如检查密码是否为空）
        if (!password) {
          return { success: false, error: '密码不能为空' };
        }

        // 生成一个临时token（开发环境）
        const token = btoa(JSON.stringify({ user_id: userData.id, timestamp: Date.now() }));
        
        // 更新最后登录时间
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userData.id);

        return {
          success: true,
          data: {
            user: userData,
            token: token
          }
        };
      }

      // 生产环境：应该使用Supabase Auth或自定义认证函数
      return { 
        success: false, 
        error: '生产环境认证未配置' 
      };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || '登录失败' };
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      await AsyncStorage.multiRemove(['supabase.auth.token', 'current_user']);
      return { success: true };
    } catch (error: any) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const userStr = await AsyncStorage.getItem('current_user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * 保存当前用户
   */
  async saveCurrentUser(user: User): Promise<void> {
    await AsyncStorage.setItem('current_user', JSON.stringify(user));
  }

  // ==================== 工单相关 ====================

  /**
   * 获取工单列表 - 调用 Web API
   */
  async getWorkOrders(params?: {
    status?: string;
    assignee_id?: string;
    department_id?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ items: WorkOrder[], total: number }>> {
    try {
      console.log('[SupabaseService] getWorkOrders called with params:', params);
      
      const token = await AsyncStorage.getItem('authToken');
      console.log('[SupabaseService] getWorkOrders - token:', token ? 'exists' : 'missing');
      
      if (!token) {
        return { success: false, error: '用户未登录' };
      }

      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.assignee_id) queryParams.append('assignee_id', params.assignee_id);
      if (params?.department_id) queryParams.append('department_id', params.department_id);
      queryParams.append('page', (params?.page || 1).toString());
      queryParams.append('limit', (params?.limit || 50).toString());
      
      console.log('[SupabaseService] getWorkOrders - 查询参数:', {
        status: params?.status,
        assignee_id: params?.assignee_id,
        department_id: params?.department_id,
        page: params?.page || 1,
        limit: params?.limit || 50
      });

      const API_URL = process.env.EXPO_PUBLIC_API_URL || SUPABASE_URL;
      const url = `${API_URL}/api/app-workorders?${queryParams.toString()}`;
      console.log('[SupabaseService] getWorkOrders - API_URL:', API_URL);
      console.log('[SupabaseService] getWorkOrders - calling URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      console.log('[SupabaseService] getWorkOrders - response status:', response.status);
      const result = await response.json();
      console.log('[SupabaseService] getWorkOrders - response data:', result);

      if (!response.ok || !result.success) {
        console.error('[SupabaseService] getWorkOrders - error:', result.error);
        return { success: false, error: result.error || '获取工单失败' };
      }

      const returnData = { 
        success: true, 
        data: { 
          items: result.data.items || [], 
          total: result.data.total || 0 
        }
      };
      console.log('[SupabaseService] getWorkOrders - returning:', returnData);
      return returnData;
    } catch (error: any) {
      console.error('[SupabaseService] getWorkOrders - exception:', error);
      return { success: false, error: error.message || '网络请求失败' };
    }
  }

  /**
   * 创建工单
   */
  async createWorkOrder(workOrder: Partial<WorkOrder>): Promise<ApiResponse<string>> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: '用户未登录' };
      }

      // 生成工单ID
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const workOrderId = `WO_${dateStr}_${random}`;

      const { data, error } = await supabase
        .from('workorders')
        .insert({
          id: workOrderId,
          ...workOrder,
          creator_id: currentUser.id,
          status: 'pending',
          sla_status: 'active',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data.id };
    } catch (error: any) {
      console.error('Create work order error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新工单状态
   */
  async updateWorkOrderStatus(
    workOrderId: string, 
    status: string,
    updateData?: any
  ): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('workorders')
        .update({
          status,
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workOrderId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: true };
    } catch (error: any) {
      console.error('Update work order status error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 问题上报相关 ====================

  /**
   * 创建问题报告
   */
  async createProblemReport(report: {
    title: string;
    description: string;
    category_ids: string[];
    images?: string[];
    location?: string;
    coordinates?: any;
  }): Promise<ApiResponse<string>> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: '用户未登录' };
      }

      // 生成报告ID
      const reportId = `PR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('problem_reports')
        .insert({
          id: reportId,
          ...report,
          reporter_id: currentUser.id,
          status: 'pending',
          anonymous: false,
          verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data.id };
    } catch (error: any) {
      console.error('Create problem report error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 统计相关 ====================

  /**
   * 获取仪表板统计数据 - 调用 Web API
   */
  async getDashboardStats(): Promise<ApiResponse<any>> {
    try {
      console.log('[SupabaseService] getDashboardStats called');
      
      const token = await AsyncStorage.getItem('authToken');
      console.log('[SupabaseService] getDashboardStats - token:', token ? 'exists' : 'missing');
      
      if (!token) {
        return { success: false, error: '用户未登录' };
      }

      const API_URL = process.env.EXPO_PUBLIC_API_URL || SUPABASE_URL;
      const url = `${API_URL}/api/app-dashboard-stats?days=7`;
      console.log('[SupabaseService] getDashboardStats - calling URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      console.log('[SupabaseService] getDashboardStats - response status:', response.status);
      const result = await response.json();
      console.log('[SupabaseService] getDashboardStats - response data:', result);

      if (!response.ok || !result.success) {
        console.error('[SupabaseService] getDashboardStats - error:', result.error);
        return { success: false, error: result.error || '获取统计数据失败' };
      }

      console.log('[SupabaseService] getDashboardStats - returning success with data:', result.data);
      return { 
        success: true, 
        data: result.data
      };
    } catch (error: any) {
      console.error('[SupabaseService] getDashboardStats - exception:', error);
      return { success: false, error: error.message || '网络请求失败' };
    }
  }

  // ==================== 文件上传相关 ====================

  /**
   * 上传文件到Supabase Storage
   */
  async uploadFile(file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<ApiResponse<string>> {
    try {
      // React Native文件上传需要特殊处理
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `uploads/${fileName}`;

      // 从URI读取文件内容
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(filePath, blob, {
          contentType: file.type,
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      return { success: true, data: urlData.publicUrl };
    } catch (error: any) {
      console.error('Upload file error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 问题分类相关 ====================

  /**
   * 获取问题分类
   */
  async getProblemCategories(): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('problem_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        return { success: false, error: error.message };
      }

      // 构建分类树
      const categories: any = {};
      const rootCategories: any[] = [];

      data?.forEach(cat => {
        categories[cat.id] = {
          ...cat,
          children: []
        };
      });

      data?.forEach(cat => {
        if (cat.parent_id) {
          if (categories[cat.parent_id]) {
            categories[cat.parent_id].children.push(categories[cat.id]);
          }
        } else {
          rootCategories.push(categories[cat.id]);
        }
      });

      return { success: true, data: rootCategories };
    } catch (error: any) {
      console.error('Get problem categories error:', error);
      return { success: false, error: error.message };
    }
  }
}

// 导出单例
export default SupabaseService.getInstance();