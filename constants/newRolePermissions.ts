/**
 * 智慧河道监控系统 - 角色权限配置
 * 基于权限点的RBAC系统
 */

// 权限点定义
export const PERMISSIONS = {
  // 告警管理
  ALARM_VIEW: 'alarm.view',
  ALARM_CREATE: 'alarm.create',
  ALARM_CONFIRM: 'alarm.confirm',
  ALARM_RESOLVE: 'alarm.resolve',
  ALARM_FALSE_ALARM: 'alarm.false_alarm',
  ALARM_CREATE_WORKORDER: 'alarm.create_workorder',
  ALARM_DELETE: 'alarm.delete',
  ALARM_EXPORT: 'alarm.export',
  
  // 工单管理
  WORKORDER_VIEW: 'workorder.view',
  WORKORDER_CREATE: 'workorder.create',
  WORKORDER_UPDATE: 'workorder.update',
  WORKORDER_DELETE: 'workorder.delete',
  WORKORDER_ASSIGN: 'workorder.assign',
  WORKORDER_REASSIGN: 'workorder.reassign',
  WORKORDER_RECEIVE: 'workorder.receive',
  WORKORDER_COMPLETE: 'workorder.complete',
  WORKORDER_REVIEW: 'workorder.review',
  WORKORDER_REJECT: 'workorder.reject',
  WORKORDER_FINAL_REVIEW: 'workorder.final_review',
  WORKORDER_RESUBMIT: 'workorder.resubmit',
  WORKORDER_CANCEL: 'workorder.cancel',
  WORKORDER_EXPORT: 'workorder.export',
  
  // 用户管理
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_RESET_PASSWORD: 'user.reset_password',
  USER_CHANGE_STATUS: 'user.change_status',
  USER_ASSIGN_ROLE: 'user.assign_role',
  USER_VIEW_LOGS: 'user.view_logs',
  
  // 数据分析
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_REPORT: 'analytics.report',
  ANALYTICS_STATISTICS: 'analytics.statistics',
  ANALYTICS_FILTER: 'analytics.filter',
  
  // GIS中心
  GIS_VIEW: 'gis.view',
  GIS_CONTROL: 'gis.control',
  GIS_DEVICE_LOCATION: 'gis.device_location',
  GIS_AREA_MANAGEMENT: 'gis.area_management',
  GIS_ROUTE_PLANNING: 'gis.route_planning',
  
  // 移动端功能
  MOBILE_CHECKIN: 'mobile.checkin',
  MOBILE_REPORT: 'mobile.report',
  MOBILE_PATROL: 'mobile.patrol',
  MOBILE_PHOTO_UPLOAD: 'mobile.photo_upload',
  MOBILE_LOCATION: 'mobile.location',
  MOBILE_OFFLINE_SYNC: 'mobile.offline_sync',
  
  // 系统管理
  SYSTEM_CONFIG: 'system.config',
  SYSTEM_LOGS: 'system.logs',
  SYSTEM_BACKUP: 'system.backup',
  SYSTEM_RESTORE: 'system.restore',
  SYSTEM_CLEANUP: 'system.cleanup',
  SYSTEM_MONITOR: 'system.monitor',
  SYSTEM_VERSION: 'system.version',
  
  // 数据看板
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_CUSTOMIZE: 'dashboard.customize',
  DASHBOARD_SHARE: 'dashboard.share',
  
  // 区域管理
  AREA_VIEW: 'area.view',
  AREA_MANAGE_TEAM: 'area.manage_team',
  AREA_ASSIGN_DEVICES: 'area.assign_devices',
  AREA_VIEW_STATS: 'area.view_stats',
  
  // 设备管理
  DEVICE_VIEW: 'device.view',
  DEVICE_MANAGE: 'device.manage',
  DEVICE_MAINTENANCE: 'device.maintenance',
  DEVICE_REPAIR: 'device.repair',
  DEVICE_MONITOR: 'device.monitor',
} as const;

// 角色定义
export interface Role {
  code: string;
  name: string;
  description: string;
  permissions: string[];
  // 数据访问范围
  dataScope: 'all' | 'area' | 'assigned' | 'department';
  // 可查看的工单状态
  viewableStatuses?: string[];
}

