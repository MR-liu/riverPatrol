import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppContext } from '@/contexts/AppContext';
import LocationService from '@/utils/LocationService';
import AttendanceService from '@/utils/AttendanceService';
import FileUploadService from '@/utils/FileUploadService';
import problemCategoryService from '@/utils/ProblemCategoryService';

export default function StatisticsScreen() {
  const { workOrders } = useAppContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsData, setStatsData] = useState({
    overview: {
      totalReports: 0,
      completedReports: 0,
      pendingReports: 0,
      completionRate: 0,
    },
    attendance: {
      totalCheckIns: 0,
      totalWorkTime: 0,
      punctualityRate: 0,
      currentStatus: 'checked_out' as any,
    },
    tracking: {
      totalTracks: 0,
      totalDistance: 0,
      totalDuration: 0,
      averageSpeed: 0,
    },
    uploads: {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      pendingFiles: 0,
    },
    categories: [] as any[],
    monthlyTrend: [] as any[],
    topLocations: [] as any[],
  });

  useEffect(() => {
    loadStatistics();
  }, [workOrders]);

  const loadStatistics = async () => {
    try {
      // 基础工单统计
      const totalReports = workOrders.length;
      const completedReports = workOrders.filter(order => order.status === '已完成').length;
      const pendingReports = workOrders.filter(order => order.status === '待接收' || order.status === '处理中').length;
      const completionRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

      // 分类统计
      const categoryStats = calculateCategoryStats(workOrders);
      
      // 月度趋势（模拟数据）
      const monthlyTrend = generateMonthlyTrend();
      
      // 热点区域（模拟数据）
      const topLocations = generateTopLocations();

      // 考勤统计
      const attendanceStats = await AttendanceService.getAttendanceStats('P001');
      
      // 轨迹统计
      const trackStats = await LocationService.getTrackStats();
      
      // 文件上传统计
      const uploadStats = await FileUploadService.getUploadStats();

      setStatsData({
        overview: {
          totalReports,
          completedReports,
          pendingReports,
          completionRate,
        },
        attendance: {
          totalCheckIns: attendanceStats.totalCheckIns,
          totalWorkTime: attendanceStats.totalWorkTime,
          punctualityRate: Math.round(attendanceStats.punctualityRate),
          currentStatus: attendanceStats.currentStatus,
        },
        tracking: trackStats,
        uploads: uploadStats,
        categories: categoryStats,
        monthlyTrend,
        topLocations,
      });
    } catch (error) {
      console.error('Load statistics error:', error);
    }
  };

  const calculateCategoryStats = (orders: any[]) => {
    // 获取所有主要分类
    const mainCategories = problemCategoryService.getMainCategories();
    const colors = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981'];
    
    return mainCategories.map((category, index) => {
      // 获取该主分类下的所有子分类和具体问题
      const subCategories = problemCategoryService.getSubCategories(category.id);
      const allSubIds = subCategories.map(sub => sub.id);
      
      // 获取所有三级分类ID
      const detailIds: string[] = [];
      subCategories.forEach(sub => {
        const details = problemCategoryService.getDetailCategories(sub.id);
        detailIds.push(...details.map(detail => detail.id));
      });
      
      // 统计工单数量
      const count = orders.filter(order => 
        detailIds.includes(order.type) || allSubIds.includes(order.type) || order.type === category.id
      ).length;
      
      const percentage = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
      
      return {
        name: category.name,
        count,
        percentage,
        color: colors[index % colors.length],
      };
    });
  };

  const generateMonthlyTrend = () => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
    return months.map(month => ({
      month,
      reports: Math.floor(Math.random() * 50) + 30,
      completed: Math.floor(Math.random() * 45) + 25,
    }));
  };

  const generateTopLocations = () => {
    return [
      { name: '河道巡查点A', reports: 23, status: '正常' },
      { name: '河道巡查点B', reports: 19, status: '正常' },
      { name: '河道巡查点C', reports: 15, status: '正常' },
      { name: '河道巡查点D', reports: 12, status: '正常' },
    ];
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadStatistics();
    setIsRefreshing(false);
  };

  const formatWorkTime = (milliseconds: number) => {
    return AttendanceService.formatWorkTime(milliseconds);
  };

  const formatDistance = (distance: number) => {
    return LocationService.formatDistance(distance);
  };

  const formatDuration = (duration: number) => {
    return LocationService.formatDuration(duration);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'checked_in':
        return '已签到';
      case 'checked_out':
        return '已签退';
      case 'on_patrol':
        return '巡视中';
      default:
        return '未知状态';
    }
  };

  const renderOverviewCard = (title: string, value: string | number, color: string, bgColor: string) => (
    <View style={[styles.overviewCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.overviewValue, { color }]}>{value}</Text>
      <Text style={styles.overviewLabel}>{title}</Text>
    </View>
  );

  const renderCategoryItem = (category: any, index: number) => (
    <View key={index} style={styles.categoryItem}>
      <View style={styles.categoryLeft}>
        <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
        <Text style={styles.categoryName}>{category.name}</Text>
      </View>
      <View style={styles.categoryRight}>
        <Text style={styles.categoryCount}>{category.count}</Text>
        <Text style={styles.categoryPercentage}>({category.percentage}%)</Text>
      </View>
    </View>
  );

  const renderTrendItem = (item: any, index: number) => (
    <View key={index} style={styles.trendItem}>
      <View style={styles.trendLeft}>
        <MaterialIcons name="schedule" size={16} color="#9CA3AF" />
        <Text style={styles.trendMonth}>{item.month}</Text>
      </View>
      <View style={styles.trendRight}>
        <View style={styles.trendData}>
          <Text style={styles.trendValue}>{item.reports}</Text>
          <Text style={styles.trendLabel}>上报</Text>
        </View>
        <View style={styles.trendData}>
          <Text style={[styles.trendValue, { color: '#10B981' }]}>{item.completed}</Text>
          <Text style={styles.trendLabel}>完成</Text>
        </View>
      </View>
    </View>
  );

  const renderLocationItem = (location: any, index: number) => (
    <View key={index} style={styles.locationItem}>
      <View style={styles.locationLeft}>
        <View style={styles.locationDot} />
        <View style={styles.locationInfo}>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.locationReports}>{location.reports} 个问题</Text>
        </View>
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{location.status}</Text>
      </View>
    </View>
  );

  const renderEfficiencyItem = (icon: string, label: string, value: string, iconColor: string) => (
    <View style={styles.efficiencyItem}>
      <View style={styles.efficiencyLeft}>
        <MaterialIcons name={icon as any} size={16} color={iconColor} />
        <Text style={styles.efficiencyLabel}>{label}</Text>
      </View>
      <Text style={styles.efficiencyValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 自定义头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据统计</Text>
        <View style={styles.headerButton} />
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          {/* 总体概览 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="bar-chart" size={16} color="#374151" />
              <Text style={styles.cardTitle}>总体概览</Text>
            </View>
            <View style={styles.overviewGrid}>
              {renderOverviewCard('总上报数', statsData.overview.totalReports, '#3B82F6', '#EBF4FF')}
              {renderOverviewCard('已完成', statsData.overview.completedReports, '#10B981', '#ECFDF5')}
              {renderOverviewCard('待处理', statsData.overview.pendingReports, '#F59E0B', '#FFFBEB')}
              {renderOverviewCard('完成率', `${statsData.overview.completionRate}%`, '#8B5CF6', '#F3F4F6')}
            </View>
          </View>

          {/* 考勤统计 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="access-time" size={16} color="#374151" />
              <Text style={styles.cardTitle}>考勤统计</Text>
            </View>
            <View style={styles.overviewGrid}>
              {renderOverviewCard('签到次数', statsData.attendance.totalCheckIns, '#3B82F6', '#EBF4FF')}
              {renderOverviewCard('工作时长', formatWorkTime(statsData.attendance.totalWorkTime), '#10B981', '#ECFDF5')}
              {renderOverviewCard('准时率', `${statsData.attendance.punctualityRate}%`, '#8B5CF6', '#F3F4F6')}
              {renderOverviewCard('当前状态', getStatusText(statsData.attendance.currentStatus), '#F59E0B', '#FFFBEB')}
            </View>
          </View>

          {/* 巡视轨迹统计 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="timeline" size={16} color="#374151" />
              <Text style={styles.cardTitle}>巡视轨迹</Text>
            </View>
            <View style={styles.overviewGrid}>
              {renderOverviewCard('轨迹数量', statsData.tracking.totalTracks, '#3B82F6', '#EBF4FF')}
              {renderOverviewCard('总距离', formatDistance(statsData.tracking.totalDistance), '#10B981', '#ECFDF5')}
              {renderOverviewCard('总时长', formatDuration(statsData.tracking.totalDuration), '#8B5CF6', '#F3F4F6')}
              {renderOverviewCard('平均速度', `${statsData.tracking.averageSpeed.toFixed(1)} km/h`, '#F59E0B', '#FFFBEB')}
            </View>
          </View>

          {/* 文件上传统计 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="cloud-upload" size={16} color="#374151" />
              <Text style={styles.cardTitle}>文件上传</Text>
            </View>
            <View style={styles.overviewGrid}>
              {renderOverviewCard('总文件数', statsData.uploads.totalFiles, '#3B82F6', '#EBF4FF')}
              {renderOverviewCard('已上传', statsData.uploads.completedFiles, '#10B981', '#ECFDF5')}
              {renderOverviewCard('上传中', statsData.uploads.pendingFiles, '#F59E0B', '#FFFBEB')}
              {renderOverviewCard('失败', statsData.uploads.failedFiles, '#EF4444', '#FEF2F2')}
            </View>
          </View>

          {/* 问题分类统计 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>问题分类统计</Text>
            <View style={styles.categoriesList}>
              {statsData.categories.map(renderCategoryItem)}
            </View>
          </View>

          {/* 月度趋势 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="trending-up" size={16} color="#374151" />
              <Text style={styles.cardTitle}>月度趋势</Text>
            </View>
            <View style={styles.trendList}>
              {statsData.monthlyTrend.map(renderTrendItem)}
            </View>
          </View>

          {/* 热点区域 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="place" size={16} color="#374151" />
              <Text style={styles.cardTitle}>热点区域</Text>
            </View>
            <View style={styles.locationsList}>
              {statsData.topLocations.map(renderLocationItem)}
            </View>
          </View>

          {/* 效率分析 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>效率分析</Text>
            <View style={styles.efficiencyList}>
              {renderEfficiencyItem('check-circle', '平均处理时长', '2.5小时', '#10B981')}
              {renderEfficiencyItem('warning', '超时处理', '3件', '#F59E0B')}
              {renderEfficiencyItem('bar-chart', '响应及时率', '98%', '#3B82F6')}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3B82F6',
  },
  header: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  categoriesList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 14,
    color: '#374151',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#6B7280',
  },
  trendList: {
    gap: 12,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  trendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendMonth: {
    fontSize: 14,
    color: '#374151',
  },
  trendRight: {
    flexDirection: 'row',
    gap: 16,
  },
  trendData: {
    alignItems: 'center',
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  trendLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  locationsList: {
    gap: 12,
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationDot: {
    width: 8,
    height: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  locationInfo: {
    gap: 2,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  locationReports: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#166534',
  },
  efficiencyList: {
    gap: 16,
  },
  efficiencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  efficiencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  efficiencyLabel: {
    fontSize: 14,
    color: '#374151',
  },
  efficiencyValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
});