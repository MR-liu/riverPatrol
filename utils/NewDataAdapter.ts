/**
 * 数据适配器 - 将新API数据格式转换为应用使用的格式
 */

import { WorkOrder as NewWorkOrder, ProblemReport, User, Alarm, Device, MonitoringPoint } from './NewApiService';

// 应用中使用的工单格式
export interface AppWorkOrder {
  id: string;
  title: string;
  location: string;
  status: string;
  priority: string;
  time: string;
  type: string;
  description: string;
  reporter: string;
  contact: string;
}

// 应用中使用的用户格式
export interface AppUser {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
}

/**
 * 数据适配器类
 */
export class NewDataAdapter {
  /**
   * 转换工单数据格式
   */
  static adaptWorkOrder(workOrder: any): AppWorkOrder {
    
    // 兼容 API 返回的格式化数据
    if (workOrder.creator_name || workOrder.assignee_name) {
      const result = {
        id: workOrder.id,
        title: workOrder.title,
        location: workOrder.location || '未知位置',
        status: this.translateWorkOrderStatus(workOrder.status),
        priority: this.translatePriority(workOrder.priority),
        time: this.formatDateTime(workOrder.created_at),
        type: workOrder.type || workOrder.type_id,
        description: workOrder.description || '',
        reporter: workOrder.creator_name || workOrder.creator_id,
        contact: '', // TODO: 需要查询联系方式
        assignee: workOrder.assignee_name || '未分配',
        department: workOrder.department_name || '未分配',
      };
      return result;
    }
    
    // 原始格式
    const result = {
      id: workOrder.id,
      title: workOrder.title,
      location: workOrder.location || '未知位置',
      status: this.translateWorkOrderStatus(workOrder.status),
      priority: this.translatePriority(workOrder.priority),
      time: this.formatDateTime(workOrder.created_at),
      type: workOrder.type_id, // TODO: 需要查询类型名称
      description: workOrder.description || '',
      reporter: workOrder.creator_id, // TODO: 需要查询用户名
      contact: '', // TODO: 需要查询联系方式
    };
    return result;
  }

  /**
   * 批量转换工单
   */
  static adaptWorkOrders(workOrders: NewWorkOrder[]): AppWorkOrder[] {
    return workOrders.map(wo => this.adaptWorkOrder(wo));
  }

  /**
   * 转换用户数据格式
   */
  static adaptUser(user: any): AppUser {
    const adaptedUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role_id || user.role?.id, // 角色ID (兼容旧字段)
      role_id: user.role_id || user.role?.id, // 保留role_id字段
      role_code: user.role?.code || user.role_code, // 角色代码
      department_id: user.department_id,
      area_id: user.area_id, // 区域ID
    };
    
