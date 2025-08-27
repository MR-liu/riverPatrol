import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatusBar, StatusBarConfigs } from '@/components/AppStatusBar';

import { useAppContext } from '@/contexts/AppContext';
import AttendanceService from '@/utils/AttendanceService';
import ApiService from '@/utils/ApiService';

export default function ProfileScreen() {
  const { setIsLoggedIn, currentUser, workOrders, statsRefreshTrigger } = useAppContext();
  const insets = useSafeAreaInsets();
  const [attendanceStatus, setAttendanceStatus] = useState<'checked_in' | 'checked_out' | 'on_patrol'>('checked_out');
  const [isLoading, setIsLoading] = useState(false);
  const [statsData, setStatsData] = useState({
    completionRate: 0,
    totalWorkOrders: 0,
    punctualityRate: 0,
    averageRating: 0
  });

  useEffect(() => {
    loadAttendanceStatus();
    loadStatsData();
  }, [currentUser, workOrders, statsRefreshTrigger]);

  const loadAttendanceStatus = async () => {
    try {
      const status = await AttendanceService.getCurrentAttendanceStatus(currentUser?.username || '');
      setAttendanceStatus(status);
    } catch (error) {
      console.error('Load attendance status error:', error);
    }
  };

  const loadStatsData = async () => {
    if (!currentUser?.username) return;
    
    try {
      // 获取工单统计
      const completedWorkOrders = workOrders.filter(wo => wo.status === '已完成').length;
      const totalWorkOrders = workOrders.length;
      const completionRate = totalWorkOrders > 0 ? Math.round((completedWorkOrders / totalWorkOrders) * 100) : 0;
      
      // 获取考勤统计
      const attendanceStats = await AttendanceService.getAttendanceStats(currentUser.username);
      const punctualityRate = Math.round(attendanceStats.punctualityRate || 0);
      
      // 基于工单质量的评分计算
      const userRating = calculateUserRating(workOrders, attendanceStats);
      
      setStatsData({
        completionRate,
        totalWorkOrders,
        punctualityRate,
        averageRating: userRating
      });
    } catch (error) {
      console.error('Load stats data error:', error);
    }
  };

  // 基于工单完成质量的评分算法
  const calculateUserRating = (workOrders: any[], attendanceStats: any) => {
    let baseScore = 3.0; // 基础分数
    let qualityBonus = 0;
    let timeBonus = 0;
    let attendanceBonus = 0;

    const completedOrders = workOrders.filter(wo => wo.status === '已完成');
    
    if (completedOrders.length > 0) {
      // 1. 完成率评分 (最高+1.0分)
      const completionRate = completedOrders.length / workOrders.length;
      qualityBonus += completionRate * 1.0;
      
      // 2. 及时完成率评分 (最高+0.5分)
      const onTimeOrders = completedOrders.filter(wo => {
        // 这里需要根据实际的时间字段判断是否按时完成
        // 暂时假设所有已完成的工单都是按时完成的
        return true;
      });
      const onTimeRate = onTimeOrders.length / completedOrders.length;
      timeBonus += onTimeRate * 0.5;
    }
    
    // 3. 考勤评分 (最高+0.5分)
    if (attendanceStats.punctualityRate) {
      attendanceBonus += (attendanceStats.punctualityRate / 100) * 0.5;
    }
    
    const finalRating = Math.min(5.0, baseScore + qualityBonus + timeBonus + attendanceBonus);
    return Math.round(finalRating * 10) / 10; // 保留一位小数
  };

  const handleLogout = () => {
    Alert.alert(
      '退出登录',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            setIsLoggedIn(false);
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleAttendanceAction = async () => {
    try {
      setIsLoading(true);
      
      const checkResult = await AttendanceService.canCheckIn(currentUser?.username || '', 
        attendanceStatus === 'checked_out' ? 'check_in' : 'check_out'
      );
      
      if (!checkResult.allowed) {
        Alert.alert('打卡提示', checkResult.reason || '当前状态不允许打卡');
        return;
      }
      
      let result;
      if (attendanceStatus === 'checked_out') {
        result = await AttendanceService.checkIn(currentUser?.username || '');
      } else {
        result = await AttendanceService.checkOut(currentUser?.username || '');
      }
      
      if (result) {
        const newStatus = await AttendanceService.getCurrentAttendanceStatus(currentUser?.username || '');
        setAttendanceStatus(newStatus);
        
        Alert.alert(
          '打卡成功',
          `${attendanceStatus === 'checked_out' ? '签到' : '签退'}成功！`,
        );
      } else {
        Alert.alert('打卡失败', '请检查GPS定位是否开启');
      }
    } catch (error) {
      console.error('Attendance action error:', error);
      Alert.alert('打卡失败', '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const getAttendanceStatusText = () => {
    switch (attendanceStatus) {
      case 'checked_in':
        return '已签到';
      case 'checked_out':
        return '未签到';
      case 'on_patrol':
        return '巡视中';
      default:
        return '未知';
    }
  };

  const getAttendanceActionText = () => {
    switch (attendanceStatus) {
      case 'checked_out':
        return '签到';
      case 'checked_in':
        return '签退';
      case 'on_patrol':
        return '结束巡视';
      default:
        return '打卡';
    }
  };

  const handleMenuPress = (title: string) => {
    switch (title) {
      case '考勤管理':
        router.push('/attendance');
        break;
      case '数据统计':
        router.push('/enhanced-statistics');
        break;
      case '消息中心':
        router.push('/messages');
        break;
      case '帮助中心':
        router.push('/help-center');
        break;
      case '个性化设置':
        router.push('/enhanced-settings');
        break;
      case '账户安全':
        router.push('/account-security');
        break;
      case '隐私设置':
        router.push('/privacy-settings');
        break;
      case '编辑资料':
        router.push('/profile-edit');
        break;
      case '版本信息':
        Alert.alert('版本信息', '智慧河道巡查系统\n版本：1.0.0\n构建：2024.01.15\n\n© 2024 智慧河道管理团队');
        break;
      case '意见反馈':
        router.push('/feedback');
        break;
      case '个人资料':
        router.push('/profile-edit');
        break;
      case '考勤记录':
        router.push('/attendance-records');
        break;
      default:
        Alert.alert('功能提示', `${title}功能开发中`);
    }
  };

  const renderMenuItem = (icon: string, title: string, subtitle?: string, showArrow = true) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => handleMenuPress(title)}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIcon}>
          <MaterialIcons name={icon as any} size={20} color="#3B82F6" />
        </View>
        <View style={styles.menuItemContent}>
          <Text style={styles.menuItemTitle}>{title}</Text>
          {subtitle && <Text style={styles.menuItemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showArrow && (
        <MaterialIcons name="keyboard-arrow-right" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );

  const renderStatCard = (title: string, value: string, color: string) => (
    <View style={[styles.statCard, { backgroundColor: color + '20' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar {...StatusBarConfigs.transparent} />
      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* 用户信息卡片 */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#3B82F6', '#6366F1', '#8B5CF6']}
              style={styles.profileGradient}
            >
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  <MaterialIcons name="person" size={32} color="#FFFFFF" />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{currentUser?.name || '未知用户'}</Text>
                  <Text style={styles.profileTitle}>河道巡查员</Text>
                  <Text style={styles.profileId}>工号：{currentUser?.username || ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleMenuPress('编辑资料')}
                >
                  <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* 绩效统计 */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>本月绩效</Text>
            <View style={styles.statsGrid}>
              {renderStatCard('完成率', `${statsData.completionRate}%`, '#10B981')}
              {renderStatCard('工单数', `${statsData.totalWorkOrders}`, '#3B82F6')}
              {renderStatCard('准时率', `${statsData.punctualityRate}%`, '#F59E0B')}
              {renderStatCard('评分', `${statsData.averageRating}`, '#8B5CF6')}
            </View>
          </View>

          {/* 考勤状态 */}
          <View style={styles.attendanceSection}>
            <Text style={styles.sectionTitle}>考勤状态</Text>
            <View style={styles.attendanceCard}>
              <View style={styles.attendanceInfo}>
                <Text style={styles.attendanceStatus}>{getAttendanceStatusText()}</Text>
                <Text style={styles.attendanceTime}>
                  今日状态：{new Date().toLocaleDateString('zh-CN', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              <TouchableOpacity 
                style={[
                  styles.attendanceButton,
                  isLoading && styles.attendanceButtonDisabled
                ]}
                onPress={handleAttendanceAction}
                disabled={isLoading}
              >
                <Text style={styles.attendanceButtonText}>
                  {isLoading ? '处理中...' : getAttendanceActionText()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 功能菜单 */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>功能服务</Text>
            <View style={styles.menuCard}>
              {renderMenuItem('schedule', '考勤管理', '签到签退记录')}
              {renderMenuItem('bar-chart', '数据统计', '个人工作数据分析')}
              {renderMenuItem('message', '消息中心', '系统消息和通知')}
              {renderMenuItem('help', '帮助中心', '使用指南和常见问题')}
              {renderMenuItem('feedback', '意见反馈', '提交问题反馈和建议')}
            </View>
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>个人中心</Text>
            <View style={styles.menuCard}>
              {renderMenuItem('person', '个人资料', '编辑个人信息和头像')}
              {renderMenuItem('history', '考勤记录', '查看详细考勤历史')}
            </View>
          </View>

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>系统设置</Text>
            <View style={styles.menuCard}>
              {renderMenuItem('settings', '个性化设置', '主题、语言、通知偏好')}
              {renderMenuItem('security', '账户安全', '密码修改、安全设置')}
              {renderMenuItem('privacy-tip', '隐私设置', '数据权限和隐私保护')}
              {renderMenuItem('info', '版本信息', 'v1.0.0')}
            </View>
          </View>

          {/* 退出登录 */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>

          {/* 底部版权信息 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2024 智慧河道管理团队. 保留所有权利.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileCard: {
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  profileGradient: {
    borderRadius: 16,
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileTitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  profileId: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsSection: {
    marginBottom: 24,
  },
  attendanceSection: {
    marginBottom: 24,
  },
  attendanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  attendanceTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  attendanceButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  attendanceButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  attendanceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  menuSection: {
    marginBottom: 24,
  },
  menuCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});