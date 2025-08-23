import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface CameraResult {
  uri: string;
  fileName: string;
  type: string;
  fileSize: number;
}

class CameraService {
  // 请求相机权限
  private async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  // 请求媒体库权限
  private async requestMediaLibraryPermission(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  // 显示选择操作的对话框
  public showImagePicker(onResult: (result: CameraResult | null) => void): void {
    Alert.alert(
      '选择图片',
      '请选择获取图片的方式',
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: () => onResult(null),
        },
        {
          text: '从相册选择',
          onPress: () => this.openImageLibrary(onResult),
        },
        {
          text: '拍照',
          onPress: () => this.openCamera(onResult),
        },
      ],
      { cancelable: true }
    );
  }

  // 打开相机
  public async openCamera(onResult: (result: CameraResult | null) => void): Promise<void> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('权限不足', '请授予相机权限后重试');
      onResult(null);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      this.handleImagePickerResponse(result, onResult);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('错误', '拍照失败');
      onResult(null);
    }
  }

  // 打开相册
  public async openImageLibrary(onResult: (result: CameraResult | null) => void): Promise<void> {
    const hasPermission = await this.requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert('权限不足', '请授予媒体库权限后重试');
      onResult(null);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      this.handleImagePickerResponse(result, onResult);
    } catch (error) {
      console.error('Image library error:', error);
      Alert.alert('错误', '选择图片失败');
      onResult(null);
    }
  }

  // 处理图片选择结果
  private handleImagePickerResponse(
    result: ImagePicker.ImagePickerResult,
    onResult: (result: CameraResult | null) => void
  ): void {
    if (result.canceled) {
      onResult(null);
      return;
    }

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.uri) {
        const cameraResult: CameraResult = {
          uri: asset.uri,
          fileName: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          fileSize: asset.fileSize || 0,
        };
        onResult(cameraResult);
      } else {
        onResult(null);
      }
    } else {
      onResult(null);
    }
  }

  // 压缩图片（可选功能）
  public async compressImage(uri: string): Promise<string> {
    // 这里可以集成图片压缩库
    // 现在先返回原始 URI
    return uri;
  }

  // 批量选择图片
  public async selectMultipleImages(
    maxSelection: number = 5,
    onResult: (results: CameraResult[]) => void
  ): Promise<void> {
    const hasPermission = await this.requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert('权限不足', '请授予媒体库权限后重试');
      onResult([]);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) {
        onResult([]);
        return;
      }

      if (result.assets) {
        const results: CameraResult[] = result.assets
          .filter(asset => asset.uri)
          .slice(0, maxSelection)
          .map(asset => ({
            uri: asset.uri!,
            fileName: asset.fileName || `image_${Date.now()}.jpg`,
            type: asset.type || 'image/jpeg',
            fileSize: asset.fileSize || 0,
          }));
        onResult(results);
      } else {
        onResult([]);
      }
    } catch (error) {
      console.error('Multiple images selection error:', error);
      Alert.alert('错误', '选择图片失败');
      onResult([]);
    }
  }
}

export default new CameraService();