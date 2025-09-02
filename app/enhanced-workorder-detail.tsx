import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAppContext } from '@/contexts/AppContext';
import { LoadingState } from '@/components/LoadingState';
import WorkOrderApiService from '@/utils/WorkOrderApiService';
import PermissionService from '@/utils/PermissionService';

export default function EnhancedWorkOrderDetailScreen() {
  const { selectedWorkOrder, setSelectedWorkOrder, workOrders, setWorkOrders, currentUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  
  // 获取用户角色和权限
  const userRole = currentUser?.role;
  const permissions = PermissionService.getWorkOrderPermissions(selectedWorkOrder, currentUser, userRole);

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

  // 接收工单
  const handleAcceptOrder = async () => {
    if (!selectedWorkOrder || !permissions.canAccept) return;

    Alert.alert(
      '确认接收工单',
      '接收后将开始处理，您确定要接收这个工单吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认接收',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await WorkOrderApiService.acceptWorkOrder(
                selectedWorkOrder.id,
                '工单已接收，准备前往现场处理'
              );

              if (response.success) {
                await refreshWorkOrder(response.data?.new_status);
                Alert.alert('接收成功', '工单已接收，请前往现场处理问题。');
              }
            } catch (error) {
              console.error('Accept order error:', error);
              Alert.alert('操作失败', '接收工单时发生错误，请重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 开始处理工单
  const handleStartOrder = async () => {
    if (!selectedWorkOrder || !permissions.canStart) return;

    Alert.alert(
      '开始处理工单',
      '确认开始处理这个工单吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始处理',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await WorkOrderApiService.startWorkOrder(
                selectedWorkOrder.id,
                undefined, // location info
                '开始现场处理'
              );

              if (response.success) {
                await refreshWorkOrder(response.data?.new_status);
                Alert.alert('操作成功', '已开始处理工单');
              }
            } catch (error) {
              console.error('Start order error:', error);
              Alert.alert('操作失败', '开始处理工单时发生错误，请重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 取消工单
  const handleCancelOrder = async () => {
    if (!selectedWorkOrder || !permissions.canCancel) return;

    Alert.alert(
      '取消工单',
      '确认取消这个工单吗？取消后无法恢复。',
      [
        { text: '不取消', style: 'cancel' },
        {
          text: '确认取消',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await WorkOrderApiService.cancelWorkOrder(
                selectedWorkOrder.id,
                '管理员取消工单'
              );

              if (response.success) {
                await refreshWorkOrder(response.data?.new_status);
                Alert.alert('操作成功', '工单已取消');
              }
            } catch (error) {
              console.error('Cancel order error:', error);
              Alert.alert('操作失败', '取消工单时发生错误，请重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 刷新工单状态
  const refreshWorkOrder = async (newStatus?: string) => {
    if (!selectedWorkOrder) return;

    // 更新本地状态 - 使用正确的状态映射
    const statusMap: { [key: string]: string } = {
      'pending': '待分配',
      'assigned': '已分配',
      'accepted': '待接收', 
      'processing': '处理中',
      'pending_review': '待审核',
      'completed': '已完成',
      'cancelled': '已取消',
    };

    const updatedWorkOrder = {
      ...selectedWorkOrder,
      status: newStatus ? statusMap[newStatus] || newStatus : selectedWorkOrder.status,
      updated_at: new Date().toISOString(),
    };

    const updatedWorkOrders = workOrders.map(order =>
      order.id === selectedWorkOrder.id ? updatedWorkOrder : order
    );
    
    setWorkOrders(updatedWorkOrders);
    setSelectedWorkOrder(updatedWorkOrder);
  };

  const handleProcessResult = () => {
    router.push('/process-result');
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    if (!permissions.canView) return null;

    const buttons: JSX.Element[] = [];

    if (permissions.canAccept) {
      buttons.push(
        <TouchableOpacity
          key="accept"
          style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          onPress={handleAcceptOrder}
        >
          <MaterialIcons name="check-circle" size={20} color="white" />
          <Text style={styles.actionButtonText}>接收工单</Text>
        </TouchableOpacity>
      );
    }

    if (permissions.canStart) {
      buttons.push(
        <TouchableOpacity
          key="start"
          style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
          onPress={handleStartOrder}
        >
          <MaterialIcons name="play-arrow" size={20} color="white" />
          <Text style={styles.actionButtonText}>开始处理</Text>
        </TouchableOpacity>
      );
    }

    if (permissions.canComplete) {
      buttons.push(
        <TouchableOpacity
          key="complete"
          style={[styles.actionButton, { backgroundColor: '#059669' }]}
          onPress={handleProcessResult}
        >
          <MaterialIcons name="done" size={20} color="white" />
          <Text style={styles.actionButtonText}>处理结果</Text>
        </TouchableOpacity>
      );
    }

    if (permissions.canCancel) {
      buttons.push(
        <TouchableOpacity
          key="cancel"
          style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
          onPress={handleCancelOrder}
        >
          <MaterialIcons name="cancel" size={20} color="white" />
          <Text style={styles.actionButtonText}>取消工单</Text>
        </TouchableOpacity>
      );
    }

    if (buttons.length === 0) return null;

    return (
      <View style={styles.actionButtonsContainer}>
        <View style={styles.actionButtonsGrid}>
          {buttons}
        </View>
      </View>
    );
  };

  // 使用 PermissionService 的格式化方法
  const getPriorityDisplay = (priority: string) => {
    return PermissionService.formatPriority(priority);
  };

  const getStatusDisplay = (status: string) => {
    return PermissionService.formatStatus(status);
  };

  return (
    <SafeAreaView style={styles.container}>
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
        <LoadingState isLoading={isLoading} loadingMessage="加载工单数据...">
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 工单基本信息 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>基本信息</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusDisplay(selectedWorkOrder.status).color },
                  ]}
                >
                  <Text style={styles.statusText}>{getStatusDisplay(selectedWorkOrder.status).text}</Text>
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
                    <Text style={styles.infoValue}>{selectedWorkOrder.type}</Text>
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
                          { backgroundColor: getPriorityDisplay(selectedWorkOrder.priority).color },
                        ]}
                      >
                        <Text style={styles.priorityText}>{getPriorityDisplay(selectedWorkOrder.priority).text}</Text>
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
          </ScrollView>
        </LoadingState>

        {/* 权限控制的操作按钮 */}
        {renderActionButtons()}
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
  // 新的操作按钮样式
  actionButtonsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});