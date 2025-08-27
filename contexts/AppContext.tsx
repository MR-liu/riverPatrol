import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '@/utils/ApiService';
import EnhancedProblemCategoryService from '@/utils/EnhancedProblemCategoryService';
import EnhancedNotificationService, { EnhancedMessage } from '@/utils/EnhancedNotificationService';

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
      
      const result = await ApiService.login(username, password);
      
      if (result.success && result.data) {
        setIsLoggedIn(true);
        setCurrentUser(result.data.user); // 设置当前用户信息
        // 登录成功后初始化其他服务
        await Promise.all([
          loadWorkOrdersFromBackend(),
          refreshDashboardStats()
        ]);
        return true;
      } else {
        setError(new Error(result.message || '登录失败'));
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

  const loadWorkOrdersFromBackend = useCallback(async (filters: any = {}): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 构建筛选参数，处理状态映射
      const filterParams: any = {
        page: 1,
        size: 50,
        ...filters
      };
      
      // 如果有状态筛选，需要转换为后端格式
      if (workOrderFilter !== 'all') {
        // 中文状态 -> 英文状态映射
        const statusMapping: { [key: string]: string } = {
          '待接收': 'pending',
          '已分配': 'assigned', 
          '处理中': 'processing',
          '待审核': 'pending_review',
          '已完成': 'completed',
          '已取消': 'cancelled'
        };
        filterParams.status = statusMapping[workOrderFilter] || workOrderFilter;
      }
      
      const result = await ApiService.getWorkOrders(filterParams);
      
      if (result.success && result.data) {
        setWorkOrders(result.data.items);
      } else {
        throw new Error(result.message || '获取工单列表失败');
      }
    } catch (error) {
      console.error('Load work orders error:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [workOrderFilter]);

  const refreshDashboardStats = useCallback(async (): Promise<void> => {
    try {
      const result = await ApiService.getDashboardStats();
      
      if (result.success && result.data) {
        setDashboardStats(result.data);
      } else {
        console.warn('获取仪表板统计失败:', result.message);
      }
    } catch (error) {
      console.error('Refresh dashboard stats error:', error);
    }
  }, []);

  const uploadFile = useCallback(async (file: any, type: string, relatedId?: string): Promise<string | null> => {
    try {
      setIsLoading(true);
      
      const result = await ApiService.uploadFile(file, type as any, relatedId);
      
      if (result.success && result.data) {
        return result.data.file_url;
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
      
      // 这里需要调用submit-report接口，暂时使用现有的saveOfflineReport
      const success = await saveOfflineReport(reportData);
      
      if (success) {
        // 如果在线，尝试同步到后端
        if (!isOfflineMode) {
          try {
            // TODO: 调用后端submit-report接口
            console.log('提交报告到后端:', reportData);
          } catch (error) {
            console.warn('同步报告到后端失败:', error);
          }
        }
      }
      
      return success;
    } catch (error) {
      console.error('Submit report error:', error);
      setError(error as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveOfflineReport, isOfflineMode]);

  const updateWorkOrderStatus = useCallback(async (workOrderId: string, action: string, note?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await ApiService.updateWorkOrderStatus(workOrderId, action as any, note);
      
      if (result.success) {
        // 更新本地工单状态
        setWorkOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === workOrderId 
              ? { ...order, status: result.data?.new_status || order.status }
              : order
          )
        );
        
        // 刷新统计数据
        refreshUserStats();
        
        return true;
      } else {
        throw new Error(result.message || '更新工单状态失败');
      }
    } catch (error) {
      console.error('Update work order status error:', error);
      setError(error as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // 在登录成功后加载消息
  useEffect(() => {
    if (isLoggedIn) {
      getMessages();
      getUnreadMessages();
      
      // 设置定期同步
      const syncInterval = setInterval(syncMessages, 30000); // 每30秒同步一次
      
      return () => clearInterval(syncInterval);
    }
  }, [isLoggedIn, getMessages, getUnreadMessages, syncMessages]);

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsInitializing(true);
        
        // 初始化API服务
        ApiService.initialize(SUPABASE_URL);
        
        // 初始化问题分类服务
        await EnhancedProblemCategoryService.initialize(SUPABASE_URL);
        
        // 初始化通知服务
        const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
        await EnhancedNotificationService.initialize(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // 尝试恢复登录状态
        const restored = await ApiService.restoreTokensFromStorage();
        if (restored) {
          setIsLoggedIn(true);
          // 恢复用户信息
          const userInfo = await ApiService.getCurrentUser();
          if (userInfo) {
            setCurrentUser(userInfo);
          }
          // 如果已登录，加载数据
          await Promise.all([
            loadWorkOrdersFromBackend(),
            refreshDashboardStats()
          ]);
        }
        
        // 加载用户设置
        const savedSettings = await AsyncStorage.getItem('user_settings');
        if (savedSettings) {
          setUserSettings(JSON.parse(savedSettings));
        }
        
        // 更新离线统计
        const offlineReports = await AsyncStorage.getItem('offline_reports');
        const reports = offlineReports ? JSON.parse(offlineReports) : [];
        
        setOfflineStats(prev => ({
          ...prev,
          offlineReportsCount: reports.length,
          workOrdersCount: workOrders.length,
        }));
      } catch (error) {
        console.error('Initialize data error:', error);
        setError(error as Error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeData();
  }, []); // 只在组件挂载时运行一次

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
  }), [
    isLoading, isInitializing, error, loginForm, showPassword, isLoggedIn, currentUser,
    workOrders, selectedWorkOrder, workOrderFilter,
    reportStep, selectedCategory, reportForm, processResult,
    userSettings, offlineStats, isOfflineMode,
    saveOfflineReport, syncOfflineData, clearOfflineData,
    loginWithBackend, loadWorkOrdersFromBackend, refreshDashboardStats,
    uploadFile, submitReport, updateWorkOrderStatus,
    refreshUserStats, statsRefreshTrigger,
    dashboardStats, messages, unreadCount, getMessages, getUnreadMessages, markMessageAsRead, syncMessages
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