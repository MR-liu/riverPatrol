import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { LoadingState } from '@/components/LoadingState';
import { PageContainer } from '@/components/PageContainer';

interface FeedbackType {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
}

export default function FeedbackScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');

  const feedbackTypes: FeedbackType[] = [
    {
      id: 'bug',
      title: '问题反馈',
      icon: 'bug-report',
      color: '#EF4444',
      description: '应用出现错误或异常行为',
    },
    {
      id: 'feature',
      title: '功能建议',
      icon: 'lightbulb',
      color: '#F59E0B',
      description: '希望增加新功能或改进现有功能',
    },
    {
      id: 'experience',
      title: '体验优化',
      icon: 'sentiment-satisfied',
      color: '#10B981',
      description: '界面设计或操作流程的改进建议',
    },
    {
      id: 'performance',
      title: '性能问题',
      icon: 'speed',
      color: '#8B5CF6',
      description: '应用运行缓慢或卡顿',
    },
    {
      id: 'content',
      title: '内容反馈',
      icon: 'article',
      color: '#3B82F6',
      description: '数据准确性或内容质量问题',
    },
    {
      id: 'other',
      title: '其他建议',
      icon: 'chat',
      color: '#6B7280',
      description: '其他意见或建议',
    },
  ];

  const urgencyOptions = [
    { value: 'low', label: '一般', color: '#10B981', description: '有时间时处理' },
    { value: 'medium', label: '重要', color: '#F59E0B', description: '希望尽快处理' },
    { value: 'high', label: '紧急', color: '#EF4444', description: '影响正常使用' },
  ];

  const handleSubmitFeedback = async () => {
    if (!selectedType) {
      Alert.alert('提示', '请选择反馈类型');
      return;
    }

    if (!title.trim()) {
      Alert.alert('提示', '请输入反馈标题');
      return;
    }

    if (!content.trim()) {
      Alert.alert('提示', '请详细描述您的反馈内容');
      return;
    }

    if (content.trim().length < 10) {
      Alert.alert('提示', '反馈内容至少需要10个字符');
      return;
    }

    setIsLoading(true);
    try {
      // 模拟提交API调用
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const feedbackData = {
        type: selectedType,
        title: title.trim(),
        content: content.trim(),
        contact: contact.trim(),
        images,
        urgency,
        timestamp: new Date().toISOString(),
        device: 'iOS 17.0', // 实际项目中可以获取设备信息
        version: '1.0.0',
      };

      console.log('Feedback submitted:', feedbackData);
      
      Alert.alert(
        '提交成功',
        '感谢您的反馈！我们会认真处理您的建议，并在必要时与您联系。',
        [
          {
            text: '确定',
            onPress: () => {
              // 重置表单
              setSelectedType('');
              setTitle('');
              setContent('');
              setContact('');
              setImages([]);
              setUrgency('medium');
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('提交失败', '反馈提交失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddImage = () => {
    if (images.length >= 3) {
      Alert.alert('提示', '最多只能添加3张图片');
      return;
    }

    Alert.alert(
      '添加图片',
      '请选择图片来源',
      [
        { text: '取消', style: 'cancel' },
        { text: '拍照', onPress: () => pickImage('camera') },
        { text: '从相册选择', onPress: () => pickImage('library') },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限不足', '需要相机权限才能拍照');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限不足', '需要相册权限才能选择照片');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('操作失败', '图片添加失败，请重试');
    }
  };

  const removeImage = (index: number) => {
    Alert.alert(
      '删除图片',
      '确定要删除这张图片吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            setImages(prev => prev.filter((_, i) => i !== index));
          }
        }
      ]
    );
  };

  const renderTypeCard = (type: FeedbackType) => (
    <TouchableOpacity
      key={type.id}
      style={[
        styles.typeCard,
        selectedType === type.id && styles.selectedTypeCard,
        { borderColor: selectedType === type.id ? type.color : '#E5E7EB' }
      ]}
      onPress={() => setSelectedType(type.id)}
    >
      <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
        <MaterialIcons name={type.icon as any} size={24} color={type.color} />
      </View>
      <Text style={styles.typeTitle}>{type.title}</Text>
      <Text style={styles.typeDescription}>{type.description}</Text>
    </TouchableOpacity>
  );

  const renderUrgencyOption = (option: any) => (
    <TouchableOpacity
      key={option.value}
      style={[
        styles.urgencyOption,
        urgency === option.value && styles.selectedUrgencyOption,
        { borderColor: urgency === option.value ? option.color : '#E5E7EB' }
      ]}
      onPress={() => setUrgency(option.value)}
    >
      <View style={styles.urgencyHeader}>
        <Text style={[
          styles.urgencyLabel,
          urgency === option.value && { color: option.color }
        ]}>
          {option.label}
        </Text>
        {urgency === option.value && (
          <MaterialIcons name="check-circle" size={16} color={option.color} />
        )}
      </View>
      <Text style={styles.urgencyDescription}>{option.description}</Text>
    </TouchableOpacity>
  );

  const renderImageItem = (uri: string, index: number) => (
    <View key={index} style={styles.imageItem}>
      <Image source={{ uri }} style={styles.feedbackImage} />
      <TouchableOpacity
        style={styles.removeImageButton}
        onPress={() => removeImage(index)}
      >
        <MaterialIcons name="close" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <PageContainer title="意见反馈">
      <LoadingState isLoading={isLoading} loadingMessage="提交反馈中...">
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 反馈类型选择 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>反馈类型</Text>
              <Text style={styles.sectionDescription}>请选择最符合您反馈内容的类型</Text>
              <View style={styles.typesGrid}>
                {feedbackTypes.map(renderTypeCard)}
              </View>
            </View>

            {/* 优先级选择 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>优先级</Text>
              <Text style={styles.sectionDescription}>请选择问题的严重程度</Text>
              <View style={styles.urgencyList}>
                {urgencyOptions.map(renderUrgencyOption)}
              </View>
            </View>

            {/* 反馈标题 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                反馈标题 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.titleInput}
                placeholder="请简要描述您的问题或建议"
                value={title}
                onChangeText={setTitle}
                maxLength={50}
              />
              <Text style={styles.charCount}>{title.length}/50</Text>
            </View>

            {/* 详细描述 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                详细描述 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.contentInput}
                placeholder="请详细描述您遇到的问题、期望的功能或改进建议..."
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{content.length}/500</Text>
            </View>

            {/* 图片上传 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>相关截图</Text>
              <Text style={styles.sectionDescription}>
                如有需要，可以上传相关截图或照片（最多3张）
              </Text>
              
              <View style={styles.imagesContainer}>
                {images.map(renderImageItem)}
                {images.length < 3 && (
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={handleAddImage}
                  >
                    <MaterialIcons name="add-a-photo" size={32} color="#9CA3AF" />
                    <Text style={styles.addImageText}>添加图片</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 联系方式 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>联系方式</Text>
              <Text style={styles.sectionDescription}>
                如需回复，请留下您的联系方式（可选）
              </Text>
              <TextInput
                style={styles.contactInput}
                placeholder="手机号或邮箱地址"
                value={contact}
                onChangeText={setContact}
                keyboardType="email-address"
              />
            </View>

            {/* 提交按钮 */}
            <TouchableOpacity
              style={[styles.submitButton, (!selectedType || !title.trim() || !content.trim()) && styles.submitButtonDisabled]}
              onPress={handleSubmitFeedback}
              disabled={!selectedType || !title.trim() || !content.trim() || isLoading}
            >
              <LinearGradient
                colors={(!selectedType || !title.trim() || !content.trim()) ? ['#9CA3AF', '#9CA3AF'] : ['#3B82F6', '#1E40AF']}
                style={styles.submitButtonGradient}
              >
                <MaterialIcons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>提交反馈</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 温馨提示 */}
            <View style={styles.tipCard}>
              <MaterialIcons name="info" size={20} color="#3B82F6" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>温馨提示</Text>
                <Text style={styles.tipText}>
                  • 我们会认真对待每一条反馈{'\n'}
                  • 重要问题通常在1-3个工作日内回复{'\n'}
                  • 您的反馈将帮助我们持续改进产品
                </Text>
              </View>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </LoadingState>
      </PageContainer>
    );
  }

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  required: {
    color: '#EF4444',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FAFBFC',
    alignItems: 'center',
  },
  selectedTypeCard: {
    backgroundColor: '#F8FAFC',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  typeDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  urgencyList: {
    gap: 12,
  },
  urgencyOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FAFBFC',
  },
  selectedUrgencyOption: {
    backgroundColor: '#F8FAFC',
  },
  urgencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  urgencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  urgencyDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    height: 120,
    textAlignVertical: 'top',
  },
  contactInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageItem: {
    position: 'relative',
  },
  feedbackImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tipCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 20,
  },
});