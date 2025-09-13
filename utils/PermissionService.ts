/**
 * 权限检查服务 - 适配统一认证系统
 * 根据用户角色和工单状态控制操作权限
 * 集成 OptimizedApiService 的统一认证体系
 */

// 适配统一认证系统的用户接口
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role_id: string;
  is_admin: boolean;
  permissions: string[];
  department_id?: string;
}

export interface WorkOrderPermissions {
  canView: boolean;          // 能否查看工单详情
  canAssign: boolean;        // 能否分配工单
  canAccept: boolean;        // 能否接收工单
  canStart: boolean;         // 能否开始处理
  canComplete: boolean;      // 能否完成处理
  canReview: boolean;        // 能否审核
  canCancel: boolean;        // 能否取消
  canEdit: boolean;          // 能否编辑
}

class PermissionService {
  /**
   * 检查用户是否为管理员 - 适配统一认证
   */
  isAdmin(user?: AuthUser | any): boolean {
    if (!user) return false;
    
    // 支持新的统一认证系统格式
    if (typeof user.is_admin === 'boolean') {
      return user.is_admin;
    }
    
    // 向后兼容旧的角色格式
    if (user.role_id) {
      return user.role_id === 'R001'; // 系统管理员
    }
    
    // 兼容旧的role对象格式
    if (user.role?.code) {
      return ['ADMIN', 'MONITOR_MANAGER'].includes(user.role.code);
    }
    
    return false;
  }

