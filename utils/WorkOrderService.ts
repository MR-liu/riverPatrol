import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface WorkOrderPhoto {
  id: string;
  uri: string;
  timestamp: number;
  type: 'before' | 'after' | 'process';
  location?: {
    latitude: number;
    longitude: number;
  };
  description?: string;
}

export interface WorkOrderProcessData {
  workOrderId: string;
  processMethod: string;
  processDescription: string;
  beforePhotos: WorkOrderPhoto[];
  afterPhotos: WorkOrderPhoto[];
  processPhotos?: WorkOrderPhoto[];
  result: 'completed' | 'partial' | 'failed';
  needFollowUp: boolean;
  followUpReason?: string;
  startTime: number;
  endTime: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  materials?: {
    name: string;
    quantity: number;
    unit: string;
  }[];
  personnel?: {
    id: string;
    name: string;
    role: string;
  }[];
  notes?: string;
  signature?: string; // Base64 encoded signature
}

export interface WorkOrderTransferData {
  workOrderId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  timestamp: number;
  notes?: string;
}

export interface WorkOrderComment {
  id: string;
  workOrderId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: 'comment' | 'system' | 'status_change';
  attachments?: string[];
}

export interface WorkOrderTimeline {
  id: string;
  workOrderId: string;
  action: string;
  description: string;
  timestamp: number;
  userId: string;
  userName: string;
  metadata?: any;
}

class WorkOrderService {
  private readonly STORAGE_KEYS = {
    PROCESS_DATA: 'workorder_process_data',
    TRANSFER_HISTORY: 'workorder_transfer_history',
    COMMENTS: 'workorder_comments',
    TIMELINE: 'workorder_timeline',
    DRAFT: 'workorder_draft',
    TEMPLATES: 'workorder_templates',
  };

