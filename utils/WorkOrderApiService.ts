import OptimizedApiService from './OptimizedApiService';
import { Alert } from 'react-native';

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
  // 更新工单状态 - 使用 OptimizedApiService
  async updateWorkOrderStatus(request: UpdateWorkOrderStatusRequest): Promise<UpdateWorkOrderStatusResponse> {
    try {
      console.log('更新工单状态:', request);

      const result = await OptimizedApiService.updateWorkOrderStatus(
        request.workorder_id,
        request.action,
        request.note,
        request.location_info,
        request.attachments
      );

      console.log('工单状态更新成功:', result);
      return {
        success: result.success,
        message: result.message || '更新成功',
        data: result.data ? {
          workorder_id: result.data.workorder_id,
          old_status: result.data.old_status,
          new_status: result.data.new_status,
          updated_at: new Date().toISOString(),
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

  // 接收工单
  async acceptWorkOrder(workOrderId: string, note?: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'accept',
      note: note || '工单已接收',
    });
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

  // 完成工单
  async completeWorkOrder(workOrderId: string, attachments?: string[], note?: string): Promise<UpdateWorkOrderStatusResponse> {
    return this.updateWorkOrderStatus({
      workorder_id: workOrderId,
      action: 'complete',
      attachments,
      note: note || '工单处理完成',
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
      const token = this.getAuthToken();
      const headers = getAuthHeaders(token);

      console.log('提交工单处理结果到数据库:', request);

      // 首先创建工单结果记录
      const resultResponse = await fetch(`${this.baseUrl}/create-workorder-result`, {
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

  // 获取工单列表 - 使用 OptimizedApiService
  async getWorkOrders(params?: {
    user_id?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<any> {
    try {
      console.log('获取工单列表 - 参数:', params);

      const result = await OptimizedApiService.getWorkOrders(params || {});
      
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