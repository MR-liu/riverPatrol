import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import ProblemCategoryPicker from '@/components/ProblemCategoryPicker';
import SimpleProblemCategoryService from '@/utils/SimpleProblemCategoryService';

interface CategorySelectorProps {
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  onCategoryChange: (categoryId: string, categoryName: string, fullPath: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  selectedCategoryName,
  onCategoryChange,
  placeholder = '请选择问题分类',
  disabled = false,
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleCategorySelect = (categoryId: string, categoryName: string, fullPath: string) => {
    onCategoryChange(categoryId, categoryName, fullPath);
  };

  const getDisplayText = () => {
    if (selectedCategoryId && selectedCategoryName) {
      return selectedCategoryName;
    }
    return placeholder;
  };

  const getDisplaySubText = () => {
    if (selectedCategoryId) {
      const fullPath = SimpleProblemCategoryService.getCategoryFullName(selectedCategoryId);
      return fullPath;
    }
    return null;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.disabledSelector]}
        onPress={() => !disabled && setPickerVisible(true)}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <View style={styles.textContainer}>
            <Text style={[
              styles.selectorText,
              !selectedCategoryName && styles.placeholderText,
              disabled && styles.disabledText
            ]}>
              {getDisplayText()}
            </Text>
            {getDisplaySubText() && (
              <Text style={[styles.subText, disabled && styles.disabledText]}>
                {getDisplaySubText()}
              </Text>
            )}
          </View>
          <MaterialIcons 
            name="keyboard-arrow-down" 
            size={24} 
            color={disabled ? '#9CA3AF' : '#6B7280'} 
          />
        </View>
      </TouchableOpacity>

      <ProblemCategoryPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleCategorySelect}
        selectedCategoryId={selectedCategoryId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  selector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    minHeight: 48,
  },
  disabledSelector: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  selectorText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  subText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});

export default CategorySelector;