// 角色权限映射
export const ROLES: Record<string, Role> = {
  // R001 - 系统管理员
  'R001': {
    code: 'R001',
    name: '系统管理员',
    description: '系统管理、用户管理、最终审核',
    permissions: Object.values(PERMISSIONS), // 所有权限
    dataScope: 'all',
  },
  
  // R002 - 监控中心主管
  'R002': {
    code: 'R002',
    name: '监控中心主管',
    description: '告警监控、工单调度、最终审核',
    permissions: [
      PERMISSIONS.ALARM_VIEW,
      PERMISSIONS.ALARM_CONFIRM,
      PERMISSIONS.ALARM_RESOLVE,
      PERMISSIONS.ALARM_CREATE_WORKORDER,
      PERMISSIONS.WORKORDER_VIEW,
      PERMISSIONS.WORKORDER_CREATE,
      PERMISSIONS.WORKORDER_ASSIGN,
      PERMISSIONS.WORKORDER_FINAL_REVIEW,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.ANALYTICS_EXPORT,
      PERMISSIONS.ANALYTICS_REPORT,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.GIS_VIEW,
      PERMISSIONS.GIS_CONTROL,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
    dataScope: 'all',
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed'],
  },
  
  // R003 - 河道维护员
  'R003': {
    code: 'R003',
    name: '河道维护员',
    description: '现场维护、问题处理',
    permissions: [
      PERMISSIONS.WORKORDER_VIEW,
      PERMISSIONS.WORKORDER_UPDATE,
      PERMISSIONS.WORKORDER_COMPLETE,
      PERMISSIONS.ALARM_VIEW,
      PERMISSIONS.ALARM_RESOLVE,
    ],
    dataScope: 'assigned', // 只看分配给自己的
    viewableStatuses: ['assigned', 'processing', 'completed'],
  },
  
  // R004 - 河道巡检员
  'R004': {
    code: 'R004',
    name: '河道巡检员',
    description: '现场巡查、问题上报、复发确认',
    permissions: [
      PERMISSIONS.WORKORDER_VIEW,
      PERMISSIONS.WORKORDER_RECEIVE,
      PERMISSIONS.WORKORDER_UPDATE,
      PERMISSIONS.WORKORDER_RESUBMIT,
      PERMISSIONS.WORKORDER_FINAL_REVIEW,
      PERMISSIONS.MOBILE_CHECKIN,
      PERMISSIONS.MOBILE_REPORT,
      PERMISSIONS.MOBILE_PATROL,
      PERMISSIONS.MOBILE_PHOTO_UPLOAD,
      PERMISSIONS.MOBILE_LOCATION,
    ],
    dataScope: 'area', // 只看自己区域的
    viewableStatuses: ['processing', 'pending_review', 'completed'],
  },
  
  // R005 - 领导看板用户
  'R005': {
    code: 'R005',
    name: '领导看板用户',
    description: '数据监督、决策支持',
    permissions: [
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.ANALYTICS_STATISTICS,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
    dataScope: 'all', // 可以看所有数据（只读）
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed'],
  },
  
  // R006 - 河道维护员主管
  'R006': {
    code: 'R006',
    name: '河道维护员主管',
    description: '区域管理、团队协调、工单审核',
    permissions: [
      PERMISSIONS.ALARM_VIEW,
      PERMISSIONS.ALARM_CONFIRM,
      PERMISSIONS.ALARM_RESOLVE,
      PERMISSIONS.WORKORDER_VIEW,
      PERMISSIONS.WORKORDER_CREATE,
      PERMISSIONS.WORKORDER_ASSIGN,
      PERMISSIONS.WORKORDER_REASSIGN,
      PERMISSIONS.WORKORDER_REVIEW,
      PERMISSIONS.WORKORDER_REJECT,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.AREA_VIEW,
      PERMISSIONS.AREA_MANAGE_TEAM,
      PERMISSIONS.DEVICE_VIEW,
      PERMISSIONS.DEVICE_MANAGE,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.ANALYTICS_FILTER,
      PERMISSIONS.GIS_VIEW,
    ],
    dataScope: 'area', // 只看管辖区域的
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed'],
  },
};

// 工单状态定义
export const WORKORDER_STATUS = {
  PENDING: 'pending',           // 待分配
  ASSIGNED: 'assigned',         // 已分配/待接收
  PROCESSING: 'processing',     // 处理中
  PENDING_REVIEW: 'pending_review', // 待审核
  COMPLETED: 'completed',       // 已完成
  CANCELLED: 'cancelled',       // 已取消
} as const;

// 工单状态中文映射
export const WORKORDER_STATUS_CN: Record<string, string> = {
  'pending': '待分配',
  'assigned': '待接收',
  'processing': '处理中',
  'pending_review': '待审核',
  'completed': '已完成',
  'cancelled': '已取消',
};

// 工单流转规则
export const WORKFLOW_RULES = {
  // 人工工单流程
  manual: {
    'pending': ['assigned', 'cancelled'],
    'assigned': ['processing', 'pending'],
    'processing': ['pending_review'],
    'pending_review': ['completed', 'processing'],
    'completed': [],
    'cancelled': [],
  },
  
  // AI告警工单流程
  ai_alarm: {
    'pending': ['assigned', 'cancelled'],
    'assigned': ['processing', 'pending'],
    'processing': ['pending_review'],
    'pending_review': ['completed', 'processing'],
    'completed': [],
    'cancelled': [],
  },
};

// 辅助函数

/**
 * 根据角色代码获取角色信息
 */
export function getRoleByCode(roleCode: string): Role | null {
  return ROLES[roleCode] || null;
}

/**
 * 检查角色是否有某个权限
 */
export function hasPermission(roleCode: string, permission: string): boolean {
  const role = getRoleByCode(roleCode);
  return role ? role.permissions.includes(permission) : false;
}

/**
 * 检查角色是否可以查看某个状态的工单
 */
export function canViewWorkOrderStatus(roleCode: string, status: string): boolean {
  const role = getRoleByCode(roleCode);
  if (!role || !role.viewableStatuses) return false;
  return role.viewableStatuses.includes(status);
}

/**
 * 获取角色的数据访问范围
 */
export function getRoleDataScope(roleCode: string): string {
  const role = getRoleByCode(roleCode);
  return role ? role.dataScope : 'assigned';
}

/**
 * 检查工单状态是否可以流转
 */
export function canTransitionStatus(
  currentStatus: string,
  newStatus: string,
  workflowType: 'manual' | 'ai_alarm' = 'manual'
): boolean {
  const rules = WORKFLOW_RULES[workflowType];
  const allowedTransitions = rules[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * 根据角色获取可执行的工单操作
 */
export function getWorkOrderActions(roleCode: string): string[] {
  const actions: string[] = [];
  
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_CREATE)) actions.push('create');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_ASSIGN)) actions.push('assign');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_RECEIVE)) actions.push('receive');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_UPDATE)) actions.push('update');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_COMPLETE)) actions.push('complete');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_REVIEW)) actions.push('review');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_REJECT)) actions.push('reject');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_FINAL_REVIEW)) actions.push('final_review');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_RESUBMIT)) actions.push('resubmit');
  if (hasPermission(roleCode, PERMISSIONS.WORKORDER_CANCEL)) actions.push('cancel');
  
  return actions;
}

