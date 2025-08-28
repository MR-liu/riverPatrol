import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import AttendanceService from '@/utils/AttendanceService';
import LocationService from '@/utils/LocationService';
import { LoadingState } from '@/components/LoadingState';
import { PageContainer } from '@/components/PageContainer';
import { useAppContext } from '@/contexts/AppContext';

const { width } = Dimensions.get('window');

export default function AttendanceScreen() {
  const { currentUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<'checked_out' | 'checked_in'>('checked_out');
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [weekStats, setWeekStats] = useState({
    totalDays: 0,
    workingDays: 0,
    totalHours: 0,
    averageHours: 0,
    overtimeHours: 0,
    punctualityRate: 100,
  });
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadAttendanceData();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendanceData = async () => {
    setIsLoading(true);
    try {
      const [status, todayData, weekData, monthData] = await Promise.all([
        AttendanceService.getCurrentStatus(currentUser?.username || ''),
        AttendanceService.getTodayRecord(currentUser?.username || ''),
        AttendanceService.getWeekStats(currentUser?.username || ''),
        AttendanceService.getMonthlyRecords(currentUser?.username || ''),
      ]);

      setAttendanceStatus(status);
      setTodayRecord(todayData);
      setWeekStats(weekData);
      setMonthlyRecords(monthData.slice(0, 10));
    } catch (error) {
      console.error('Load attendance data error:', error);
      Alert.alert('加载失败', '无法加载考勤数据，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckInOut = async () => {
    setIsCheckingIn(true);
    try {
      let location = null;
      try {
        location = await LocationService.getCurrentLocation();
      } catch (error) {
        console.log('Failed to get location:', error);
      }

      if (attendanceStatus === 'checked_out') {
        const success = await AttendanceService.checkIn(currentUser?.username || '', {
          latitude: location?.latitude,
          longitude: location?.longitude,
          address: location?.address,
        });

        if (success) {
          setAttendanceStatus('checked_in');
          Alert.alert('签到成功', '已记录您的签到时间和位置');
          await loadAttendanceData();
        } else {
          Alert.alert('签到失败', '请重试');
        }
      } else {
        const success = await AttendanceService.checkOut(currentUser?.username || '', {
          latitude: location?.latitude,
          longitude: location?.longitude,
          address: location?.address,
        });

        if (success) {
          setAttendanceStatus('checked_out');
          Alert.alert('签退成功', '今日工作已结束，请注意休息');
          await loadAttendanceData();
        } else {
          Alert.alert('签退失败', '请重试');
        }
      }
    } catch (error) {
      console.error('Check in/out error:', error);
      Alert.alert('操作失败', '考勤操作失败，请重试');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    });
  };

  const formatDuration = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#10B981';
      case 'late': return '#F59E0B';
      case 'absent': return '#EF4444';
      case 'leave': return '#6B7280';
      default: return '#3B82F6';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'late': return '迟到';
      case 'absent': return '缺勤';
      case 'leave': return '请假';
      default: return '未知';
    }
  };

  const renderStatsCard = (title: string, value: string, color: string, subtitle?: string) => (
    <View style={[styles.statsCard, { backgroundColor: color + '15' }]}>
      <MaterialIcons name="bar-chart" size={24} color={color} />
      <Text style={[styles.statsValue, { color }]}>{value}</Text>
      <Text style={styles.statsTitle}>{title}</Text>
      {subtitle && <Text style={styles.statsSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderRecord = (record: any, index: number) => (
    <View key={index} style={styles.recordItem}>
      <View style={styles.recordDate}>
        <Text style={styles.recordDateText}>
          {new Date(record.date).toLocaleDateString('zh-CN', { 
            month: '2-digit', 
            day: '2-digit' 
          })}
        </Text>
        <Text style={styles.recordWeekday}>
          {new Date(record.date).toLocaleDateString('zh-CN', { weekday: 'short' })}
        </Text>
      </View>
      
      <View style={styles.recordContent}>
        <View style={styles.recordTimes}>
          <Text style={styles.recordTime}>
            签到: {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : '--:--'}
          </Text>
          <Text style={styles.recordTime}>
            签退: {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : '--:--'}
          </Text>
        </View>
        
        <View style={styles.recordInfo}>
          <Text style={styles.recordDuration}>
            {record.workDuration ? formatDuration(record.workDuration) : '工作中'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>
            <Text style={styles.statusText}>{getStatusText(record.status)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <PageContainer 
      title="考勤管理"
      rightButton={{
        icon: 'refresh',
        onPress: loadAttendanceData
      }}
    >
      <LoadingState isLoading={isLoading} loadingMessage="加载考勤数据...">
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 时间显示 */}
            <View style={styles.timeCard}>
              <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
              <Text style={styles.currentDate}>{formatDate(currentTime)}</Text>
            </View>

            {/* 签到/签退按钮 */}
            <View style={styles.checkInCard}>
              <TouchableOpacity
                style={[
                  styles.checkInButton,
                  attendanceStatus === 'checked_in' && styles.checkOutButton,
                ]}
                onPress={handleCheckInOut}
                disabled={isCheckingIn}
              >
                <LinearGradient
                  colors={
                    attendanceStatus === 'checked_out'
                      ? ['#10B981', '#059669']
                      : ['#EF4444', '#DC2626']
                  }
                  style={styles.checkInButtonGradient}
                >
                  <MaterialIcons
                    name={attendanceStatus === 'checked_out' ? 'login' : 'logout'}
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.checkInButtonText}>
                    {isCheckingIn
                      ? '操作中...'
                      : attendanceStatus === 'checked_out'
                      ? '签到'
                      : '签退'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {todayRecord && (
                <View style={styles.todayStatus}>
                  {todayRecord.checkInTime && (
                    <Text style={styles.todayStatusText}>
                      今日签到: {new Date(todayRecord.checkInTime).toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  )}
                  {todayRecord.checkOutTime && (
                    <Text style={styles.todayStatusText}>
                      今日签退: {new Date(todayRecord.checkOutTime).toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  )}
                  {todayRecord.workDuration && (
                    <Text style={styles.todayStatusText}>
                      工作时长: {formatDuration(todayRecord.workDuration)}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* 本周统计 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="date-range" size={16} color="#374151" />
                <Text style={styles.cardTitle}>本周统计</Text>
              </View>
              <View style={styles.statsGrid}>
                {renderStatsCard('出勤天数', `${weekStats.workingDays}/${weekStats.totalDays}`, '#3B82F6')}
                {renderStatsCard('总工时', `${(weekStats.totalHours / (1000 * 60 * 60)).toFixed(1)}h`, '#10B981')}
                {renderStatsCard('准时率', `${weekStats.punctualityRate}%`, '#8B5CF6')}
                {renderStatsCard('加班时长', `${(weekStats.overtimeHours / (1000 * 60 * 60)).toFixed(1)}h`, '#F59E0B')}
              </View>
            </View>

            {/* 考勤记录 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="history" size={16} color="#374151" />
                <Text style={styles.cardTitle}>最近记录</Text>
                <TouchableOpacity 
                  style={styles.moreButton}
                  onPress={() => router.push('/attendance-records')}
                >
                  <Text style={styles.moreButtonText}>查看全部</Text>
                  <MaterialIcons name="chevron-right" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.recordsList}>
                {monthlyRecords.length > 0 ? (
                  monthlyRecords.map(renderRecord)
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="event-note" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>暂无考勤记录</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </LoadingState>
      </PageContainer>
    );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  timeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  currentTime: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  currentDate: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  checkInCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  checkInButton: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  checkOutButton: {
    // Different styling for check-out if needed
  },
  checkInButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  todayStatus: {
    alignItems: 'center',
    gap: 4,
  },
  todayStatusText: {
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
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
    flex: 1,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moreButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statsTitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statsSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  recordsList: {
    gap: 12,
  },
  recordItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 16,
  },
  recordDate: {
    alignItems: 'center',
    minWidth: 40,
  },
  recordDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  recordWeekday: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recordContent: {
    flex: 1,
    gap: 8,
  },
  recordTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordTime: {
    fontSize: 14,
    color: '#374151',
  },
  recordInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordDuration: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});