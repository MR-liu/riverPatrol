import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppContext } from '@/contexts/AppContext';
import LocationService from '@/utils/LocationService';
import AttendanceService from '@/utils/AttendanceService';
import FileUploadService from '@/utils/FileUploadService';
import MessageService from '@/utils/MessageService';
import ReportService from '@/utils/ReportService';
import problemCategoryService from '@/utils/ProblemCategoryService';
import { LoadingState } from '@/components/LoadingState';

// 简化的图表组件
const SimpleBarChart = ({ data, height = 120 }: { data: any[], height?: number }) => {
  const maxValue = Math.max(...data.map(item => item.value));
  
  return (
    <View style={[styles.chartContainer, { height }]}>
      <View style={styles.chartWrapper}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * (height - 40) : 0;
          return (
            <View key={index} style={styles.barColumn}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: item.color || '#3B82F6',
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{item.label}</Text>
              <Text style={styles.barValue}>{item.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const SimplePieChart = ({ data, size = 120 }: { data: any[], size?: number }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  
  return (
    <View style={[styles.pieContainer, { width: size, height: size }]}>
      <View style={[styles.pieChart, { width: size, height: size, borderRadius: size / 2 }]}>
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const angle = (item.value / total) * 360;
          const style = {
            position: 'absolute' as const,
            top: size / 2 - 4,
            left: size / 2 - 4,
            width: 8,
            height: 8,
            backgroundColor: item.color,
            borderRadius: 4,
            transform: [
              { translateX: Math.cos((currentAngle + angle / 2) * Math.PI / 180) * (size / 3) },
              { translateY: Math.sin((currentAngle + angle / 2) * Math.PI / 180) * (size / 3) },
            ],
          };
          currentAngle += angle;
          return <View key={index} style={style} />;
        })}
      </View>
      <View style={styles.pieLegend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
            <Text style={styles.legendValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const SimpleLineChart = ({ data, height = 120 }: { data: any[], height?: number }) => {
  const maxValue = Math.max(...data.map(item => item.value));
  const minValue = Math.min(...data.map(item => item.value));
  const range = maxValue - minValue || 1;
  const width = Dimensions.get('window').width - 64; // 减去padding
  const pointWidth = width / (data.length - 1 || 1);
  
  return (
    <View style={[styles.chartContainer, { height }]}>
      <View style={styles.lineChartWrapper}>
        <View style={styles.lineChart}>
          {data.map((item, index) => {
            const y = height - 40 - ((item.value - minValue) / range) * (height - 60);
            const x = index * pointWidth;
            
            return (
              <View key={index}>
                <View
                  style={[
                    styles.linePoint,
                    {
                      position: 'absolute',
                      left: x - 3,
                      top: y - 3,
                    },
                  ]}
                />
                {index < data.length - 1 && (
                  <View
                    style={[
                      styles.lineSegment,
                      {
                        position: 'absolute',
                        left: x,
                        top: y,
                        width: pointWidth,
                        transform: [
                          {
                            rotate: `${Math.atan2(
                              ((data[index + 1].value - minValue) / range) * (height - 60) - 
                              ((item.value - minValue) / range) * (height - 60),
                              pointWidth
                            )}rad`,
                          },
                        ],
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.lineLabels}>
          {data.map((item, index) => (
            <Text key={index} style={styles.lineLabel}>{item.label}</Text>
          ))}
        </View>
      </View>
    </View>
  );
};

export default function EnhancedStatisticsScreen() {
  const { workOrders, currentUser, statsRefreshTrigger } = useAppContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [statsData, setStatsData] = useState({
    overview: {
      totalReports: 0,
      completedReports: 0,
      pendingReports: 0,
      completionRate: 0,
      avgProcessTime: 0,
      urgentReports: 0,
    },
    attendance: {
      totalCheckIns: 0,
      totalWorkTime: 0,
      punctualityRate: 0,
      currentStatus: 'checked_out' as any,
      avgDailyWorkTime: 0,
      overtimeHours: 0,
    },
    tracking: {
      totalTracks: 0,
      totalDistance: 0,
      totalDuration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      coveredAreas: 0,
    },
    uploads: {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      pendingFiles: 0,
      totalSize: 0,
      avgUploadTime: 0,
    },
    messages: {
      total: 0,
      unread: 0,
      starred: 0,
      todayCount: 0,
    },
    categories: [] as any[],
    monthlyTrend: [] as any[],
    topLocations: [] as any[],
    performanceMetrics: {
      efficiency: 0,
      quality: 0,
      responseTime: 0,
      customerSatisfaction: 0,
    },
    charts: {
      categoryChart: [] as any[],
      trendChart: [] as any[],
      performanceChart: [] as any[],
      locationChart: [] as any[],
    },
  });

  useEffect(() => {
    loadStatistics();
  }, [workOrders, selectedTimeRange, statsRefreshTrigger]);

  const loadStatistics = async () => {
    setIsLoading(true);
    try {
      // 获取各种统计数据
      const [
        reportStats,
        attendanceStats,
        trackStats,
        uploadStats,
        messageStats,
      ] = await Promise.all([
        ReportService.getReports(),
        AttendanceService.getAttendanceStats(currentUser?.username || ''),
        LocationService.getTrackStats(),
        FileUploadService.getUploadStats(),
        MessageService.getMessageStats(),
      ]);

      // 基础工单统计
      const totalReports = workOrders.length;
      const completedReports = workOrders.filter(order => order.status === '已完成').length;
      const pendingReports = workOrders.filter(order => 
        order.status === '待接收' || order.status === '处理中'
      ).length;
      const urgentReports = workOrders.filter(order => order.priority === '紧急').length;
      const completionRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

      // 分类统计
      const categoryStats = calculateCategoryStats(workOrders);
      
      // 月度趋势
      const monthlyTrend = generateTrendData(selectedTimeRange);
      
      // 热点区域
      const topLocations = generateTopLocations();

      // 性能指标
      const performanceMetrics = calculatePerformanceMetrics(workOrders);

      // 图表数据
      const charts = generateChartData(workOrders, categoryStats, monthlyTrend);

      setStatsData({
        overview: {
          totalReports,
          completedReports,
          pendingReports,
          completionRate,
          avgProcessTime: calculateAvgProcessTime(workOrders),
          urgentReports,
        },
        attendance: {
          ...attendanceStats,
          avgDailyWorkTime: attendanceStats.totalWorkTime / Math.max(attendanceStats.totalCheckIns, 1),
          overtimeHours: calculateOvertimeHours(attendanceStats),
        },
        tracking: {
          ...trackStats,
          maxSpeed: trackStats.averageSpeed * 1.5, // 模拟最高速度
          coveredAreas: Math.floor(trackStats.totalDistance / 1000) * 2, // 模拟覆盖区域
        },
        uploads: {
          ...uploadStats,
          totalSize: uploadStats.totalFiles * 2.5, // 模拟总大小(MB)
          avgUploadTime: 1.2, // 模拟平均上传时间(秒)
        },
        messages: {
          ...messageStats,
          todayCount: messageStats.recentActivity.today,
        },
        categories: categoryStats,
        monthlyTrend,
        topLocations,
        performanceMetrics,
        charts,
      });
    } catch (error) {
      console.error('Load statistics error:', error);
    } finally {
      setIsLoading(false);
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
        trend: Math.random() > 0.5 ? 'up' : 'down',
        change: Math.floor(Math.random() * 20) + 1,
      };
    });
  };

  const generateTrendData = (range: string) => {
    const periods: { [key: string]: string[] } = {
      week: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      month: ['1月', '2月', '3月', '4月', '5月', '6月'],
      quarter: ['Q1', 'Q2', 'Q3', 'Q4'],
      year: ['2021', '2022', '2023', '2024'],
    };
    
    return periods[range].map((period: string) => ({
      period,
      reports: Math.floor(Math.random() * 50) + 20,
      completed: Math.floor(Math.random() * 45) + 15,
      efficiency: Math.floor(Math.random() * 30) + 70,
    }));
  };

  const generateTopLocations = () => {
    return [
      { name: '河道巡查点A', reports: 23, status: '正常', risk: 'low' },
      { name: '河道巡查点B', reports: 19, status: '关注', risk: 'medium' },
      { name: '河道巡查点C', reports: 15, status: '正常', risk: 'low' },
      { name: '河道巡查点D', reports: 12, status: '正常', risk: 'low' },
      { name: '河道巡查点E', reports: 8, status: '严重', risk: 'high' },
    ];
  };

  const calculatePerformanceMetrics = (orders: any[]) => {
    return {
      efficiency: Math.floor(Math.random() * 20) + 80, // 80-100%
      quality: Math.floor(Math.random() * 15) + 85,   // 85-100%
      responseTime: Math.floor(Math.random() * 30) + 70, // 70-100%
      customerSatisfaction: Math.floor(Math.random() * 10) + 90, // 90-100%
    };
  };

  const calculateAvgProcessTime = (orders: any[]) => {
    const completedOrders = orders.filter(order => order.status === '已完成');
    if (completedOrders.length === 0) return 0;
    return Math.round(Math.random() * 4 + 2); // 2-6小时
  };

  const calculateOvertimeHours = (attendance: any) => {
    return Math.floor(attendance.totalWorkTime / (8 * 60 * 60 * 1000) * 0.1); // 模拟加班时间
  };

  const generateChartData = (orders: any[], categories: any[], trends: any[]) => {
    return {
      categoryChart: categories.map(cat => ({
        label: cat.name.slice(0, 2),
        value: cat.count,
        color: cat.color,
      })),
      trendChart: trends.map(trend => ({
        label: trend.period,
        value: trend.reports,
        efficiency: trend.efficiency,
      })),
      performanceChart: [
        { label: '效率', value: 85, color: '#3B82F6' },
        { label: '质量', value: 92, color: '#10B981' },
        { label: '响应', value: 78, color: '#F59E0B' },
        { label: '满意', value: 95, color: '#8B5CF6' },
      ],
      locationChart: [
        { label: '北区', value: 35, color: '#EF4444' },
        { label: '南区', value: 28, color: '#3B82F6' },
        { label: '东区', value: 22, color: '#10B981' },
        { label: '西区', value: 15, color: '#F59E0B' },
      ],
    };
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

  const getStatusColor = (status: string, risk?: string) => {
    if (risk === 'high') return '#EF4444';
    if (risk === 'medium') return '#F59E0B';
    return '#10B981';
  };

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeSelector}>
      {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            selectedTimeRange === range && styles.timeRangeButtonActive,
          ]}
          onPress={() => setSelectedTimeRange(range)}
        >
          <Text
            style={[
              styles.timeRangeText,
              selectedTimeRange === range && styles.timeRangeTextActive,
            ]}
          >
            {range === 'week' ? '周' : range === 'month' ? '月' : range === 'quarter' ? '季' : '年'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMetricCard = (
    title: string,
    value: string | number,
    color: string,
    bgColor: string,
    icon: string,
    change?: number,
    trend?: 'up' | 'down'
  ) => (
    <View style={[styles.metricCard, { backgroundColor: bgColor }]}>
      <View style={styles.metricHeader}>
        <MaterialIcons name={icon as any} size={20} color={color} />
        {change !== undefined && (
          <View style={styles.metricChange}>
            <MaterialIcons
              name={trend === 'up' ? 'trending-up' : 'trending-down'}
              size={12}
              color={trend === 'up' ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.metricChangeText,
                { color: trend === 'up' ? '#10B981' : '#EF4444' },
              ]}
            >
              {change}%
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{title}</Text>
    </View>
  );

  const renderPerformanceIndicator = (label: string, value: number, color: string) => (
    <View style={styles.performanceItem}>
      <View style={styles.performanceHeader}>
        <Text style={styles.performanceLabel}>{label}</Text>
        <Text style={[styles.performanceValue, { color }]}>{value}%</Text>
      </View>
      <View style={styles.performanceBar}>
        <View
          style={[
            styles.performanceProgress,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );

  const renderLocationAnalysis = (location: any, index: number) => (
    <View key={index} style={styles.locationAnalysisItem}>
      <View style={styles.locationInfo}>
        <View style={styles.locationHeader}>
          <Text style={styles.locationName}>{location.name}</Text>
          <View style={[styles.riskBadge, { backgroundColor: getStatusColor(location.status, location.risk) }]}>
            <Text style={styles.riskText}>{location.status}</Text>
          </View>
        </View>
        <View style={styles.locationStats}>
          <Text style={styles.locationReports}>{location.reports} 个问题</Text>
          <Text style={styles.locationRisk}>风险等级: {location.risk}</Text>
        </View>
      </View>
      <View style={styles.locationTrend}>
        <MaterialIcons
          name={location.reports > 15 ? 'trending-up' : 'trending-down'}
          size={16}
          color={location.reports > 15 ? '#EF4444' : '#10B981'}
        />
      </View>
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
        <Text style={styles.headerTitle}>数据分析</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/data-export')}
        >
          <MaterialIcons name="file-download" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <LoadingState isLoading={isLoading} loadingMessage="加载统计数据...">
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
          >
            {/* 时间范围选择器 */}
            {renderTimeRangeSelector()}

            {/* 核心指标概览 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="dashboard" size={16} color="#374151" />
                <Text style={styles.cardTitle}>核心指标</Text>
              </View>
              <View style={styles.metricsGrid}>
                {renderMetricCard('总工单数', statsData.overview.totalReports, '#3B82F6', '#EBF4FF', 'assignment', 12, 'up')}
                {renderMetricCard('完成率', `${statsData.overview.completionRate}%`, '#10B981', '#ECFDF5', 'check-circle', 5, 'up')}
                {renderMetricCard('平均处理时长', `${statsData.overview.avgProcessTime}h`, '#F59E0B', '#FFFBEB', 'schedule', 8, 'down')}
                {renderMetricCard('紧急工单', statsData.overview.urgentReports, '#EF4444', '#FEF2F2', 'priority-high', 3, 'down')}
              </View>
            </View>

            {/* 分类统计图表 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="pie-chart" size={16} color="#374151" />
                <Text style={styles.cardTitle}>问题分类分布</Text>
              </View>
              <SimpleBarChart data={statsData.charts.categoryChart} />
              <View style={styles.categoryDetails}>
                {statsData.categories.map((category, index) => (
                  <View key={index} style={styles.categoryDetailItem}>
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryCount}>{category.count}</Text>
                      <View style={styles.categoryTrend}>
                        <MaterialIcons
                          name={category.trend === 'up' ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={category.trend === 'up' ? '#EF4444' : '#10B981'}
                        />
                        <Text
                          style={[
                            styles.categoryChangeText,
                            { color: category.trend === 'up' ? '#EF4444' : '#10B981' },
                          ]}
                        >
                          {category.change}%
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 趋势分析 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="trending-up" size={16} color="#374151" />
                <Text style={styles.cardTitle}>趋势分析</Text>
              </View>
              <SimpleLineChart data={statsData.charts.trendChart} />
            </View>

            {/* 性能指标 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="speed" size={16} color="#374151" />
                <Text style={styles.cardTitle}>性能指标</Text>
              </View>
              <View style={styles.performanceGrid}>
                {renderPerformanceIndicator('工作效率', statsData.performanceMetrics.efficiency, '#3B82F6')}
                {renderPerformanceIndicator('处理质量', statsData.performanceMetrics.quality, '#10B981')}
                {renderPerformanceIndicator('响应及时性', statsData.performanceMetrics.responseTime, '#F59E0B')}
                {renderPerformanceIndicator('满意度', statsData.performanceMetrics.customerSatisfaction, '#8B5CF6')}
              </View>
            </View>

            {/* 区域分析 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="place" size={16} color="#374151" />
                <Text style={styles.cardTitle}>区域分析</Text>
              </View>
              <View style={styles.areaAnalysis}>
                <SimplePieChart data={statsData.charts.locationChart} size={100} />
                <View style={styles.locationAnalysis}>
                  {statsData.topLocations.map(renderLocationAnalysis)}
                </View>
              </View>
            </View>

            {/* 考勤与效率 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="access-time" size={16} color="#374151" />
                <Text style={styles.cardTitle}>考勤效率</Text>
              </View>
              <View style={styles.attendanceGrid}>
                {renderMetricCard('签到次数', statsData.attendance.totalCheckIns, '#3B82F6', '#EBF4FF', 'login')}
                {renderMetricCard('工作时长', formatWorkTime(statsData.attendance.totalWorkTime), '#10B981', '#ECFDF5', 'schedule')}
                {renderMetricCard('准时率', `${statsData.attendance.punctualityRate}%`, '#8B5CF6', '#F3F4F6', 'schedule')}
                {renderMetricCard('加班时长', `${statsData.attendance.overtimeHours}h`, '#F59E0B', '#FFFBEB', 'access-time')}
              </View>
            </View>

            {/* 巡视轨迹详情 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="timeline" size={16} color="#374151" />
                <Text style={styles.cardTitle}>巡视详情</Text>
              </View>
              <View style={styles.trackingDetails}>
                <View style={styles.trackingRow}>
                  <View style={styles.trackingItem}>
                    <Text style={styles.trackingLabel}>总轨迹数</Text>
                    <Text style={styles.trackingValue}>{statsData.tracking.totalTracks}</Text>
                  </View>
                  <View style={styles.trackingItem}>
                    <Text style={styles.trackingLabel}>总距离</Text>
                    <Text style={styles.trackingValue}>{formatDistance(statsData.tracking.totalDistance)}</Text>
                  </View>
                </View>
                <View style={styles.trackingRow}>
                  <View style={styles.trackingItem}>
                    <Text style={styles.trackingLabel}>平均速度</Text>
                    <Text style={styles.trackingValue}>{statsData.tracking.averageSpeed.toFixed(1)} km/h</Text>
                  </View>
                  <View style={styles.trackingItem}>
                    <Text style={styles.trackingLabel}>覆盖区域</Text>
                    <Text style={styles.trackingValue}>{statsData.tracking.coveredAreas} 个</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 消息统计 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="message" size={16} color="#374151" />
                <Text style={styles.cardTitle}>消息统计</Text>
              </View>
              <View style={styles.messageStats}>
                {renderMetricCard('总消息数', statsData.messages.total, '#3B82F6', '#EBF4FF', 'mail')}
                {renderMetricCard('未读消息', statsData.messages.unread, '#EF4444', '#FEF2F2', 'mark-email-unread')}
                {renderMetricCard('收藏消息', statsData.messages.starred, '#F59E0B', '#FFFBEB', 'star')}
                {renderMetricCard('今日消息', statsData.messages.todayCount, '#10B981', '#ECFDF5', 'today')}
              </View>
            </View>
          </ScrollView>
        </LoadingState>
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
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeRangeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metricChangeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  chartContainer: {
    marginVertical: 8,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  bar: {
    width: 20,
    borderRadius: 2,
  },
  barLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
  },
  pieContainer: {
    alignItems: 'center',
  },
  pieChart: {
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  pieLegend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
  },
  lineChartWrapper: {
    paddingVertical: 8,
  },
  lineChart: {
    position: 'relative',
    marginBottom: 16,
  },
  linePoint: {
    width: 6,
    height: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  lineSegment: {
    height: 2,
    backgroundColor: '#3B82F6',
  },
  lineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  lineLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  categoryDetails: {
    marginTop: 16,
    gap: 12,
  },
  categoryDetailItem: {
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
    gap: 12,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  categoryTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  categoryChangeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  performanceGrid: {
    gap: 16,
  },
  performanceItem: {
    gap: 8,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  performanceLabel: {
    fontSize: 14,
    color: '#374151',
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  performanceBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  performanceProgress: {
    height: '100%',
    borderRadius: 2,
  },
  areaAnalysis: {
    flexDirection: 'row',
    gap: 24,
  },
  locationAnalysis: {
    flex: 1,
    gap: 12,
  },
  locationAnalysisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  locationInfo: {
    flex: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  locationStats: {
    flexDirection: 'row',
    gap: 12,
  },
  locationReports: {
    fontSize: 12,
    color: '#6B7280',
  },
  locationRisk: {
    fontSize: 12,
    color: '#6B7280',
  },
  locationTrend: {
    padding: 4,
  },
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trackingDetails: {
    gap: 16,
  },
  trackingRow: {
    flexDirection: 'row',
    gap: 16,
  },
  trackingItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  trackingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  trackingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  messageStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});