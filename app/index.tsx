import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
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

  // 显示启动屏幕而不是空白页
  return (
    <LinearGradient
      colors={['#3B82F6', '#1E40AF', '#1E3A8A']}
      style={styles.container}
    >
      <View style={styles.content}>
        <MaterialIcons name="waves" size={80} color="white" />
        <Text style={styles.title}>智慧河道巡查</Text>
        <Text style={styles.subtitle}>River Patrol System</Text>
        <ActivityIndicator size="large" color="white" style={styles.loader} />
        <Text style={styles.loadingText}>正在加载...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
  loader: {
    marginTop: 40,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 16,
    fontSize: 14,
  },
});