import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatusBar, StatusBarConfigs } from '@/components/AppStatusBar';

import { useAppContext } from '@/contexts/AppContext';
import PhotoPicker from '@/components/PhotoPicker';
import CategorySelector from '@/components/CategorySelector';
import problemCategoryService from '@/utils/ProblemCategoryService';

export default function ReportScreen() {
  const {
    reportStep,
    setReportStep,
    selectedCategory,
    setSelectedCategory,
    reportForm,
    setReportForm,
    saveOfflineReport,
    isOfflineMode,
  } = useAppContext();

  const insets = useSafeAreaInsets();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('普通');
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCategoryChange = (categoryId: string, categoryName: string, fullPath: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryName(categoryName);
    setSelectedCategory(categoryId);
    
    // 如果选择了三级分类，直接进入下一步
    const category = problemCategoryService.getCategoryById(categoryId);
    if (category && category.level === 3) {
      setReportStep(2);
    }
  };

  const handleNext = () => {
    if (!selectedCategoryId) {
      Alert.alert('提示', '请选择问题分类');
      return;
    }
    
    const category = problemCategoryService.getCategoryById(selectedCategoryId);
    if (!category || category.level !== 3) {
      Alert.alert('提示', '请选择具体的问题类型');
      return;
    }
    
    setReportStep(2);
  };

  const handleSubmit = async () => {
    // 验证必要字段
    if (!description.trim()) {
      Alert.alert('提示', '请填写问题描述');
      return;
    }

    if (photos.length === 0) {
      Alert.alert('提示', '请至少上传一张现场照片');
      return;
    }

    try {
      const reportData = {
        categoryId: selectedCategoryId,
        categoryName: selectedCategoryName,
        categoryFullPath: problemCategoryService.getCategoryFullName(selectedCategoryId),
        description: description.trim(),
        location: location.trim() || '当前位置',
        priority,
        photos,
        timestamp: Date.now(),
        reportId: `REPORT_${Date.now()}`,
      };

      if (isOfflineMode) {
        // 离线模式：保存到本地存储
        const success = await saveOfflineReport(reportData);
        if (success) {
          Alert.alert(
            '离线上报成功',
            '问题已保存到本地，网络恢复后将自动同步',
            [
              {
                text: '确定',
                onPress: () => {
                  resetForm();
                  router.push('/(tabs)');
                },
              },
            ]
          );
        } else {
          Alert.alert('上报失败', '请稍后重试');
        }
      } else {
        // 在线模式：直接提交（这里可以调用API）
        Alert.alert(
          '上报成功',
          '问题已成功上报，我们会尽快处理',
          [
            {
              text: '确定',
              onPress: () => {
                resetForm();
                router.push('/(tabs)');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Report submission error:', error);
      Alert.alert('上报失败', '请检查网络连接后重试');
    }
  };

  const resetForm = () => {
    setReportStep(1);
    setSelectedCategoryId('');
    setSelectedCategoryName('');
    setSelectedCategory('');
    setDescription('');
    setLocation('');
    setPriority('普通');
    setPhotos([]);
  };

  const renderStepIndicator = () => (
    <View style={styles.simpleStepIndicator}>
      <View style={styles.stepDots}>
        <View style={[styles.stepDot, reportStep >= 1 && styles.stepDotActive]} />
        <View style={styles.stepConnectorLine} />
        <View style={[styles.stepDot, reportStep >= 2 && styles.stepDotActive]} />
      </View>
      <View style={styles.stepLabels}>
        <Text style={[styles.stepLabel, reportStep >= 1 && styles.stepLabelActive]}>
          选择分类
        </Text>
        <Text style={[styles.stepLabel, reportStep >= 2 && styles.stepLabelActive]}>
          填写详情
        </Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.simpleHeader}>
        <Text style={styles.simpleTitle}>选择问题分类</Text>
        <Text style={styles.simpleSubtitle}>请选择要上报的问题类型</Text>
      </View>

      <CategorySelector
        selectedCategoryId={selectedCategoryId}
        selectedCategoryName={selectedCategoryName}
        onCategoryChange={handleCategoryChange}
        placeholder="点击选择问题分类"
      />
      
      {selectedCategoryId && (
        <View style={styles.selectedInfo}>
          <MaterialIcons name="check-circle" size={18} color="#10B981" />
          <Text style={styles.selectedText}>
            {problemCategoryService.getCategoryFullName(selectedCategoryId)}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.simpleButton,
          !selectedCategoryId && styles.simpleButtonDisabled
        ]}
        onPress={handleNext}
        disabled={!selectedCategoryId}
      >
        <Text style={[
          styles.simpleButtonText,
          !selectedCategoryId && styles.simpleButtonTextDisabled
        ]}>
          下一步
        </Text>
        <MaterialIcons 
          name="arrow-forward" 
          size={18} 
          color={selectedCategoryId ? "#FFFFFF" : "#9CA3AF"} 
        />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setReportStep(1)}
      >
        <MaterialIcons name="arrow-back" size={20} color="#6366F1" />
        <Text style={styles.backText}>返回</Text>
      </TouchableOpacity>
      
      <View style={styles.simpleHeader}>
        <Text style={styles.simpleTitle}>填写详情</Text>
        <Text style={styles.simpleSubtitle}>{selectedCategoryName}</Text>
      </View>

      <View style={styles.simpleForm}>
        {/* 紧急程度 */}
        <View style={styles.simpleField}>
          <Text style={styles.simpleLabel}>紧急程度</Text>
          <View style={styles.priorityRow}>
            {['普通', '紧急'].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.priorityTag,
                  priority === level && styles.priorityTagSelected,
                  level === '紧急' && priority === level && styles.priorityTagUrgent,
                ]}
                onPress={() => setPriority(level)}
              >
                <Text style={[
                  styles.priorityTagText,
                  priority === level && styles.priorityTagTextSelected,
                ]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 位置信息 */}
        <View style={styles.simpleField}>
          <Text style={styles.simpleLabel}>位置信息</Text>
          <View style={styles.simpleInput}>
            <MaterialIcons name="location-on" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.simpleTextInput}
              placeholder="具体位置（可选，默认GPS位置）"
              placeholderTextColor="#9CA3AF"
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>

        {/* 问题描述 */}
        <View style={styles.simpleField}>
          <Text style={styles.simpleLabel}>
            问题描述 <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.simpleTextArea}>
            <TextInput
              style={styles.simpleTextAreaInput}
              placeholder="请描述发现的问题..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* 现场照片 */}
        <View style={styles.simpleField}>
          <Text style={styles.simpleLabel}>
            现场照片 <Text style={styles.required}>*</Text>
          </Text>
          <PhotoPicker
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={6}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!description.trim() || photos.length === 0) && styles.submitButtonDisabled
        ]}
        onPress={handleSubmit}
        disabled={!description.trim() || photos.length === 0}
      >
        <MaterialIcons 
          name={isOfflineMode ? "save" : "send"} 
          size={20} 
          color="#FFFFFF" 
        />
        <Text style={styles.submitButtonText}>
          {isOfflineMode ? '离线保存' : '提交上报'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setReportStep(2)}
      >
        <MaterialIcons name="arrow-back" size={20} color="#3B82F6" />
        <Text style={styles.backText}>返回问题选择</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>完善详细信息</Text>
      <Text style={styles.stepSubtitle}>请填写问题的详细描述和位置信息</Text>

      <View style={styles.formSection}>
        {/* 位置信息 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>位置信息</Text>
          <TextInput
            style={styles.textInput}
            placeholder="请输入具体位置（可选，默认使用GPS位置）"
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* 问题描述 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>问题描述 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="请详细描述问题的具体情况、严重程度等..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 现场照片 */}
        <View style={styles.inputGroup}>
          <PhotoPicker
            title="现场照片"
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={5}
            required={true}
          />
        </View>

        {/* 提示信息卡片 */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>提交后系统将自动获取GPS位置信息</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.submitGradient}
        >
          <MaterialIcons name="send" size={20} color="#FFFFFF" />
          <Text style={styles.submitText}>提交上报</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar {...StatusBarConfigs.transparent} />
      <LinearGradient
        colors={['#FAFBFF', '#F4F6FF', '#EEF2FF']}
        style={[styles.background, { paddingTop: Math.max(insets.top, 20) }]}
      >
        {renderStepIndicator()}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {reportStep === 1 && renderStep1()}
          {reportStep === 2 && renderStep2()}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepIndicator: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.1)',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#3B82F6',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#3B82F6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  categoriesGrid: {
    gap: 16,
  },
  categoryCard: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 16,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  itemsList: {
    gap: 12,
    marginBottom: 32,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  itemCardSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  itemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  itemTextSelected: {
    color: '#FFFFFF',
  },
  nextButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  nextButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  formSection: {
    paddingHorizontal: 4,
    gap: 20,
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  submitButton: {
    borderRadius: 12,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  textAreaContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  // 新增样式
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  stepCircleCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 8,
  },
  stepLabelActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  stepConnector: {
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  stepConnectorActive: {
    backgroundColor: '#6366F1',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  stepHeaderText: {
    alignItems: 'center',
  },
  selectedCategoryInfo: {
    marginTop: 20,
    padding: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  selectedCategoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  selectedCategoryPath: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontWeight: '500',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 56,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  priorityIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  priorityIndicatorSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#FFFFFF',
  },
  priorityIndicatorUrgent: {
    backgroundColor: '#EF4444',
    borderColor: '#FFFFFF',
  },
  infoCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 8,
  },
  infoCardText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    fontWeight: '500',
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
  nextButtonTextDisabled: {
    color: '#9CA3AF',
  },
  categorySection: {
    marginBottom: 24,
  },
  stepActions: {
    paddingTop: 24,
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#3B82F6',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  priorityButtonSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  priorityButtonTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  // 简化样式
  simpleStepIndicator: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#6366F1',
  },
  stepConnectorLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
  },
  simpleHeader: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  simpleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  simpleSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 24,
    gap: 8,
  },
  selectedText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    flex: 1,
  },
  simpleButton: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  simpleButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  simpleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  simpleButtonTextDisabled: {
    color: '#9CA3AF',
  },
  simpleForm: {
    gap: 24,
    marginBottom: 32,
  },
  simpleField: {
    gap: 12,
  },
  simpleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityTag: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  priorityTagSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EBF4FF',
  },
  priorityTagUrgent: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  priorityTagText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  priorityTagTextSelected: {
    color: '#6366F1',
    fontWeight: '600',
  },
  simpleInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  simpleTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  simpleTextArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },
  simpleTextAreaInput: {
    fontSize: 16,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
});