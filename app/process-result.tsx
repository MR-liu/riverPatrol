import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppContext } from '@/contexts/AppContext';
import PhotoPicker from '@/components/PhotoPicker';
import LocationService from '@/utils/LocationService';

export default function ProcessResultScreen() {
  const { selectedWorkOrder, setSelectedWorkOrder, workOrders, setWorkOrders, processResult, setProcessResult } = useAppContext();
  const [processMethod, setProcessMethod] = useState('');
  const [processDescription, setProcessDescription] = useState('');
  const [result, setResult] = useState('');
  const [needFollowUp, setNeedFollowUp] = useState(false);
  const [followUpReason, setFollowUpReason] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!processMethod.trim() || !processDescription.trim() || !result.trim()) {
      Alert.alert('提示', '请填写完整的处理信息');
      return;
    }

    if (beforePhotos.length === 0 || afterPhotos.length === 0) {
      Alert.alert('提示', '请上传处理前后的对比照片');
      return;
    }

    if (needFollowUp && !followUpReason.trim()) {
      Alert.alert('提示', '请填写需要跟进的原因');
      return;
    }

    try {
      // 结束GPS轨迹记录
      const completedTrack = await LocationService.stopPatrolTrack(`工单${selectedWorkOrder?.id}处理完成`);
      
      // 构建处理结果数据
      const resultData = {
        beforePhotos,
        afterPhotos,
        processMethod,
        processDescription,
        result,
        needFollowUp,
        followUpReason,
        completedTrack,
        completedAt: new Date().toISOString(),
        processDuration: completedTrack?.totalDuration || 0,
        travelDistance: completedTrack?.totalDistance || 0,
      };

      // 保存到context
      setProcessResult(resultData);

      // 更新工单状态
      if (selectedWorkOrder) {
        const updatedWorkOrder = {
          ...selectedWorkOrder,
          status: needFollowUp ? '待审核' : '已完成',
        };

        const updatedWorkOrders = workOrders.map(order =>
          order.id === selectedWorkOrder.id ? updatedWorkOrder : order
        );
        setWorkOrders(updatedWorkOrders);
        setSelectedWorkOrder(updatedWorkOrder);
      }

      // 保存处理结果到本地存储
      await saveProcessResult(resultData);

      Alert.alert(
        '提交成功',
        `处理结果已提交${needFollowUp ? '，等待审核' : '，工单已完成'}${completedTrack ? `\n\n巡视统计:\n距离: ${LocationService.formatDistance(completedTrack.totalDistance)}\n用时: ${LocationService.formatDuration(completedTrack.totalDuration)}` : ''}`,
        [
          {
            text: '确定',
            onPress: () => {
              // 重置表单
              resetForm();
              // 返回工单列表
              router.push('/(tabs)/workorders');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Submit process result error:', error);
      Alert.alert('提交失败', '处理结果提交时发生错误，请重试');
    }
  };

  const resetForm = () => {
    setProcessMethod('');
    setProcessDescription('');
    setResult('');
    setNeedFollowUp(false);
    setFollowUpReason('');
    setBeforePhotos([]);
    setAfterPhotos([]);
  };

  const saveProcessResult = async (resultData: any) => {
    try {
      const existingResults = await AsyncStorage.getItem('processResults');
      const results = existingResults ? JSON.parse(existingResults) : [];
      
      results.push({
        id: `result_${Date.now()}`,
        workOrderId: selectedWorkOrder?.id,
        workOrderTitle: selectedWorkOrder?.title,
        timestamp: Date.now(),
        ...resultData,
      });
      
      await AsyncStorage.setItem('processResults', JSON.stringify(results));
    } catch (error) {
      console.error('Save process result error:', error);
    }
  };

  if (!selectedWorkOrder) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>未找到工单信息</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 自定义头部 */}
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

          {/* 处理前后照片 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="camera-alt" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>处理前后对比照片</Text>
            </View>
            
            <PhotoPicker
              title="处理前照片"
              photos={beforePhotos}
              onPhotosChange={setBeforePhotos}
              maxPhotos={3}
              required={true}
            />

            <PhotoPicker
              title="处理后照片"
              photos={afterPhotos}
              onPhotosChange={setAfterPhotos}
              maxPhotos={3}
              required={true}
            />
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
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>提交处理结果</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

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
});