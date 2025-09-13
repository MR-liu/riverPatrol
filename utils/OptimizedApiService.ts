// 智慧河道监控系统 - 优化后的API服务客户端
// 支持统一认证中间件的最优解决方案

import AsyncStorage from '@react-native-async-storage/async-storage';
import DataAdapterService, { BackendDashboardStats, BackendWorkOrder } from './DataAdapterService';
import { getAuthHeaders } from './SupabaseConfig';

// 请求选项接口
interface RequestOptions extends RequestInit {
  skipAuth?: boolean; // 跳过认证，用于token刷新等场景
}

// 重试配置接口
interface RetryConfig {
  maxRetries?: number;
  backoff?: number;
}

/**
 * 后端API客户端 - 优化版
 * 特性：
 * 1. 智能JWT验证和缓存
 * 2. 统一错误处理
 * 3. 自动重试和降级
 * 4. 性能优化
 */
class OptimizedApiService {
  private static baseUrl: string = '';
  private static accessToken: string = '';
  private static refreshToken: string = '';
  private static currentUserId: string | null = null;
  private static tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
  
  // JWT本地验证缓存
  private static jwtValidationCache = new Map<string, { valid: boolean; expiresAt: number }>();

  // 初始化配置
  static initialize(supabaseUrl: string) {
    this.baseUrl = `${supabaseUrl}/functions/v1`;
    console.log('[OptimizedApiService] 初始化完成, baseUrl:', this.baseUrl);
  }

  // 设置认证Token
  static setAuthTokens(accessToken: string, refreshToken: string, userId?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (userId) {
      this.currentUserId = userId;
    }
    console.log('[OptimizedApiService] Token设置完成，用户ID:', userId);
  }

  // 获取当前用户ID
  static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // 获取认证头
  private static getAuthHeaders(): Record<string, string> {
    return getAuthHeaders(this.accessToken);
  }

  // ==================== 智能JWT验证 ====================
  
  /**
   * 本地JWT验证 - 支持缓存和批量验证
   */
  static validateJWTLocally(token: string, useCache: boolean = true): boolean {
    if (!token) return false;

    // 检查缓存
    if (useCache) {
      const cached = this.jwtValidationCache.get(token);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.valid;
      }
    }

    try {
      // 基本格式验证
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        this.cacheValidation(token, false);
        return false;
      }

