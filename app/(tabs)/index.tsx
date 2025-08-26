import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatusBar, StatusBarConfigs } from '@/components/AppStatusBar';

import { useAppContext } from '@/contexts/AppContext';

export default function DashboardScreen() {
  const { 
    workOrders, 
    setSelectedWorkOrder, 
    dashboardStats,
    refreshDashboardStats,
    isLoading 
  } = useAppContext();
  const insets = useSafeAreaInsets();

  // 优先使用后端统计数据，如果没有则使用本地计算
  const stats = useMemo(() => {
    if (dashboardStats?.overview) {
      return {
        pending: dashboardStats.overview.pending_count,
        processing: dashboardStats.overview.processing_count,
        completed: dashboardStats.overview.completed_count,
        completionRate: dashboardStats.overview.completion_rate,
        todayNew: dashboardStats.today_stats?.new_workorders || 0,
        todayCompleted: dashboardStats.today_stats?.completed_workorders || 0
      };
    }
    
    // fallback到本地计算
    const pendingCount = workOrders.filter(order => order.status === '待接收').length;
    const processingCount = workOrders.filter(order => order.status === '处理中').length;
    const completedCount = workOrders.filter(order => order.status === '已完成').length;
    const total = workOrders.length;
    
    return {
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
      completionRate: total > 0 ? (completedCount / total) * 100 : 0,
      todayNew: 0,
      todayCompleted: 0
    };
  }, [dashboardStats, workOrders]);

  // 使用 useMemo 优化计算结果
  const pendingOrders = useMemo(() => workOrders.filter(order => order.status === '待接收'), [workOrders]);
  const processingOrders = useMemo(() => workOrders.filter(order => order.status === '处理中'), [workOrders]);
  const completedOrders = useMemo(() => workOrders.filter(order => order.status === '已完成'), [workOrders]);

  // 使用 useCallback 优化事件处理函数
  const handleNotificationClick = useCallback(() => {
    router.push('/messages');
  }, []);

  const handleQuickReport = useCallback(() => {
    router.push('/(tabs)/report');
  }, []);

  const handleMapView = useCallback(() => {
    router.push('/(tabs)/map');
  }, []);

  const handleAttendanceCheck = useCallback(() => {
    // TODO: 实现打卡签到功能
    router.push('/(tabs)/profile');
  }, []);

  const handleWorkOrderPress = useCallback((workOrder: any) => {
    setSelectedWorkOrder(workOrder);
    router.push('/workorder-detail');
  }, [setSelectedWorkOrder]);

  const handleStatistics = useCallback(() => {
    router.push('/statistics');
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case '紧急':
        return '#EF4444';
      case '普通':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case '待接收':
        return '#F59E0B';
      case '处理中':
        return '#3B82F6';
      case '待审核':
        return '#8B5CF6';
      case '已完成':
        return '#10B981';
      default:
        return '#6B7280';
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <AppStatusBar {...StatusBarConfigs.transparent} />
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 20, // 为底部安全区域和 Tab Bar 留出空间
        }}
      >
        {/* 现代化渐变背景头部 */}
        <LinearGradient
          colors={['#f8fafc', '#e2e8f0', '#cbd5e1']}
          style={[styles.backgroundGradient, { paddingTop: insets.top + 10 }]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
        >
          {/* 头部玻璃态效果区域 */}
          <BlurView intensity={20} style={styles.headerBlur}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greeting}>早上好，张三</Text>
                <Text style={styles.subGreeting}>今天是个适合巡查的好天气</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={handleNotificationClick}
                >
                  <MaterialIcons name="notifications" size={20} color="#475569" />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIcon}
                  onPress={handleNotificationClick}
                >
                  <MaterialIcons name="message" size={20} color="#475569" />
                  <View style={styles.messageDot} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 现代化统计卡片 */}
            <View style={styles.statsContainer}>
              <LinearGradient
                colors={['#fef2f2', '#fecaca']}
                style={styles.statCard}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Text style={styles.statNumber}>{stats.pending}</Text>
                <Text style={styles.statLabel}>待办</Text>
              </LinearGradient>
              
              <LinearGradient
                colors={['#ecfdf5', '#a7f3d0']}
                style={styles.statCard}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Text style={styles.statNumber}>{stats.todayCompleted}</Text>
                <Text style={styles.statLabel}>今日完成</Text>
              </LinearGradient>
              
              <LinearGradient
                colors={['#eff6ff', '#bfdbfe']}
                style={styles.statCard}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Text style={styles.statNumber}>{stats.processing + stats.completed}</Text>
                <Text style={styles.statLabel}>本月总计</Text>
              </LinearGradient>
              
              <LinearGradient
                colors={['#faf5ff', '#ddd6fe']}
                style={styles.statCard}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Text style={styles.statNumber}>{stats.completionRate.toFixed(0)}%</Text>
                <Text style={styles.statLabel}>准时率</Text>
              </LinearGradient>
            </View>
          </BlurView>
        </LinearGradient>

        {/* 现代化快捷操作 */}
        <View style={styles.section}>
          <View style={styles.quickActionsGrid}>
            <LinearGradient
              colors={['#f97316', '#ea580c', '#dc2626']}
              style={styles.primaryActionButton}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
            >
              <TouchableOpacity 
                style={styles.actionButtonContent}
                onPress={handleQuickReport}
              >
                <MaterialIcons name="add-circle" size={24} color="white" />
                <Text style={styles.primaryActionText}>一键上报</Text>
              </TouchableOpacity>
            </LinearGradient>
            
            <TouchableOpacity 
              style={styles.secondaryActionButton}
              onPress={handleMapView}
            >
              <BlurView intensity={10} style={styles.actionButtonBlur}>
                <MaterialIcons name="map" size={24} color="#475569" />
                <Text style={styles.secondaryActionText}>地图巡查</Text>
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* 现代化待办工单 */}
        {pendingOrders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>待办工单</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/workorders')}>
                <View style={styles.viewAllButton}>
                  <Text style={styles.viewAllText}>查看全部</Text>
                  <MaterialIcons name="arrow-forward" size={16} color="#3B82F6" />
                </View>
              </TouchableOpacity>
            </View>
            {pendingOrders.slice(0, 3).map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.modernWorkOrderCard}
                onPress={() => handleWorkOrderPress(order)}
              >
                <BlurView intensity={15} style={styles.cardBlur}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.workOrderTitle}>{order.title}</Text>
                    <View style={styles.badgeContainer}>
                      <LinearGradient
                        colors={order.priority === '紧急' ? ['#fef2f2', '#fecaca'] : ['#eff6ff', '#bfdbfe']}
                        style={styles.modernBadge}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                      >
                        <Text style={[styles.badgeText, { color: order.priority === '紧急' ? '#dc2626' : '#2563eb' }]}>
                          {order.status}
                        </Text>
                      </LinearGradient>
                      {order.priority === '紧急' && (
                        <MaterialIcons name="warning" size={16} color="#dc2626" style={styles.warningIcon} />
                      )}
                    </View>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardRow}>
                      <MaterialIcons name="location-on" size={16} color="#64748b" />
                      <Text style={styles.cardText}>{order.location}</Text>
                    </View>
                    <View style={styles.cardRow}>
                      <MaterialIcons name="access-time" size={16} color="#64748b" />
                      <Text style={styles.cardText}>{order.time}</Text>
                    </View>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 现代化今日统计 */}
        <View style={styles.section}>
          <LinearGradient
            colors={['#eff6ff', '#dbeafe', '#bfdbfe']}
            style={styles.modernTaskCard}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
          >
            <BlurView intensity={10} style={styles.taskCardBlur}>
              <View style={styles.taskHeader}>
                <MaterialIcons name="bar-chart" size={24} color="#2563eb" />
                <Text style={styles.taskTitle}>今日统计</Text>
              </View>
              <View style={styles.taskStatsGrid}>
                <View style={styles.taskStat}>
                  <Text style={styles.taskStatNumber}>8</Text>
                  <Text style={styles.taskStatLabel}>已完成</Text>
                </View>
                <View style={styles.taskStat}>
                  <Text style={styles.taskStatNumber}>2</Text>
                  <Text style={styles.taskStatLabel}>进行中</Text>
                </View>
                <View style={styles.taskStat}>
                  <Text style={styles.taskStatNumber}>5.2km</Text>
                  <Text style={styles.taskStatLabel}>巡查距离</Text>
                </View>
              </View>
            </BlurView>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  backgroundGradient: {
    paddingBottom: 20,
  },
  headerBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 0,
    padding: 20,
    margin: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  messageDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryActionButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  actionButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonBlur: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryActionText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '500',
  },
  modernWorkOrderCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workOrderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modernBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningIcon: {
    marginLeft: 4,
  },
  cardContent: {
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#64748b',
  },
  modernTaskCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  taskCardBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 20,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  taskStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  taskStat: {
    alignItems: 'center',
  },
  taskStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  taskStatLabel: {
    fontSize: 12,
    color: '#64748b',
  },
});
