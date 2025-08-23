import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Safe Area 配置常量
 */
export const SAFE_AREA_CONFIG = {
  // 最小安全区域值
  MIN_TOP: Platform.OS === 'ios' ? 44 : 24,
  MIN_BOTTOM: Platform.OS === 'ios' ? 34 : 16,
  
  // Tab Bar 高度
  TAB_BAR_HEIGHT: 64,
  
  // Header 高度
  HEADER_HEIGHT: 56,
  
  // 状态栏高度
  STATUS_BAR_HEIGHT: Platform.OS === 'ios' ? 44 : 24,
};

/**
 * 获取安全区域值的工具函数
 */
export const useSafeAreaValues = () => {
  const insets = useSafeAreaInsets();
  
  return {
    // 原始安全区域值
    insets,
    
    // 计算后的安全区域值
    safeTop: Math.max(insets.top, SAFE_AREA_CONFIG.MIN_TOP),
    safeBottom: Math.max(insets.bottom, SAFE_AREA_CONFIG.MIN_BOTTOM),
    safeLeft: insets.left,
    safeRight: insets.right,
    
    // Tab Bar 相关
    tabBarHeight: SAFE_AREA_CONFIG.TAB_BAR_HEIGHT + Math.max(insets.bottom, SAFE_AREA_CONFIG.MIN_BOTTOM),
    tabBarPadding: Math.max(insets.bottom, 8),
    
    // 内容区域的 padding
    contentPaddingTop: Math.max(insets.top, SAFE_AREA_CONFIG.MIN_TOP),
    contentPaddingBottom: Math.max(insets.bottom + SAFE_AREA_CONFIG.TAB_BAR_HEIGHT, 100),
    
    // Header 高度（包含状态栏）
    headerHeight: SAFE_AREA_CONFIG.HEADER_HEIGHT + Math.max(insets.top, SAFE_AREA_CONFIG.MIN_TOP),
    
    // 是否有刘海屏或灵动岛
    hasNotch: insets.top > SAFE_AREA_CONFIG.MIN_TOP,
    
    // 是否有 Home Indicator
    hasHomeIndicator: insets.bottom > 0,
  };
};

/**
 * 设备适配配置
 */
export const DEVICE_CONFIG = {
  // iPhone X 系列特征
  isIPhoneX: (insets: any) => Platform.OS === 'ios' && insets.top >= 44,
  
  // Android 刘海屏特征
  hasAndroidNotch: (insets: any) => Platform.OS === 'android' && insets.top > 24,
  
  // 底部安全区域特征
  hasBottomSafeArea: (insets: any) => insets.bottom > 0,
};

/**
 * 常用的 Safe Area 样式
 */
export const createSafeAreaStyles = () => {
  const { safeTop, safeBottom, tabBarHeight, contentPaddingBottom } = useSafeAreaValues();
  
  return {
    // 容器样式
    safeContainer: {
      flex: 1,
      paddingTop: safeTop,
    },
    
    // 内容区域样式
    safeContent: {
      flex: 1,
      paddingBottom: contentPaddingBottom,
    },
    
    // Tab Bar 样式
    safeTabBar: {
      height: tabBarHeight,
      paddingBottom: safeBottom,
    },
    
    // Header 样式
    safeHeader: {
      paddingTop: safeTop,
      height: 56 + safeTop,
    },
    
    // 全屏模态样式
    safeModal: {
      flex: 1,
      paddingTop: safeTop,
      paddingBottom: safeBottom,
    },
  };
};