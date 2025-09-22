import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '@/contexts/AppContext';
import ImagePickerModal from '@/components/ImagePickerModal';
import LocationService from '@/utils/LocationService';
import WorkOrderApiService from '@/utils/WorkOrderApiService';

export default function ProcessResultScreen() {
  const { selectedWorkOrder, setSelectedWorkOrder, workOrders, setWorkOrders } = useAppContext();
  const insets = useSafeAreaInsets();
  const [processMethod, setProcessMethod] = useState('');
  const [processDescription, setProcessDescription] = useState('');
  const [result, setResult] = useState('');
  const [needFollowUp, setNeedFollowUp] = useState(false);
  const [followUpReason, setFollowUpReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!processMethod.trim() || !processDescription.trim() || !result.trim()) {
      Alert.alert('提示', '请填写完整的处理信息');
      return;
    }

    if (photos.length === 0) {
      Alert.alert('提示', '请上传现场处理照片');
      return;
    }

    if (needFollowUp && !followUpReason.trim()) {
      Alert.alert('提示', '请填写需要跟进的原因');
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (!selectedWorkOrder) {
        Alert.alert('错误', '未找到工单信息');
        return;
      }

      // 停止轨迹记录
      const completedTrack = await LocationService.stopPatrolTrack(`工单${selectedWorkOrder.id}处理完成`);

      // 照片已经在选择时上传，这里直接使用URL

      // 获取当前位置信息
      const locationInfo = await LocationService.getCurrentPosition();
      let locationAddress = '未知位置';
      
      if (locationInfo) {
        // 获取地址信息
        locationAddress = await LocationService.getAddressFromCoords(
          locationInfo.coords.latitude,
          locationInfo.coords.longitude
        );
      }

      // 提交处理结果到服务器
      Alert.alert('提交中', '正在保存处理结果到服务器...');
      
      // 构建处理结果描述
      const fullProcessResult = `
处理方法: ${processMethod}
处理描述: ${processDescription}
处理结果: ${result}
${needFollowUp ? `需要跟进: ${followUpReason}` : ''}
处理位置: ${locationAddress}
      `.trim();

      // 使用新的API方法提交
      const response = await WorkOrderApiService.submitResult(
        selectedWorkOrder.id,
        fullProcessResult,
        photos,
        `工单处理完成 - ${result}`
      );

      if (response.success) {
        // 更新本地工单状态 - 提交后变为待审核状态
        const newStatus = 'pending_review'; // 提交后都需要审核
        const updatedWorkOrder = {
          ...selectedWorkOrder,
          status: newStatus,
          processing_images: photos,
          processing_notes: fullProcessResult,
          updated_at: new Date().toISOString(),
        };

        const updatedWorkOrders = workOrders.map(order =>
          order.id === selectedWorkOrder.id ? updatedWorkOrder : order
        );
        setWorkOrders(updatedWorkOrders);
        setSelectedWorkOrder(updatedWorkOrder);

        Alert.alert(
          '提交成功', 
          `处理结果已保存到数据库${needFollowUp ? '，等待审核' : '，工单已完成'}${completedTrack ? `\n\n巡视统计:\n距离: ${LocationService.formatDistance(completedTrack.totalDistance)}\n用时: ${LocationService.formatDuration(completedTrack.totalDuration)}` : ''}`,
          [
            {
              text: '确定',
              onPress: () => {
                resetForm();
                router.push('/(tabs)/workorders');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Submit process result error:', error);
      Alert.alert('提交失败', '处理结果提交时发生错误，请检查网络连接后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setProcessMethod('');
    setProcessDescription('');
    setResult('');
    setNeedFollowUp(false);
    setFollowUpReason('');
    setPhotos([]);
  };


  if (!selectedWorkOrder) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBackground, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>上传处理结果</Text>
            <View style={styles.headerButton} />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>未找到工单信息</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header background that extends to top */}
      <View style={[styles.headerBackground, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>上传处理结果</Text>
          <View style={styles.headerButton} />
        </View>
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 工单信息概览 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="assignment" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>工单信息</Text>
            </View>
            <Text style={styles.workOrderTitle}>{selectedWorkOrder.title}</Text>
            <Text style={styles.workOrderLocation}>{selectedWorkOrder.location}</Text>
          </View>

          {/* 处理方法 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="build" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>处理方法</Text>
            </View>
            <View style={styles.methodOptions}>
              {['现场清理', '设备维修', '人员调度', '政策整改', '其他方式'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.methodOption,
                    processMethod === method && styles.methodOptionSelected,
                  ]}
                  onPress={() => setProcessMethod(method)}
                >
                  <Text style={[
                    styles.methodOptionText,
                    processMethod === method && styles.methodOptionTextSelected,
                  ]}>
                    {method}
                  </Text>
                  {processMethod === method && (
                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 处理描述 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="description" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>处理描述</Text>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="请详细描述处理过程和采取的措施..."
              placeholderTextColor="#9CA3AF"
              value={processDescription}
              onChangeText={setProcessDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* 处理结果 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="fact-check" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>处理结果</Text>
            </View>
            <View style={styles.resultOptions}>
              {['问题已解决', '问题部分解决', '问题未解决', '需要进一步处理'].map((resultOption) => (
                <TouchableOpacity
                  key={resultOption}
                  style={[
                    styles.resultOption,
                    result === resultOption && styles.resultOptionSelected,
                  ]}
                  onPress={() => setResult(resultOption)}
                >
                  <Text style={[
                    styles.resultOptionText,
                    result === resultOption && styles.resultOptionTextSelected,
                  ]}>
                    {resultOption}
                  </Text>
                  {result === resultOption && (
                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 现场照片 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="camera-alt" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>现场处理照片</Text>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoContainer}>
                {photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.photoThumb} />
                ))}
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={() => setShowImagePicker(true)}
                >
                  <MaterialIcons name="add-a-photo" size={32} color="#3B82F6" />
                  <Text style={styles.addPhotoText}>添加照片</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <Text style={styles.photoHint}>已上传 {photos.length} 张照片（建议3-9张）</Text>
          </View>

          {/* 后续跟进 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="follow-the-signs" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>后续跟进</Text>
            </View>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>是否需要后续跟进</Text>
              <Switch
                value={needFollowUp}
                onValueChange={setNeedFollowUp}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={needFollowUp ? '#3B82F6' : '#F3F4F6'}
              />
            </View>

            {needFollowUp && (
              <TextInput
                style={[styles.textArea, { marginTop: 12 }]}
                placeholder="请说明需要跟进的原因和具体事项..."
                placeholderTextColor="#9CA3AF"
                value={followUpReason}
                onChangeText={setFollowUpReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>
        </ScrollView>

        {/* 底部提交按钮 */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.submitButtonGradient}
            >
              <MaterialIcons name="cloud-upload" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>处理完毕</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 图片选择器 */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onImagesSelected={setPhotos}
        maxImages={9}
        existingImages={photos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBackground: {
    backgroundColor: '#3B82F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  workOrderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  workOrderLocation: {
    fontSize: 14,
    color: '#6B7280',
  },
  methodOptions: {
    gap: 8,
  },
  methodOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
  },
  methodOptionSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  methodOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  methodOptionTextSelected: {
    color: '#FFFFFF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FAFBFC',
    minHeight: 80,
  },
  resultOptions: {
    gap: 8,
  },
  resultOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
  },
  resultOptionSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  resultOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  resultOptionTextSelected: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  actionBar: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  submitButton: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
  },
  photoHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
});