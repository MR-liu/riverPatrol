import { WorkOrder } from '@/contexts/AppContext';

// 后端数据接口定义
export interface BackendWorkOrder {
  id: string;
  type_id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'important' | 'normal';
  status: 'pending' | 'assigned' | 'processing' | 'pending_review' | 'completed' | 'cancelled';
  location: string;
  coordinates: any;
  creator_id: string;
  assignee_id: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  assignee_name?: string;
  point_id?: string;
}

export interface BackendProblemReport {
  id: string;
  reporter_id: string;
  category_ids: string[];
  title: string;
  description: string;
  priority: 'normal' | 'urgent' | 'critical';
  location_name: string;
  longitude: number;
  latitude: number;
  address: string;
  photos: string[];
  status: 'submitted' | 'reviewed' | 'converted' | 'rejected';
  created_at: string;
  reporter_name?: string;
}

export interface BackendUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  department_id: string;
  role_id: string;
  status: string;
  last_login_at: string;
}

export interface BackendDashboardStats {
  total_workorders: number;
  pending_workorders: number;
  processing_workorders: number;
  completed_workorders: number;
  completion_rate: number;
  today_stats: {
    new_workorders: number;
    completed_workorders: number;
    active_users: number;
  };
  category_stats: Array<{
    category_id: string;
    category_name: string;
    count: number;
    percentage: number;
  }>;
}

export interface ProblemCategory {
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
}

/**
 * 数据适配服务 - 处理前后端数据格式转换
 */
class DataAdapterService {
  // 前端分类ID到后端分类ID的映射关系
  private static readonly CATEGORY_MAPPING = {
    'garbage': ['M08001', 'M07001'], // 垃圾污染 -> 垃圾堆积, 成片漂浮垃圾
    'facility': ['M03001', 'M05001', 'M06001', 'M05002'], // 设施损毁 -> 护栏损坏, 平台损坏, 标牌缺失, 凉亭损坏
    'violation': ['S01001', 'S01002', 'S02001'], // 违规行为 -> 违章搭建, 占绿毁绿, 工业污染
    'water': ['S02002', 'S02003'] // 水质异常 -> 生活污染, 农业污染
  };

  // 状态映射：后端 -> 前端
  private static readonly STATUS_MAPPING = {
    'pending': '待接收',
    'assigned': '已分配', 
    'processing': '处理中',
    'pending_review': '待审核',
    'completed': '已完成',
    'cancelled': '已取消'
  };

  // 优先级映射：后端 -> 前端
  private static readonly PRIORITY_MAPPING = {
    'urgent': '紧急',
    'important': '重要',
    'normal': '普通'
  };

  /**
   * 将前端分类ID映射为后端分类ID数组
   */
  static mapFrontendToBackendCategories(frontendCategory: string): string[] {
    return this.CATEGORY_MAPPING[frontendCategory as keyof typeof this.CATEGORY_MAPPING] || [];
  }

  /**
   * 将后端分类ID映射回前端分类ID
   */
  static mapBackendToFrontendCategory(backendCategoryIds: string[]): string {
    for (const [frontendId, backendIds] of Object.entries(this.CATEGORY_MAPPING)) {
      if (backendCategoryIds.some(id => backendIds.includes(id))) {
        return frontendId;
      }
    }
    return 'garbage'; // 默认分类
  }

  /**
   * 后端工单数据转换为前端格式
   */
  static adaptWorkOrder(backendWorkOrder: BackendWorkOrder): WorkOrder {
    return {
      id: backendWorkOrder.id,
      title: backendWorkOrder.title,
      location: backendWorkOrder.location || '未知位置',
      status: this.STATUS_MAPPING[backendWorkOrder.status] || '待接收',
      priority: this.PRIORITY_MAPPING[backendWorkOrder.priority] || '普通',
      time: this.formatTimeAgo(backendWorkOrder.created_at),
      type: backendWorkOrder.type_id,
      description: backendWorkOrder.description,
      reporter: backendWorkOrder.creator_name || '系统',
      contact: '138****0000' // 可以从用户信息中获取
    };
  }

  /**
   * 前端工单数据转换为后端格式
   */
  static adaptWorkOrderToBackend(frontendWorkOrder: any, creatorId: string): Partial<BackendWorkOrder> {
    return {
      title: frontendWorkOrder.title,
      description: frontendWorkOrder.description,
      priority: this.mapFrontendPriority(frontendWorkOrder.priority),
      location: frontendWorkOrder.location,
      creator_id: creatorId,
      type_id: frontendWorkOrder.type || 'WT001' // 默认工单类型
    };
  }

