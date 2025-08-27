import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAppContext } from '@/contexts/AppContext';

export default function Index() {
  const { isLoggedIn, isInitializing } = useAppContext();

  useEffect(() => {
    // 等待初始化完成后再决定导航到哪里
    if (!isInitializing) {
      if (isLoggedIn) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoggedIn, isInitializing]);

  // 这个组件不会被渲染，只是用于路由决策
  return null;
}