  /**
   * 检查用户是否有特定权限 - 适配统一认证
   */
  hasPermission(user?: AuthUser | any, permission: string): boolean {
    if (!user) return false;
    
    // 管理员拥有所有权限
    if (this.isAdmin(user)) return true;
    
    // 检查统一认证系统的权限列表
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permission) || 
             user.permissions.includes('*') ||
             user.permissions.includes(permission.split('.')[0] + '.*');
    }
    
    // 向后兼容旧的权限格式
    if (user.role?.permissions) {
      const resourcePermissions = user.role.permissions.workorders || [];
      return resourcePermissions.includes(permission);
    }
    
    return false;
  }

  /**
   * 检查用户对工单的操作权限 - 适配统一认证
   */
  getWorkOrderPermissions(
    workOrder: any,
    currentUser: AuthUser | any,
    userRole?: any // 保持向后兼容
  ): WorkOrderPermissions {
    if (!workOrder || !currentUser) {
      return this.getDefaultPermissions();
    }

    const roleId = currentUser.role_id || currentUser.roleId;
    const userId = currentUser.id;
    const areaId = currentUser.areaId || currentUser.area_id;
    
    // 工单状态 - 支持中文和英文状态
    const status = workOrder.status?.toLowerCase();
    const chineseStatus = workOrder.status; // 可能是中文状态
    
    const isStatusPending = status === 'pending' || chineseStatus === '待分配';
    const isStatusAssigned = status === 'assigned' || chineseStatus === '已分配';
    const isStatusProcessing = status === 'processing' || chineseStatus === '处理中';
    const isStatusPendingReview = status === 'pending_review' || chineseStatus === '待审核';
    const isStatusCompleted = status === 'completed' || chineseStatus === '已完成';
    const isStatusCancelled = status === 'cancelled' || chineseStatus === '已取消';
    
    // 检查用户角色
    const isAssignee = workOrder.assignee_id === userId;
    const isCreator = workOrder.creator_id === userId;
    const isAreaSupervisor = roleId === 'R006' && areaId === workOrder.area_id;
    
    // 根据角色ID判断权限
    switch (roleId) {
      case 'R001': // 系统管理员
      case 'R002': // 监控中心主管
        return {
          canView: true,
          canAssign: isStatusPending,
          canAccept: false,
          canStart: false,
          canComplete: false,
          canReview: isStatusPendingReview,
          canCancel: !isStatusCompleted && !isStatusCancelled,
          canEdit: !isStatusCompleted && !isStatusCancelled,
        };
        
      case 'R003': // 河道维护员
        return {
          canView: isAssignee,
          canAssign: false,
          canAccept: false,
          canStart: isAssignee && (isStatusAssigned || isStatusPending),
          canComplete: isAssignee && isStatusProcessing,
          canReview: false,
          canCancel: false,
          canEdit: false,
        };
        
      case 'R004': // 河道巡检员
        return {
          canView: isCreator || isAssignee,
          canAssign: false,
          canAccept: false,
          canStart: isAssignee && (isStatusAssigned || isStatusPending),
          canComplete: isAssignee && isStatusProcessing,
          canReview: false,
          canCancel: isCreator && !isStatusCompleted && !isStatusCancelled,
          canEdit: false,
        };
        
      case 'R005': // 领导看板用户
        return {
          canView: true,
          canAssign: false,
          canAccept: false,
          canStart: false,
          canComplete: false,
          canReview: false,
          canCancel: false,
          canEdit: false,
        };
        
      case 'R006': // 河道维护员主管
        return {
          canView: isAreaSupervisor,
          canAssign: isAreaSupervisor && isStatusPending,
          canAccept: false,
          canStart: false,
          canComplete: false,
          canReview: isAreaSupervisor && isStatusPendingReview,
          canCancel: isAreaSupervisor && !isStatusCompleted && !isStatusCancelled,
          canEdit: false,
        };
        
      default:
        return this.getDefaultPermissions();
    }
  }

  /**
   * 获取默认权限（无权限）
   */
  private getDefaultPermissions(): WorkOrderPermissions {
    return {
      canView: false,
      canAssign: false,
      canAccept: false,
      canStart: false,
      canComplete: false,
      canReview: false,
      canCancel: false,
      canEdit: false,
    };
  }

  /**
   * 获取工单列表查询参数（基于权限）- 适配统一认证
   */
  getWorkOrderQueryParams(currentUser: AuthUser | any, userRole?: any): any {
    if (!currentUser) return {};

    const roleId = currentUser.role_id || currentUser.role?.id || userRole?.id;
    
    // 根据不同角色返回不同的查询参数
    switch (roleId) {
      case 'R001': // 系统管理员
      case 'R002': // 监控中心主管
      case 'R005': // 领导看板用户
        // 可以查看所有工单
        return {};
        
      case 'R006': // 河道维护员主管
        // 只查看自己管理区域的工单，不需要 user_id 参数
        // area_id 过滤已经在后端 API 中处理
        return {};
        
      case 'R003': // 河道维护员
      case 'R004': // 河道巡检员
        // 只能查看分配给自己或自己创建的工单
        return {
          user_id: currentUser.id,
        };
        
      default:
        // 默认只能查看自己相关的工单
        return {
          user_id: currentUser.id,
        };
    }
  }

  /**
   * 检查用户是否可以查看工单列表 - 适配统一认证
   */
  canViewWorkOrderList(user?: AuthUser | any): boolean {
    if (!user) return false;
    return this.hasPermission(user, 'workorder.view') || this.isAdmin(user);
  }

  /**
   * 根据角色获取状态过滤选项 - 适配统一认证
   */
  getStatusFilterOptions(user?: AuthUser | any): Array<{ label: string; value: string }> {
    const isAdmin = this.isAdmin(user);
    
    const commonOptions = [
      { label: '全部', value: '' },
      { label: '已分配', value: 'assigned' },
      { label: '处理中', value: 'processing' },
      { label: '已完成', value: 'completed' },
    ];

    if (isAdmin) {
      return [
        ...commonOptions,
        { label: '待分配', value: 'pending' },
        { label: '待审核', value: 'pending_review' },
        { label: '已取消', value: 'cancelled' },
      ];
    }

    return commonOptions;
  }

  /**
   * 检查用户是否可以创建工单 - 适配统一认证
   */
  canCreateWorkOrder(user?: AuthUser | any): boolean {
    if (!user) return false;
    return this.hasPermission(user, 'workorder.create') || this.isAdmin(user);
  }

  /**
   * 检查用户是否可以上报问题 - 适配统一认证
   */
  canCreateReport(user?: AuthUser | any): boolean {
    if (!user) return false;
    return this.hasPermission(user, 'mobile.report') || this.hasPermission(user, 'workorder.create') || this.isAdmin(user);
  }

  /**
   * 获取用户可用的工单操作列表
   */
  getAvailableActions(
    workOrder: any,
    currentUser: any,
    userRole?: UserRole
  ): Array<{
    key: string;
    label: string;
    color: string;
    icon: string;
    action: () => void;
  }> {
    const permissions = this.getWorkOrderPermissions(workOrder, currentUser, userRole);
    const actions: any[] = [];

    if (permissions.canAssign) {
      actions.push({
        key: 'assign',
        label: '分配工单',
        color: '#3B82F6',
        icon: 'person-add',
        action: () => this.handleAssign(workOrder),
      });
    }

    if (permissions.canAccept) {
      actions.push({
        key: 'accept',
        label: '接收工单',
        color: '#10B981',
        icon: 'check-circle',
        action: () => this.handleAccept(workOrder),
      });
    }

    if (permissions.canStart) {
      actions.push({
        key: 'start',
        label: '开始处理',
        color: '#8B5CF6',
        icon: 'play-arrow',
        action: () => this.handleStart(workOrder),
      });
    }

    if (permissions.canComplete) {
      actions.push({
        key: 'complete',
        label: '完成处理',
        color: '#059669',
        icon: 'done',
        action: () => this.handleComplete(workOrder),
      });
    }

    if (permissions.canReview) {
      actions.push({
        key: 'review',
        label: '审核工单',
        color: '#F59E0B',
        icon: 'rate-review',
        action: () => this.handleReview(workOrder),
      });
    }

    if (permissions.canCancel) {
      actions.push({
        key: 'cancel',
        label: '取消工单',
        color: '#EF4444',
        icon: 'cancel',
        action: () => this.handleCancel(workOrder),
      });
    }

    return actions;
  }

  // 占位方法，实际实现需要传入回调函数或在具体组件中实现
  private handleAssign(workOrder: any) { console.log('分配工单:', workOrder.id); }
  private handleAccept(workOrder: any) { console.log('接收工单:', workOrder.id); }
  private handleStart(workOrder: any) { console.log('开始处理:', workOrder.id); }
  private handleComplete(workOrder: any) { console.log('完成处理:', workOrder.id); }
  private handleReview(workOrder: any) { console.log('审核工单:', workOrder.id); }
  private handleCancel(workOrder: any) { console.log('取消工单:', workOrder.id); }

  /**
   * 格式化状态显示文本
   */
  formatStatus(status: string): { text: string; color: string } {
    const statusMap: Record<string, { text: string; color: string }> = {
      'pending': { text: '待分配', color: '#F59E0B' },
      'assigned': { text: '已分配', color: '#3B82F6' },
      'processing': { text: '处理中', color: '#8B5CF6' },
      'pending_review': { text: '待审核', color: '#F59E0B' },
      'completed': { text: '已完成', color: '#10B981' },
      'cancelled': { text: '已取消', color: '#6B7280' },
    };

    return statusMap[status?.toLowerCase()] || { text: status || '未知', color: '#6B7280' };
  }

  /**
   * 格式化优先级显示
   */
  formatPriority(priority: string): { text: string; color: string } {
    const priorityMap: Record<string, { text: string; color: string }> = {
      'urgent': { text: '紧急', color: '#EF4444' },
      'important': { text: '重要', color: '#F59E0B' },
      'normal': { text: '一般', color: '#3B82F6' },
    };

    return priorityMap[priority?.toLowerCase()] || { text: priority || '一般', color: '#3B82F6' };
  }
}

export default new PermissionService();