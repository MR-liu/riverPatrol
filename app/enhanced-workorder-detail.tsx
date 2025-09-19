import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { LoadingState } from '@/components/LoadingState';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';
import { useAppContext } from '@/contexts/AppContext';
import PermissionService from '@/utils/PermissionService';
import WorkOrderApiService from '@/utils/WorkOrderApiService';

export default function EnhancedWorkOrderDetailScreen() {
  const { selectedWorkOrder, setSelectedWorkOrder, workOrders, setWorkOrders, currentUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [imageLoadingStates, setImageLoadingStates] = useState<{[key: number]: boolean}>({});
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // 本地处理状态
  
  // 调试：打印工单数据
  console.log('工单详情数据:', {
    id: selectedWorkOrder?.id,
    status: selectedWorkOrder?.status,
    results: selectedWorkOrder?.results,
    hasResults: selectedWorkOrder?.results && (Array.isArray(selectedWorkOrder?.results) ? selectedWorkOrder?.results.length > 0 : !!selectedWorkOrder?.results),
  });
  
  // 获取用户角色和权限
  const userRole = currentUser?.role;
  const permissions = PermissionService.getWorkOrderPermissions(selectedWorkOrder, currentUser, userRole);

  if (!selectedWorkOrder) {
    return (
      <SafeAreaWrapper edges={['top']} style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>未找到工单信息</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaWrapper>
    );
  }

  // 分配工单（区域主管使用）
  const handleAssignOrder = async () => {
    if (!selectedWorkOrder || !permissions.canAssign) return;
    // TODO: 实现分配工单的模态框，选择维护员
    Alert.alert('分配工单', '分配功能开发中...');
  };

  // 开始处理工单（维护员使用） - 先调用API更新状态
  const handleStartProcessing = async () => {
    if (!selectedWorkOrder) return;
    
    Alert.alert(
      '开始处理工单',
      '确认开始处理这个工单吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            setIsLoading(true);
            try {
              // 先调用API将状态更新为processing
              const response = await WorkOrderApiService.startWorkOrder(
                selectedWorkOrder.id,
                undefined, // location info
                '开始现场处理'
              );

              if (response.success) {
                // 更新本地状态
                await refreshWorkOrder('processing');
                // 跳转到处理结果填写页面
                router.push('/process-result');
              } else {
                Alert.alert('操作失败', response.message || '无法开始处理工单');
              }
            } catch (error) {
              console.error('Start processing error:', error);
              Alert.alert('操作失败', '开始处理工单时发生错误，请重试');
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

  // 发起人确认完成
  const handleReporterConfirm = async () => {
    if (!selectedWorkOrder) return;
    
    Alert.alert(
      '确认完成',
      '确认工单处理结果满意，工单将标记为已完成？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认完成',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await WorkOrderApiService.updateWorkOrderStatus({
                workorder_id: selectedWorkOrder.id,
                action: 'reporter_confirm' as any,
                note: '发起人确认完成',
              });

              if (response.success) {
                await refreshWorkOrder('completed');
                Alert.alert('确认成功', '工单已完成');
              }
            } catch (error) {
              console.error('Reporter confirm error:', error);
              Alert.alert('操作失败', '确认失败，请重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 发起人拒绝（要求返工）
  const handleReporterReject = async () => {
    if (!selectedWorkOrder) return;
    setRejectModalVisible(true);
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
      'pending_dispatch': '待派发',
      'dispatched': '已派发',
      'assigned': '已分配',
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

  // 提交处理结果 - 跳转到处理结果填写页面
  const handleSubmitResult = async () => {
    if (!selectedWorkOrder || !permissions.canComplete) return;
    
    // 跳转到处理结果填写页面，让维护员填写处理方法、上传照片等
    router.push('/process-result');
  };

  // 审核通过
  const handleApproveOrder = async () => {
    if (!selectedWorkOrder || !permissions.canReview) return;
    
    Alert.alert(
      '审核通过',
      '确认审核通过这个工单？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认通过',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await WorkOrderApiService.approveWorkOrder(
                selectedWorkOrder.id,
                '审核通过'
              );

              if (response.success) {
                await refreshWorkOrder(response.data?.new_status);
                Alert.alert('审核成功', '工单已审核通过');
              }
            } catch (error) {
              console.error('Approve order error:', error);
              Alert.alert('操作失败', '审核工单失败，请重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 审核拒绝/打回
  const handleRejectOrder = async () => {
    if (!selectedWorkOrder || !permissions.canReview) return;
    setRejectModalVisible(true);
  };

  // 最终复核通过
  const handleFinalApprove = async () => {
    if (!selectedWorkOrder) return;
    
    Alert.alert(
      '复核通过',
      '确认复核通过这个工单？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认通过',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await WorkOrderApiService.finalApproveWorkOrder(
                selectedWorkOrder.id,
                '复核通过'
              );

              if (response.success) {
                await refreshWorkOrder('completed');
                Alert.alert('复核成功', '工单已完成');
              }
            } catch (error) {
              console.error('Final approve error:', error);
              Alert.alert('操作失败', '复核失败，请重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 最终复核拒绝
  const handleFinalReject = async () => {
    if (!selectedWorkOrder) return;
    setRejectModalVisible(true);
  };

  // 确认拒绝
  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('请输入原因', '请输入打回原因');
      return;
    }

    setRejectModalVisible(false);
    setIsLoading(true);
    
    try {
      // 判断是审核拒绝、发起人拒绝还是最终复核拒绝
      const isFinalReject = selectedWorkOrder?.status === 'pending_final_review' || 
                           selectedWorkOrder?.status === '待复核';
      const isReporterReject = selectedWorkOrder?.status === 'pending_reporter_confirm' || 
                               selectedWorkOrder?.status === '待发起人确认';
      
      let response;
      if (isFinalReject) {
        response = await WorkOrderApiService.finalRejectWorkOrder(
          selectedWorkOrder!.id,
          rejectReason
        );
      } else if (isReporterReject) {
        response = await WorkOrderApiService.updateWorkOrderStatus({
          workorder_id: selectedWorkOrder!.id,
          action: 'reporter_reject' as any,
          note: rejectReason,
        });
      } else {
        response = await WorkOrderApiService.rejectWorkOrder(
          selectedWorkOrder!.id,
          rejectReason
        );
      }

      if (response.success) {
        await refreshWorkOrder(response.data?.new_status || 'processing');
        Alert.alert('打回成功', '工单已打回，要求返工');
        setRejectReason('');
      }
    } catch (error) {
      console.error('Reject order error:', error);
      Alert.alert('操作失败', '打回工单失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    if (!permissions.canView) return null;

    const buttons: JSX.Element[] = [];
    const status = selectedWorkOrder?.status;

    // 根据状态和权限显示不同按钮
    if (permissions.canAssign && (status === '待分配' || status === 'pending' || status === '待派发' || status === 'pending_dispatch')) {
      buttons.push(
        <TouchableOpacity
          key="assign"
          style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
          onPress={handleAssignOrder}
        >
          <MaterialIcons name="person-add" size={20} color="white" />
          <Text style={styles.actionButtonText}>分配工单</Text>
        </TouchableOpacity>
      );
    }

    // 维护员处理按钮
    const userRoleId = currentUser?.role_id || currentUser?.role?.id;
    if ((userRoleId === 'R003') && (status === '已派发' || status === 'dispatched' || status === '已分配' || status === 'assigned')) {
      buttons.push(
        <TouchableOpacity
          key="process"
          style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          onPress={handleStartProcessing}
        >
          <MaterialIcons name="build" size={20} color="white" />
          <Text style={styles.actionButtonText}>处理工单</Text>
        </TouchableOpacity>
      );
    }


    if (permissions.canComplete && (status === '处理中' || status === 'processing')) {
      buttons.push(
        <TouchableOpacity
          key="submit"
          style={[styles.actionButton, { backgroundColor: '#059669' }]}
          onPress={handleSubmitResult}
        >
          <MaterialIcons name="check" size={20} color="white" />
          <Text style={styles.actionButtonText}>提交结果</Text>
        </TouchableOpacity>
      );
    }

    if (permissions.canReview && (status === '待审核' || status === 'pending_review')) {
      buttons.push(
        <TouchableOpacity
          key="approve"
          style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          onPress={handleApproveOrder}
        >
          <MaterialIcons name="done-all" size={20} color="white" />
          <Text style={styles.actionButtonText}>审核通过</Text>
        </TouchableOpacity>
      );
      
      buttons.push(
        <TouchableOpacity
          key="reject"
          style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
          onPress={handleRejectOrder}
        >
          <MaterialIcons name="replay" size={20} color="white" />
          <Text style={styles.actionButtonText}>打回返工</Text>
        </TouchableOpacity>
      );
    }

    // 发起人确认按钮
    if ((status === '待发起人确认' || status === 'pending_reporter_confirm') && 
        selectedWorkOrder?.reporter === currentUser?.username) {
      buttons.push(
        <TouchableOpacity
          key="confirm"
          style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          onPress={handleReporterConfirm}
        >
          <MaterialIcons name="check-circle" size={20} color="white" />
          <Text style={styles.actionButtonText}>确认完成</Text>
        </TouchableOpacity>
      );
      
      buttons.push(
        <TouchableOpacity
          key="reporter-reject"
          style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
          onPress={handleReporterReject}
        >
          <MaterialIcons name="replay" size={20} color="white" />
          <Text style={styles.actionButtonText}>要求返工</Text>
        </TouchableOpacity>
      );
    }

    // 最终复核按钮 - 系统管理员、监控中心主管、巡检员可以复核待复核的工单
    const canDoFinalReview = userRoleId === 'R001' ||  // 系统管理员
                            userRoleId === 'R002' ||  // 监控中心主管
                            userRoleId === 'R004' ||  // 河道巡检员（发起人）
                            selectedWorkOrder?.reporter === currentUser?.username;  // 或者是工单发起人
    
    if ((status === '待复核' || status === 'pending_final_review') && canDoFinalReview) {
      buttons.push(
        <TouchableOpacity
          key="final-approve"
          style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          onPress={handleFinalApprove}
        >
          <MaterialIcons name="verified" size={20} color="white" />
          <Text style={styles.actionButtonText}>复核通过</Text>
        </TouchableOpacity>
      );
      
      buttons.push(
        <TouchableOpacity
          key="final-reject"
          style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
          onPress={handleFinalReject}
        >
          <MaterialIcons name="replay" size={20} color="white" />
          <Text style={styles.actionButtonText}>要求返工</Text>
        </TouchableOpacity>
      );
    }

    if (permissions.canCancel && status !== '待发起人确认' && status !== 'pending_reporter_confirm' && status !== '待复核' && status !== 'pending_final_review') {
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
    // 对维护员和巡检员，dispatched 状态显示为"待处理"
    const userRoleId = currentUser?.role_id || currentUser?.role?.id;
    if ((userRoleId === 'R003' || userRoleId === 'R004') && status === 'dispatched') {
      return { text: '待处理', color: '#F59E0B' };
    }
    
    const statusMap: { [key: string]: { text: string, color: string } } = {
      'pending': { text: '待分配', color: '#F59E0B' },
      'pending_dispatch': { text: '待派发', color: '#F59E0B' },
      'dispatched': { text: '已派发', color: '#3B82F6' },
      'assigned': { text: '已分配', color: '#3B82F6' },
      'processing': { text: '处理中', color: '#8B5CF6' },
      'pending_review': { text: '待审核', color: '#F59E0B' },
      'pending_reporter_confirm': { text: '待发起人确认', color: '#F59E0B' },
      'pending_final_review': { text: '待复核', color: '#F59E0B' },
      'completed': { text: '已完成', color: '#10B981' },
      'cancelled': { text: '已取消', color: '#6B7280' },
    };
    
    return statusMap[status] || { text: status, color: '#6B7280' };
  };

  return (
    <SafeAreaWrapper edges={['top']} style={styles.container}>
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
                    <Text style={styles.infoValue}>
                      {selectedWorkOrder.time || 
                       (selectedWorkOrder.created_at ? new Date(selectedWorkOrder.created_at).toLocaleString('zh-CN') : '未知时间')}
                    </Text>
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
                    <Text style={styles.infoValue}>{selectedWorkOrder.reporter || '系统'}</Text>
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

            {/* 处理结果信息 - 已完成、待审核、待确认、待复核的工单显示 */}
            {(selectedWorkOrder.status === '已完成' || 
              selectedWorkOrder.status === 'completed' ||
              selectedWorkOrder.status === '待审核' ||
              selectedWorkOrder.status === 'pending_review' ||
              selectedWorkOrder.status === '待发起人确认' ||
              selectedWorkOrder.status === 'pending_reporter_confirm' ||
              selectedWorkOrder.status === '待复核' ||
              selectedWorkOrder.status === 'pending_final_review') && 
             selectedWorkOrder.results && (() => {
               // 处理 results 可能是对象或数组的情况
               const resultData = Array.isArray(selectedWorkOrder.results) 
                 ? selectedWorkOrder.results[0] 
                 : selectedWorkOrder.results;
               
               if (!resultData) return null;
               
               console.log('处理结果数据:', {
                 hasAfterPhotos: !!resultData.after_images,
                 afterPhotosLength: resultData.after_images?.length,
                 afterPhotos: resultData.after_images
               },
              JSON.stringify(selectedWorkOrder.results));
               
               return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>处理结果</Text>
                  </View>
                  <View style={styles.infoSection}>
                    {resultData.description && (
                      <View style={styles.infoRow}>
                        <MaterialIcons name="description" size={20} color="#6B7280" />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>处理说明</Text>
                          <Text style={styles.infoValue}>{resultData.description}</Text>
                        </View>
                      </View>
                    )}
                    
                    {resultData.after_images && resultData.after_images.length > 0 && (
                      <View>
                        <View style={styles.infoRow}>
                          <MaterialIcons name="photo-library" size={20} color="#6B7280" />
                          <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>处理后照片 ({resultData.after_images.length}张)</Text>
                          </View>
                        </View>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false} 
                          style={styles.photoContainer}
                          contentContainerStyle={{ paddingRight: 16, marginTop: 8 }}
                        >
                          {resultData.after_images.map((photo: string, index: number) => (
                            <TouchableOpacity
                              key={`after-${index}`}
                              style={styles.photoWrapper}
                              onPress={() => {
                                setPreviewImageUrl(photo);
                                setImagePreviewVisible(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <Image
                                source={photo}
                                style={styles.photo}
                                contentFit="cover"
                                transition={300}
                                cachePolicy="memory-disk"
                                recyclingKey={`after-photo-${index}`}
                              />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  
                    {resultData.created_at && (
                      <View style={styles.infoRow}>
                        <MaterialIcons name="access-time" size={20} color="#6B7280" />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>处理时间</Text>
                          <Text style={styles.infoValue}>
                            {new Date(resultData.created_at).toLocaleString('zh-CN')}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
               );
             })()}

            {/* 现场照片 */}
            {selectedWorkOrder.images && selectedWorkOrder.images.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>问题照片 ({selectedWorkOrder.images.length}张)</Text>
                </View>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.photoContainer}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {selectedWorkOrder.images.map((photo: string, index: number) => {
                    const isLoading = imageLoadingStates[index] !== false;
                    // 直接使用原始CDN URL
                    let processedUrl = photo;
                    
                    // 测试：使用一个公开的图片URL看是否能加载
                    // processedUrl = 'https://picsum.photos/200/300';
                    
                    console.log(`图片${index + 1} URL:`, processedUrl);
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.photoWrapper}
                        onPress={() => {
                          setPreviewImageUrl(processedUrl);
                          setImagePreviewVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={processedUrl}
                          style={styles.photo}
                          contentFit="cover"
                          transition={300}
                          cachePolicy="memory-disk" // 使用内存和磁盘缓存
                          recyclingKey={`photo-${index}`} // 优化内存使用
                          onError={(error) => {
                            console.error(`图片${index + 1}加载失败:`, error);
                            setImageLoadingStates(prev => ({...prev, [index]: false}));
                          }}
                          onLoadStart={() => {
                            setImageLoadingStates(prev => ({...prev, [index]: true}));
                          }}
                          onLoad={() => {
                            console.log(`图片${index + 1}加载成功`);
                            setImageLoadingStates(prev => ({...prev, [index]: false}));
                          }}
                        />
                        {/* 加载指示器 */}
                        {isLoading && (
                          <View style={styles.photoLoadingOverlay}>
                            <ActivityIndicator size="small" color="#3B82F6" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </LoadingState>

        {/* 权限控制的操作按钮 */}
        {renderActionButtons()}
        
        {/* 打回原因模态框 */}
        <Modal
          visible={rejectModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setRejectModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>打回原因</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="请输入打回原因..."
                multiline
                numberOfLines={4}
                value={rejectReason}
                onChangeText={setRejectReason}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setRejectModalVisible(false);
                    setRejectReason('');
                  }}
                >
                  <Text style={styles.modalButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={confirmReject}
                >
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>确认打回</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* 图片预览模态框 */}
        <Modal
          visible={imagePreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImagePreviewVisible(false)}
        >
          <View style={styles.imagePreviewOverlay}>
            <TouchableOpacity 
              style={styles.imagePreviewContainer}
              activeOpacity={1}
              onPress={() => setImagePreviewVisible(false)}
            >
              <Image
                source={previewImageUrl}
                style={styles.previewImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              <TouchableOpacity
                style={styles.closePreviewButton}
                onPress={() => setImagePreviewVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaWrapper>
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
  photoContainer: {
    paddingVertical: 8,
    height: 140, // 固定容器高度
  },
  photoWrapper: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 120, // 明确设置宽度
    height: 120, // 明确设置高度
    backgroundColor: '#F3F4F6', // 添加背景色，便于看到占位
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E5E7EB', // 添加背景色
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  photoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
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
  // 模态框样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#F59E0B',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  // 图片预览样式
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  closePreviewButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});