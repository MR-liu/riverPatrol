import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface PhotoPickerProps {
  title: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  required?: boolean;
}

export default function PhotoPicker({
  title,
  photos,
  onPhotosChange,
  maxPhotos = 3,
  required = false,
}: PhotoPickerProps) {
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPermission.status !== 'granted' || mediaLibraryPermission.status !== 'granted') {
      Alert.alert(
        '权限不足',
        '需要相机和相册权限才能上传照片，请在设置中开启权限。'
      );
      return false;
    }
    return true;
  };

  const showImageOptions = () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('提示', `最多只能上传${maxPhotos}张照片`);
      return;
    }

    Alert.alert(
      '选择照片',
      '请选择照片来源',
      [
        { text: '取消', style: 'cancel' },
        { text: '拍照', onPress: () => takePhoto() },
        { text: '从相册选择', onPress: () => pickFromGallery() },
      ]
    );
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhotos = [...photos, result.assets[0].uri];
        onPhotosChange(newPhotos);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('错误', '拍照失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhotos = [...photos, result.assets[0].uri];
        onPhotosChange(newPhotos);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('错误', '选择照片失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这张照片吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            onPhotosChange(newPhotos);
          },
        },
      ]
    );
  };

  const renderPhoto = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.photoItem}>
      <Image source={{ uri: item }} style={styles.photoImage} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removePhoto(index)}
      >
        <MaterialIcons name="close" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderAddButton = () => (
    <TouchableOpacity
      style={[styles.addPhotoButton, isLoading && styles.addPhotoButtonDisabled]}
      onPress={showImageOptions}
      disabled={isLoading}
    >
      <MaterialIcons 
        name={isLoading ? "hourglass-empty" : "add-photo-alternate"} 
        size={24} 
        color="#9CA3AF" 
      />
      <Text style={styles.addPhotoText}>
        {isLoading ? '处理中...' : '添加照片'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {title} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <Text style={styles.subtitle}>
          已添加 {photos.length}/{maxPhotos} 张照片
        </Text>
      </View>

      <View style={styles.photosContainer}>
        <FlatList
          data={[...photos, 'add-button']}
          renderItem={({ item, index }) => {
            if (item === 'add-button') {
              return photos.length < maxPhotos ? renderAddButton() : null;
            }
            return renderPhoto({ item: item as string, index });
          }}
          keyExtractor={(item, index) => `photo-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photosList}
        />
      </View>

      {photos.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="photo-camera" size={32} color="#D1D5DB" />
          <Text style={styles.emptyText}>暂无照片</Text>
          <Text style={styles.emptySubtext}>点击添加照片按钮上传照片</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  photosContainer: {
    minHeight: 100,
  },
  photosList: {
    paddingHorizontal: 4,
  },
  photoItem: {
    position: 'relative',
    marginRight: 12,
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#FAFBFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addPhotoButtonDisabled: {
    opacity: 0.5,
  },
  addPhotoText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },
});