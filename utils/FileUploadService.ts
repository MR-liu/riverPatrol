import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export interface UploadFile {
  id: string;
  uri: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
}

export interface UploadProgress {
  fileId: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  url?: string;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
}

class FileUploadService {
  private uploadQueue: UploadFile[] = [];
  private isProcessing = false;

  // 添加文件到上传队列
  async addFileToQueue(
    uri: string, 
    category: 'workorder' | 'avatar' | 'report' = 'workorder',
    shouldCompress: boolean = true
  ): Promise<string> {
    try {
      // 获取文件信息
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('文件不存在');
      }

      let processedUri = uri;
      
      // 图片压缩处理
      if (shouldCompress && this.isImageFile(uri)) {
        const compressed = await this.compressImage(uri);
        processedUri = compressed.uri;
      }

      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileName = this.generateFileName(fileId, uri);
      
      const uploadFile: UploadFile = {
        id: fileId,
        uri: processedUri,
        name: fileName,
        type: category,
        size: fileInfo.size || 0,
        mimeType: this.getMimeType(uri),
      };

      this.uploadQueue.push(uploadFile);
      
      // 保存到本地存储
      await this.saveUploadQueue();
      
      // 开始处理队列
      this.processUploadQueue();
      
      return fileId;
    } catch (error) {
      console.error('Add file to queue error:', error);
      throw error;
    }
  }

  // 批量添加文件
  async addFilesToQueue(
    uris: string[], 
    category: 'workorder' | 'avatar' | 'report' = 'workorder'
  ): Promise<string[]> {
    const fileIds: string[] = [];
    
    for (const uri of uris) {
      try {
        const fileId = await this.addFileToQueue(uri, category);
        fileIds.push(fileId);
      } catch (error) {
        console.error(`Failed to add file ${uri}:`, error);
      }
    }
    
    return fileIds;
  }

  // 处理上传队列
  private async processUploadQueue(): Promise<void> {
    if (this.isProcessing || this.uploadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      while (this.uploadQueue.length > 0) {
        const file = this.uploadQueue.shift();
        if (file) {
          await this.uploadSingleFile(file);
        }
      }
    } catch (error) {
      console.error('Process upload queue error:', error);
    } finally {
      this.isProcessing = false;
      await this.saveUploadQueue();
    }
  }

  // 上传单个文件
  private async uploadSingleFile(file: UploadFile): Promise<UploadResult> {
    try {
      // 更新上传状态
      await this.updateUploadProgress(file.id, 0, 'uploading');

      // 模拟上传进度
      for (let progress = 10; progress <= 90; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        await this.updateUploadProgress(file.id, progress, 'uploading');
      }

      // 模拟文件上传完成
      const mockUrl = `https://cdn.riverpatrol.com/uploads/${file.name}`;
      const mockThumbnailUrl = this.isImageFile(file.uri) 
        ? `https://cdn.riverpatrol.com/thumbnails/${file.name}` 
        : undefined;

      // 保存到本地文件映射
      await this.saveFileMapping(file.id, mockUrl, mockThumbnailUrl);

      // 更新为完成状态
      await this.updateUploadProgress(file.id, 100, 'completed', mockUrl);

      return {
        success: true,
        fileId: file.id,
        url: mockUrl,
        thumbnailUrl: mockThumbnailUrl,
      };
    } catch (error) {
      console.error('Upload single file error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      await this.updateUploadProgress(file.id, 0, 'failed', undefined, errorMessage);
      
      return {
        success: false,
        fileId: file.id,
        error: errorMessage,
      };
    }
  }

  // 图片压缩
  private async compressImage(uri: string): Promise<{ uri: string }> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1080 } }, // 最大宽度1080px
        ],
        {
          compress: 0.8, // 压缩质量80%
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      return result;
    } catch (error) {
      console.error('Image compression error:', error);
      return { uri }; // 压缩失败返回原图
    }
  }

  // 获取上传进度
  async getUploadProgress(fileId: string): Promise<UploadProgress | null> {
    try {
      const progressData = await AsyncStorage.getItem('upload_progress');
      if (progressData) {
        const progressMap = JSON.parse(progressData);
        return progressMap[fileId] || null;
      }
      return null;
    } catch (error) {
      console.error('Get upload progress error:', error);
      return null;
    }
  }

  // 获取所有上传进度
  async getAllUploadProgress(): Promise<Record<string, UploadProgress>> {
    try {
      const progressData = await AsyncStorage.getItem('upload_progress');
      return progressData ? JSON.parse(progressData) : {};
    } catch (error) {
      console.error('Get all upload progress error:', error);
      return {};
    }
  }

  // 更新上传进度
  private async updateUploadProgress(
    fileId: string,
    progress: number,
    status: UploadProgress['status'],
    url?: string,
    error?: string
  ): Promise<void> {
    try {
      const progressData = await AsyncStorage.getItem('upload_progress');
      const progressMap = progressData ? JSON.parse(progressData) : {};
      
      progressMap[fileId] = {
        fileId,
        progress,
        status,
        url,
        error,
      };
      
      await AsyncStorage.setItem('upload_progress', JSON.stringify(progressMap));
    } catch (error) {
      console.error('Update upload progress error:', error);
    }
  }

  // 保存文件映射
  private async saveFileMapping(fileId: string, url: string, thumbnailUrl?: string): Promise<void> {
    try {
      const mappingData = await AsyncStorage.getItem('file_mappings');
      const mappings = mappingData ? JSON.parse(mappingData) : {};
      
      mappings[fileId] = {
        url,
        thumbnailUrl,
        createdAt: Date.now(),
      };
      
      await AsyncStorage.setItem('file_mappings', JSON.stringify(mappings));
    } catch (error) {
      console.error('Save file mapping error:', error);
    }
  }

  // 获取文件URL
  async getFileUrl(fileId: string): Promise<{ url?: string; thumbnailUrl?: string }> {
    try {
      const mappingData = await AsyncStorage.getItem('file_mappings');
      if (mappingData) {
        const mappings = JSON.parse(mappingData);
        return mappings[fileId] || {};
      }
      return {};
    } catch (error) {
      console.error('Get file URL error:', error);
      return {};
    }
  }

  // 保存上传队列
  private async saveUploadQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('upload_queue', JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('Save upload queue error:', error);
    }
  }

  // 恢复上传队列
  async restoreUploadQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('upload_queue');
      if (queueData) {
        this.uploadQueue = JSON.parse(queueData);
        // 重新开始处理队列
        this.processUploadQueue();
      }
    } catch (error) {
      console.error('Restore upload queue error:', error);
    }
  }

  // 清理失败的上传
  async clearFailedUploads(): Promise<void> {
    try {
      const progressData = await AsyncStorage.getItem('upload_progress');
      if (progressData) {
        const progressMap = JSON.parse(progressData);
        const cleanedMap: Record<string, UploadProgress> = {};
        
        Object.entries(progressMap).forEach(([fileId, progress]: [string, any]) => {
          if (progress.status !== 'failed') {
            cleanedMap[fileId] = progress;
          }
        });
        
        await AsyncStorage.setItem('upload_progress', JSON.stringify(cleanedMap));
      }
    } catch (error) {
      console.error('Clear failed uploads error:', error);
    }
  }

  // 重试失败的上传
  async retryFailedUploads(): Promise<void> {
    try {
      const progressData = await AsyncStorage.getItem('upload_progress');
      if (progressData) {
        const progressMap = JSON.parse(progressData);
        const failedFiles: string[] = [];
        
        Object.entries(progressMap).forEach(([fileId, progress]: [string, any]) => {
          if (progress.status === 'failed') {
            failedFiles.push(fileId);
          }
        });

        // 这里可以重新添加失败的文件到队列
        console.log(`Found ${failedFiles.length} failed uploads to retry`);
      }
    } catch (error) {
      console.error('Retry failed uploads error:', error);
    }
  }

  // 工具方法
  private isImageFile(uri: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => uri.toLowerCase().includes(ext));
  }

  private getMimeType(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  private generateFileName(fileId: string, uri: string): string {
    const extension = uri.split('.').pop() || 'jpg';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${timestamp}_${fileId}.${extension}`;
  }

  // 获取上传统计
  async getUploadStats(): Promise<{
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    pendingFiles: number;
  }> {
    try {
      const progressData = await AsyncStorage.getItem('upload_progress');
      if (progressData) {
        const progressMap = JSON.parse(progressData);
        const progresses = Object.values(progressMap) as UploadProgress[];
        
        return {
          totalFiles: progresses.length,
          completedFiles: progresses.filter(p => p.status === 'completed').length,
          failedFiles: progresses.filter(p => p.status === 'failed').length,
          pendingFiles: progresses.filter(p => p.status === 'pending' || p.status === 'uploading').length,
        };
      }
      
      return {
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0,
        pendingFiles: 0,
      };
    } catch (error) {
      console.error('Get upload stats error:', error);
      return {
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0,
        pendingFiles: 0,
      };
    }
  }
}

export default new FileUploadService();