      // 解析payload检查过期时间
      try {
        const payload = JSON.parse(atob(tokenParts[1]));
        const now = Math.floor(Date.now() / 1000);
        
        const isValid = !payload.exp || payload.exp > now;
        this.cacheValidation(token, isValid);
        return isValid;
        
      } catch (decodeError) {
        // 无法解析但格式正确，假定有效
        console.warn('[OptimizedApiService] JWT解析失败，假定有效:', decodeError);
        this.cacheValidation(token, true);
        return true;
      }
    } catch (error) {
      console.error('[OptimizedApiService] JWT验证异常:', error);
      this.cacheValidation(token, false);
      return false;
    }
  }

  /**
   * 缓存验证结果
   */
  private static cacheValidation(token: string, valid: boolean) {
    this.jwtValidationCache.set(token, {
      valid,
      expiresAt: Date.now() + 300000 // 5分钟缓存
    });
  }

  /**
   * 检查token是否需要刷新
   */
  static shouldRefreshToken(token: string): boolean {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      // 如果token在5分钟内过期，则需要刷新
      return payload.exp && (payload.exp - now) < 300;
    } catch {
      return true; // 解析失败，需要刷新
    }
  }

  // ==================== 智能请求处理 ====================

  /**
   * 通用请求方法 - 支持重试和降级
   */
  private static async request<T>(
    endpoint: string, 
    options: RequestOptions = {},
    retryConfig: RetryConfig = {}
  ): Promise<{ success: boolean; data?: T; message?: string; error?: string }> {
    
    const { maxRetries = 2, backoff = 1000 } = retryConfig;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.makeRequest<T>(endpoint, options);
        return result;
      } catch (error) {
        console.error(`[OptimizedApiService] 请求失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error);
        
        // 如果是401错误且不是refresh-token请求，尝试自动刷新token
        if (error instanceof Error && error.message.includes('401') && 
            !endpoint.includes('refresh-token') && !options.skipAuth) {
          console.log('[OptimizedApiService] 检测到401错误，尝试刷新token');
          const refreshSuccess = await this.refreshTokens();
          
          if (refreshSuccess) {
            console.log('[OptimizedApiService] Token刷新成功，重试请求');
            // token刷新成功，重试原请求
            continue;
          } else {
            console.log('[OptimizedApiService] Token刷新失败，停止重试');
            return {
              success: false,
              error: '认证失败，请重新登录',
              message: '登录状态已过期'
            };
          }
        }
        
        if (attempt < maxRetries) {
          // 指数退避重试
          const delay = backoff * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 最后一次尝试失败，返回错误
        return {
          success: false,
          error: error instanceof Error ? error.message : '请求失败',
          message: '网络异常，请检查连接或稍后重试'
        };
      }
    }

    return { success: false, error: '未知错误' };
  }

  /**
   * 核心请求实现
   */
  private static async makeRequest<T>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<{ success: boolean; data?: T; message?: string; error?: string }> {
    
    const url = `${this.baseUrl}${endpoint}`;
    
    // 根据skipAuth决定是否添加认证headers
    let headers = {};
    if (!options.skipAuth) {
      headers = {
        ...this.getAuthHeaders(),
        ...options.headers,
      };
      
      // 预检token有效性（非跳过认证的请求）
      if (this.accessToken && !this.validateJWTLocally(this.accessToken)) {
        console.warn('[OptimizedApiService] 本地JWT验证失败');
        // 在这里可以触发自动刷新，但为避免循环调用，由上层request方法处理
      }
    } else {
      // 跳过认证的请求仍然需要基本headers
      headers = {
        'Content-Type': 'application/json',
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        ...options.headers,
      };
    }

    console.log(`[OptimizedApiService] 发起请求:`, {
      endpoint,
      method: options.method || 'GET',
      hasToken: !!this.accessToken,
      tokenValid: this.accessToken ? this.validateJWTLocally(this.accessToken) : false,
      skipAuth: options.skipAuth || false
    });
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error(`[OptimizedApiService] 响应解析失败:`, {
        status: response.status,
        statusText: response.statusText,
        endpoint
      });
      throw new Error(`响应格式错误: ${response.status}`);
    }
    
    if (!response.ok) {
      console.error(`[OptimizedApiService] HTTP错误:`, {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        result
      });
      
      // 智能错误处理
      if (response.status === 401) {
        console.error('[OptimizedApiService] 认证失败，清除本地token');
        await this.handleAuthError();
      }
      
      throw new Error(result.message || result.error || `HTTP ${response.status}`);
    }

    console.log(`[OptimizedApiService] 请求成功:`, endpoint);
    return result;
  }

  /**
   * 认证错误处理
   */
  private static async handleAuthError() {
    // 清除缓存
    this.jwtValidationCache.clear();
    this.tokenCache.clear();
    
    // 清除存储的token
    try {
      await AsyncStorage.multiRemove([
        'access_token',
        'refresh_token',
        'user_info'
      ]);
    } catch (error) {
      console.error('[OptimizedApiService] 清除存储失败:', error);
    }
    
    // 重置状态
    this.accessToken = '';
    this.refreshToken = '';
    this.currentUserId = null;
  }

  // ==================== API方法 ====================

  /**
   * 用户登录 - 优化版
   */
  static async login(username: string, password: string): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    console.log('[OptimizedApiService] 开始登录流程:', username);
    
    const result = await this.request('/custom-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (result.success && result.data) {
      // 保存Token和用户信息
      const { session, user } = result.data;
      this.setAuthTokens(session.access_token, session.refresh_token, user.id);

      // 验证并缓存新token
      const tokenValid = this.validateJWTLocally(session.access_token);
      console.log('[OptimizedApiService] 新token验证结果:', tokenValid);

      // 异步保存到存储
      this.saveAuthData(result.data).catch(error => 
        console.error('[OptimizedApiService] 保存认证数据失败:', error)
      );
      
      console.log('[OptimizedApiService] 登录成功, 用户:', user.name);
    }

    return result;
  }

  /**
   * 异步保存认证数据
   */
  private static async saveAuthData(data: any) {
    // 支持两种数据结构：login返回的data.session和refresh返回的直接结构
    const user = data.user;
    const accessToken = data.session?.access_token || data.access_token;
    const refreshToken = data.session?.refresh_token || data.refresh_token;
    
    await AsyncStorage.multiSet([
      ['user_info', JSON.stringify(user)],
      ['access_token', accessToken],
      ['refresh_token', refreshToken]
    ]);
  }

  /**
   * 获取仪表板统计数据 - 优化版
   */
  static async getDashboardStats(userId?: string, days: number = 7): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('user_id', userId);
    queryParams.append('days', days.toString());

    console.log('[OptimizedApiService] 获取仪表板统计:', { userId, days });

    const result = await this.request<BackendDashboardStats>(
      `/get-dashboard-stats?${queryParams.toString()}`,
      {},
      { maxRetries: 1 } // 仪表板数据允许快速失败
    );

    if (result.success) {
      console.log('[OptimizedApiService] 仪表板统计获取成功');
    }

    return result;
  }

  /**
   * 获取工单列表 - 优化版
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
      items: any[];
      pagination: any;
    };
    message?: string;
  }> {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // 转换前端参数名为后端参数名
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
      // 数据适配
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

    return result as any;
  }

  /**
   * 从本地存储恢复Token - 优化版
   */
  static async restoreTokensFromStorage(): Promise<boolean> {
    try {
      console.log('[OptimizedApiService] 开始从存储恢复token');
      
      const [accessToken, refreshToken] = await AsyncStorage.multiGet([
        'access_token',
        'refresh_token'
      ]);

      if (accessToken[1] && refreshToken[1]) {
        console.log('[OptimizedApiService] 找到存储的token，开始验证');
        
        // 本地验证
        const isValid = this.validateJWTLocally(accessToken[1]);
        
        if (isValid) {
          this.setAuthTokens(accessToken[1], refreshToken[1]);
          
          // 检查是否需要刷新
          if (this.shouldRefreshToken(accessToken[1])) {
            console.log('[OptimizedApiService] Token即将过期，尝试自动刷新');
            // 异步刷新token，不阻塞当前流程
            this.refreshTokens().then(success => {
              if (success) {
                console.log('[OptimizedApiService] Token自动刷新成功');
              } else {
                console.log('[OptimizedApiService] Token自动刷新失败');
              }
            }).catch(error => {
              console.error('[OptimizedApiService] Token自动刷新出错:', error);
            });
          }
          
          console.log('[OptimizedApiService] Token恢复成功');
          return true;
        } else {
          console.log('[OptimizedApiService] Token验证失败，清除存储');
          await this.handleAuthError();
        }
      } else {
        console.log('[OptimizedApiService] 未找到存储的token');
      }
    } catch (error) {
      console.error('[OptimizedApiService] 恢复token异常:', error);
      await this.handleAuthError();
    }
    
    return false;
  }

  /**
   * 登出 - 清理所有数据
   */
  static async logout(): Promise<void> {
    console.log('[OptimizedApiService] 开始登出流程');
    await this.handleAuthError();
    console.log('[OptimizedApiService] 登出完成');
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

  // ==================== 扩展业务API ====================

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
      priority: DataAdapterService.mapFrontendPriority?.(workOrderData.priority) || 'normal',
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
    delete (headers as any)['Content-Type'];

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
      console.error('[OptimizedApiService] 文件上传失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '文件上传失败',
      };
    }
  }

  /**
   * 获取问题分类 - 使用 SupabaseService
   */
  static async getProblemCategories(level?: number, parent?: string): Promise<any> {
    // 导入 SupabaseService
    const SupabaseService = require('./SupabaseService').default;
    
    try {
      const result = await SupabaseService.getProblemCategories();
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('[OptimizedApiService] 获取问题分类失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取问题分类失败'
      };
    }
  }

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

  /**
   * 刷新Token
   * 使用refresh token获取新的access token
   */
  static async refreshTokens(): Promise<boolean> {
    console.log('[OptimizedApiService] 开始刷新Token');
    
    if (!this.refreshToken) {
      console.error('[OptimizedApiService] 没有refresh token，无法刷新');
      return false;
    }

    try {
      // 调用refresh-token Edge Function
      const result = await this.request('/refresh-token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: this.refreshToken }),
        skipAuth: true, // 刷新token时不需要认证
      });

      if (result.success && result.data) {
        const { user } = result.data;
        
        // 更新内存中的token
        this.setAuthTokens(result.data.access_token, result.data.refresh_token, user.id);
        
        // 验证新token
        const tokenValid = this.validateJWTLocally(result.data.access_token);
        console.log('[OptimizedApiService] 新token验证结果:', tokenValid);

        // 异步保存到存储（结构与login保持一致）
        this.saveAuthData(result.data).catch(error => 
          console.error('[OptimizedApiService] 保存刷新后的认证数据失败:', error)
        );
        
        console.log('[OptimizedApiService] Token刷新成功');
        return true;
      } else {
        console.error('[OptimizedApiService] Token刷新失败:', result.message);
        await this.handleAuthError();
        return false;
      }
    } catch (error) {
      console.error('[OptimizedApiService] Token刷新过程出错:', error);
      await this.handleAuthError();
      return false;
    }
  }

  // ==================== 性能监控 ====================

  /**
   * 获取API性能统计
   */
  static getPerformanceStats() {
    return {
      jwtCacheSize: this.jwtValidationCache.size,
      tokenCacheSize: this.tokenCache.size,
      currentToken: this.accessToken ? {
        valid: this.validateJWTLocally(this.accessToken),
        shouldRefresh: this.shouldRefreshToken(this.accessToken)
      } : null
    };
  }

  /**
   * 清理缓存
   */
  static clearCache() {
    this.jwtValidationCache.clear();
    this.tokenCache.clear();
    console.log('[OptimizedApiService] 缓存已清理');
  }
}

export default OptimizedApiService;