import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProblemCategoryService from '@/utils/ProblemCategoryService';
import EnhancedNotificationService, { EnhancedMessage } from '@/utils/EnhancedNotificationService';
import AuthService from '@/utils/AuthService';
import SupabaseService from '@/utils/SupabaseService';
import NewDataAdapter from '@/utils/NewDataAdapter';
import { getRoleByCode, getRoleDataScope, PERMISSIONS, hasPermission } from '@/constants/newRolePermissions';
import JPushService from '@/utils/JPushService';

// Supabase配置 - 使用环境变量
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('错误: EXPO_PUBLIC_SUPABASE_URL 环境变量未设置');
  throw new Error('EXPO_PUBLIC_SUPABASE_URL 环境变量是必需的');
}

export interface WorkOrder {
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

export interface ReportForm {
  selectedItems: string[];
  description: string;
  priority: string;
  photos: string[];
}

export interface ProcessResult {
  beforePhotos: string[];
  afterPhotos: string[];
  processMethod: string;
  processDescription: string;
  result: string;
  needFollowUp: boolean;
  followUpReason: string;
}

export interface UserInfo {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role?: string;
  role_code?: string; // 角色代码
  department_id?: string; // 部门ID
  area_id?: string; // 区域ID
}

export interface UserSettings {
  notifications: {
    workOrderUpdates: boolean;
    systemMessages: boolean;
    reminderAlerts: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    language: 'zh-CN' | 'en-US';
  };
  privacy: {
    locationTracking: boolean;
    dataCollection: boolean;
    analyticsEnabled: boolean;
  };
  performance: {
    autoSync: boolean;
    imageQuality: 'low' | 'medium' | 'high';
    cacheSize: number;
    backgroundRefresh: boolean;
  };
  advanced: {
    developerMode: boolean;
    debugMode: boolean;
    logLevel: 'none' | 'error' | 'info' | 'debug';
  };
}

export interface OfflineStats {
  workOrdersCount: number;
  offlineReportsCount: number;
  cachedPhotosCount: number;
  totalStorageSize: string;
}

interface AppContextType {
  // 加载和错误状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isInitializing: boolean;
  error: Error | null;
  setError: (error: Error | null) => void;

  // 用户信息
  currentUser: UserInfo | null;
  setCurrentUser: (user: UserInfo | null) => void;

  // 登录表单
  loginForm: { username: string; password: string };
  setLoginForm: (form: { username: string; password: string }) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;

  // 工单相关
  workOrders: WorkOrder[];
  setWorkOrders: (orders: WorkOrder[]) => void;
  selectedWorkOrder: WorkOrder | null;
  setSelectedWorkOrder: (order: WorkOrder | null) => void;
  workOrderFilter: string;
  setWorkOrderFilter: (filter: string) => void;

  // 上报相关
  reportStep: number;
  setReportStep: (step: number) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  reportForm: ReportForm;
  setReportForm: (form: ReportForm | ((prev: ReportForm) => ReportForm)) => void;

  // 处理结果
  processResult: ProcessResult;
  setProcessResult: (result: ProcessResult | ((prev: ProcessResult) => ProcessResult)) => void;

  // 用户设置和离线存储
  userSettings: UserSettings;
  setUserSettings: (settings: UserSettings | ((prev: UserSettings) => UserSettings)) => void;
  offlineStats: OfflineStats;
  setOfflineStats: (stats: OfflineStats) => void;
  isOfflineMode: boolean;
  setIsOfflineMode: (offline: boolean) => void;

  // 离线操作方法
  saveOfflineReport: (reportData: any) => Promise<boolean>;
  syncOfflineData: () => Promise<void>;
  clearOfflineData: () => Promise<boolean>;

  // 新增API方法
  loginWithBackend: (username: string, password: string) => Promise<boolean>;
  logoutUser: () => Promise<boolean>;
  loadWorkOrdersFromBackend: (filters?: any) => Promise<void>;
  refreshDashboardStats: () => Promise<void>;
  uploadFile: (file: any, type: string, relatedId?: string) => Promise<string | null>;
  submitReport: (reportData: any) => Promise<boolean>;
  updateWorkOrderStatus: (workOrderId: string, action: string, note?: string) => Promise<boolean>;
  
