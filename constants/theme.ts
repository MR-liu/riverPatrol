export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    background: string;
    surface: string;
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    borderLight: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    headerBackground: string;
    headerText: string;
    tabBarBackground: string;
    tabBarActive: string;
    tabBarInactive: string;
    inputBackground: string;
    inputBorder: string;
    inputText: string;
    inputPlaceholder: string;
    buttonPrimary: string;
    buttonPrimaryText: string;
    buttonSecondary: string;
    buttonSecondaryText: string;
    modalBackground: string;
    modalOverlay: string;
    gradientStart: string;
    gradientMiddle: string;
    gradientEnd: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  shadows: {
    sm: any;
    md: any;
    lg: any;
  };
}

export const lightTheme: Theme = {
  colors: {
    primary: '#3B82F6',
    primaryDark: '#1E40AF',
    primaryLight: '#93C5FD',
    secondary: '#10B981',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: 'rgba(255, 255, 255, 0.95)',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    info: '#3B82F6',
    headerBackground: '#3B82F6',
    headerText: '#FFFFFF',
    tabBarBackground: '#FFFFFF',
    tabBarActive: '#3B82F6',
    tabBarInactive: '#9CA3AF',
    inputBackground: '#FFFFFF',
    inputBorder: '#E5E7EB',
    inputText: '#1F2937',
    inputPlaceholder: '#9CA3AF',
    buttonPrimary: '#3B82F6',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#F3F4F6',
    buttonSecondaryText: '#6B7280',
    modalBackground: '#FFFFFF',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    gradientStart: '#F8FAFC',
    gradientMiddle: '#EBF4FF',
    gradientEnd: '#E0E7FF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export const darkTheme: Theme = {
  colors: {
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    primaryLight: '#1E40AF',
    secondary: '#34D399',
    background: '#0F172A',
    surface: '#1E293B',
    card: 'rgba(30, 41, 59, 0.95)',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    border: '#334155',
    borderLight: '#1E293B',
    error: '#F87171',
    warning: '#FBBF24',
    success: '#34D399',
    info: '#60A5FA',
    headerBackground: '#1E293B',
    headerText: '#F1F5F9',
    tabBarBackground: '#1E293B',
    tabBarActive: '#60A5FA',
    tabBarInactive: '#64748B',
    inputBackground: '#1E293B',
    inputBorder: '#334155',
    inputText: '#F1F5F9',
    inputPlaceholder: '#64748B',
    buttonPrimary: '#3B82F6',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#334155',
    buttonSecondaryText: '#CBD5E1',
    modalBackground: '#1E293B',
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    gradientStart: '#1E293B',
    gradientMiddle: '#1E3A5F',
    gradientEnd: '#1E40AF',
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  fontSize: lightTheme.fontSize,
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export const getTheme = (isDark: boolean): Theme => {
  return isDark ? darkTheme : lightTheme;
};

// 字体大小映射
export const getFontSizeMultiplier = (size: 'small' | 'medium' | 'large'): number => {
  switch (size) {
    case 'small': return 0.9;
    case 'large': return 1.1;
    default: return 1;
  }
};

// 应用字体大小
export const applyFontSize = (baseSize: number, userFontSize: 'small' | 'medium' | 'large'): number => {
  return Math.round(baseSize * getFontSizeMultiplier(userFontSize));
};