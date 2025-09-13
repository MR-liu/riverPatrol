/**
 * 智慧河道监控系统 - 新版API服务
 * 基于SUPABASE_DATABASE_DOCUMENTATION.md的表结构
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase配置
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== 数据类型定义 ====================

// 用户相关类型
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

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  status: 'active' | 'inactive';
}

// 工单相关类型
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

// 告警相关类型
export interface Alarm {
  id: string;
  type_id: string;
  level_id: string;
  device_id?: string;
  point_id: string;
  title: string;
  description?: string;
  confidence: number;
  image_url?: string;
  video_url?: string;
  coordinates?: any;
  status: 'pending' | 'confirmed' | 'processing' | 'resolved' | 'false_alarm' | 'ignored';
  confirmed_by?: string;
  confirmed_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_note?: string;
  department_id?: string;
  region_code?: string;
  created_at: string;
  updated_at: string;
}

// 问题报告类型
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

// 设备相关类型
export interface Device {
  id: string;
  name: string;
  code: string;
  type_id: string;
  point_id: string;
  status: 'online' | 'offline' | 'fault' | 'maintenance';
  last_heartbeat?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
}

// 监控点类型
export interface MonitoringPoint {
  id: string;
  name: string;
  code: string;
  river_name?: string;
  river_section?: string;
  longitude: number;
  latitude: number;
  address?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================== API服务类 ====================

class NewApiService {
  private static instance: NewApiService;
  private accessToken: string = '';
  private refreshToken: string = '';
  private currentUser: User | null = null;

  private constructor() {}

  static getInstance(): NewApiService {
    if (!NewApiService.instance) {
      NewApiService.instance = new NewApiService();
    }
    return NewApiService.instance;
  }

  // ==================== 认证相关 ====================

  /**
   * 用户登录
   */
  async login(username: string, password: string): Promise<ApiResponse<{user: User, token: string}>> {
    try {
      // 调用认证函数
      const { data, error } = await supabase.rpc('authenticate_user', {
        p_username: username,
        p_password: password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        // 保存token和用户信息
        this.accessToken = data.token;
        await AsyncStorage.setItem('access_token', data.token);
        
        // 获取用户详细信息
        const userResult = await this.getUserDetail(data.user_id);
        if (userResult.success && userResult.data) {
          this.currentUser = userResult.data;
          await AsyncStorage.setItem('current_user', JSON.stringify(userResult.data));
        }

        return { 
          success: true, 
          data: { 
            user: this.currentUser!, 
            token: data.token 
          }
        };
      }

      return { success: false, error: data?.message || '登录失败' };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || '登录异常' };
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      // 清除本地存储
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'current_user']);
      this.accessToken = '';
      this.refreshToken = '';
      this.currentUser = null;

      return { success: true };
    } catch (error: any) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userStr = await AsyncStorage.getItem('current_user');
      if (userStr) {
        this.currentUser = JSON.parse(userStr);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Get current user error:', error);
    }

    return null;
  }

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(name, code),
          department:departments(name, code)
        `)
        .eq('id', userId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Get user detail error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 工单相关 ====================

  /**
   * 获取工单列表
   */
  async getWorkOrders(params?: {
    status?: string;
    assignee_id?: string;
    department_id?: string;
    area_id?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ items: WorkOrder[], total: number }>> {
    try {
      let query = supabase
        .from('workorders')
        .select('*, creator:users!creator_id(name), assignee:users!assignee_id(name)', { count: 'exact' });

      // 应用筛选条件
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.assignee_id) {
        query = query.eq('assignee_id', params.assignee_id);
      }
      if (params?.department_id) {
        query = query.eq('department_id', params.department_id);
      }
      if (params?.area_id) {
        query = query.eq('area_id', params.area_id);
      }

      // 分页
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // 排序
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: { 
          items: data || [], 
          total: count || 0 
        }
      };
    } catch (error: any) {
      console.error('Get work orders error:', error);
      return { success: false, error: error.message };
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

      const { data, error } = await supabase.rpc('create_workorder', {
        p_type_id: workOrder.type_id || 'WT_009', // 默认问题核查
        p_title: workOrder.title,
        p_description: workOrder.description,
        p_creator_id: currentUser.id,
        p_priority: workOrder.priority || 'normal',
        p_alarm_id: workOrder.alarm_id,
        p_report_id: workOrder.report_id,
        p_department_id: workOrder.department_id,
        p_area_id: workOrder.area_id
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
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
    action: 'assign' | 'start' | 'complete' | 'review' | 'reject',
    params?: any
  ): Promise<ApiResponse<boolean>> {
    try {
      let result;

      switch (action) {
        case 'assign':
          result = await supabase.rpc('assign_workorder', {
            p_workorder_id: workOrderId,
            p_assignee_id: params.assignee_id,
            p_assigner_id: params.assigner_id
          });
          break;

        case 'start':
          result = await supabase.rpc('start_workorder', {
            p_workorder_id: workOrderId,
            p_processor_id: params.processor_id
          });
          break;

        case 'complete':
          result = await supabase.rpc('submit_workorder_result', {
            p_workorder_id: workOrderId,
            p_processor_id: params.processor_id,
            p_process_method: params.process_method,
            p_process_result: params.process_result,
            p_before_photos: params.before_photos,
            p_after_photos: params.after_photos,
            p_need_followup: params.need_followup || false,
            p_followup_reason: params.followup_reason
          });
          break;

        case 'review':
          result = await supabase.rpc('approve_workorder', {
            p_workorder_id: workOrderId,
            p_reviewer_id: params.reviewer_id,
            p_review_note: params.review_note,
            p_quality_rating: params.quality_rating
          });
          break;

        case 'reject':
          result = await supabase.rpc('reject_workorder', {
            p_workorder_id: workOrderId,
            p_reviewer_id: params.reviewer_id,
            p_rejection_reason: params.rejection_reason,
            p_back_to_assignee: params.back_to_assignee || true
          });
          break;

        default:
          return { success: false, error: '不支持的操作' };
      }

      if (result.error) {
        return { success: false, error: result.error.message };
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

      const { data, error } = await supabase
        .from('problem_reports')
        .insert({
          title: report.title,
          description: report.description,
          category_ids: report.category_ids,
          images: report.images || [],
          location: report.location,
          coordinates: report.coordinates,
          reporter_id: currentUser.id,
          status: 'pending',
          anonymous: false,
          verified: false
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

  /**
   * 获取问题报告列表
   */
  async getProblemReports(params?: {
    status?: string;
    reporter_id?: string;
    verified?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ items: ProblemReport[], total: number }>> {
    try {
      let query = supabase
        .from('problem_reports')
        .select('*', { count: 'exact' });

      // 应用筛选
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.reporter_id) {
        query = query.eq('reporter_id', params.reporter_id);
      }
      if (params?.verified !== undefined) {
        query = query.eq('verified', params.verified);
      }

      // 分页
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // 排序
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: { 
          items: data || [], 
          total: count || 0 
        }
      };
    } catch (error: any) {
      console.error('Get problem reports error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 告警相关 ====================

  /**
   * 获取告警列表
   */
  async getAlarms(params?: {
    status?: string;
    type_id?: string;
    level_id?: string;
    point_id?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ items: Alarm[], total: number }>> {
    try {
      let query = supabase
        .from('alarms')
        .select('*', { count: 'exact' });

      // 应用筛选
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.type_id) {
        query = query.eq('type_id', params.type_id);
      }
      if (params?.level_id) {
        query = query.eq('level_id', params.level_id);
      }
      if (params?.point_id) {
        query = query.eq('point_id', params.point_id);
      }

      // 分页
      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // 排序 - 按优先级和创建时间
      query = query.order('priority_index', { ascending: true })
                   .order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: { 
          items: data || [], 
          total: count || 0 
        }
      };
    } catch (error: any) {
      console.error('Get alarms error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 设备相关 ====================

  /**
   * 获取设备列表
   */
  async getDevices(params?: {
    status?: string;
    type_id?: string;
    point_id?: string;
  }): Promise<ApiResponse<Device[]>> {
    try {
      let query = supabase
        .from('devices')
        .select('*');

      // 应用筛选
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.type_id) {
        query = query.eq('type_id', params.type_id);
      }
      if (params?.point_id) {
        query = query.eq('point_id', params.point_id);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Get devices error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 监控点相关 ====================

  /**
   * 获取监控点列表
   */
  async getMonitoringPoints(params?: {
    status?: string;
    river_name?: string;
  }): Promise<ApiResponse<MonitoringPoint[]>> {
    try {
      let query = supabase
        .from('monitoring_points')
        .select('*');

      // 应用筛选
      if (params?.status) {
        query = query.eq('status', params.status);
      }
      if (params?.river_name) {
        query = query.eq('river_name', params.river_name);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Get monitoring points error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 统计相关 ====================

  /**
   * 获取仪表板统计数据
   */
  async getDashboardStats(): Promise<ApiResponse<any>> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: '用户未登录' };
      }

      // 调用系统概览视图
      const { data, error } = await supabase
        .from('v_system_overview')
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // 获取用户工作负载
      const { data: workloadData } = await supabase
        .from('v_user_workload')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      return { 
        success: true, 
        data: {
          overview: data,
          userWorkload: workloadData
        }
      };
    } catch (error: any) {
      console.error('Get dashboard stats error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 文件上传相关 ====================

  /**
   * 上传文件
   */
  async uploadFile(file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<ApiResponse<string>> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, formData);

      if (error) {
        return { success: false, error: error.message };
      }

      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

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

  // ==================== 用户权限相关 ====================

  /**
   * 获取用户权限
   */
  async getUserPermissions(): Promise<ApiResponse<string[]>> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: '用户未登录' };
      }

      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_user_id: currentUser.id
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { 
        success: true, 
        data: data?.map((p: any) => p.permission_code) || []
      };
    } catch (error: any) {
      console.error('Get user permissions error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证用户权限
   */
  async verifyPermission(permissionCode: string): Promise<boolean> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return false;
      }

      const { data } = await supabase.rpc('verify_user_permission', {
        p_user_id: currentUser.id,
        p_permission_code: permissionCode
      });

      return data || false;
    } catch (error) {
      console.error('Verify permission error:', error);
      return false;
    }
  }
}

// 导出单例
export default NewApiService.getInstance();