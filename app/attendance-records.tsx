import React, { useState, useEffect } from 'react';
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

import AttendanceService from '@/utils/AttendanceService';
import { LoadingState } from '@/components/LoadingState';
import { useAppContext } from '@/contexts/AppContext';

const { width } = Dimensions.get('window');

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workDuration: number | null;
  status: 'normal' | 'late' | 'absent' | 'leave';
  checkInLocation?: string;
  checkOutLocation?: string;
  overtime: number;
  breaks: Array<{
    startTime: string;
    endTime: string;
    duration: number;
  }>;
  notes?: string;
}

export default function AttendanceRecordsScreen() {
  const { currentUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthStats, setMonthStats] = useState({
    totalDays: 0,
    workDays: 0,
    normalDays: 0,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,
    totalHours: 0,
    overtimeHours: 0,
    averageWorkHours: 0,
  });

  useEffect(() => {
    loadAttendanceRecords();
  }, [selectedMonth]);

  const loadAttendanceRecords = async () => {
    setIsLoading(true);
    try {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;
      
      const [recordsData, statsData] = await Promise.all([
        AttendanceService.getMonthlyRecords(currentUser?.username || '', year, month),
        AttendanceService.getMonthStats(currentUser?.username || '', year, month),
      ]);

      setRecords(recordsData);
      setMonthStats(statsData);
    } catch (error) {
      console.error('Load attendance records error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAttendanceRecords();
    setIsRefreshing(false);
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (milliseconds: number | null) => {
    if (!milliseconds) return '--';
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}时${minutes}分`;
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return 'check-circle';
      case 'late': return 'access-time';
      case 'absent': return 'cancel';
      case 'leave': return 'event-busy';
      default: return 'help';
    }
  };

  const renderStatsCard = (title: string, value: string, color: string, subtitle?: string) => (
    <View style={[styles.statsCard, { backgroundColor: color + '15' }]}>
      <Text style={[styles.statsValue, { color }]}>{value}</Text>
      <Text style={styles.statsTitle}>{title}</Text>
      {subtitle && <Text style={styles.statsSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderRecord = (record: AttendanceRecord, index: number) => {
    const date = new Date(record.date);
    const isToday = date.toDateString() === new Date().toDateString();
    const dayOfWeek = date.toLocaleDateString('zh-CN', { weekday: 'short' });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    return (
      <View key={record.id} style={[styles.recordCard, isToday && styles.todayRecord]}>
        <View style={styles.recordHeader}>
          <View style={styles.recordDate}>
            <Text style={[styles.recordDateText, isToday && styles.todayText]}>
              {date.getDate().toString().padStart(2, '0')}
            </Text>
            <Text style={[styles.recordWeekday, isWeekend && styles.weekendText]}>
              {dayOfWeek}
            </Text>
          </View>
          
          <View style={styles.recordStatus}>
            <MaterialIcons
              name={getStatusIcon(record.status) as any}
              size={16}
              color={getStatusColor(record.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
              {getStatusText(record.status)}
            </Text>
          </View>
        </View>

        <View style={styles.recordContent}>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <MaterialIcons name="login" size={16} color="#6B7280" />
              <Text style={styles.timeLabel}>签到</Text>
              <Text style={styles.timeValue}>{formatTime(record.checkInTime)}</Text>
            </View>
            
            <View style={styles.timeItem}>
              <MaterialIcons name="logout" size={16} color="#6B7280" />
              <Text style={styles.timeLabel}>签退</Text>
              <Text style={styles.timeValue}>{formatTime(record.checkOutTime)}</Text>
            </View>
          </View>

          <View style={styles.durationRow}>
            <View style={styles.durationItem}>
              <Text style={styles.durationLabel}>工作时长</Text>
              <Text style={styles.durationValue}>{formatDuration(record.workDuration)}</Text>
            </View>
            
            {record.overtime > 0 && (
              <View style={styles.durationItem}>
                <Text style={styles.durationLabel}>加班时长</Text>
                <Text style={[styles.durationValue, styles.overtimeValue]}>
                  {formatDuration(record.overtime)}
                </Text>
              </View>
            )}
          </View>

          {record.checkInLocation && (
            <View style={styles.locationRow}>
              <MaterialIcons name="place" size={14} color="#9CA3AF" />
              <Text style={styles.locationText} numberOfLines={1}>
                签到位置: {record.checkInLocation}
              </Text>
            </View>
          )}

          {record.breaks && record.breaks.length > 0 && (
            <View style={styles.breaksRow}>
              <Text style={styles.breaksLabel}>休息记录:</Text>
              {record.breaks.map((breakItem, breakIndex) => (
                <Text key={breakIndex} style={styles.breakText}>
                  {formatTime(breakItem.startTime)} - {formatTime(breakItem.endTime)} 
                  ({formatDuration(breakItem.duration)})
                </Text>
              ))}
            </View>
          )}

          {record.notes && (
            <View style={styles.notesRow}>
              <Text style={styles.notesLabel}>备注:</Text>
              <Text style={styles.notesText}>{record.notes}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>考勤记录</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/attendance-export')}
        >
          <MaterialIcons name="file-download" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <LoadingState isLoading={isLoading}>
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          >
            {/* 月份选择器 */}
            <View style={styles.monthSelector}>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() => changeMonth('prev')}
              >
                <MaterialIcons name="chevron-left" size={24} color="#3B82F6" />
              </TouchableOpacity>
              
              <Text style={styles.monthText}>
                {selectedMonth.toLocaleDateString('zh-CN', { 
                  year: 'numeric', 
                  month: 'long' 
                })}
              </Text>
              
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() => changeMonth('next')}
                disabled={selectedMonth.getMonth() >= new Date().getMonth() && 
                         selectedMonth.getFullYear() >= new Date().getFullYear()}
              >
                <MaterialIcons 
                  name="chevron-right" 
                  size={24} 
                  color={selectedMonth.getMonth() >= new Date().getMonth() && 
                        selectedMonth.getFullYear() >= new Date().getFullYear() 
                        ? "#D1D5DB" : "#3B82F6"} 
                />
              </TouchableOpacity>
            </View>

            {/* 月度统计 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="assessment" size={16} color="#374151" />
                <Text style={styles.cardTitle}>本月统计</Text>
              </View>
              
              <View style={styles.statsGrid}>
                {renderStatsCard('出勤天数', `${monthStats.workDays}`, '#3B82F6', `共${monthStats.totalDays}天`)}
                {renderStatsCard('正常出勤', `${monthStats.normalDays}`, '#10B981', '天')}
                {renderStatsCard('迟到次数', `${monthStats.lateDays}`, '#F59E0B', '次')}
                {renderStatsCard('总工时', `${(monthStats.totalHours / (1000 * 60 * 60)).toFixed(1)}`, '#8B5CF6', '小时')}
              </View>

              <View style={styles.statsSecondary}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsSecondaryLabel}>平均工时</Text>
                  <Text style={styles.statsSecondaryValue}>
                    {(monthStats.averageWorkHours / (1000 * 60 * 60)).toFixed(1)}小时/天
                  </Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsSecondaryLabel}>加班时长</Text>
                  <Text style={styles.statsSecondaryValue}>
                    {(monthStats.overtimeHours / (1000 * 60 * 60)).toFixed(1)}小时
                  </Text>
                </View>
              </View>
            </View>

            {/* 考勤记录列表 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="list" size={16} color="#374151" />
                <Text style={styles.cardTitle}>详细记录</Text>
                <Text style={styles.cardSubtitle}>({records.length}条记录)</Text>
              </View>
              
              <View style={styles.recordsList}>
                {records.length > 0 ? (
                  records.map(renderRecord)
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="event-note" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>暂无考勤记录</Text>
                    <Text style={styles.emptyStateSubtext}>
                      该月份暂无考勤数据
                    </Text>
                  </View>
                )}
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
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
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
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statsSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statsSecondary: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 24,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsSecondaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statsSecondaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  recordsList: {
    gap: 12,
  },
  recordCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  todayRecord: {
    borderLeftColor: '#3B82F6',
    backgroundColor: '#EBF4FF',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordDate: {
    alignItems: 'center',
  },
  recordDateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  todayText: {
    color: '#3B82F6',
  },
  recordWeekday: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  weekendText: {
    color: '#EF4444',
  },
  recordStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recordContent: {
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 8,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 'auto',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 16,
  },
  durationItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  durationLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  overtimeValue: {
    color: '#F59E0B',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#9CA3AF',
    flex: 1,
  },
  breaksRow: {
    marginTop: 4,
  },
  breaksLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  breakText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 12,
  },
  notesRow: {
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#D1D5DB',
  },
});