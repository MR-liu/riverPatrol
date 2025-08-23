import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface ReportPhoto {
  id: string;
  uri: string;
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  description?: string;
}

export interface ReportForm {
  id: string;
  category: string;
  selectedItems: string[];
  title: string;
  description: string;
  location: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  photos: ReportPhoto[];
  reporterInfo: {
    name: string;
    phone?: string;
    email?: string;
  };
  metadata: {
    timestamp: number;
    deviceInfo: string;
    appVersion: string;
  };
  status: 'draft' | 'submitting' | 'submitted' | 'failed';
}

export interface ReportDraft {
  id: string;
  formData: Partial<ReportForm>;
  lastSaved: number;
  autoSaved: boolean;
}

class ReportService {
  private readonly STORAGE_KEYS = {
    REPORTS: 'reports',
    DRAFTS: 'report_drafts',
  };

  // 验证报告表单
  validateReport(form: Partial<ReportForm>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!form.category) {
      errors.push('请选择问题分类');
    }

    if (!form.selectedItems || form.selectedItems.length === 0) {
      errors.push('请至少选择一个具体问题');
    }

    if (!form.description || form.description.trim().length === 0) {
      errors.push('请填写问题描述');
    }

    if (!form.location?.address || form.location.address.trim().length === 0) {
      errors.push('请填写位置信息');
    }

    if (!form.photos || form.photos.length === 0) {
      errors.push('请至少上传一张现场照片');
    }

    if (!form.reporterInfo?.name || form.reporterInfo.name.trim().length === 0) {
      errors.push('请填写报告人姓名');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 创建新报告
  async createReport(formData: Partial<ReportForm>): Promise<ReportForm> {
    const report: ReportForm = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: formData.category || '',
      selectedItems: formData.selectedItems || [],
      title: formData.title || this.generateTitle(formData),
      description: formData.description || '',
      location: {
        address: formData.location?.address || '当前位置',
        coordinates: formData.location?.coordinates,
      },
      priority: formData.priority || 'normal',
      photos: formData.photos || [],
      reporterInfo: {
        name: formData.reporterInfo?.name || '匿名用户',
        phone: formData.reporterInfo?.phone,
        email: formData.reporterInfo?.email,
      },
      metadata: {
        timestamp: Date.now(),
        deviceInfo: 'Mobile Device',
        appVersion: '1.0.0',
      },
      status: 'draft',
    };

    return report;
  }

  // 保存报告草稿
  async saveDraft(formData: Partial<ReportForm>, autoSave = false): Promise<boolean> {
    try {
      const draftId = formData.id || `draft_${Date.now()}`;
      
      const draft: ReportDraft = {
        id: draftId,
        formData,
        lastSaved: Date.now(),
        autoSaved: autoSave,
      };

      const existingDrafts = await this.getDrafts();
      const updatedDrafts = existingDrafts.filter(d => d.id !== draftId);
      updatedDrafts.push(draft);

      await AsyncStorage.setItem(this.STORAGE_KEYS.DRAFTS, JSON.stringify(updatedDrafts));
      
      if (!autoSave) {
        Alert.alert('保存成功', '草稿已保存');
      }
      
      return true;
    } catch (error) {
      console.error('Save draft error:', error);
      if (!autoSave) {
        Alert.alert('保存失败', '草稿保存失败，请重试');
      }
      return false;
    }
  }

  // 获取草稿列表
  async getDrafts(): Promise<ReportDraft[]> {
    try {
      const draftsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.DRAFTS);
      return draftsStr ? JSON.parse(draftsStr) : [];
    } catch (error) {
      console.error('Get drafts error:', error);
      return [];
    }
  }

  // 删除草稿
  async deleteDraft(draftId: string): Promise<boolean> {
    try {
      const drafts = await this.getDrafts();
      const filteredDrafts = drafts.filter(d => d.id !== draftId);
      await AsyncStorage.setItem(this.STORAGE_KEYS.DRAFTS, JSON.stringify(filteredDrafts));
      return true;
    } catch (error) {
      console.error('Delete draft error:', error);
      return false;
    }
  }

  // 提交报告
  async submitReport(report: ReportForm): Promise<boolean> {
    try {
      const validation = this.validateReport(report);
      if (!validation.isValid) {
        Alert.alert('验证失败', validation.errors.join('\n'));
        return false;
      }

      const submittingReport = {
        ...report,
        status: 'submitted' as const,
        metadata: {
          ...report.metadata,
          timestamp: Date.now(),
        },
      };

      await this.saveReport(submittingReport);
      await this.deleteDraft(report.id);
      
      Alert.alert('提交成功', '报告已成功提交，我们会尽快处理');
      return true;
    } catch (error) {
      console.error('Submit report error:', error);
      Alert.alert('提交失败', '报告提交时发生错误，请重试');
      return false;
    }
  }

  // 保存报告到本地
  private async saveReport(report: ReportForm): Promise<void> {
    const reports = await this.getReports();
    const existingIndex = reports.findIndex(r => r.id === report.id);
    
    if (existingIndex >= 0) {
      reports[existingIndex] = report;
    } else {
      reports.push(report);
    }

    await AsyncStorage.setItem(this.STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  }

  // 获取报告列表
  async getReports(): Promise<ReportForm[]> {
    try {
      const reportsStr = await AsyncStorage.getItem(this.STORAGE_KEYS.REPORTS);
      return reportsStr ? JSON.parse(reportsStr) : [];
    } catch (error) {
      console.error('Get reports error:', error);
      return [];
    }
  }

  // 生成报告标题
  private generateTitle(formData: Partial<ReportForm>): string {
    const category = formData.category || '问题';
    const location = formData.location?.address || '未知位置';
    return `${category}报告 - ${location}`;
  }
}

export default new ReportService();