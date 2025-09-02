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

    const isAdmin = this.isAdmin(currentUser);
    const isCreator = workOrder.creator_id === currentUser.id;
    const isAssignee = workOrder.assignee_id === currentUser.id;
    const isReviewer = workOrder.reviewer_id === currentUser.id;
    
    // 工单状态
    const status = workOrder.status?.toLowerCase();
    const isStatusPending = status === 'pending';
    const isStatusAssigned = status === 'assigned';
    const isStatusProcessing = status === 'processing';
    const isStatusPendingReview = status === 'pending_review';
    const isStatusCompleted = status === 'completed';
    const isStatusCancelled = status === 'cancelled';

    return {
      // 查看权限：管理员能看所有，用户只能看相关的
      canView: isAdmin || isCreator || isAssignee || isReviewer || 
               this.hasPermission(currentUser, 'workorder.view'),

      // 分配权限：只有管理员或有分配权限的用户能分配待分配的工单
      canAssign: (isAdmin || this.hasPermission(currentUser, 'workorder.assign')) && isStatusPending,

      // 接收权限：被分配的用户能接收已分配的工单
      canAccept: isAssignee && isStatusAssigned,

      // 开始处理权限：被分配的用户能开始处理中的工单
      canStart: isAssignee && (isStatusAssigned || isStatusProcessing),

      // 完成处理权限：被分配的用户能完成处理中的工单，管理员也可以
      canComplete: (isAssignee || (isAdmin && this.hasPermission(currentUser, 'workorder.complete'))) && isStatusProcessing,

      // 审核权限：管理员或有审核权限的用户能审核待审核的工单
      canReview: (isAdmin || this.hasPermission(currentUser, 'workorder.review')) && isStatusPendingReview,

      // 取消权限：管理员和创建者能取消未完成的工单
      canCancel: (isAdmin || isCreator || this.hasPermission(currentUser, 'workorder.cancel')) && 
                 !isStatusCompleted && !isStatusCancelled,

      // 编辑权限：管理员和处理人能编辑未完成的工单
      canEdit: (isAdmin || isAssignee || this.hasPermission(currentUser, 'workorder.update')) && 
               !isStatusCompleted && !isStatusCancelled,
    };
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

    const isAdmin = this.isAdmin(currentUser);
    
    if (isAdmin) {
      // 管理员可以查看所有工单
      return {};
    } else {
      // 普通用户只能查看自己相关的工单
      return {
        user_id: currentUser.id,  // 查询创建的或分配给自己的工单
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