/**
 * 检查用户是否可以处理工单
 */
export function canProcessWorkOrder(roleCode: string, workOrderStatus: string): boolean {
  // 检查是否有查看权限
  if (!hasPermission(roleCode, PERMISSIONS.WORKORDER_VIEW)) return false;
  
  // 检查是否可以查看该状态
  if (!canViewWorkOrderStatus(roleCode, workOrderStatus)) return false;
  
  // 根据状态检查特定权限
  switch (workOrderStatus) {
    case WORKORDER_STATUS.PENDING:
      return hasPermission(roleCode, PERMISSIONS.WORKORDER_ASSIGN);
    case WORKORDER_STATUS.ASSIGNED:
      return hasPermission(roleCode, PERMISSIONS.WORKORDER_RECEIVE) ||
             hasPermission(roleCode, PERMISSIONS.WORKORDER_UPDATE);
    case WORKORDER_STATUS.PROCESSING:
      return hasPermission(roleCode, PERMISSIONS.WORKORDER_COMPLETE) ||
             hasPermission(roleCode, PERMISSIONS.WORKORDER_UPDATE);
    case WORKORDER_STATUS.PENDING_REVIEW:
      return hasPermission(roleCode, PERMISSIONS.WORKORDER_REVIEW) ||
             hasPermission(roleCode, PERMISSIONS.WORKORDER_FINAL_REVIEW);
    default:
      return false;
  }
}