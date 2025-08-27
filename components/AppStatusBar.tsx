import React from 'react';
import { StatusBar, Platform } from 'react-native';

interface AppStatusBarProps {
  style?: 'default' | 'light-content' | 'dark-content';
  backgroundColor?: string;
  translucent?: boolean;
  hidden?: boolean;
}

export const AppStatusBar: React.FC<AppStatusBarProps> = ({
  style = 'light-content',
  backgroundColor = 'transparent',
  translucent = true,
  hidden = false,
}) => {
  return (
    <StatusBar
      barStyle={style}
      backgroundColor={backgroundColor}
      translucent={translucent}
      hidden={hidden}
      animated
    />
  );
};

// 预定义的状态栏配置
export const StatusBarConfigs = {
  // 登录页面 - 透明状态栏，让渐变背景延伸到状态栏区域
  login: {
    style: 'light-content' as const,
    backgroundColor: 'transparent',
    translucent: true,
  },
  
  // 首页 - 浅色背景
  home: {
    style: 'dark-content' as const,
    backgroundColor: 'transparent',
    translucent: true,
  },
  
  // 深色页面
  dark: {
    style: 'light-content' as const,
    backgroundColor: '#1F2937',
    translucent: true,
  },
  
  // 透明状态栏
  transparent: {
    style: 'dark-content' as const,
    backgroundColor: 'transparent',
    translucent: true,
  },
};