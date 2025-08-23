import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import problemCategoryService from './ProblemCategoryService';

export interface ExportOptions {
  format: 'json' | 'csv' | 'excel';
  dateRange?: {
    start: number;
    end: number;
  };
  categories?: string[];
  includeCharts?: boolean;
  includeImages?: boolean;
}

export interface ExportData {
  metadata: {
    exportDate: string;
    dateRange: string;
    totalRecords: number;
    format: string;
    version: string;
  };
  workOrders: any[];
  reports: any[];
  attendance: any[];
  tracking: any[];
  messages: any[];
  statistics: any;
}

class DataExportService {
  private readonly EXPORT_CACHE_KEY = 'export_cache';
  private readonly MAX_CACHE_SIZE = 10; // 最多缓存10个导出文件

  // 导出所有数据
  async exportAllData(options: ExportOptions): Promise<string | null> {
    try {
      const exportData = await this.collectAllData(options);
      
      switch (options.format) {
        case 'json':
          return await this.exportAsJSON(exportData);
        case 'csv':
          return await this.exportAsCSV(exportData);
        case 'excel':
          return await this.exportAsExcel(exportData);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Export all data error:', error);
      Alert.alert('导出失败', '数据导出过程中发生错误，请重试');
      return null;
    }
  }

  // 导出工单数据
  async exportWorkOrders(workOrders: any[], options: ExportOptions): Promise<string | null> {
    try {
      const filteredOrders = this.filterByDateRange(workOrders, options.dateRange);
      
      const exportData = {
        metadata: this.generateMetadata('工单数据', filteredOrders.length, options.format),
        workOrders: filteredOrders.map(order => ({
          id: order.id,
          title: order.title,
          type: order.type,
          priority: order.priority,
          status: order.status,
          location: order.location,
          description: order.description,
          reporter: order.reporter,
          assignee: order.assignee,
          createdAt: order.time,
          completedAt: order.completedAt,
        })),
      };

      switch (options.format) {
        case 'json':
          return await this.exportAsJSON(exportData);
        case 'csv':
          return await this.exportAsCSV(exportData, 'workOrders');
        default:
          return await this.exportAsJSON(exportData);
      }
    } catch (error) {
      console.error('Export work orders error:', error);
      return null;
    }
  }

  // 导出统计报告
  async exportStatisticsReport(statistics: any, options: ExportOptions): Promise<string | null> {
    try {
      const reportData = {
        metadata: this.generateMetadata('统计报告', Object.keys(statistics).length, options.format),
        summary: {
          reportDate: new Date().toISOString(),
          period: this.formatDateRange(options.dateRange),
          totalWorkOrders: statistics.overview?.totalReports || 0,
          completionRate: statistics.overview?.completionRate || 0,
          avgProcessTime: statistics.overview?.avgProcessTime || 0,
        },
        overview: statistics.overview,
        categories: statistics.categories,
        performance: statistics.performanceMetrics,
        attendance: statistics.attendance,
        tracking: statistics.tracking,
        trends: statistics.monthlyTrend,
        locations: statistics.topLocations,
        charts: options.includeCharts ? statistics.charts : undefined,
      };

      return await this.exportAsJSON(reportData);
    } catch (error) {
      console.error('Export statistics report error:', error);
      return null;
    }
  }

  // 导出考勤数据
  async exportAttendanceData(attendanceData: any[], options: ExportOptions): Promise<string | null> {
    try {
      const filteredData = this.filterByDateRange(attendanceData, options.dateRange);
      
      const exportData = {
        metadata: this.generateMetadata('考勤数据', filteredData.length, options.format),
        attendance: filteredData,
      };

      switch (options.format) {
        case 'csv':
          return await this.exportAsCSV(exportData, 'attendance');
        default:
          return await this.exportAsJSON(exportData);
      }
    } catch (error) {
      console.error('Export attendance data error:', error);
      return null;
    }
  }

  // 收集所有数据
  private async collectAllData(options: ExportOptions): Promise<ExportData> {
    try {
      // 从各个服务获取数据
      const [workOrders, reports, attendance, tracking, messages] = await Promise.all([
        this.getWorkOrdersData(),
        this.getReportsData(),
        this.getAttendanceData(),
        this.getTrackingData(),
        this.getMessagesData(),
      ]);

      // 应用日期范围过滤
      const filteredWorkOrders = this.filterByDateRange(workOrders, options.dateRange);
      const filteredReports = this.filterByDateRange(reports, options.dateRange);
      const filteredAttendance = this.filterByDateRange(attendance, options.dateRange);

      // 生成统计数据
      const statistics = await this.generateStatistics(filteredWorkOrders, filteredReports);

      return {
        metadata: this.generateMetadata('完整数据导出', filteredWorkOrders.length, options.format),
        workOrders: filteredWorkOrders,
        reports: filteredReports,
        attendance: filteredAttendance,
        tracking,
        messages,
        statistics,
      };
    } catch (error) {
      console.error('Collect all data error:', error);
      throw error;
    }
  }

  // 获取工单数据
  private async getWorkOrdersData(): Promise<any[]> {
    try {
      const workOrdersStr = await AsyncStorage.getItem('work_orders');
      return workOrdersStr ? JSON.parse(workOrdersStr) : [];
    } catch (error) {
      console.error('Get work orders data error:', error);
      return [];
    }
  }

  // 获取报告数据
  private async getReportsData(): Promise<any[]> {
    try {
      const reportsStr = await AsyncStorage.getItem('reports');
      return reportsStr ? JSON.parse(reportsStr) : [];
    } catch (error) {
      console.error('Get reports data error:', error);
      return [];
    }
  }

  // 获取考勤数据
  private async getAttendanceData(): Promise<any[]> {
    try {
      const attendanceStr = await AsyncStorage.getItem('attendance_records_P001');
      return attendanceStr ? JSON.parse(attendanceStr) : [];
    } catch (error) {
      console.error('Get attendance data error:', error);
      return [];
    }
  }

  // 获取轨迹数据
  private async getTrackingData(): Promise<any[]> {
    try {
      const trackingStr = await AsyncStorage.getItem('patrol_tracks');
      return trackingStr ? JSON.parse(trackingStr) : [];
    } catch (error) {
      console.error('Get tracking data error:', error);
      return [];
    }
  }

  // 获取消息数据
  private async getMessagesData(): Promise<any[]> {
    try {
      const messagesStr = await AsyncStorage.getItem('messages');
      return messagesStr ? JSON.parse(messagesStr) : [];
    } catch (error) {
      console.error('Get messages data error:', error);
      return [];
    }
  }

  // 按日期范围过滤数据
  private filterByDateRange(data: any[], dateRange?: { start: number; end: number }): any[] {
    if (!dateRange) return data;

    return data.filter(item => {
      const itemTime = new Date(item.timestamp || item.time || item.createdAt || Date.now()).getTime();
      return itemTime >= dateRange.start && itemTime <= dateRange.end;
    });
  }

  // 生成元数据
  private generateMetadata(title: string, recordCount: number, format: string) {
    return {
      title,
      exportDate: new Date().toISOString(),
      dateRange: '全部数据',
      totalRecords: recordCount,
      format,
      version: '1.0.0',
      generator: '智慧河道巡查系统',
    };
  }

  // 格式化日期范围
  private formatDateRange(dateRange?: { start: number; end: number }): string {
    if (!dateRange) return '全部时间';
    
    const startDate = new Date(dateRange.start).toLocaleDateString('zh-CN');
    const endDate = new Date(dateRange.end).toLocaleDateString('zh-CN');
    return `${startDate} 至 ${endDate}`;
  }

  // 生成统计数据
  private async generateStatistics(workOrders: any[], reports: any[]): Promise<any> {
    const totalWorkOrders = workOrders.length;
    const completedWorkOrders = workOrders.filter(order => order.status === '已完成').length;
    const completionRate = totalWorkOrders > 0 ? Math.round((completedWorkOrders / totalWorkOrders) * 100) : 0;

    // 分类统计 - 使用新的问题分类系统
    const mainCategories = problemCategoryService.getMainCategories();
    const categoryStats = mainCategories.map(category => {
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
      const count = workOrders.filter(order => 
        detailIds.includes(order.type) || allSubIds.includes(order.type) || order.type === category.id
      ).length;
      
      return {
        name: category.name,
        count,
        percentage: totalWorkOrders > 0 ? Math.round((count / totalWorkOrders) * 100) : 0,
      };
    });

    // 优先级统计
    const priorities = ['低', '一般', '高', '紧急'];
    const priorityStats = priorities.map(priority => ({
      level: priority,
      count: workOrders.filter(order => order.priority === priority).length,
    }));

    // 状态统计
    const statuses = ['待接收', '处理中', '已完成', '已关闭'];
    const statusStats = statuses.map(status => ({
      status,
      count: workOrders.filter(order => order.status === status).length,
    }));

    return {
      overview: {
        totalWorkOrders,
        completedWorkOrders,
        completionRate,
        totalReports: reports.length,
      },
      categories: categoryStats,
      priorities: priorityStats,
      statuses: statusStats,
      summary: {
        avgCompletionTime: this.calculateAvgCompletionTime(workOrders),
        mostCommonCategory: this.getMostCommonCategory(categoryStats),
        mostCommonPriority: this.getMostCommonPriority(priorityStats),
      },
    };
  }

  // 计算平均完成时间
  private calculateAvgCompletionTime(workOrders: any[]): number {
    const completedOrders = workOrders.filter(order => order.status === '已完成' && order.completedAt);
    if (completedOrders.length === 0) return 0;

    const totalTime = completedOrders.reduce((sum, order) => {
      const startTime = new Date(order.time || order.createdAt).getTime();
      const endTime = new Date(order.completedAt).getTime();
      return sum + (endTime - startTime);
    }, 0);

    return Math.round(totalTime / completedOrders.length / (1000 * 60 * 60)); // 转换为小时
  }

  // 获取最常见的分类
  private getMostCommonCategory(categoryStats: any[]): string {
    if (categoryStats.length === 0) return '无';
    return categoryStats.reduce((max, category) => 
      category.count > max.count ? category : max
    ).name;
  }

  // 获取最常见的优先级
  private getMostCommonPriority(priorityStats: any[]): string {
    if (priorityStats.length === 0) return '无';
    return priorityStats.reduce((max, priority) => 
      priority.count > max.count ? priority : max
    ).level;
  }

  // 导出为JSON格式
  private async exportAsJSON(data: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const fileName = `export_${Date.now()}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, jsonString);
      
      // 缓存导出记录
      await this.cacheExportRecord(fileName, filePath, 'json');
      
      return filePath;
    } catch (error) {
      console.error('Export as JSON error:', error);
      throw error;
    }
  }

  // 导出为CSV格式
  private async exportAsCSV(data: any, primaryTable?: string): Promise<string> {
    try {
      let csvContent = '';
      
      if (primaryTable && data[primaryTable]) {
        csvContent = this.convertToCSV(data[primaryTable]);
      } else if (data.workOrders) {
        csvContent = this.convertToCSV(data.workOrders);
      } else {
        // 导出多个表格
        csvContent = this.convertMultipleTableToCSV(data);
      }

      const fileName = `export_${Date.now()}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent);
      
      // 缓存导出记录
      await this.cacheExportRecord(fileName, filePath, 'csv');
      
      return filePath;
    } catch (error) {
      console.error('Export as CSV error:', error);
      throw error;
    }
  }

  // 导出为Excel格式 (简化版，实际上是CSV)
  private async exportAsExcel(data: any): Promise<string> {
    // 由于React Native环境限制，这里实际导出为CSV格式，但使用.xlsx扩展名
    // 在实际项目中，可以考虑使用专门的Excel库
    try {
      const csvContent = this.convertMultipleTableToCSV(data);
      const fileName = `export_${Date.now()}.xlsx`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent);
      
      // 缓存导出记录
      await this.cacheExportRecord(fileName, filePath, 'excel');
      
      return filePath;
    } catch (error) {
      console.error('Export as Excel error:', error);
      throw error;
    }
  }

  // 将数组转换为CSV格式
  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // 处理包含逗号的值
        return typeof value === 'string' && value.includes(',') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  // 将多个表格转换为CSV格式
  private convertMultipleTableToCSV(data: any): string {
    let csvContent = '';
    
    const tables = ['workOrders', 'reports', 'attendance', 'tracking', 'messages'];
    
    for (const table of tables) {
      if (data[table] && Array.isArray(data[table]) && data[table].length > 0) {
        csvContent += `\n=== ${table.toUpperCase()} ===\n`;
        csvContent += this.convertToCSV(data[table]);
        csvContent += '\n';
      }
    }

    // 添加统计摘要
    if (data.statistics) {
      csvContent += '\n=== STATISTICS SUMMARY ===\n';
      csvContent += this.convertStatisticsToCSV(data.statistics);
    }

    return csvContent;
  }

  // 将统计数据转换为CSV格式
  private convertStatisticsToCSV(statistics: any): string {
    let csvContent = '';
    
    // 概览统计
    if (statistics.overview) {
      csvContent += 'Overview\n';
      csvContent += Object.entries(statistics.overview)
        .map(([key, value]) => `${key},${value}`)
        .join('\n') + '\n\n';
    }

    // 分类统计
    if (statistics.categories) {
      csvContent += 'Categories\n';
      csvContent += 'Name,Count,Percentage\n';
      csvContent += statistics.categories
        .map((cat: any) => `${cat.name},${cat.count},${cat.percentage}%`)
        .join('\n') + '\n\n';
    }

    return csvContent;
  }

  // 缓存导出记录
  private async cacheExportRecord(fileName: string, filePath: string, format: string): Promise<void> {
    try {
      const cacheStr = await AsyncStorage.getItem(this.EXPORT_CACHE_KEY);
      const cache = cacheStr ? JSON.parse(cacheStr) : [];

      const record = {
        id: `export_${Date.now()}`,
        fileName,
        filePath,
        format,
        size: await this.getFileSize(filePath),
        createdAt: Date.now(),
      };

      cache.unshift(record);

      // 保持缓存大小限制
      if (cache.length > this.MAX_CACHE_SIZE) {
        const removedRecords = cache.splice(this.MAX_CACHE_SIZE);
        // 删除超出限制的文件
        for (const removedRecord of removedRecords) {
          try {
            await FileSystem.deleteAsync(removedRecord.filePath, { idempotent: true });
          } catch (error) {
            console.warn('Failed to delete cached export file:', error);
          }
        }
      }

      await AsyncStorage.setItem(this.EXPORT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Cache export record error:', error);
    }
  }

  // 获取文件大小
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists ? (fileInfo.size || 0) : 0;
    } catch (error) {
      console.error('Get file size error:', error);
      return 0;
    }
  }

  // 获取导出历史
  async getExportHistory(): Promise<any[]> {
    try {
      const cacheStr = await AsyncStorage.getItem(this.EXPORT_CACHE_KEY);
      return cacheStr ? JSON.parse(cacheStr) : [];
    } catch (error) {
      console.error('Get export history error:', error);
      return [];
    }
  }

  // 分享导出文件
  async shareExportFile(filePath: string): Promise<boolean> {
    try {
      const fileExists = (await FileSystem.getInfoAsync(filePath)).exists;
      if (!fileExists) {
        Alert.alert('文件不存在', '导出文件已被删除或移动');
        return false;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('分享不可用', '当前设备不支持文件分享功能');
        return false;
      }

      await Sharing.shareAsync(filePath);
      return true;
    } catch (error) {
      console.error('Share export file error:', error);
      Alert.alert('分享失败', '文件分享过程中发生错误');
      return false;
    }
  }

  // 删除导出文件
  async deleteExportFile(exportId: string): Promise<boolean> {
    try {
      const history = await this.getExportHistory();
      const exportRecord = history.find(record => record.id === exportId);
      
      if (!exportRecord) {
        Alert.alert('记录不存在', '找不到指定的导出记录');
        return false;
      }

      // 删除文件
      await FileSystem.deleteAsync(exportRecord.filePath, { idempotent: true });

      // 从缓存中移除记录
      const updatedHistory = history.filter(record => record.id !== exportId);
      await AsyncStorage.setItem(this.EXPORT_CACHE_KEY, JSON.stringify(updatedHistory));

      return true;
    } catch (error) {
      console.error('Delete export file error:', error);
      Alert.alert('删除失败', '文件删除过程中发生错误');
      return false;
    }
  }

  // 清理所有导出文件
  async clearAllExports(): Promise<boolean> {
    try {
      const history = await this.getExportHistory();
      
      // 删除所有文件
      for (const record of history) {
        try {
          await FileSystem.deleteAsync(record.filePath, { idempotent: true });
        } catch (error) {
          console.warn('Failed to delete export file:', record.fileName, error);
        }
      }

      // 清空缓存
      await AsyncStorage.removeItem(this.EXPORT_CACHE_KEY);

      return true;
    } catch (error) {
      console.error('Clear all exports error:', error);
      Alert.alert('清理失败', '清理导出文件过程中发生错误');
      return false;
    }
  }

  // 格式化文件大小
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // 获取支持的导出格式
  getSupportedFormats(): { value: string; label: string; description: string }[] {
    return [
      {
        value: 'json',
        label: 'JSON',
        description: '适合程序处理的结构化数据格式',
      },
      {
        value: 'csv',
        label: 'CSV',
        description: '适合Excel等表格软件打开的格式',
      },
      {
        value: 'excel',
        label: 'Excel',
        description: '微软Excel格式（实验性支持）',
      },
    ];
  }
}

export default new DataExportService();