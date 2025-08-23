import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAppContext } from '@/contexts/AppContext';

export default function Index() {
  const { isLoggedIn } = useAppContext();

  useEffect(() => {
    // 根据登录状态决定导航到哪里
    if (isLoggedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoggedIn]);

  // 这个组件不会被渲染，只是用于路由决策
  return null;
}