    return adaptedUser;
  }

  /**
   * 转换问题报告为工单格式
   */
  static adaptProblemReportToWorkOrder(report: ProblemReport): AppWorkOrder {
    return {
      id: report.id,
      title: report.title,
      location: report.location || '未知位置',
      status: '待处理',
      priority: report.severity === 'high' ? '紧急' : '普通',
      time: this.formatDateTime(report.created_at),
      type: '问题上报',
      description: report.description,
      reporter: report.reporter_id, // TODO: 需要查询用户名
      contact: '', // TODO: 需要查询联系方式
    };
  }

  /**
   * 转换告警为工单格式
   */
  static adaptAlarmToWorkOrder(alarm: Alarm): AppWorkOrder {
    return {
      id: alarm.id,
      title: alarm.title,
      location: alarm.point_id, // TODO: 需要查询监控点名称
      status: this.translateAlarmStatus(alarm.status),
      priority: alarm.confidence > 0.8 ? '紧急' : '普通',
      time: this.formatDateTime(alarm.created_at),
      type: '告警处理',
      description: alarm.description || '',
      reporter: '系统',
      contact: '',
    };
  }

  /**
   * 转换设备数据
   */
  static adaptDevice(device: Device): any {
    return {
      id: device.id,
      name: device.name,
      code: device.code,
      status: this.translateDeviceStatus(device.status),
      isOnline: device.status === 'online',
      lastHeartbeat: device.last_heartbeat,
      type: device.type_id, // TODO: 需要查询类型名称
      location: device.point_id, // TODO: 需要查询监控点名称
    };
  }

  /**
   * 转换监控点数据
   */
  static adaptMonitoringPoint(point: MonitoringPoint): any {
    return {
      id: point.id,
      name: point.name,
      code: point.code,
      riverName: point.river_name || '',
      riverSection: point.river_section || '',
      coordinates: {
        latitude: point.latitude,
        longitude: point.longitude,
      },
      address: point.address || '',
      isActive: point.status === 'active',
    };
  }

  /**
   * 转换仪表板统计数据
   */
  static adaptDashboardStats(stats: any): any {
    if (!stats) return null;

    const overview = stats.overview || {};
    const today_stats = stats.today_stats || {};
    const userWorkload = stats.user_workload || {};
    const performance_metrics = stats.performance_metrics || {};

    return {
      overview: {
        total_workorders: overview.total_workorders || 0,
        pending_count: overview.pending_count || 0,
        processing_count: overview.processing_count || 0,
        completed_count: overview.completed_count || 0,
        completion_rate: overview.completion_rate || 0,
      },
      today_stats: {
        new_workorders: today_stats.new_workorders || 0,
        completed_workorders: today_stats.completed_workorders || 0,
        new_alarms: today_stats.new_alarms || 0,
        new_reports: today_stats.new_reports || 0,
      },
      device_stats: {
        total_devices: overview.total_devices || 0,
        online_devices: overview.online_devices || 0,
        offline_devices: (overview.total_devices || 0) - (overview.online_devices || 0),
      },
      alarm_stats: {
        active_alarms: overview.active_alarms || 0,
        today_alarms: overview.today_alarms || 0,
      },
      performance_metrics: {
        on_time_rate: performance_metrics.on_time_rate || 85,
        avg_processing_hours: performance_metrics.avg_completion_time || 0,
      },
      patrol_stats: {
        distance: 0, // TODO: 从巡查数据计算
        duration: 0,
      },
      user_workload: {
        assigned_count: userWorkload.assigned_count || 0,
        processing_count: userWorkload.processing_count || 0,
        today_completed: userWorkload.today_completed || 0,
      }
    };
  }

  /**
   * 构建问题上报数据
   */
  static buildProblemReportData(formData: any): any {
    return {
      title: formData.title,
      description: formData.description,
      category_ids: formData.selectedItems || [],
      images: formData.photos || [],
      location: formData.location?.address,
      coordinates: formData.location?.coordinates,
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 转换工单状态
   */
  private static translateWorkOrderStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': '待分配',
      'assigned': '待接收',
      'processing': '处理中',
      'pending_review': '待审核',
      'completed': '已完成',
      'cancelled': '已取消',
    };
    return statusMap[status] || status;
  }

  /**
   * 转换告警状态
   */
  private static translateAlarmStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': '待确认',
      'confirmed': '已确认',
      'processing': '处理中',
      'resolved': '已解决',
      'false_alarm': '误报',
      'ignored': '已忽略',
    };
    return statusMap[status] || status;
  }

  /**
   * 转换设备状态
   */
  private static translateDeviceStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'online': '在线',
      'offline': '离线',
      'fault': '故障',
      'maintenance': '维护中',
    };
    return statusMap[status] || status;
  }

  /**
   * 转换优先级
   */
  private static translatePriority(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'urgent': '紧急',
      'important': '重要',
      'normal': '普通',
    };
    return priorityMap[priority] || priority;
  }

  /**
   * 格式化日期时间
   */
  private static formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}天前`;
      } else if (hours > 0) {
        return `${hours}小时前`;
      } else {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes > 0 ? `${minutes}分钟前` : '刚刚';
      }
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * 计算完成率
   */
  private static calculateCompletionRate(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  /**
   * 转换问题分类数据
   */
  static adaptProblemCategories(categories: any[]): any {
    const result: any = {};
    
    // 递归处理分类树
    const processCategory = (cat: any, level: number = 1) => {
      result[cat.id] = {
        name: cat.name,
        level: level,
        parent: cat.parent_id || null,
      };

      if (cat.children && cat.children.length > 0) {
        cat.children.forEach((child: any) => {
          processCategory(child, level + 1);
        });
      }
    };

    categories.forEach(cat => processCategory(cat));
    return { categories: result };
  }

  /**
   * 获取主分类
   */
  static getMainCategories(categoriesData: any): any[] {
    const { categories } = categoriesData;
    return Object.entries(categories)
      .filter(([_, cat]: [string, any]) => cat.level === 1)
      .map(([id, cat]: [string, any]) => ({ id, name: cat.name }));
  }

  /**
   * 获取子分类
   */
  static getSubCategories(categoriesData: any, parentId: string): any[] {
    const { categories } = categoriesData;
    return Object.entries(categories)
      .filter(([_, cat]: [string, any]) => cat.parent === parentId)
      .map(([id, cat]: [string, any]) => ({ id, name: cat.name }));
  }
}

export default NewDataAdapter;