  /**
   * 后端问题报告转换为前端格式（用于工单列表）
   */
  static adaptProblemReportToWorkOrder(report: BackendProblemReport): WorkOrder {
    return {
      id: `PR_${report.id}`,
      title: report.title,
      location: report.location_name,
      status: this.mapReportStatus(report.status),
      priority: this.mapReportPriority(report.priority),
      time: this.formatTimeAgo(report.created_at),
      type: report.category_ids[0] || 'M08001',
      description: report.description,
      reporter: report.reporter_name || '用户举报',
      contact: '138****0000'
    };
  }

  /**
   * 前端报告数据转换为后端格式
   */
  static adaptReportToBackend(reportData: any, reporterId: string): Partial<BackendProblemReport> {
    const categoryIds = reportData.selectedItems?.length > 0 
      ? this.mapFrontendToBackendCategories(reportData.category || 'garbage')
      : ['M08001'];

    return {
      reporter_id: reporterId,
      category_ids: categoryIds,
      title: reportData.title || this.generateReportTitle(reportData),
      description: reportData.description,
      priority: this.mapFrontendReportPriority(reportData.priority),
      location_name: reportData.location?.address || '当前位置',
      longitude: reportData.location?.coordinates?.longitude || 0,
      latitude: reportData.location?.coordinates?.latitude || 0,
      address: reportData.location?.address || '',
      photos: reportData.photos?.map((photo: any) => photo.uri || photo.url) || []
    };
  }

  /**
   * 时间格式化为相对时间
   */
  private static formatTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '刚刚';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}分钟前`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}小时前`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}天前`;
    }
  }

  /**
   * 前端优先级映射到后端
   */
  private static mapFrontendPriority(priority: string): 'urgent' | 'important' | 'normal' {
    const mapping = {
      '紧急': 'urgent',
      '重要': 'important', 
      '普通': 'normal'
    };
    return mapping[priority as keyof typeof mapping] || 'normal';
  }

  /**
   * 前端报告优先级映射到后端
   */
  private static mapFrontendReportPriority(priority: string): 'normal' | 'urgent' | 'critical' {
    const mapping = {
      '一般': 'normal',
      '普通': 'normal',
      '紧急': 'urgent',
      '严重': 'critical'
    };
    return mapping[priority as keyof typeof mapping] || 'normal';
  }

  /**
   * 报告状态映射
   */
  private static mapReportStatus(status: string): string {
    const mapping = {
      'submitted': '已提交',
      'reviewed': '已审核', 
      'converted': '已转工单',
      'rejected': '已拒绝'
    };
    return mapping[status as keyof typeof mapping] || '已提交';
  }

  /**
   * 报告优先级映射
   */
  private static mapReportPriority(priority: string): string {
    const mapping = {
      'normal': '普通',
      'urgent': '紧急',
      'critical': '严重'
    };
    return mapping[priority as keyof typeof mapping] || '普通';
  }

  /**
   * 生成报告标题
   */
  private static generateReportTitle(reportData: any): string {
    const category = reportData.category || 'garbage';
    const location = reportData.location?.address || '未知位置';
    const categoryNames = {
      'garbage': '垃圾污染',
      'facility': '设施损毁',
      'violation': '违规行为',
      'water': '水质异常'
    };
    return `${categoryNames[category as keyof typeof categoryNames]}问题 - ${location}`;
  }

  /**
   * 构建分页参数
   */
  static buildPaginationParams(page: number = 1, pageSize: number = 20) {
    return {
      page,
      size: pageSize,
      offset: (page - 1) * pageSize,
      limit: pageSize
    };
  }

  /**
   * 构建筛选参数
   */
  static buildFilterParams(filters: {
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    dateRange?: { start: string; end: string };
  }) {
    const params: any = {};

    if (filters.status && filters.status !== 'all') {
      // 前端状态转后端状态
      const backendStatus = Object.entries(this.STATUS_MAPPING)
        .find(([_, frontendStatus]) => frontendStatus === filters.status)?.[0];
      if (backendStatus) {
        params.status = backendStatus;
      }
    }

    if (filters.priority && filters.priority !== 'all') {
      const backendPriority = this.mapFrontendPriority(filters.priority);
      params.priority = backendPriority;
    }

    if (filters.assigneeId) {
      params.assignee_id = filters.assigneeId;
    }

    if (filters.dateRange) {
      params.created_at_gte = filters.dateRange.start;
      params.created_at_lte = filters.dateRange.end;
    }

    return params;
  }

  /**
   * 处理API错误响应
   */
  static handleApiError(error: any): { message: string; code?: string } {
    if (error.response?.data?.message) {
      return {
        message: error.response.data.message,
        code: error.response.data.code
      };
    }
    
    if (error.message) {
      return { message: error.message };
    }

    return { message: '网络错误，请重试' };
  }

  /**
   * 验证必填字段
   */
  static validateRequiredFields(data: any, requiredFields: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        errors.push(`${field} 不能为空`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default DataAdapterService;