  // 保存处理结果
  async saveProcessResult(data: WorkOrderProcessData): Promise<boolean> {
    try {
      // 验证数据
      if (!this.validateProcessData(data)) {
        Alert.alert('数据验证失败', '请检查填写的信息是否完整');
        return false;
      }

      // 获取现有数据
      const existingData = await this.getProcessData();
      existingData.push(data);

      // 保存到存储
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PROCESS_DATA,
        JSON.stringify(existingData)
      );

      // 添加到时间线
      await this.addTimelineEntry({
        id: `timeline_${Date.now()}`,
        workOrderId: data.workOrderId,
        action: 'process_completed',
        description: `工单处理${data.result === 'completed' ? '完成' : '部分完成'}`,
        timestamp: data.endTime,
        userId: 'current_user',
        userName: '当前用户',
        metadata: {
          result: data.result,
          needFollowUp: data.needFollowUp,
        },
      });

      return true;
    } catch (error) {
      console.error('Save process result error:', error);
      Alert.alert('保存失败', '处理结果保存失败，请重试');
      return false;
    }
  }

  // 验证处理数据
  private validateProcessData(data: WorkOrderProcessData): boolean {
    if (!data.workOrderId || !data.processMethod || !data.processDescription) {
      return false;
    }

    if (!data.beforePhotos || data.beforePhotos.length === 0) {
      Alert.alert('缺少照片', '请至少上传一张处理前照片');
      return false;
    }

    if (!data.afterPhotos || data.afterPhotos.length === 0) {
      Alert.alert('缺少照片', '请至少上传一张处理后照片');
      return false;
    }

    if (data.needFollowUp && !data.followUpReason) {
      Alert.alert('缺少信息', '请填写需要后续跟进的原因');
      return false;
    }

    return true;
  }

  // 获取处理数据
  async getProcessData(workOrderId?: string): Promise<WorkOrderProcessData[]> {
    try {
      const dataStr = await AsyncStorage.getItem(this.STORAGE_KEYS.PROCESS_DATA);
      const allData: WorkOrderProcessData[] = dataStr ? JSON.parse(dataStr) : [];
      
      if (workOrderId) {
        return allData.filter(d => d.workOrderId === workOrderId);
      }
      
      return allData;
    } catch (error) {
      console.error('Get process data error:', error);
      return [];
    }
  }

  // 转派工单
  async transferWorkOrder(data: WorkOrderTransferData): Promise<boolean> {
    try {
      // 验证转派数据
      if (!data.toUserId || !data.reason) {
        Alert.alert('信息不完整', '请选择转派对象并填写转派原因');
        return false;
      }

      // 保存转派记录
      const history = await this.getTransferHistory();
      history.push(data);
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.TRANSFER_HISTORY,
        JSON.stringify(history)
      );

      // 添加到时间线
      await this.addTimelineEntry({
        id: `timeline_${Date.now()}`,
        workOrderId: data.workOrderId,
        action: 'transferred',
        description: `工单已转派给 ${data.toUserId}`,
        timestamp: data.timestamp,
        userId: data.fromUserId,
        userName: '当前用户',
        metadata: {
          toUserId: data.toUserId,
          reason: data.reason,
        },
      });

      Alert.alert('转派成功', '工单已成功转派');
      return true;
    } catch (error) {
      console.error('Transfer work order error:', error);
      Alert.alert('转派失败', '工单转派失败，请重试');
      return false;
    }
  }

  // 获取转派历史
  async getTransferHistory(workOrderId?: string): Promise<WorkOrderTransferData[]> {
    try {
      const historyStr = await AsyncStorage.getItem(this.STORAGE_KEYS.TRANSFER_HISTORY);
      const allHistory: WorkOrderTransferData[] = historyStr ? JSON.parse(historyStr) : [];
      
      if (workOrderId) {
        return allHistory.filter(h => h.workOrderId === workOrderId);
      }
      
      return allHistory;
    } catch (error) {
      console.error('Get transfer history error:', error);
      return [];
    }
  }

  // 添加评论
  async addComment(comment: WorkOrderComment): Promise<boolean> {
    try {
      const comments = await this.getComments();
      comments.push(comment);
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.COMMENTS,
        JSON.stringify(comments)
      );

      // 添加到时间线
      await this.addTimelineEntry({
        id: `timeline_${Date.now()}`,
        workOrderId: comment.workOrderId,
        action: 'commented',
        description: '添加了评论',
        timestamp: comment.timestamp,
        userId: comment.userId,
        userName: comment.userName,
        metadata: {
          content: comment.content,
        },
      });

      return true;
    } catch (error) {
      console.error('Add comment error:', error);
      return false;
    }
  }

  // 获取评论
  async getComments(workOrderId?: string): Promise<WorkOrderComment[]> {
    try {
      const commentsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.COMMENTS);
      const allComments: WorkOrderComment[] = commentsStr ? JSON.parse(commentsStr) : [];
      
      if (workOrderId) {
        return allComments.filter(c => c.workOrderId === workOrderId);
      }
      
      return allComments;
    } catch (error) {
      console.error('Get comments error:', error);
      return [];
    }
  }

  // 添加时间线条目
  async addTimelineEntry(entry: WorkOrderTimeline): Promise<boolean> {
    try {
      const timeline = await this.getTimeline();
      timeline.push(entry);
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.TIMELINE,
        JSON.stringify(timeline)
      );
      
      return true;
    } catch (error) {
      console.error('Add timeline entry error:', error);
      return false;
    }
  }

  // 获取时间线
  async getTimeline(workOrderId?: string): Promise<WorkOrderTimeline[]> {
    try {
      const timelineStr = await AsyncStorage.getItem(this.STORAGE_KEYS.TIMELINE);
      const allTimeline: WorkOrderTimeline[] = timelineStr ? JSON.parse(timelineStr) : [];
      
      if (workOrderId) {
        return allTimeline
          .filter(t => t.workOrderId === workOrderId)
          .sort((a, b) => b.timestamp - a.timestamp);
      }
      
      return allTimeline.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Get timeline error:', error);
      return [];
    }
  }

  // 保存草稿
  async saveDraft(workOrderId: string, draftData: any): Promise<boolean> {
    try {
      const drafts = await this.getDrafts();
      drafts[workOrderId] = {
        ...draftData,
        savedAt: Date.now(),
      };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.DRAFT,
        JSON.stringify(drafts)
      );
      
      return true;
    } catch (error) {
      console.error('Save draft error:', error);
      return false;
    }
  }

  // 获取草稿
  async getDraft(workOrderId: string): Promise<any | null> {
    try {
      const drafts = await this.getDrafts();
      return drafts[workOrderId] || null;
    } catch (error) {
      console.error('Get draft error:', error);
      return null;
    }
  }

  // 获取所有草稿
  private async getDrafts(): Promise<Record<string, any>> {
    try {
      const draftsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.DRAFT);
      return draftsStr ? JSON.parse(draftsStr) : {};
    } catch (error) {
      console.error('Get drafts error:', error);
      return {};
    }
  }

  // 删除草稿
  async deleteDraft(workOrderId: string): Promise<boolean> {
    try {
      const drafts = await this.getDrafts();
      delete drafts[workOrderId];
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.DRAFT,
        JSON.stringify(drafts)
      );
      
      return true;
    } catch (error) {
      console.error('Delete draft error:', error);
      return false;
    }
  }

  // 保存处理模板
  async saveTemplate(name: string, template: any): Promise<boolean> {
    try {
      const templates = await this.getTemplates();
      templates[name] = {
        ...template,
        createdAt: Date.now(),
      };
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.TEMPLATES,
        JSON.stringify(templates)
      );
      
      Alert.alert('保存成功', '处理模板已保存');
      return true;
    } catch (error) {
      console.error('Save template error:', error);
      Alert.alert('保存失败', '模板保存失败，请重试');
      return false;
    }
  }

  // 获取处理模板
  async getTemplates(): Promise<Record<string, any>> {
    try {
      const templatesStr = await AsyncStorage.getItem(this.STORAGE_KEYS.TEMPLATES);
      return templatesStr ? JSON.parse(templatesStr) : {};
    } catch (error) {
      console.error('Get templates error:', error);
      return {};
    }
  }

  // 删除模板
  async deleteTemplate(name: string): Promise<boolean> {
    try {
      const templates = await this.getTemplates();
      delete templates[name];
      
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.TEMPLATES,
        JSON.stringify(templates)
      );
      
      return true;
    } catch (error) {
      console.error('Delete template error:', error);
      return false;
    }
  }

  // 计算工单处理时长
  calculateProcessDuration(startTime: number, endTime: number): string {
    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }

  // 获取工单统计
  async getWorkOrderStats(): Promise<{
    totalProcessed: number;
    completedCount: number;
    partialCount: number;
    failedCount: number;
    averageProcessTime: number;
    needFollowUpCount: number;
  }> {
    try {
      const processData = await this.getProcessData();
      
      const stats = {
        totalProcessed: processData.length,
        completedCount: processData.filter(d => d.result === 'completed').length,
        partialCount: processData.filter(d => d.result === 'partial').length,
        failedCount: processData.filter(d => d.result === 'failed').length,
        averageProcessTime: 0,
        needFollowUpCount: processData.filter(d => d.needFollowUp).length,
      };
      
      if (processData.length > 0) {
        const totalTime = processData.reduce(
          (sum, d) => sum + (d.endTime - d.startTime),
          0
        );
        stats.averageProcessTime = totalTime / processData.length;
      }
      
      return stats;
    } catch (error) {
      console.error('Get work order stats error:', error);
      return {
        totalProcessed: 0,
        completedCount: 0,
        partialCount: 0,
        failedCount: 0,
        averageProcessTime: 0,
        needFollowUpCount: 0,
      };
    }
  }

  // 清理过期数据（保留30天）
  async cleanupOldData(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      // 清理处理数据
      const processData = await this.getProcessData();
      const filteredProcessData = processData.filter(d => d.endTime > thirtyDaysAgo);
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PROCESS_DATA,
        JSON.stringify(filteredProcessData)
      );
      
      // 清理时间线
      const timeline = await this.getTimeline();
      const filteredTimeline = timeline.filter(t => t.timestamp > thirtyDaysAgo);
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.TIMELINE,
        JSON.stringify(filteredTimeline)
      );
      
      // 清理评论
      const comments = await this.getComments();
      const filteredComments = comments.filter(c => c.timestamp > thirtyDaysAgo);
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.COMMENTS,
        JSON.stringify(filteredComments)
      );
    } catch (error) {
      console.error('Cleanup old data error:', error);
    }
  }
}

export default new WorkOrderService();