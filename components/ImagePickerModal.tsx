import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ImageUploadService from '@/utils/ImageUploadService';

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImagesSelected: (urls: string[]) => void;
  maxImages?: number;
  existingImages?: string[];
}

const { width: screenWidth } = Dimensions.get('window');
const imageSize = (screenWidth - 40) / 3 - 10;

export default function ImagePickerModal({
  visible,
  onClose,
  onImagesSelected,
  maxImages = 9,
  existingImages = [],
}: ImagePickerModalProps) {
  const [images, setImages] = useState<string[]>(existingImages);
  const [localImages, setLocalImages] = useState<string[]>([]); // 本地未上传的图片
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async (fromCamera: boolean) => {
    if (images.length + localImages.length >= maxImages) {
      Alert.alert('提示', `最多只能上传${maxImages}张图片`);
      return;
    }

    try {
      const pickerResult = await ImageUploadService.pickImage(fromCamera);
      
      if (pickerResult && !pickerResult.canceled && pickerResult.assets?.[0]) {
        // 先添加到本地图片列表
        const newLocalImages = [...localImages, pickerResult.assets[0].uri];
        setLocalImages(newLocalImages);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '选择图片失败，请重试');
    }
  };

  const handleRemoveImage = (index: number, isLocal: boolean) => {
    Alert.alert(
      '确认删除',
      '确定要删除这张图片吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            if (isLocal) {
              const newLocalImages = localImages.filter((_, i) => i !== index);
              setLocalImages(newLocalImages);
            } else {
              const newImages = images.filter((_, i) => i !== index);
              setImages(newImages);
              onImagesSelected(newImages);
            }
          },
        },
      ]
    );
  };

  const handleUploadAndClose = async () => {
    if (localImages.length > 0) {
      setUploading(true);
      try {
        // 批量上传本地图片
        const uploadedUrls = await ImageUploadService.uploadMultipleImages(localImages);
        
        if (uploadedUrls.length > 0) {
          const allImages = [...images, ...uploadedUrls];
          setImages(allImages);
          onImagesSelected(allImages);
          setLocalImages([]);
        }
      } catch (error) {
        console.error('批量上传失败:', error);
        Alert.alert('上传失败', '部分图片上传失败，请重试');
      } finally {
        setUploading(false);
      }
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleUploadAndClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>选择图片</Text>
            <TouchableOpacity onPress={handleUploadAndClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.imageContainer}>
            <View style={styles.imageGrid}>
              {/* 已上传的图片 */}
              {images.map((uri, index) => (
                <View key={`uploaded-${index}`} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index, false)}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                  {/* 已上传标识 */}
                  <View style={styles.uploadedBadge}>
                    <MaterialIcons name="cloud-done" size={16} color="#fff" />
                  </View>
                </View>
              ))}
              
              {/* 待上传的本地图片 */}
              {localImages.map((uri, index) => (
                <View key={`local-${index}`} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index, true)}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                  {/* 待上传标识 */}
                  <View style={styles.pendingBadge}>
                    <MaterialIcons name="cloud-upload" size={16} color="#fff" />
                  </View>
                </View>
              ))}
              
              {(images.length + localImages.length) < maxImages && (
                <View style={styles.addImageButtons}>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handlePickImage(true)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#007AFF" />
                    ) : (
                      <>
                        <MaterialIcons name="camera-alt" size={32} color="#007AFF" />
                        <Text style={styles.addButtonText}>拍照</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handlePickImage(false)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#007AFF" />
                    ) : (
                      <>
                        <MaterialIcons name="photo-library" size={32} color="#007AFF" />
                        <Text style={styles.addButtonText}>相册</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              已选择 {images.length + localImages.length}/{maxImages} 张图片
              {localImages.length > 0 && ` (${localImages.length} 张待上传)`}
            </Text>
            <TouchableOpacity
              style={[styles.confirmButton, (images.length === 0 && localImages.length === 0) && styles.disabledButton]}
              onPress={handleUploadAndClose}
              disabled={images.length === 0 && localImages.length === 0}
            >
              <Text style={styles.confirmButtonText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  imageContainer: {
    padding: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageWrapper: {
    width: imageSize,
    height: imageSize,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    width: imageSize,
    height: imageSize,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  addButtonText: {
    marginTop: 4,
    fontSize: 12,
    color: '#007AFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#10B981',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});