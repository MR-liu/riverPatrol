import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatusBar, StatusBarConfigs } from '@/components/AppStatusBar';

import { useAppContext } from '@/contexts/AppContext';

export default function LoginScreen() {
  const {
    loginForm,
    setLoginForm,
    showPassword,
    setShowPassword,
    setIsLoggedIn,
    loginWithBackend,
    isLoading,
    error,
    setError,
  } = useAppContext();
  
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState(loginForm.username);
  const [password, setPassword] = useState(loginForm.password);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }

    // 清除之前的错误
    setError(null);
    
    try {
      // 使用后端登录接口
      const success = await loginWithBackend(username, password);
      
      if (success) {
        const loginInfo = { username, password };
        setLoginForm(loginInfo);
        
        // 保存登录信息到本地存储
        await AsyncStorage.setItem('loginInfo', JSON.stringify(loginInfo));
        
        Alert.alert('登录成功', '欢迎使用智慧河道巡查系统', [
          {
            text: '确定',
            onPress: () => router.replace('/(tabs)')
          }
        ]);
      } else {
        // 错误信息已经在loginWithBackend中设置
        const errorMessage = error?.message || '登录失败，请检查用户名和密码';
        Alert.alert('登录失败', errorMessage);
      }
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('登录失败', '网络连接异常，请稍后重试');
    }
  };

  return (
    <LinearGradient
      colors={['#3B82F6', '#1E40AF', '#1E3A8A']}
      style={styles.container}
    >
      <AppStatusBar {...StatusBarConfigs.login} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Logo区域 */}
          <View style={styles.logoContainer}>
            <MaterialIcons name="waves" size={80} color="white" />
            <Text style={styles.title}>智慧河道巡查</Text>
            <Text style={styles.subtitle}>River Patrol System</Text>
          </View>

          {/* 登录表单 */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={24} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="请输入用户名"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="请输入密码"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={24}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loginButtonContent}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={[styles.loginButtonText, { marginLeft: 8 }]}>登录中...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>登录</Text>
              )}
            </TouchableOpacity>

            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>请使用后端配置的用户名和密码登录</Text>
              {error && (
                <Text style={styles.errorText}>{error.message}</Text>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 24,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  helpText: {
    color: '#6B7280',
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});