import OptimizedApiService from './OptimizedApiService';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UpdateWorkOrderStatusRequest {
  workorder_id: string;
  action: 'accept' | 'start' | 'complete' | 'review' | 'approve' | 'reject' | 'cancel';
  note?: string;
  location_info?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  attachments?: string[];
}

export interface UpdateWorkOrderStatusResponse {
  success: boolean;
  message: string;
  data?: {
    workorder_id: string;
    old_status: string;
    new_status: string;
    updated_at: string;
  };
}

export interface SubmitWorkOrderResultRequest {
  workorder_id: string;
  process_method: string;
  process_result: string;
  before_photos?: string[];
  after_photos?: string[];
  need_followup?: boolean;
  followup_reason?: string;
  location_info?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

class WorkOrderApiService {
  // 更新工单状态 - 使用新的 app-workorders API
  async updateWorkOrderStatus(request: UpdateWorkOrderStatusRequest): Promise<UpdateWorkOrderStatusResponse> {
    try {
      console.log('更新工单状态:', request);

      // 直接调用新的 app-workorders API
      const token = await AsyncStorage.getItem('access_token');
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const url = `${baseUrl}/api/app-workorders/${request.workorder_id}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: request.action,
          note: request.note,
          attachments: request.attachments,
          assigneeId: (request as any).assigneeId,
          processResult: (request as any).processResult,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || '更新失败');
      }

      console.log('工单状态更新成功:', result);
      return {
        success: result.success,
        message: result.message || '更新成功',
        data: result.data ? {
          workorder_id: result.data.workorder?.id || request.workorder_id,
          old_status: result.data.oldStatus,
          new_status: result.data.newStatus,
          updated_at: result.data.workorder?.updated_at || new Date().toISOString(),
        } : undefined
      };
    } catch (error) {
      console.error('工单状态更新失败:', error);
      Alert.alert('更新失败', error instanceof Error ? error.message : '网络错误，请重试');
      return {
        success: false,
        message: error instanceof Error ? error.message : '网络错误，请重试'
      };
    }
  }

  // 分配工单（区域主管使用）
  async assignWorkOrder(workOrderId: string, assigneeId: string, note?: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'assign',
      note: note || '分配工单',
      assigneeId,
    } as any);
  }

  // 开始处理工单
  async startWorkOrder(workOrderId: string, locationInfo?: { latitude: number; longitude: number; address?: string }, note?: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'start',
      location_info: locationInfo,
      note: note || '开始处理工单',
    });
  }

  // 提交处理结果（维护员使用）
  async submitResult(workOrderId: string, processResult?: any, attachments?: string[], note?: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'submit_result',
      attachments: attachments || [],
      note: note || '提交处理结果',
      processResult: processResult || '',
    } as any);
  }

  // 审核通过（区域主管使用）
  async approveWorkOrder(workOrderId: string, note?: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'approve',
      note: note || '审核通过',
    });
  }

  // 审核拒绝/打回（区域主管使用）
  async rejectWorkOrder(workOrderId: string, note: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'reject',
      note,
    });
  }

  // 取消工单
  async cancelWorkOrder(workOrderId: string, note: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'cancel',
      note,
    });
  }

  // 提交工单处理结果
  async submitWorkOrderResult(request: SubmitWorkOrderResultRequest): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      console.log('提交工单处理结果到数据库:', request);

      // 首先创建工单结果记录
      const resultResponse = await fetch(`${baseUrl}/api/create-workorder-result`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!resultResponse.ok) {
        const error = await resultResponse.json();
        throw new Error(error.message || '提交处理结果失败');
      }

      const result = await resultResponse.json();

      // 然后更新工单状态为完成或待审核
      const newStatus = request.need_followup ? 'pending_review' : 'completed';
      await this.updateWorkOrderStatus({
        workorder_id: request.workorder_id,
        action: request.need_followup ? 'review' : 'complete',
        attachments: [...(request.before_photos || []), ...(request.after_photos || [])],
        note: `处理完成：${request.process_result}`,
        location_info: request.location_info,
      });

      console.log('工单处理结果已保存到数据库:', result);
      return { ...result, success: true };
    } catch (error) {
      console.error('提交工单处理结果到数据库失败:', error);
      Alert.alert('提交失败', error instanceof Error ? error.message : '网络错误，请重试');
      throw error;
    }
  }

  // 获取工单列表 - 使用新的 app-workorders API
  async getWorkOrders(params?: {
    user_id?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<any> {
    try {
      console.log('获取工单列表 - 参数:', params);

      // 使用新的 app-workorders API
      const token = await AsyncStorage.getItem('access_token');
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.size) queryParams.append('limit', params.size.toString());
      
      const url = `${baseUrl}/api/app-workorders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || '获取工单列表失败');
      }

