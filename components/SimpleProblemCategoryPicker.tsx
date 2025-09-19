import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ProblemCategoryService, { ProblemCategory } from '@/utils/ProblemCategoryService';

interface SimpleProblemCategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (category: ProblemCategory) => void;
  selectedCategoryId?: string;
  title?: string;
}

export default function SimpleProblemCategoryPicker({
  visible,
  onClose,
  onSelect,
  selectedCategoryId,
  title = '选择问题分类',
}: SimpleProblemCategoryPickerProps) {
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [visible]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      // 获取平铺的分类列表
      const flatCategories = ProblemCategoryService.getFlatCategories();
      setCategories(flatCategories);
    } catch (error) {
      console.error('加载分类失败:', error);
      // 使用默认分类
      const defaultCategories = ProblemCategoryService.getCategories();
      setCategories(defaultCategories);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (category: ProblemCategory) => {
    onSelect(category);
    onClose();
  };

  const getIconName = (icon?: string): any => {
    const iconMap: { [key: string]: string } = {
      'water': 'water-drop',
      'trash': 'delete',
      'alert': 'warning',
      'warning': 'report-problem',
      'tree': 'park',
      'shield': 'security',
      'info': 'info',
    };
    return iconMap[icon || 'info'] || 'category';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>加载分类中...</Text>
            </View>
          ) : (
            <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    selectedCategoryId === category.id && styles.categoryItemSelected,
                  ]}
                  onPress={() => handleSelect(category)}
                >
                  <View style={styles.categoryLeft}>
                    <View 
                      style={[
                        styles.categoryIcon,
                        { backgroundColor: `${category.color}20` || '#f0f0f0' }
                      ]}
                    >
                      <MaterialIcons 
                        name={getIconName(category.icon)} 
                        size={24} 
                        color={category.color || '#666'} 
                      />
                    </View>
                    <Text style={[
                      styles.categoryName,
                      selectedCategoryId === category.id && styles.categoryNameSelected
                    ]}>
                      {category.name}
                    </Text>
                  </View>
                  {selectedCategoryId === category.id && (
                    <MaterialIcons name="check-circle" size={24} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
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
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  categoryList: {
    padding: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryItemSelected: {
    backgroundColor: '#e8f0fe',
    borderColor: '#3B82F6',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  categoryNameSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    paddingVertical: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
});