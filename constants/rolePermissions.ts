/**
 * 角色权限配置
 * 定义各角色的工单操作权限和查看范围
 */

export interface RolePermission {
  code: string;
  name: string;
  // 可以查看的工单状态
  viewableStatuses: string[];
  // 可以执行的操作
  allowedActions: string[];
  // 工单查看范围
  viewScope: 'all' | 'assigned' | 'department' | 'area';
  // 可以分配工单
  canAssign: boolean;
  // 可以审核工单
  canReview: boolean;
  // 可以创建工单
  canCreate: boolean;
}

// 角色权限映射
export const ROLE_PERMISSIONS: Record<string, RolePermission> = {
  // 管理员 - 全权限
  'admin': {
    code: 'admin',
    name: '管理员',
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed', 'cancelled'],
    allowedActions: ['create', 'assign', 'start', 'complete', 'review', 'reject', 'cancel'],
    viewScope: 'all',
    canAssign: true,
    canReview: true,
    canCreate: true,
  },
  
  // 超级管理员
  'R001': {
    code: 'R001',
    name: '超级管理员',
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed', 'cancelled'],
    allowedActions: ['create', 'assign', 'start', 'complete', 'review', 'reject', 'cancel'],
    viewScope: 'all',
    canAssign: true,
    canReview: true,
    canCreate: true,
  },
  
  // 监控中心主管 (R002) - 确认告警、创建工单、最终审核
  'R002': {
    code: 'R002',
    name: '监控中心主管',
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed'],
    allowedActions: ['create', 'review', 'reject'],
    viewScope: 'all',
    canAssign: false,
    canReview: true,
    canCreate: true,
  },
  
  // 河道维护员 (R003) - 接收并处理工单
  'R003': {
    code: 'R003',
    name: '河道维护员',
    viewableStatuses: ['assigned', 'processing', 'completed'],
    allowedActions: ['start', 'complete'],
    viewScope: 'assigned', // 只看分配给自己的
    canAssign: false,
    canReview: false,
    canCreate: false,
  },
  
  // 河道巡检员 (R004) - 现场确认
  'R004': {
    code: 'R004',
    name: '河道巡检员',
    viewableStatuses: ['processing', 'pending_review', 'completed'],
    allowedActions: ['confirm'],
    viewScope: 'area', // 只看自己区域的
    canAssign: false,
    canReview: false,
    canCreate: false,
  },
  
  // 区域主管 (R005) - 区域内的工单管理（如东区管理）
  'R005': {
    code: 'R005',
    name: '区域主管',
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed'],
    allowedActions: ['assign', 'review', 'reject'],
    viewScope: 'area', // 只看自己区域的
    canAssign: true,
    canReview: true,
    canCreate: false,
  },
  
  // 河道维护员主管 (R006) - 接收工单、分派工单、审核完成
  'R006': {
    code: 'R006',
    name: '河道维护员主管',
    viewableStatuses: ['pending', 'assigned', 'processing', 'pending_review', 'completed'],
    allowedActions: ['assign', 'review', 'reject'],
    viewScope: 'area', // 只看自己区域的
    canAssign: true,
    canReview: true,
    canCreate: false,
  },
};

// 工单状态流转规则
export const WORKFLOW_RULES = {
  // 人工单子流程
  manual: {
    'pending': ['assigned', 'cancelled'], // 待分配 -> 已分配或取消
    'assigned': ['processing', 'pending'], // 已分配 -> 处理中或退回待分配
    'processing': ['pending_review'], // 处理中 -> 待审核
    'pending_review': ['completed', 'processing'], // 待审核 -> 已完成或退回处理
    'completed': [], // 已完成（终态）
    'cancelled': [], // 已取消（终态）
  },
  
  // AI告警单子流程
  ai_alarm: {
    'pending': ['assigned', 'cancelled'], // 待分配 -> 已分配或取消
    'assigned': ['processing', 'pending'], // 已分配 -> 处理中或退回待分配
    'processing': ['pending_review'], // 处理中 -> 待审核
    'pending_review': ['completed', 'processing'], // 待审核 -> 已完成或退回处理
    'completed': [], // 已完成（终态）
    'cancelled': [], // 已取消（终态）
  }
};

// 根据角色代码获取权限
export function getRolePermissions(roleCode: string): RolePermission | null {
  return ROLE_PERMISSIONS[roleCode] || null;
}

// 检查用户是否有某个操作权限
export function hasPermission(roleCode: string, action: string): boolean {
  const permissions = getRolePermissions(roleCode);
  return permissions ? permissions.allowedActions.includes(action) : false;
}

// 检查用户是否可以查看某个状态的工单
export function canViewStatus(roleCode: string, status: string): boolean {
  const permissions = getRolePermissions(roleCode);
  return permissions ? permissions.viewableStatuses.includes(status) : false;
}