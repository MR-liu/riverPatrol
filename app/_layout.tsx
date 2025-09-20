import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AppProvider } from '@/contexts/AppContext';
import { ToastContainer } from '@/components/CustomToast';
import JPushService from '@/utils/JPushService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // 初始化极光推送
    initJPush();
  }, []);

  const initJPush = async () => {
    try {
      console.log('[App] 初始化极光推送...');
      await JPushService.initialize();
      
      // 添加通知监听
      JPushService.addNotificationListener((notification) => {
        console.log('[App] 收到推送通知:', notification);
        // 可以在这里显示应用内提示
      });

      // 添加通知打开监听
      JPushService.addLocalNotificationListener((notification) => {
        console.log('[App] 用户点击了通知:', notification);
        // 处理通知点击后的跳转逻辑
      });
      
      console.log('[App] 极光推送初始化完成');
    } catch (error) {
      console.error('[App] 极光推送初始化失败:', error);
    }
  };

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="workorder-detail" options={{ headerShown: false }} />
            <Stack.Screen name="enhanced-workorder-detail" options={{ headerShown: false }} />
            <Stack.Screen name="process-result" options={{ headerShown: false }} />
            <Stack.Screen name="statistics" options={{ headerShown: false }} />
            <Stack.Screen name="enhanced-statistics" options={{ headerShown: false }} />
            <Stack.Screen name="data-export" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="enhanced-settings" options={{ headerShown: false }} />
            <Stack.Screen name="messages" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-settings" options={{ headerShown: false }} />
            <Stack.Screen name="attendance" options={{ headerShown: false }} />
            <Stack.Screen name="attendance-records" options={{ headerShown: false }} />
            <Stack.Screen name="help-center" options={{ headerShown: false }} />
            <Stack.Screen name="feedback" options={{ headerShown: false }} />
            <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
            <Stack.Screen name="account-security" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
          <ToastContainer />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