      console.log('工单列表获取成功:', result.data?.items?.length || 0, '个工单');
      return result;
    } catch (error) {
      console.error('获取工单列表失败:', error);
      Alert.alert('加载失败', error instanceof Error ? error.message : '网络错误，请重试');
      throw error;
    }
  }

  // 上传处理结果照片 - 使用 OptimizedApiService
  async uploadResultPhoto(file: File | { uri: string; name: string; type: string }, workOrderId: string): Promise<any> {
    try {
      console.log('开始上传图片, 工单ID:', workOrderId);

      const result = await OptimizedApiService.uploadFile(file as any, 'result_photo', workOrderId);
      
      console.log('图片上传成功:', result.data?.file_url);
      return result;
    } catch (error) {
      console.error('图片上传失败:', error);
      Alert.alert('上传失败', error instanceof Error ? error.message : '图片上传失败，请重试');
      throw error;
    }
  }

  // 批量上传图片
  async uploadMultiplePhotos(photos: any[], workOrderId: string, uploadType: string = 'result_photo'): Promise<string[]> {
    try {
      console.log(`开始批量上传 ${photos.length} 张图片...`);
      
      const uploadPromises = photos.map(async (photo, index) => {
        try {
          const result = await this.uploadResultPhoto(photo, workOrderId);
          console.log(`图片 ${index + 1}/${photos.length} 上传成功`);
          return result.data?.file_url;
        } catch (error) {
          console.error(`图片 ${index + 1} 上传失败:`, error);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successUrls = results.filter(url => url !== null);
      
      console.log(`批量上传完成: ${successUrls.length}/${photos.length} 张图片上传成功`);
      
      if (successUrls.length < photos.length) {
        Alert.alert('部分上传失败', `${photos.length - successUrls.length} 张图片上传失败，已成功上传 ${successUrls.length} 张`);
      }
      
      return successUrls;
    } catch (error) {
      console.error('批量上传图片失败:', error);
      throw error;
    }
  }

  // 最终复核通过
  async finalApproveWorkOrder(workOrderId: string, note?: string): Promise<ApiResponse> {
    try {
      const response = await this.updateWorkOrderStatus({
        workorder_id: workOrderId,
        action: 'final_approve' as any,
        note: note || '最终复核通过',
      });
      return response;
    } catch (error) {
      console.error('最终复核通过失败:', error);
      throw error;
    }
  }

  // 最终复核拒绝
  async finalRejectWorkOrder(workOrderId: string, reason: string): Promise<ApiResponse> {
    try {
      const response = await this.updateWorkOrderStatus({
        workorder_id: workOrderId,
        action: 'final_reject' as any,
        note: reason,
      });
      return response;
    } catch (error) {
      console.error('最终复核拒绝失败:', error);
      throw error;
    }
  }

  // 同步本地数据到服务器
  async syncOfflineData(): Promise<void> {
    try {
      // 这里可以实现离线数据同步逻辑
      // 例如：将 AsyncStorage 中的未同步数据发送到服务器
      console.log('开始同步离线数据...');
      
      // TODO: 实现具体的同步逻辑
      
      console.log('离线数据同步完成');
    } catch (error) {
      console.error('离线数据同步失败:', error);
    }
  }
}

export default new WorkOrderApiService();