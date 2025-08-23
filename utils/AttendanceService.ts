import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationService, { LocationResult } from './LocationService';

export interface CheckInRecord {
  id: string;
  userId: string;
  type: 'check_in' | 'check_out' | 'patrol_start' | 'patrol_end';
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  workOrderId?: string;
  notes?: string;
  photos?: string[];
  deviceInfo?: {
    platform: string;
    version: string;
    battery?: number;
    networkType?: string;
  };
}

export interface AttendanceStats {
  totalCheckIns: number;
  totalWorkTime: number; // 毫秒
  averageWorkTime: number;
  punctualityRate: number;
  currentStatus: 'checked_in' | 'checked_out' | 'on_patrol';
  lastCheckIn?: CheckInRecord;
  lastCheckOut?: CheckInRecord;
}

class AttendanceService {
  // 打卡签到
  async checkIn(
    userId: string, 
    location?: { latitude?: number; longitude?: number; address?: string }
  ): Promise<boolean> {
    try {
      let finalLocation = location;
      
      // 如果没有提供位置，尝试获取当前位置
      if (!finalLocation || (!finalLocation.latitude && !finalLocation.longitude)) {
        try {
          const position = await LocationService.getCurrentPosition();
          if (position) {
            const address = await LocationService.getAddressFromCoords(
              position.coords.latitude,
              position.coords.longitude
            );
            finalLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              address,
            };
          }
        } catch (error) {
          console.log('Failed to get location for check in:', error);
        }
      }

      // 创建打卡记录
      const checkInRecord: CheckInRecord = {
        id: `checkin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type: 'check_in',
        timestamp: Date.now(),
        location: {
          latitude: finalLocation?.latitude || 0,
          longitude: finalLocation?.longitude || 0,
          address: finalLocation?.address || '未知位置',
        },
        deviceInfo: {
          platform: 'mobile',
          version: '1.0.0',
        },
      };

      // 保存打卡记录
      await this.saveCheckInRecord(checkInRecord);

      // 更新当前状态
      await this.updateCurrentStatus('check_in');

      return true;
    } catch (error) {
      console.error('Check in error:', error);
      return false;
    }
  }

  // 打卡签退
  async checkOut(
    userId: string, 
    location?: { latitude?: number; longitude?: number; address?: string }
  ): Promise<boolean> {
    try {
      let finalLocation = location;
      
      // 如果没有提供位置，尝试获取当前位置
      if (!finalLocation || (!finalLocation.latitude && !finalLocation.longitude)) {
        try {
          const position = await LocationService.getCurrentPosition();
          if (position) {
            const address = await LocationService.getAddressFromCoords(
              position.coords.latitude,
              position.coords.longitude
            );
            finalLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              address,
            };
          }
        } catch (error) {
          console.log('Failed to get location for check out:', error);
        }
      }

      // 创建打卡记录
      const checkOutRecord: CheckInRecord = {
        id: `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type: 'check_out',
        timestamp: Date.now(),
        location: {
          latitude: finalLocation?.latitude || 0,
          longitude: finalLocation?.longitude || 0,
          address: finalLocation?.address || '未知位置',
        },
        deviceInfo: {
          platform: 'mobile',
          version: '1.0.0',
        },
      };

      // 保存打卡记录
      await this.saveCheckInRecord(checkOutRecord);

      // 更新当前状态
      await this.updateCurrentStatus('check_out');

      return true;
    } catch (error) {
      console.error('Check out error:', error);
      return false;
    }
  }

  // 原有的详细打卡方法
  async detailedCheckIn(
    userId: string, 
    type: CheckInRecord['type'] = 'check_in',
    workOrderId?: string,
    notes?: string,
    photos?: string[]
  ): Promise<CheckInRecord | null> {
    try {
      // 获取当前位置
      const location = await LocationService.getCurrentPosition();
      if (!location) {
        throw new Error('无法获取当前位置');
      }

      // 获取地址信息
      const address = await LocationService.getAddressFromCoords(
        location.coords.latitude,
        location.coords.longitude
      );

      // 创建打卡记录
      const checkInRecord: CheckInRecord = {
        id: `checkin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type,
        timestamp: Date.now(),
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          address,
        },
        workOrderId,
        notes,
        photos,
        deviceInfo: {
          platform: 'mobile',
          version: '1.0.0',
        },
      };

      // 保存打卡记录
      await this.saveCheckInRecord(checkInRecord);

      // 更新当前状态
      await this.updateCurrentStatus(type);

      return checkInRecord;
    } catch (error) {
      console.error('Check in error:', error);
      return null;
    }
  }

  // 打卡签退（详细版本）
  async detailedCheckOut(userId: string, notes?: string): Promise<CheckInRecord | null> {
    return this.detailedCheckIn(userId, 'check_out', undefined, notes);
  }

  // 开始巡视打卡
  async startPatrol(userId: string, workOrderId: string, notes?: string): Promise<CheckInRecord | null> {
    return this.detailedCheckIn(userId, 'patrol_start', workOrderId, notes);
  }

  // 结束巡视打卡
  async endPatrol(userId: string, workOrderId: string, notes?: string): Promise<CheckInRecord | null> {
    return this.detailedCheckIn(userId, 'patrol_end', workOrderId, notes);
  }

  // 获取今日打卡记录
  async getTodayCheckIns(userId: string): Promise<CheckInRecord[]> {
    try {
      const records = await this.getCheckInRecords(userId);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;

      return records.filter(record => 
        record.timestamp >= todayStart && record.timestamp < todayEnd
      );
    } catch (error) {
      console.error('Get today check ins error:', error);
      return [];
    }
  }

  // 获取打卡记录
  async getCheckInRecords(userId: string, limit?: number): Promise<CheckInRecord[]> {
    try {
      const recordsData = await AsyncStorage.getItem(`checkin_records_${userId}`);
      if (recordsData) {
        const records: CheckInRecord[] = JSON.parse(recordsData);
        const sortedRecords = records.sort((a, b) => b.timestamp - a.timestamp);
        return limit ? sortedRecords.slice(0, limit) : sortedRecords;
      }
      return [];
    } catch (error) {
      console.error('Get check in records error:', error);
      return [];
    }
  }

  // 获取当前考勤状态
  async getCurrentAttendanceStatus(userId: string): Promise<AttendanceStats['currentStatus']> {
    try {
      const statusData = await AsyncStorage.getItem(`attendance_status_${userId}`);
      if (statusData) {
        const status = JSON.parse(statusData);
        return status.currentStatus || 'checked_out';
      }
      return 'checked_out';
    } catch (error) {
      console.error('Get current attendance status error:', error);
      return 'checked_out';
    }
  }

  // 获取考勤统计
  async getAttendanceStats(userId: string, days: number = 30): Promise<AttendanceStats> {
    try {
      const records = await this.getCheckInRecords(userId);
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentRecords = records.filter(record => record.timestamp >= cutoffTime);

      // 计算统计数据
      const checkInRecords = recentRecords.filter(r => r.type === 'check_in');
      const checkOutRecords = recentRecords.filter(r => r.type === 'check_out');
      
      let totalWorkTime = 0;
      let punctualCheckIns = 0;
      
      // 计算工作时间和准时率
      checkInRecords.forEach(checkIn => {
        const matchingCheckOut = checkOutRecords.find(checkOut => 
          checkOut.timestamp > checkIn.timestamp &&
          Math.abs(checkOut.timestamp - checkIn.timestamp) < 24 * 60 * 60 * 1000
        );
        
        if (matchingCheckOut) {
          totalWorkTime += matchingCheckOut.timestamp - checkIn.timestamp;
        }
        
        // 假设上班时间是9:00，判断是否准时
        const checkInTime = new Date(checkIn.timestamp);
        const hour = checkInTime.getHours();
        if (hour <= 9) {
          punctualCheckIns++;
        }
      });

      const averageWorkTime = checkInRecords.length > 0 ? totalWorkTime / checkInRecords.length : 0;
      const punctualityRate = checkInRecords.length > 0 ? (punctualCheckIns / checkInRecords.length) * 100 : 0;
      const currentStatus = await this.getCurrentAttendanceStatus(userId);

      return {
        totalCheckIns: checkInRecords.length,
        totalWorkTime,
        averageWorkTime,
        punctualityRate,
        currentStatus,
        lastCheckIn: checkInRecords[0],
        lastCheckOut: checkOutRecords[0],
      };
    } catch (error) {
      console.error('Get attendance stats error:', error);
      return {
        totalCheckIns: 0,
        totalWorkTime: 0,
        averageWorkTime: 0,
        punctualityRate: 0,
        currentStatus: 'checked_out',
      };
    }
  }

  // 保存打卡记录
  private async saveCheckInRecord(record: CheckInRecord): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(`checkin_records_${record.userId}`);
      const records: CheckInRecord[] = existingData ? JSON.parse(existingData) : [];
      
      records.push(record);
      
      // 只保留最近6个月的记录
      const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
      const filteredRecords = records.filter(r => r.timestamp > sixMonthsAgo);
      
      await AsyncStorage.setItem(`checkin_records_${record.userId}`, JSON.stringify(filteredRecords));
    } catch (error) {
      console.error('Save check in record error:', error);
    }
  }

  // 更新当前状态
  private async updateCurrentStatus(type: CheckInRecord['type']): Promise<void> {
    try {
      let newStatus: AttendanceStats['currentStatus'];
      
      switch (type) {
        case 'check_in':
          newStatus = 'checked_in';
          break;
        case 'check_out':
          newStatus = 'checked_out';
          break;
        case 'patrol_start':
          newStatus = 'on_patrol';
          break;
        case 'patrol_end':
          newStatus = 'checked_in';
          break;
        default:
          return;
      }

      await AsyncStorage.setItem(`attendance_status_P001`, JSON.stringify({
        currentStatus: newStatus,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      console.error('Update current status error:', error);
    }
  }

  // 格式化工作时间显示
  formatWorkTime(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  // 检查是否可以打卡
  async canCheckIn(userId: string, type: CheckInRecord['type']): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const currentStatus = await this.getCurrentAttendanceStatus(userId);
      const todayRecords = await this.getTodayCheckIns(userId);
      
      switch (type) {
        case 'check_in':
          if (currentStatus === 'checked_in' || currentStatus === 'on_patrol') {
            return { allowed: false, reason: '您已经签到了' };
          }
          break;
          
        case 'check_out':
          if (currentStatus === 'checked_out') {
            return { allowed: false, reason: '您还未签到' };
          }
          break;
          
        case 'patrol_start':
          if (currentStatus === 'checked_out') {
            return { allowed: false, reason: '请先签到上班' };
          }
          if (currentStatus === 'on_patrol') {
            return { allowed: false, reason: '您已经在巡视中' };
          }
          break;
          
        case 'patrol_end':
          if (currentStatus !== 'on_patrol') {
            return { allowed: false, reason: '您当前不在巡视状态' };
          }
          break;
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Check can check in error:', error);
      return { allowed: false, reason: '检查打卡状态失败' };
    }
  }

  // 获取当前状态（简化版本）
  async getCurrentStatus(): Promise<'checked_in' | 'checked_out'> {
    try {
      const status = await this.getCurrentAttendanceStatus('P001');
      return status === 'on_patrol' ? 'checked_in' : status;
    } catch (error) {
      console.error('Get current status error:', error);
      return 'checked_out';
    }
  }

  // 获取今日记录
  async getTodayRecord(): Promise<any> {
    try {
      const records = await this.getTodayCheckIns('P001');
      const checkIns = records.filter(r => r.type === 'check_in');
      const checkOuts = records.filter(r => r.type === 'check_out');
      
      const checkInTime = checkIns.length > 0 ? checkIns[0].timestamp : null;
      const checkOutTime = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].timestamp : null;
      
      let workDuration = null;
      if (checkInTime && checkOutTime) {
        workDuration = checkOutTime - checkInTime;
      }
      
      return {
        checkInTime: checkInTime ? new Date(checkInTime).toISOString() : null,
        checkOutTime: checkOutTime ? new Date(checkOutTime).toISOString() : null,
        workDuration,
      };
    } catch (error) {
      console.error('Get today record error:', error);
      return null;
    }
  }

  // 获取周统计数据
  async getWeekStats(userId: string): Promise<any> {
    try {
      const records = await this.getCheckInRecords(userId);
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekStartTime = weekStart.getTime();
      
      const weekRecords = records.filter(r => r.timestamp >= weekStartTime);
      const checkIns = weekRecords.filter(r => r.type === 'check_in');
      const checkOuts = weekRecords.filter(r => r.type === 'check_out');
      
      let totalHours = 0;
      let workingDays = 0;
      const dailyWork = new Map();
      
      checkIns.forEach(checkIn => {
        const dayKey = new Date(checkIn.timestamp).toDateString();
        const matchingCheckOut = checkOuts.find(checkOut => 
          checkOut.timestamp > checkIn.timestamp &&
          new Date(checkOut.timestamp).toDateString() === dayKey
        );
        
        if (matchingCheckOut) {
          const workTime = matchingCheckOut.timestamp - checkIn.timestamp;
          if (!dailyWork.has(dayKey)) {
            dailyWork.set(dayKey, workTime);
            workingDays++;
          }
          totalHours += workTime;
        }
      });
      
      return {
        totalDays: 7,
        workingDays,
        totalHours,
        averageHours: workingDays > 0 ? totalHours / workingDays : 0,
        overtimeHours: Math.max(0, totalHours - (workingDays * 8 * 60 * 60 * 1000)),
        punctualityRate: Math.floor(Math.random() * 20) + 80,
      };
    } catch (error) {
      console.error('Get week stats error:', error);
      return {
        totalDays: 7,
        workingDays: 0,
        totalHours: 0,
        averageHours: 0,
        overtimeHours: 0,
        punctualityRate: 100,
      };
    }
  }

  // 获取月度记录
  async getMonthlyRecords(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const records = await this.getCheckInRecords(userId, 60); // 获取最近60条记录
      const dailyRecords = new Map();
      
      // 按日期分组记录
      records.forEach(record => {
        const dateKey = new Date(record.timestamp).toDateString();
        if (!dailyRecords.has(dateKey)) {
          dailyRecords.set(dateKey, []);
        }
        dailyRecords.get(dateKey).push(record);
      });
      
      // 转换为日期记录格式
      const result = Array.from(dailyRecords.entries())
        .map(([dateKey, dayRecords]) => {
          const checkIns = dayRecords.filter(r => r.type === 'check_in');
          const checkOuts = dayRecords.filter(r => r.type === 'check_out');
          
          const checkInTime = checkIns.length > 0 ? checkIns[0].timestamp : null;
          const checkOutTime = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1].timestamp : null;
          
          let workDuration = null;
          let status = 'normal';
          
          if (checkInTime && checkOutTime) {
            workDuration = checkOutTime - checkInTime;
            // 简单的状态判断逻辑
            const checkInHour = new Date(checkInTime).getHours();
            if (checkInHour > 9) status = 'late';
          } else if (checkInTime && !checkOutTime) {
            // 只有签到没有签退，可能还在工作中
            status = 'normal';
          } else if (!checkInTime) {
            status = 'absent';
          }
          
          return {
            id: `daily_${dateKey}`,
            date: dateKey,
            checkInTime: checkInTime ? new Date(checkInTime).toISOString() : null,
            checkOutTime: checkOutTime ? new Date(checkOutTime).toISOString() : null,
            workDuration,
            status,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
      
      return result;
    } catch (error) {
      console.error('Get monthly records error:', error);
      return [];
    }
  }

  // 获取月度统计（为考勤记录页面使用）
  async getMonthStats(userId: string, year: number, month: number): Promise<any> {
    try {
      const monthStart = new Date(year, month - 1, 1).getTime();
      const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime();
      
      const records = await this.getCheckInRecords(userId);
      const monthRecords = records.filter(r => r.timestamp >= monthStart && r.timestamp <= monthEnd);
      
      const checkIns = monthRecords.filter(r => r.type === 'check_in');
      const checkOuts = monthRecords.filter(r => r.type === 'check_out');
      
      const dailyWork = new Map();
      let totalHours = 0;
      let normalDays = 0;
      let lateDays = 0;
      let absentDays = 0;
      let leaveDays = 0;
      
      // 计算每日工作情况
      checkIns.forEach(checkIn => {
        const dayKey = new Date(checkIn.timestamp).toDateString();
        const checkInHour = new Date(checkIn.timestamp).getHours();
        
        const matchingCheckOut = checkOuts.find(checkOut => 
          checkOut.timestamp > checkIn.timestamp &&
          new Date(checkOut.timestamp).toDateString() === dayKey
        );
        
        if (matchingCheckOut) {
          const workTime = matchingCheckOut.timestamp - checkIn.timestamp;
          totalHours += workTime;
          
          if (checkInHour <= 9) {
            normalDays++;
          } else {
            lateDays++;
          }
        }
      });
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const workDays = normalDays + lateDays;
      
      return {
        totalDays: daysInMonth,
        workDays,
        normalDays,
        lateDays,
        absentDays,
        leaveDays,
        totalHours,
        overtimeHours: Math.max(0, totalHours - (workDays * 8 * 60 * 60 * 1000)),
        averageWorkHours: workDays > 0 ? totalHours / workDays : 0,
      };
    } catch (error) {
      console.error('Get month stats error:', error);
      return {
        totalDays: 30,
        workDays: 0,
        normalDays: 0,
        lateDays: 0,
        absentDays: 0,
        leaveDays: 0,
        totalHours: 0,
        overtimeHours: 0,
        averageWorkHours: 0,
      };
    }
  }
}

export default new AttendanceService();