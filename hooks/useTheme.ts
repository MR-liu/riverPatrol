import { useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getTheme, applyFontSize, Theme } from '@/constants/theme';

export interface ThemedStyles {
  theme: Theme;
  isDark: boolean;
  fontSize: (base: number) => number;
}

export function useTheme(): ThemedStyles {
  const { userSettings } = useAppContext();
  
  const isDark = useMemo(() => {
    if (userSettings.appearance.theme === 'auto') {
      // 可以根据系统设置自动切换，这里暂时默认使用浅色
      return false;
    }
    return userSettings.appearance.theme === 'dark';
  }, [userSettings.appearance.theme]);
  
  const theme = useMemo(() => {
    return getTheme(isDark);
  }, [isDark]);
  
  const fontSize = useMemo(() => {
    return (base: number) => applyFontSize(base, userSettings.appearance.fontSize);
  }, [userSettings.appearance.fontSize]);
  
  return {
    theme,
    isDark,
    fontSize,
  };
}