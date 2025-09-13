import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import SimpleProblemCategoryService from '@/utils/SimpleProblemCategoryService';

// 定义CategoryOption类型
interface CategoryOption {
  id: string;
  name: string;
  parentId?: string;
}

interface ProblemCategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string, categoryName: string, fullPath: string) => void;
  selectedCategoryId?: string;
  title?: string;
}

export const ProblemCategoryPicker: React.FC<ProblemCategoryPickerProps> = ({
  visible,
  onClose,
  onSelect,
  selectedCategoryId,
  title = '选择问题分类',
}) => {
  const insets = useSafeAreaInsets();
  console.log('SafeArea insets:', insets); // Debug log
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3>(1);
  const [selectedMainId, setSelectedMainId] = useState<string>('');
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [mainCategories, setMainCategories] = useState<CategoryOption[]>([]);
  const [subCategories, setSubCategories] = useState<CategoryOption[]>([]);
  const [detailCategories, setDetailCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    if (visible) {
      loadMainCategories();
      resetSelection();
    }
  }, [visible]);

  const loadMainCategories = () => {
    const categories = SimpleProblemCategoryService.getMainCategories();
    setMainCategories(categories);
  };

  const resetSelection = () => {
    setCurrentLevel(1);
    setSelectedMainId('');
    setSelectedSubId('');
    setSubCategories([]);
    setDetailCategories([]);
  };

  const handleMainCategorySelect = (categoryId: string) => {
    setSelectedMainId(categoryId);
    const subCats = SimpleProblemCategoryService.getSubCategories(categoryId);
    setSubCategories(subCats);
    setCurrentLevel(2);
    setSelectedSubId('');
    setDetailCategories([]);
  };

  const handleSubCategorySelect = (categoryId: string) => {
    setSelectedSubId(categoryId);
    const detailCats = SimpleProblemCategoryService.getDetailCategories(categoryId);
    setDetailCategories(detailCats);
    setCurrentLevel(3);
  };

  const handleDetailCategorySelect = (categoryId: string) => {
    const categoryName = SimpleProblemCategoryService.getCategoryById(categoryId)?.name || '';
    const fullPath = SimpleProblemCategoryService.getCategoryFullName(categoryId);
    onSelect(categoryId, categoryName, fullPath);
    onClose();
  };

  const handleBackPress = () => {
    if (currentLevel === 3) {
      setCurrentLevel(2);
      setDetailCategories([]);
    } else if (currentLevel === 2) {
      setCurrentLevel(1);
      setSubCategories([]);
      setSelectedMainId('');
    } else {
      onClose();
    }
  };

  const getCurrentTitle = () => {
    if (currentLevel === 1) return title;
    if (currentLevel === 2) {
      const mainCategory = SimpleProblemCategoryService.getCategoryById(selectedMainId);
      return mainCategory?.name || '选择子分类';
    }
    if (currentLevel === 3) {
      const subCategory = SimpleProblemCategoryService.getCategoryById(selectedSubId);
      return subCategory?.name || '选择具体问题';
    }
    return title;
  };

  const getCurrentCategories = () => {
    if (currentLevel === 1) return mainCategories;
    if (currentLevel === 2) return subCategories;
    if (currentLevel === 3) return detailCategories;
    return [];
  };

  const renderCategoryItem = (category: CategoryOption) => {
    const isSelected = category.id === selectedCategoryId;
    const hasChildren = currentLevel < 3;

    return (
      <TouchableOpacity
        key={category.id}
        style={[styles.categoryItem, isSelected && styles.selectedCategoryItem]}
        onPress={() => {
          if (currentLevel === 1) {
            handleMainCategorySelect(category.id);
          } else if (currentLevel === 2) {
            handleSubCategorySelect(category.id);
          } else {
            handleDetailCategorySelect(category.id);
          }
        }}
      >
        <View style={styles.categoryContent}>
          <Text style={[styles.categoryName, isSelected && styles.selectedCategoryName]}>
            {category.name}
          </Text>
          {hasChildren && (
            <MaterialIcons 
              name="chevron-right" 
              size={20} 
              color={isSelected ? '#3B82F6' : '#9CA3AF'} 
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderBreadcrumb = () => {
    const path: string[] = [];
    
    if (selectedMainId) {
      const mainCategory = SimpleProblemCategoryService.getCategoryById(selectedMainId);
      if (mainCategory) path.push(mainCategory.name);
    }
    
    if (selectedSubId) {
      const subCategory = SimpleProblemCategoryService.getCategoryById(selectedSubId);
      if (subCategory) path.push(subCategory.name);
    }

    if (path.length === 0) return null;

    return (
      <View style={styles.breadcrumb}>
        {path.map((name, index) => (
          <View key={index} style={styles.breadcrumbItem}>
            <Text style={styles.breadcrumbText}>{name}</Text>
            {index < path.length - 1 && (
              <MaterialIcons name="chevron-right" size={16} color="#6B7280" />
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#3B82F6" translucent={false} />
      <View style={styles.container}>
        {/* 头部 */}
        <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 12 }]}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBackPress}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getCurrentTitle()}</Text>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* 面包屑导航和内容区 */}
        <View style={styles.background}>
          {/* 面包屑导航 */}
          {renderBreadcrumb()}

          {/* 分类列表 */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.categoriesList}>
              {getCurrentCategories().map(renderCategoryItem)}
            </View>
          </ScrollView>

          {/* 底部提示 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {currentLevel === 1 && '请选择问题大类'}
              {currentLevel === 2 && '请选择问题子类'}
              {currentLevel === 3 && '请选择具体问题类型'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3B82F6',
  },
  header: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  background: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  content: {
    flex: 1,
  },
  categoriesList: {
    padding: 16,
    gap: 8,
  },
  categoryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCategoryItem: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#EBF4FF',
  },
  categoryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  selectedCategoryName: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default ProblemCategoryPicker;