  // 统计数据刷新
  refreshUserStats: () => void;
  
  // 仪表板统计数据
  dashboardStats: any;
  setDashboardStats: (stats: any) => void;
  
  // 通知和消息
  messages: EnhancedMessage[];
  unreadCount: number;
  getMessages: () => Promise<EnhancedMessage[]>;
  getUnreadMessages: () => Promise<EnhancedMessage[]>;
  markMessageAsRead: (messageIds: string[]) => Promise<boolean>;
  syncMessages: () => Promise<boolean>;
  
  // 推送相关
  pushConfig: any;
  setPushConfig: (config: any) => void;
  loadPushConfig: () => Promise<void>;
  savePushConfig: (config: any) => Promise<boolean>;
  testPushNotification: () => Promise<boolean>;
  handleRemotePushNotification: (notification: any) => void;
  handlePushNotificationOpen: (notification: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [reportStep, setReportStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workOrderFilter, setWorkOrderFilter] = useState('all');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  
  // 通知和消息状态
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // 统计数据刷新状态
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  
  // 推送相关状态
  const [pushConfig, setPushConfig] = useState({
    enable_alarm_push: true,
    enable_workorder_push: true,
    enable_notification_push: true,
    enable_inspection_push: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    min_priority: 'normal',
  });

  // 默认设置
  const defaultSettings = useMemo(() => ({
    notifications: {
      workOrderUpdates: true,
      systemMessages: true,
      reminderAlerts: true,
      soundEnabled: true,
      vibrationEnabled: true,
    },
    appearance: {
      theme: 'light' as const,
      fontSize: 'medium' as const,
      language: 'zh-CN' as const,
    },
    privacy: {
      locationTracking: true,
      dataCollection: false,
      analyticsEnabled: false,
    },
    performance: {
      autoSync: true,
      imageQuality: 'medium' as const,
      cacheSize: 50,
      backgroundRefresh: true,
    },
    advanced: {
      developerMode: false,
      debugMode: false,
      logLevel: 'error' as const,
    },
  }), []);

  const [userSettings, setUserSettings] = useState<UserSettings>(defaultSettings);

  const [offlineStats, setOfflineStats] = useState<OfflineStats>({
    workOrdersCount: 0,
    offlineReportsCount: 0,
    cachedPhotosCount: 0,
    totalStorageSize: '0 B',
  });

  const [reportForm, setReportForm] = useState<ReportForm>({
    selectedItems: [],
    description: '',
    priority: '一般',
    photos: [],
  });

  const [processResult, setProcessResult] = useState<ProcessResult>({
    beforePhotos: [],
    afterPhotos: [],
    processMethod: '',
    processDescription: '',
    result: '',
    needFollowUp: false,
    followUpReason: '',
  });

  // 工单数据 - 初始为空，将从API获取
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  // 离线操作方法
  const saveOfflineReport = useCallback(async (reportData: any): Promise<boolean> => {
    try {
      const existingReports = await AsyncStorage.getItem('offline_reports');
      const reports = existingReports ? JSON.parse(existingReports) : [];
      reports.push(reportData);
      await AsyncStorage.setItem('offline_reports', JSON.stringify(reports));
      
      // 更新离线统计
      setOfflineStats(prev => ({
        ...prev,
        offlineReportsCount: reports.length,
      }));
      
      return true;
    } catch (error) {
      console.error('Save offline report error:', error);
      return false;
    }
  }, []);

  const syncOfflineData = useCallback(async (): Promise<void> => {
    try {
      const offlineReports = await AsyncStorage.getItem('offline_reports');
      if (offlineReports) {
        const reports = JSON.parse(offlineReports);
        // 这里可以添加实际的同步逻辑
        console.log('Syncing offline reports:', reports);
        
        // 同步成功后清除离线数据
        await AsyncStorage.removeItem('offline_reports');
        setOfflineStats(prev => ({
          ...prev,
          offlineReportsCount: 0,
        }));
      }
    } catch (error) {
      console.error('Sync offline data error:', error);
      throw error;
    }
  }, []);

  const clearOfflineData = useCallback(async (): Promise<boolean> => {
    try {
      await AsyncStorage.multiRemove(['offline_reports', 'cached_work_orders']);
      setOfflineStats({
        workOrdersCount: 0,
        offlineReportsCount: 0,
        cachedPhotosCount: 0,
        totalStorageSize: '0 B',
      });
      return true;
    } catch (error) {
      console.error('Clear offline data error:', error);
      return false;
    }
  }, []);

  // 新增API方法
  const loginWithBackend = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await AuthService.login(username, password);
      
      if (result.success && result.data) {
        setIsLoggedIn(true);
        // 使用数据适配器转换用户数据格式
        const adaptedUser = NewDataAdapter.adaptUser(result.data.user);
        setCurrentUser(adaptedUser);
        
        // 登录成功后注册设备到后端
        if (result.data.token) {
          try {
            console.log('[AppContext] 登录成功，开始注册设备到后端...');
            const registered = await JPushService.registerDeviceToBackend(result.data.token);
            if (registered) {
              console.log('[AppContext] 设备注册成功');
            } else {
              console.log('[AppContext] 设备注册失败，但不影响登录');
            }
          } catch (error) {
            console.error('[AppContext] 设备注册异常:', error);
            // 设备注册失败不影响登录流程
          }
        }
        
        return true;
      } else {
        // 处理登录失败
        if (username) {
          await AuthService.handleLoginFailure(username);
        }
        setError(new Error(result.error || '登录失败'));
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 登出方法
  const logoutUser = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const result = await AuthService.logout();
      
      if (result.success) {
        // 清空状态
        setIsLoggedIn(false);
        setCurrentUser(null);
        setWorkOrders([]);
        setDashboardStats(null);
        setLoginForm({ username: '', password: '' });
        
        // 清空本地存储
        await AsyncStorage.multiRemove(['currentUser', 'user_settings']);
        
        console.log('[AppContext] User logged out successfully');
        return true;
      } else {
        setError(new Error(result.error || '登出失败'));
        return false;
      }
    } catch (error) {
      console.error('Logout error:', error);
      setError(error as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWorkOrdersFromBackend = useCallback(async (filters: any = {}): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 构建筛选参数
      const filterParams: any = {
        page: filters.page || 1,
        limit: filters.limit || 50,
        ...filters
      };
      
      // 根据角色权限添加过滤条件
      const userRoleCode = currentUser?.role_code || currentUser?.role;
      if (userRoleCode) {
        const dataScope = getRoleDataScope(userRoleCode);
        
        
        // 根据数据访问范围设置过滤条件
        // 注意：对于 R006 区域主管，不需要设置任何过滤参数，后端会自动按 area_id 过滤
        if (userRoleCode === 'R006' || userRoleCode === 'MAINTENANCE_SUPERVISOR') {
          // R006 区域主管 - 后端会自动过滤其管理区域的工单
          // 不设置任何过滤参数
        } else {
          switch (dataScope) {
            case 'assigned':
              // 只看分配给自己的工单
              filterParams.assignee_id = currentUser.id;
              break;
            case 'department':
              // 只看自己部门的工单
              if (currentUser.department_id) {
                filterParams.department_id = currentUser.department_id;
              }
              break;
            case 'area':
              // 只看自己区域的工单（其他角色）
              if (currentUser.area_id) {
                filterParams.area_id = currentUser.area_id;
              } else {
                console.warn('[AppContext] 角色需要区域过滤但用户没有area_id');
              }
              break;
            case 'all':
              // 可以看所有工单，不添加过滤条件
              break;
          }
        }
        
        // 检查是否有查看工单权限
        if (!hasPermission(userRoleCode, PERMISSIONS.WORKORDER_VIEW)) {
          console.warn('[AppContext] 用户没有查看工单权限');
          // 返回空数组
          filterParams.limit = 0;
        }
      } else {
        // 如果没有角色信息，默认只看分配给自己的
        console.warn('[AppContext] 用户没有角色信息，默认只显示分配给自己的工单');
        filterParams.assignee_id = currentUser?.id;
      }
      
      // 如果有状态筛选，需要转换为后端格式
      if (workOrderFilter !== 'all') {
        // 中文状态 -> 英文状态映射
        const statusMapping: { [key: string]: string } = {
          '待接收': 'assigned',
          '待分配': 'pending',
          '已分配': 'assigned', 
          '处理中': 'processing',
          '待审核': 'pending_review',
          '已完成': 'completed',
          '已取消': 'cancelled'
        };
        filterParams.status = statusMapping[workOrderFilter] || workOrderFilter;
      }
      
      const result = await SupabaseService.getWorkOrders(filterParams);
      
      
      if (result.success && result.data) {
        // 不使用 NewDataAdapter 转换，保留原始英文状态
        // workorders.tsx 页面会自己处理显示转换
        setWorkOrders(result.data.items);
      } else {
        console.warn('[AppContext] 获取工单失败:', result.error);
        throw new Error(result.error || '获取工单列表失败');
      }
    } catch (error) {
      console.error('Load work orders error:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [workOrderFilter, currentUser]);

  const refreshDashboardStats = useCallback(async (): Promise<void> => {
    try {
      const result = await SupabaseService.getDashboardStats();
      
      if (result.success && result.data) {
        // 使用数据适配器转换统计数据格式
        const adaptedStats = NewDataAdapter.adaptDashboardStats(result.data);
        setDashboardStats(adaptedStats);
      } else {
        console.warn('获取仪表板统计失败:', result.error);
      }
    } catch (error) {
      console.error('Refresh dashboard stats error:', error);
    }
  }, []);

  const uploadFile = useCallback(async (fileUri: string, type: string = 'problem_report', relatedId?: string): Promise<string | null> => {
    try {
      setIsLoading(true);
      
      // 创建 FormData
      const formData = new FormData();
      
      // 从本地文件URI创建文件对象
      const fileInfo = {
        uri: fileUri,
        type: 'image/jpeg', // 默认类型，可以根据文件扩展名动态设置
        name: `photo_${Date.now()}.jpg` // 生成文件名
      };
      
      // 将文件添加到FormData
      formData.append('file', fileInfo as any);
      
      // 调用统一的上传接口
      const response = await fetch('https://u.chengyishi.com/upload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.url) {
        console.log('文件上传成功:', result.data.url);
        return result.data.url;
      } else {
        throw new Error(result.message || '文件上传失败');
      }
    } catch (error) {
      console.error('Upload file error:', error);
      setError(error as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitReport = useCallback(async (reportData: any): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 如果离线，保存到本地
      if (isOfflineMode) {
        const success = await saveOfflineReport(reportData);
        return success;
      }
      
      // 在线模式，通过Next.js API提交
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('未登录');
      }

      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/app-problem-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reportData)
      });

      const result = await response.json();
      
      if (result.success) {
        // 刷新工单列表
        await loadWorkOrdersFromBackend();
        return true;
      } else {
        throw new Error(result.error || '提交报告失败');
      }
    } catch (error) {
      console.error('Submit report error:', error);
      setError(error as Error);
      
      // 如果在线提交失败，尝试保存到本地
      try {
        const success = await saveOfflineReport(reportData);
        if (success) {
          console.log('在线提交失败，已保存到本地');
        }
        return success;
      } catch (localError) {
        console.error('保存到本地也失败:', localError);
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  }, [saveOfflineReport, isOfflineMode, loadWorkOrdersFromBackend]);

  const updateWorkOrderStatus = useCallback(async (workOrderId: string, action: string, note?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 构建参数
      const params: any = {};
      const currentUserId = currentUser?.id;
      
      if (!currentUserId) {
        throw new Error('用户未登录');
      }
      
      switch(action) {
        case 'assign':
          params.assignee_id = currentUserId;
          params.assigner_id = currentUserId;
          break;
        case 'start':
          params.processor_id = currentUserId;
          break;
        case 'complete':
          params.processor_id = currentUserId;
          params.process_method = note || '处理完成';
          params.process_result = '已解决';
          break;
        case 'review':
          params.reviewer_id = currentUserId;
          params.review_note = note;
          break;
        case 'reject':
          params.reviewer_id = currentUserId;
          params.rejection_reason = note;
          break;
      }
      
      const updateData = { ...params };
      const result = await SupabaseService.updateWorkOrderStatus(workOrderId, action, updateData);
      
      if (result.success) {
        // 重新加载工单列表以获取最新状态
        await loadWorkOrdersFromBackend();
        
        // 刷新统计数据
        refreshUserStats();
        
        return true;
      } else {
        throw new Error(result.error || '更新工单状态失败');
      }
    } catch (error) {
      console.error('Update work order status error:', error);
      setError(error as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, loadWorkOrdersFromBackend]);

  // 通知和消息相关方法
  const getMessages = useCallback(async (): Promise<EnhancedMessage[]> => {
    try {
      const messages = await EnhancedNotificationService.getMessages();
      setMessages(messages);
      return messages;
    } catch (error) {
      console.error('Get messages error:', error);
      return [];
    }
  }, []);

  const getUnreadMessages = useCallback(async (): Promise<EnhancedMessage[]> => {
    try {
      const unreadMessages = await EnhancedNotificationService.getUnreadMessages();
      const count = await EnhancedNotificationService.getUnreadCount();
      setUnreadCount(count);
      return unreadMessages;
    } catch (error) {
      console.error('Get unread messages error:', error);
      return [];
    }
  }, []);

  const markMessageAsRead = useCallback(async (messageIds: string[]): Promise<boolean> => {
    try {
      const result = await EnhancedNotificationService.markAsRead(messageIds);
      if (result) {
        // 更新本地状态
        const updatedMessages = await EnhancedNotificationService.getMessages();
        const newUnreadCount = await EnhancedNotificationService.getUnreadCount();
        setMessages(updatedMessages);
        setUnreadCount(newUnreadCount);
      }
      return result;
    } catch (error) {
      console.error('Mark message as read error:', error);
      return false;
    }
  }, []);

  const syncMessages = useCallback(async (): Promise<boolean> => {
    try {
      const result = await EnhancedNotificationService.syncMessagesFromServer();
      if (result) {
        // 更新本地状态
        const updatedMessages = await EnhancedNotificationService.getMessages();
        const newUnreadCount = await EnhancedNotificationService.getUnreadCount();
        setMessages(updatedMessages);
        setUnreadCount(newUnreadCount);
      }
      return result;
    } catch (error) {
      console.error('Sync messages error:', error);
      return false;
    }
  }, []);

  // 刷新用户统计数据
  const refreshUserStats = useCallback(() => {
    setStatsRefreshTrigger(prev => prev + 1);
  }, []);
  
  // 推送相关方法
  const loadPushConfig = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('app-auth-token');
      if (!token) return;
      
      const response = await fetch(`${SUPABASE_URL}/api/app-push-config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        setPushConfig(result.data.config);
      }
    } catch (error) {
      console.error('加载推送配置失败:', error);
    }
  }, []);
  
  const savePushConfig = useCallback(async (config: any): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('app-auth-token');
      if (!token) return false;
      
      const response = await fetch(`${SUPABASE_URL}/api/app-push-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        setPushConfig(config);
        return true;
      }
      return false;
    } catch (error) {
      console.error('保存推送配置失败:', error);
      return false;
    }
  }, []);
  
  const testPushNotification = useCallback(async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('app-auth-token');
      if (!token) return false;
      
      const response = await fetch(`${SUPABASE_URL}/api/app-push-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: '测试推送',
          content: '这是一条测试推送消息',
        }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('测试推送失败:', error);
      return false;
    }
  }, []);
  
  const handleRemotePushNotification = useCallback((notification: any) => {
    console.log('[AppContext] 收到远程推送:', notification);
    
    // 根据推送类型更新相应的数据
    const extras = notification.extras || {};
    const { type, target_id } = extras;
    
    switch (type) {
      case 'workorder':
        // 刷新工单列表
        loadWorkOrdersFromBackend();
        break;
      case 'notification':
        // 刷新通知列表
        syncMessages();
        break;
      default:
        break;
    }
  }, [loadWorkOrdersFromBackend, syncMessages]);
  
  const handlePushNotificationOpen = useCallback((notification: any) => {
    console.log('[AppContext] 打开推送通知:', notification);
    
    // 处理通知点击事件，可以导航到对应页面
    const extras = notification.extras || {};
    const { type, target_id } = extras;
    
    // TODO: 实现页面导航逻辑
    switch (type) {
      case 'workorder':
        // 导航到工单详情页
        if (target_id) {
          // navigation.navigate('WorkOrderDetail', { id: target_id });
        }
        break;
      case 'notification':
        // 导航到通知列表
        // navigation.navigate('Notifications');
        break;
      default:
        break;
    }
  }, []);

  // 在登录成功后加载消息和工单数据
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      // 加载工单和统计数据
      loadWorkOrdersFromBackend();
      refreshDashboardStats();
      
      // 加载消息
      getMessages();
      getUnreadMessages();
      
      // 加载推送配置
      loadPushConfig();
      
      // 注册推送监听
      const unsubscribeNotification = JPushService.addNotificationListener(handleRemotePushNotification);
      const unsubscribeOpen = JPushService.addLocalNotificationListener(handlePushNotificationOpen);
      
      // 设置定期同步
      const syncInterval = setInterval(syncMessages, 30000); // 每30秒同步一次
      
      return () => {
        clearInterval(syncInterval);
        unsubscribeNotification();
        unsubscribeOpen();
      };
    }
  }, [isLoggedIn, currentUser, loadWorkOrdersFromBackend, refreshDashboardStats, getMessages, getUnreadMessages, syncMessages, loadPushConfig, handleRemotePushNotification, handlePushNotificationOpen]);

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsInitializing(true);
        console.log('[AppContext] 开始初始化应用...');
        
        // 设置初始化超时
        const initTimeout = setTimeout(() => {
          console.error('[AppContext] 初始化超时，强制完成');
          setIsInitializing(false);
        }, 10000); // 10秒超时
        
        try {
          // 初始化问题分类服务（设置超时）
          await Promise.race([
            ProblemCategoryService.initialize(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('问题分类服务初始化超时')), 3000))
          ]);
          console.log('[AppContext] 问题分类服务初始化完成');
        } catch (error) {
          console.warn('[AppContext] 问题分类服务初始化失败，继续运行:', error);
        }
        
        try {
          // 初始化通知服务（设置超时）
          const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
          await Promise.race([
            EnhancedNotificationService.initialize(SUPABASE_URL, SUPABASE_ANON_KEY),
            new Promise((_, reject) => setTimeout(() => reject(new Error('通知服务初始化超时')), 3000))
          ]);
          console.log('[AppContext] 通知服务初始化完成');
        } catch (error) {
          console.warn('[AppContext] 通知服务初始化失败，继续运行:', error);
        }
        
        // 尝试恢复登录状态（不等待，避免阻塞）
        AuthService.isAuthenticated().then(async (isAuthenticated) => {
          if (isAuthenticated) {
            const currentUserData = await AuthService.getCurrentUser();
            if (currentUserData) {
              console.log('[AppContext] 用户信息恢复成功，设置登录状态');
              setIsLoggedIn(true);
              const adaptedUser = NewDataAdapter.adaptUser(currentUserData);
              setCurrentUser(adaptedUser);
            }
          } else {
            console.log('[AppContext] 无有效会话，保持未登录状态');
            setIsLoggedIn(false);
            setCurrentUser(null);
          }
        }).catch((error) => {
          console.warn('[AppContext] 恢复登录状态失败:', error);
          setIsLoggedIn(false);
          setCurrentUser(null);
        });
        
        // 加载用户设置（异步，不阻塞）
        AsyncStorage.getItem('user_settings').then((savedSettings) => {
          if (savedSettings) {
            setUserSettings(JSON.parse(savedSettings));
          }
        }).catch((error) => {
          console.warn('[AppContext] 加载用户设置失败:', error);
        });
        
        // 更新离线统计（异步，不阻塞）
        AsyncStorage.getItem('offline_reports').then((offlineReports) => {
          const reports = offlineReports ? JSON.parse(offlineReports) : [];
          setOfflineStats(prev => ({
            ...prev,
            offlineReportsCount: reports.length,
            workOrdersCount: 0,
          }));
        }).catch((error) => {
          console.warn('[AppContext] 加载离线统计失败:', error);
        });
        
        // 清除超时计时器
        clearTimeout(initTimeout);
        console.log('[AppContext] 应用初始化完成');
      } catch (error) {
        console.error('[AppContext] 初始化错误:', error);
        setError(error as Error);
      } finally {
        // 确保初始化状态被清除
        setTimeout(() => {
          setIsInitializing(false);
        }, 500);
      }
    };

    initializeData();
  }, []); // 只在组件挂载时运行一次
  
  // 单独的effect用于在登录后加载数据
  useEffect(() => {
    if (isLoggedIn && currentUser && !isInitializing) {
      console.log('[AppContext] 用户已登录，开始加载数据...');
      // 延迟加载，避免初始化时的竞争条件
      const loadInitialData = async () => {
        try {
          await Promise.all([
            loadWorkOrdersFromBackend(),
            refreshDashboardStats()
          ]);
          console.log('[AppContext] 初始数据加载完成');
        } catch (error) {
          console.warn('[AppContext] 加载初始数据失败，但不影响登录状态:', error);
        }
      };
      
      const timer = setTimeout(loadInitialData, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, currentUser, isInitializing]); // 依赖登录状态和用户信息

  const contextValue = useMemo(() => ({
    // 加载和错误状态
    isLoading,
    setIsLoading,
    isInitializing,
    error,
    setError,

    // 登录表单
    loginForm,
    setLoginForm,
    showPassword,
    setShowPassword,
    isLoggedIn,
    setIsLoggedIn,

    // 用户信息
    currentUser,
    setCurrentUser,

    // 工单相关
    workOrders,
    setWorkOrders,
    selectedWorkOrder,
    setSelectedWorkOrder,
    workOrderFilter,
    setWorkOrderFilter,

    // 上报相关
    reportStep,
    setReportStep,
    selectedCategory,
    setSelectedCategory,
    reportForm,
    setReportForm,

    // 处理结果
    processResult,
    setProcessResult,

    // 用户设置和离线存储
    userSettings,
    setUserSettings,
    offlineStats,
    setOfflineStats,
    isOfflineMode,
    setIsOfflineMode,

    // 离线操作方法
    saveOfflineReport,
    syncOfflineData,
    clearOfflineData,

    // 新增API方法
    loginWithBackend,
    logoutUser,
    loadWorkOrdersFromBackend,
    refreshDashboardStats,
    uploadFile,
    submitReport,
    updateWorkOrderStatus,
    
    // 统计数据刷新
    refreshUserStats,
    statsRefreshTrigger,
    
    // 仪表板统计数据
    dashboardStats,
    setDashboardStats,
    
    // 通知和消息
    messages,
    unreadCount,
    getMessages,
    getUnreadMessages,
    markMessageAsRead,
    syncMessages,
    
    // 推送相关
    pushConfig,
    setPushConfig,
    loadPushConfig,
    savePushConfig,
    testPushNotification,
    handleRemotePushNotification,
    handlePushNotificationOpen,
  }), [
    isLoading, isInitializing, error, loginForm, showPassword, isLoggedIn, currentUser,
    workOrders, selectedWorkOrder, workOrderFilter,
    reportStep, selectedCategory, reportForm, processResult,
    userSettings, offlineStats, isOfflineMode,
    saveOfflineReport, syncOfflineData, clearOfflineData,
    loginWithBackend, logoutUser, loadWorkOrdersFromBackend, refreshDashboardStats,
    uploadFile, submitReport, updateWorkOrderStatus,
    refreshUserStats, statsRefreshTrigger,
    dashboardStats, messages, unreadCount, getMessages, getUnreadMessages, markMessageAsRead, syncMessages,
    pushConfig, loadPushConfig, savePushConfig, testPushNotification, handleRemotePushNotification, handlePushNotificationOpen
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}