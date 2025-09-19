import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    url: string;
    path: string;
    size: number;
    mimetype: string;
    originalName: string;
  };
}

interface MultipleUploadResponse {
  success: boolean;
  message: string;
  data?: {
    succeeded: Array<{
      url: string;
      path: string;
      size: number;
      mimetype: string;
      originalName: string;
    }>;
    failed: Array<any>;
  };
}

class ImageUploadService {
  private static readonly UPLOAD_URL = 'https://u.chengyishi.com/upload';
  private static readonly MULTIPLE_UPLOAD_URL = 'https://u.chengyishi.com/upload/multiple';

  /**
   * 选择图片（从相册或相机）
   */
  static async pickImage(fromCamera: boolean = false): Promise<ImagePicker.ImagePickerResult | null> {
    try {
      // 请求权限
      const permissionType = fromCamera 
        ? ImagePicker.CameraPermissionResponse 
        : ImagePicker.MediaLibraryPermissionResponse;
      
      const { status } = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          '权限提示',
          `需要${fromCamera ? '相机' : '相册'}权限才能${fromCamera ? '拍摄' : '选择'}照片`
        );
        return null;
      }

      // 打开相机或相册
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
            allowsMultipleSelection: false,
          });

      return result;
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '选择图片失败');
      return null;
    }
  }

  /**
   * 上传单张图片到服务器
   */
  static async uploadImage(imageUri: string): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      
      // 获取文件名和类型
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // 添加文件到表单
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: type,
      } as any);

      // 发送请求
      const response = await fetch(this.UPLOAD_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || '上传失败');
      }

      return result;
    } catch (error) {
      console.error('上传图片失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '上传失败',
      };
    }
  }

  /**
   * 批量上传图片（使用多文件接口，更高效）
   */
  static async uploadMultipleImages(imageUris: string[]): Promise<string[]> {
    if (imageUris.length === 0) return [];
    
    try {
      const formData = new FormData();
      
      // 添加所有文件到表单
      imageUris.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `photo_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('files', {
          uri: uri,
          name: filename,
          type: type,
        } as any);
      });

      // 发送批量上传请求
      const response = await fetch(this.MULTIPLE_UPLOAD_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      const result: MultipleUploadResponse = await response.json();
      
      if (result.success && result.data) {
        // 返回成功上传的图片URLs
        return result.data.succeeded.map(item => item.url);
      }
      
      return [];
    } catch (error) {
      console.error('批量上传图片失败:', error);
      // 如果批量上传失败，回退到单个上传
      const uploadedUrls: string[] = [];
      for (const uri of imageUris) {
        const result = await this.uploadImage(uri);
        if (result.success && result.data) {
          uploadedUrls.push(result.data.url);
        }
      }
      return uploadedUrls;
    }
  }

  /**
   * 选择并上传图片（完整流程）
   */
  static async pickAndUploadImage(fromCamera: boolean = false): Promise<string | null> {
    try {
      // 选择图片
      const pickerResult = await this.pickImage(fromCamera);
      
      if (!pickerResult || pickerResult.canceled || !pickerResult.assets?.[0]) {
        return null;
      }

      // 显示上传中提示
      const imageUri = pickerResult.assets[0].uri;
      
      // 上传图片
      const uploadResult = await this.uploadImage(imageUri);
      
      if (uploadResult.success && uploadResult.data) {
        return uploadResult.data.url;
      } else {
        Alert.alert('上传失败', uploadResult.message);
        return null;
      }
    } catch (error) {
      console.error('选择并上传图片失败:', error);
      Alert.alert('错误', '图片上传失败，请重试');
      return null;
    }
  }

  /**
   * 压缩图片（如果需要）
   */
  static async compressImage(uri: string, quality: number = 0.7): Promise<string> {
    // 使用 expo-image-manipulator 进行压缩
    try {
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      
      const manipResult = await manipulateAsync(
        uri,
        [],
        { compress: quality, format: SaveFormat.JPEG }
      );
      
      return manipResult.uri;
    } catch (error) {
      console.error('压缩图片失败:', error);
      return uri; // 返回原图
    }
  }
}

export default ImageUploadService;
export type { UploadResponse };