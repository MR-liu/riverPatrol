import { WorkOrder } from '@/contexts/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataAdapterService, { BackendDashboardStats, BackendWorkOrder } from './DataAdapterService';
import { getAuthHeaders } from './SupabaseConfig';

/**
 * 后端API客户端 - 处理与Supabase Edge Functions的通信
 */
class ApiService {
  private static baseUrl: string = '';
  private static accessToken: string = '';
  private static refreshToken: string = '';
  private static currentUserId: string | null = null;

  // 初始化配置
  static initialize(supabaseUrl: string) {
    this.baseUrl = `${supabaseUrl}/functions/v1`;
  }

  // 设置认证Token
  static setAuthTokens(accessToken: string, refreshToken: string, userId?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (userId) {
      this.currentUserId = userId;
    }
  }

  // 设置当前用户ID
  static setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  // 获取当前用户ID
  static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // 获取认证头
  private static getAuthHeaders(): Record<string, string> {
    return getAuthHeaders(this.accessToken);
  }

  // 通用请求方法
  private static async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; message?: string; error?: string }> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        ...this.getAuthHeaders(),
        ...options.headers,
      };
      
      // 添加调试日志
      console.log(`[ApiService] 请求 ${endpoint}:`, {
        url,
        method: options.method || 'GET',
        hasAccessToken: !!this.accessToken,
        accessTokenPrefix: this.accessToken ? this.accessToken.substring(0, 20) + '...' : 'none'
      });
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error(`[ApiService] HTTP错误 ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          result
        });
        throw new Error(result.message || `请求失败: ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`API请求失败 [${endpoint}]:`, error);
      
      // 区分网络错误和业务逻辑错误
      if (error instanceof Error) {
        // 如果是网络相关的错误
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch') ||
            error.message.includes('timeout')) {
          return {
            success: false,
            error: error.message,
            message: '请检查网络连接'
          };
        }
        // 业务逻辑错误（如密码错误、权限错误等）
        return {
          success: false,
          error: error.message,
          message: error.message // 直接使用服务器返回的错误信息
        };
      }
      
      return {
        success: false,
        error: '请求处理失败',
        message: '请稍后重试'
      };
    }
  }

  // ==================== 认证相关接口 ====================

  /**
   * 用户登录
   */
  static async login(username: string, password: string): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    const result = await this.request('/custom-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (result.success && result.data) {
      // 保存Token
      this.setAuthTokens(
        result.data.session.access_token,
        result.data.session.refresh_token,
        result.data.user.id
      );

      // 缓存用户信息
      await AsyncStorage.setItem('user_info', JSON.stringify(result.data.user));
      await AsyncStorage.setItem('access_token', result.data.session.access_token);
      await AsyncStorage.setItem('refresh_token', result.data.session.refresh_token);
    }

    return result;
  }

  /**
   * 刷新Token
   */
  static async refreshTokens(): Promise<boolean> {
    // 这里应该调用refresh token的端点，暂时返回false
    // TODO: 实现Token刷新逻辑
    return false;
  }

  // ==================== 工单相关接口 ====================

  /**
   * 获取工单列表
   */
  static async getWorkOrders(params: {
    page?: number;
    size?: number;
    status?: string;
    priority?: string;
    assigneeId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    success: boolean;
    data?: {
      items: WorkOrder[];
      pagination: {
        page: number;
        size: number;
        total: number;
        pages: number;
      };
    };
    message?: string;
  }> {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // 将前端参数名转换为后端参数名
        let backendKey = key;
        if (key === 'assigneeId') backendKey = 'assignee_id';
        if (key === 'sortBy') backendKey = 'sort_by';
        if (key === 'sortOrder') backendKey = 'sort_order';
        
        queryParams.append(backendKey, value.toString());
      }
    });

    const result = await this.request<{
      items: BackendWorkOrder[];
      pagination: any;
    }>(`/get-workorders?${queryParams.toString()}`);

    if (result.success && result.data) {
      // 转换后端数据为前端格式
      const adaptedItems = result.data.items.map(item => 
        DataAdapterService.adaptWorkOrder(item)
      );

      return {
        success: true,
        data: {
          items: adaptedItems,
          pagination: result.data.pagination
        }
      };
    }

    return result;
  }

  /**
   * 创建工单
   */
  static async createWorkOrder(workOrderData: {
    title: string;
    description: string;
    priority: string;
    location?: string;
    coordinates?: { latitude: number; longitude: number };
    assigneeId?: string;
    expectedCompleteAt?: string;
  }): Promise<{
    success: boolean;
    data?: { workorder_id: string; title: string; status: string };
    message?: string;
  }> {
    // 转换前端数据为后端格式
    const backendData = {
      type_id: 'WT001', // 默认工单类型
      title: workOrderData.title,
      description: workOrderData.description,
      priority: DataAdapterService['mapFrontendPriority']?.(workOrderData.priority) || 'normal',
      location: workOrderData.location,
      coordinates: workOrderData.coordinates,
      assignee_id: workOrderData.assigneeId,
      expected_complete_at: workOrderData.expectedCompleteAt,
      source: 'manual'
    };

    return await this.request('/create-workorder', {
      method: 'POST',
      body: JSON.stringify(backendData),
    });
  }

  /**
   * 更新工单状态
   */
  static async updateWorkOrderStatus(
    workOrderId: string, 
    action: 'accept' | 'start' | 'complete' | 'review' | 'approve' | 'reject' | 'cancel',
    note?: string,
    locationInfo?: { latitude: number; longitude: number; address?: string },
    attachments?: string[]
  ): Promise<{
    success: boolean;
    data?: { workorder_id: string; old_status: string; new_status: string };
    message?: string;
  }> {
    const requestData = {
      workorder_id: workOrderId,
      action,
      note,
      location_info: locationInfo,
      attachments
    };

    return await this.request('/update-workorder-status', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  }

  // ==================== 统计数据接口 ====================

  /**
   * 获取仪表板统计数据
   */
  static async getDashboardStats(userId?: string, days: number = 7): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('user_id', userId);
    queryParams.append('days', days.toString());

    const result = await this.request<BackendDashboardStats>(
      `/get-dashboard-stats?${queryParams.toString()}`
    );

    if (result.success && result.data) {
      // 可以在这里进行数据适配
      return {
        success: true,
        data: result.data
      };
    }

    return result;
  }

  // ==================== 文件上传接口 ====================

  /**
   * 上传文件
   */
  static async uploadFile(
    file: File | Blob,
    uploadType: 'avatar' | 'report_photo' | 'result_photo' | 'checkin_photo' | 'alarm_video' | 'alarm_image' | 'other',
    relatedId?: string
  ): Promise<{
    success: boolean;
    data?: {
      file_id: string;
      file_name: string;
      file_url: string;
      file_size: number;
      mime_type: string;
    };
    message?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_type', uploadType);
    if (relatedId) {
      formData.append('related_id', relatedId);
    }

    const headers = getAuthHeaders(this.accessToken);
    // 移除 Content-Type，让浏览器自动设置（包含 boundary）
    delete headers['Content-Type'];

    try {
      const response = await fetch(`${this.baseUrl}/upload-file`, {
        method: 'POST',
        body: formData,
        headers,
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `上传失败: ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('文件上传失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '文件上传失败',
      };
    }
  }

  // ==================== 问题分类接口 ====================

  /**
   * 获取问题分类（通过EnhancedProblemCategoryService调用）
   */
  static async getProblemCategories(level?: number, parent?: string): Promise<any> {
    const queryParams = new URLSearchParams();
    if (level) queryParams.append('level', level.toString());
    if (parent) queryParams.append('parent', parent);

    return await this.request(`/get-problem-categories?${queryParams.toString()}`);
  }

  // ==================== 辅助方法 ====================

  /**
   * 检查Token是否有效
   */
  static async validateToken(): Promise<boolean> {
    if (!this.accessToken) return false;

    // 简单验证：尝试获取用户信息
    const result = await this.getDashboardStats();
    return result.success;
  }

  /**
   * 清除认证信息
   */
  static async logout(): Promise<void> {
    this.accessToken = '';
    this.refreshToken = '';
    
    await AsyncStorage.multiRemove([
      'user_info',
      'access_token', 
      'refresh_token'
    ]);
  }

  /**
   * 从本地存储恢复Token
   */
  static async restoreTokensFromStorage(): Promise<boolean> {
    try {
      const [accessToken, refreshToken] = await AsyncStorage.multiGet([
        'access_token',
        'refresh_token'
      ]);

      if (accessToken[1] && refreshToken[1]) {
        this.setAuthTokens(accessToken[1], refreshToken[1]);
        
        // 验证Token是否仍然有效
        const isValid = await this.validateToken();
        if (!isValid) {
          await this.logout();
          return false;
        }
        
        return true;
      }
    } catch (error) {
      console.error('恢复Token失败:', error);
    }
    
    return false;
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(): Promise<any> {
    try {
      const userInfoStr = await AsyncStorage.getItem('user_info');
      return userInfoStr ? JSON.parse(userInfoStr) : null;
    } catch {
      return null;
    }
  }

  // ==================== 错误处理 ====================

  /**
   * 处理API错误
   */
  static handleApiError(error: any): { message: string; shouldLogout?: boolean } {
    const errorData = DataAdapterService.handleApiError(error);
    
    // 如果是认证错误，可能需要重新登录
    const shouldLogout = error.status === 401 || error.status === 403;
    
    return {
      message: errorData.message,
      shouldLogout
    };
  }

  // ==================== 消息同步 ====================

  /**
   * 同步用户消息
   */
  static async syncMessages(params: {
    user_id: string;
    device_id?: string;
    last_sync?: string;
  }): Promise<{
    success: boolean;
    data?: {
      messages: any[];
      unread_count: number;
      sync_timestamp: string;
    };
    message?: string;
    error?: string;
  }> {
    const result = await this.request<{
      messages: any[];
      unread_count: number;
      sync_timestamp: string;
    }>('/sync-messages', {
      method: 'POST',
      body: JSON.stringify(params)
    });

    return result;
  }
}

export default ApiService;