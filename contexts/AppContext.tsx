import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  error: Error | null;
  setError: (error: Error | null) => void;

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loginForm, setLoginForm] = useState({
    username: 'P001',
    password: '123456',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [reportStep, setReportStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workOrderFilter, setWorkOrderFilter] = useState('all');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  // 工单数据
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    {
      id: 'WO001',
      title: '河道垃圾堆积问题',
      location: '金沙江大桥下游200米',
      status: '待接收',
      priority: '紧急',
      time: '2小时前',
      type: 'M08001', // 河边环境-垃圾堆积
      description: '河道内发现大量生活垃圾堆积，影响水质和环境卫生。',
      reporter: '市民张三',
      contact: '138****1234',
    },
    {
      id: 'WO002',
      title: '护栏损坏需要维修',
      location: '滨江路段护栏',
      status: '处理中',
      priority: '普通',
      time: '1天前',
      type: 'M03001', // 河道护栏-损坏
      description: '护栏部分损坏，存在安全隐患，需要及时维修。',
      reporter: '巡查员李四',
      contact: '139****5678',
    },
    {
      id: 'WO003',
      title: '河面漂浮垃圾清理',
      location: '中山桥至解放桥段',
      status: '待接收',
      priority: '普通',
      time: '3小时前',
      type: 'M07001', // 河面环境-成片漂浮垃圾
      description: '河面发现成片漂浮垃圾，主要为塑料袋、饮料瓶等生活垃圾。',
      reporter: '环保志愿者王五',
      contact: '186****9012',
    },
    {
      id: 'WO004',
      title: '绿化带树木枯死',
      location: '滨河公园东段',
      status: '已完成',
      priority: '普通',
      time: '2天前',
      type: 'M02003', // 河道绿化-树木缺失、枯死
      description: '绿化带内有多棵树木出现枯死现象，需要及时清理和补种。',
      reporter: '公园管理员',
      contact: '159****3456',
    },
    {
      id: 'WO005',
      title: '违章搭建临时建筑',
      location: '河岸边停车场附近',
      status: '待审核',
      priority: '紧急',
      time: '4小时前',
      type: 'S01001', // 违法侵占河道-违章搭建
      description: '发现有人在河道管理范围内违章搭建临时建筑，占用河道空间。',
      reporter: '市民举报',
      contact: '177****7890',
    },
  ]);

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

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        
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
        setIsLoading(false);
      }
    };

    initializeData();
  }, []); // 只在组件挂载时运行一次

  const contextValue = useMemo(() => ({
    // 加载和错误状态
    isLoading,
    setIsLoading,
    error,
    setError,

    // 登录表单
    loginForm,
    setLoginForm,
    showPassword,
    setShowPassword,
    isLoggedIn,
    setIsLoggedIn,

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
  }), [
    isLoading, error, loginForm, showPassword, isLoggedIn,
    workOrders, selectedWorkOrder, workOrderFilter,
    reportStep, selectedCategory, reportForm, processResult,
    userSettings, offlineStats, isOfflineMode,
    saveOfflineReport, syncOfflineData, clearOfflineData
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