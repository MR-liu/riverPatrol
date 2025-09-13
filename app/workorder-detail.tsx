import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppContext } from '@/contexts/AppContext';
import LocationService from '@/utils/LocationService';
import SimpleProblemCategoryService from '@/utils/SimpleProblemCategoryService';

// 导出页面选项以隐藏header
export const unstable_settings = {
  headerShown: false,
};

export default function WorkOrderDetailScreen() {
  const { selectedWorkOrder, setSelectedWorkOrder, workOrders, setWorkOrders, currentUser } = useAppContext();

  if (!selectedWorkOrder) {
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
          <Text style={styles.headerTitle}>工单详情</Text>
          <View style={styles.headerButton} />
        </View>
        
        <LinearGradient
          colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
          style={styles.background}
        >
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color="#EF4444" />
            <Text style={styles.errorText}>未找到工单信息</Text>
            <Text style={styles.errorSubtext}>请返回工单列表重新选择</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const handleAcceptOrder = async () => {
    if (!selectedWorkOrder) return;

    try {
      // 显示确认对话框
      Alert.alert(
        '确认接收工单',
        '接收后将开始巡视轨迹记录，您确定要接收这个工单吗？',
        [
          {
            text: '取消',
            style: 'cancel',
          },
          {
            text: '确认接收',
            onPress: async () => {
              // 更新工单状态
              const updatedWorkOrder = {
                ...selectedWorkOrder,
                status: '处理中',
              };

              // 更新工单列表
              const updatedWorkOrders = workOrders.map(order =>
                order.id === selectedWorkOrder.id ? updatedWorkOrder : order
              );
              setWorkOrders(updatedWorkOrders);
              setSelectedWorkOrder(updatedWorkOrder);

              // 开始轨迹记录
              const trackId = await LocationService.startPatrolTrack(currentUser?.username || '', selectedWorkOrder.id);
              
              if (trackId) {
                Alert.alert(
                  '接收成功',
                  '工单已接收，已开始记录巡视轨迹。请前往现场处理问题。',
                  [
                    {
                      text: '前往地图',
                      onPress: () => router.push('/(tabs)/map'),
                    },
                    {
                      text: '继续查看',
                      style: 'cancel',
                    },
                  ]
                );
              } else {
                Alert.alert('接收成功', '工单已接收，请及时处理。GPS轨迹记录启动失败，请检查定位权限。');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Accept work order error:', error);
      Alert.alert('操作失败', '接收工单时发生错误，请重试');
    }
  };

  const handleProcessResult = () => {
    router.push('/process-result');
  };

  const handleTransfer = () => {
    Alert.alert('转派工单', '转派功能开发中');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '紧急':
        return '#EF4444';
      case '普通':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '待接收':
        return '#F59E0B';
      case '处理中':
        return '#3B82F6';
      case '已完成':
        return '#10B981';
      case '待审核':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

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
        <Text style={styles.headerTitle}>工单详情</Text>
        <View style={styles.headerButton} />
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 工单基本信息 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>基本信息</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(selectedWorkOrder.status) },
                ]}
              >
                <Text style={styles.statusText}>{selectedWorkOrder.status}</Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <MaterialIcons name="title" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>工单标题</Text>
                  <Text style={styles.infoValue}>{selectedWorkOrder.title}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="category" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>问题类型</Text>
                  <Text style={styles.infoValue}>
                    {SimpleProblemCategoryService.getCategoryFullName(selectedWorkOrder.type) || selectedWorkOrder.type}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="flag" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>优先级</Text>
                  <View style={styles.priorityContainer}>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(selectedWorkOrder.priority) },
                      ]}
                    >
                      <Text style={styles.priorityText}>{selectedWorkOrder.priority}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="place" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>问题位置</Text>
                  <Text style={styles.infoValue}>{selectedWorkOrder.location}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialIcons name="access-time" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>上报时间</Text>
                  <Text style={styles.infoValue}>{selectedWorkOrder.time}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 详细描述 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>详细描述</Text>
            </View>
            <Text style={styles.description}>{selectedWorkOrder.description}</Text>
          </View>

          {/* 上报信息 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>上报信息</Text>
            </View>
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <MaterialIcons name="person" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>上报人</Text>
                  <Text style={styles.infoValue}>{selectedWorkOrder.reporter}</Text>
                </View>
              </View>
              {selectedWorkOrder.contact && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={20} color="#6B7280" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>联系电话</Text>
                    <Text style={styles.infoValue}>{selectedWorkOrder.contact}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* 处理进度 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>处理进度</Text>
            </View>
            <View style={styles.progressSection}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.progressDotCompleted]} />
                <View style={styles.progressContent}>
                  <Text style={styles.progressTitle}>工单创建</Text>
                  <Text style={styles.progressTime}>2小时前</Text>
                </View>
              </View>
              
              <View style={styles.progressLine} />
              
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  selectedWorkOrder.status !== '待接收' && styles.progressDotCompleted
                ]} />
                <View style={styles.progressContent}>
                  <Text style={styles.progressTitle}>工单接收</Text>
                  <Text style={styles.progressTime}>
                    {selectedWorkOrder.status !== '待接收' ? '1小时前' : '待处理'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.progressLine} />
              
              <View style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  (selectedWorkOrder.status === '已完成' || selectedWorkOrder.status === '待审核') && styles.progressDotCompleted
                ]} />
                <View style={styles.progressContent}>
                  <Text style={styles.progressTitle}>问题处理</Text>
                  <Text style={styles.progressTime}>
                    {selectedWorkOrder.status === '已完成' || selectedWorkOrder.status === '待审核' ? '30分钟前' : '待处理'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 底部操作按钮 */}
        <View style={styles.actionBar}>
          {selectedWorkOrder.status === '待接收' && (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleTransfer}>
                <Text style={styles.secondaryButtonText}>转派</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleAcceptOrder}>
                <LinearGradient
                  colors={['#3B82F6', '#1E40AF']}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>接收工单</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
          
          {selectedWorkOrder.status === '处理中' && (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleTransfer}>
                <Text style={styles.secondaryButtonText}>转派</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleProcessResult}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>上传结果</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
          
          {(selectedWorkOrder.status === '已完成' || selectedWorkOrder.status === '待审核') && (
            <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={() => router.back()}>
              <LinearGradient
                colors={['#6B7280', '#4B5563']}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>返回列表</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
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
    paddingTop: 20,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  infoSection: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  priorityContainer: {
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  progressSection: {
    paddingVertical: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  progressDotCompleted: {
    backgroundColor: '#3B82F6',
  },
  progressContent: {
    flex: 1,
    paddingVertical: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  progressTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  progressLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonGradient: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});