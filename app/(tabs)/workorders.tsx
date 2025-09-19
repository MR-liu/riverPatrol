import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';
import Toast from 'react-native-toast-message';

import { useAppContext } from '@/contexts/AppContext';
import SimpleProblemCategoryService from '@/utils/SimpleProblemCategoryService';
import PermissionService from '@/utils/PermissionService';
import WorkOrderApiService from '@/utils/WorkOrderApiService';

export default function WorkOrdersScreen() {
  const { 
    workOrders, 
    setWorkOrders,
    workOrderFilter, 
    setWorkOrderFilter, 
    setSelectedWorkOrder,
    loadWorkOrdersFromBackend,
    isLoading,
    error,
    currentUser,
  } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取用户角色和权限
  const userRole = currentUser?.role;
  const userRoleId = currentUser?.role_id || currentUser?.role?.id;
  const canViewAllOrders = PermissionService.isAdmin(userRole);
  
  // 根据角色获取筛选标签
  const getFilterTabsForRole = () => {
    switch (userRoleId) {
      case 'R001': // 系统管理员
      case 'R002': // 监控中心主管
        return [
          { value: '待分配', label: '待分配' },
          { value: '已分配', label: '已分配' },
          { value: '处理中', label: '处理中' },
          { value: '待审核', label: '待审核' },
          { value: '已完成', label: '已完成' },
        ];
      
      case 'R003': // 河道维护员
      case 'R004': // 河道巡检员
        return [
          { value: '已派发', label: '待处理' },  // dispatched 状态显示为"待处理"
          { value: '处理中', label: '处理中' },
          { value: '已完成', label: '已完成' },
        ];
      
      case 'R005': // 领导看板用户
        return [
          { value: '处理中', label: '处理中' },
          { value: '待审核', label: '待审核' },
          { value: '已完成', label: '已完成' },
        ];
      
      case 'R006': // 河道维护员主管
        return [
          { value: '待分配', label: '待分配' },
          { value: '已分配', label: '已分配' },
          { value: '处理中', label: '处理中' },
          { value: '待审核', label: '待审核' },
          { value: '已完成', label: '已完成' },
        ];
      
      default:
        return [
          { value: '处理中', label: '处理中' },
          { value: '已完成', label: '已完成' },
        ];
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      try {
        const queryParams = PermissionService.getWorkOrderQueryParams(currentUser, userRole);
        const response = await WorkOrderApiService.getWorkOrders({
          ...queryParams,
          search: searchQuery,
        });
        
        if (response.success && response.data?.items) {
          // 转换数据格式以适配界面显示，但保留原始数据用于权限检查
          const formattedOrders = response.data.items.map((order: any) => ({
            // 保留所有原始字段
            ...order,
            // 覆盖特定字段用于显示
            priority: order.priority === 'urgent' ? '紧急' : order.priority === 'important' ? '重要' : '普通',
            type: order.type_id,
            location: order.location || order.area?.name || '未知位置',
            time: new Date(order.created_at).toLocaleString('zh-CN'),
          }));
          setWorkOrders(formattedOrders);
        }
      } catch (error) {
        console.error('Search error:', error);
        Alert.alert('搜索失败', '请检查网络连接');
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const queryParams = PermissionService.getWorkOrderQueryParams(currentUser, userRole);
      const response = await WorkOrderApiService.getWorkOrders(queryParams);
      
      if (response.success && response.data?.items) {
        // 转换数据格式以适配界面显示，但保留原始数据用于权限检查
        const formattedOrders = response.data.items.map((order: any) => ({
          // 保留所有原始字段
          ...order,
          // 添加权限检查需要的字段
          assignee_id: order.assignee?.id || order.assignee_id,
          creator_id: order.creator?.id || order.creator_id,
          area_id: order.area?.id || order.area_id,
          // 覆盖特定字段用于显示
          priority: order.priority === 'urgent' ? '紧急' : order.priority === 'important' ? '重要' : '普通',
          type: order.type_id,
          location: order.location || order.area?.name || '未知位置',
          time: order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : 
                (order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '未知时间'),
        }));
        setWorkOrders(formattedOrders);
        Toast.show({
          type: 'success',
          text1: '刷新成功',
          text2: `已加载 ${response.data.items.length} 个工单`,
          position: 'top',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Refresh error:', error);
      Toast.show({
        type: 'error',
        text1: '刷新失败',
        text2: '请检查网络连接',
        position: 'top',
        visibilityTime: 2000,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // 根据权限加载工单数据
  const loadWorkOrdersWithPermission = async () => {
    try {
      const queryParams = PermissionService.getWorkOrderQueryParams(currentUser, userRole);
      const response = await WorkOrderApiService.getWorkOrders(queryParams);
      
      if (response.success && response.data?.items) {
        // 转换数据格式以适配界面显示，但保留原始数据用于权限检查
        const formattedOrders = response.data.items.map((order: any) => ({
          // 保留所有原始字段
          ...order,
          // 添加权限检查需要的字段
          assignee_id: order.assignee?.id || order.assignee_id,
          creator_id: order.creator?.id || order.creator_id,
          area_id: order.area?.id || order.area_id,
          // 覆盖特定字段用于显示
          priority: order.priority === 'urgent' ? '紧急' : order.priority === 'important' ? '重要' : '普通',
          type: order.type_id,
          location: order.location || order.area?.name || '未知位置',
          time: order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : 
                (order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '未知时间'),
        }));
        setWorkOrders(formattedOrders);
      }
    } catch (error) {
      console.error('Load work orders error:', error);
    }
  };

  // 监听筛选条件变化，自动刷新数据
  useEffect(() => {
    if (currentUser) {
      loadWorkOrdersWithPermission();
    }
  }, [workOrderFilter, currentUser]);

  // 页面获得焦点时重新加载数据
  useFocusEffect(
    React.useCallback(() => {
      if (currentUser) {
        loadWorkOrdersWithPermission();
      }
    }, [currentUser])
  );

  // 添加筛选功能
  const handleFilter = () => {
    const filterOptions = PermissionService.getStatusFilterOptions(userRole);
    Alert.alert('筛选功能', '请选择状态筛选', filterOptions.map(option => ({
      text: option.label,
      onPress: () => setWorkOrderFilter(option.value),
    })));
  };

  const handleWorkOrderPress = (workOrder: any) => {
    // 检查用户是否有查看权限
    console.log('当前用户:', currentUser?.id, '角色:', currentUser?.role_id);
    console.log('工单信息:', { id: workOrder.id, assignee_id: workOrder.assignee_id });
    
    const permissions = PermissionService.getWorkOrderPermissions(workOrder, currentUser, userRole);
    console.log('权限结果:', permissions);
    
    if (!permissions.canView) {
      Alert.alert('权限不足', '您没有权限查看此工单');
      return;
    }
    
    setSelectedWorkOrder(workOrder);
    router.push('/enhanced-workorder-detail'); // 使用增强版工单详情页面
  };

  const getFilteredWorkOrders = () => {
    let filtered = workOrders;

    if (workOrderFilter !== 'all') {
      // 将中文状态转换为英文状态进行筛选
      const statusMap: { [key: string]: string } = {
        '待分配': 'pending',     // 待分配（监控主管、区域主管看）
        '已分配': 'assigned',     // 已分配（区域主管看）
        '待接收': 'assigned',     // 待接收（维护员看，实际是 assigned 状态）
        '处理中': 'processing',   // 处理中
        '待审核': 'pending_review', // 待审核（区域主管审核）
        '已完成': 'completed',    // 已完成
        '已取消': 'cancelled',    // 已取消
      };
      const englishStatus = statusMap[workOrderFilter] || workOrderFilter;
      filtered = workOrders.filter(order => order.status === englishStatus);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const typeName = order.typeName || order.type || '';
        return order.title.toLowerCase().includes(query) ||
               order.location.toLowerCase().includes(query) ||
               typeName.toLowerCase().includes(query);
      });
    }

    return filtered;
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
    // Handle both English and Chinese status values
    const normalizedStatus = translateStatus(status);
    switch (normalizedStatus) {
      case '待分配':
      case '待派发':
        return '#F59E0B';
      case '已分配':
      case '已派发':
        return '#3B82F6';
      case '待接收':
      case '待处理':
        return '#F59E0B';
      case '处理中':
        return '#8B5CF6';
      case '已完成':
        return '#10B981';
      case '待审核':
      case '待发起人确认':
      case '待复核':
        return '#F59E0B';
      case '已取消':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  // Translate backend status to display status based on user role
  const translateStatus = (status: string): string => {
    // 对维护员和巡检员，dispatched 状态显示为"待处理"
    if ((userRoleId === 'R003' || userRoleId === 'R004') && status === 'dispatched') {
      return '待处理';
    }
    
    const statusMap: { [key: string]: string } = {
      'pending': '待分配',
      'pending_dispatch': '待派发',
      'dispatched': '已派发',
      'assigned': '已分配', 
      'processing': '处理中',
      'completed': '已完成',
      'pending_review': '待审核',
      'pending_reporter_confirm': '待发起人确认',
      'pending_final_review': '待复核',
      'cancelled': '已取消',
    };
    return statusMap[status?.toLowerCase()] || status;
  };

  const renderFilterTab = (filter: string, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterTab,
        workOrderFilter === filter && styles.filterTabActive,
      ]}
      onPress={() => setWorkOrderFilter(filter)}
    >
      <Text style={[
        styles.filterTabText,
        workOrderFilter === filter && styles.filterTabTextActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderWorkOrder = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.workOrderCard}
      onPress={() => handleWorkOrderPress(item)}
    >
      <View style={styles.workOrderHeader}>
        <View style={styles.workOrderTitleRow}>
          <Text style={styles.workOrderTitle}>{item.title}</Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(item.priority) },
            ]}
          >
            <Text style={styles.priorityText}>{item.priority}</Text>
          </View>
        </View>
        <View style={styles.workOrderMeta}>
          <View style={styles.workOrderLocation}>
            <MaterialIcons name="place" size={14} color="#6B7280" />
            <Text style={styles.workOrderLocationText}>{item.location}</Text>
          </View>
          <Text style={styles.workOrderTime}>{item.time}</Text>
        </View>
        <Text style={styles.workOrderDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View style={styles.workOrderFooter}>
        <View style={styles.workOrderType}>
          <MaterialIcons name="category" size={14} color="#6B7280" />
          <Text style={styles.workOrderTypeText}>
            {item.typeName || item.type || '未分类'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(translateStatus(item.status)) },
          ]}
        >
          <Text style={styles.statusText}>{translateStatus(item.status)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaWrapper edges={['top']}>
      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        {/* 顶部搜索和操作 */}
        <View style={styles.header}>
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="搜索工单..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleFilter}>
              <MaterialIcons name="filter-list" size={20} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleRefresh} disabled={isLoading || isRefreshing}>
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : (
                <MaterialIcons name="refresh" size={20} color="#64748B" />
              )}
            </TouchableOpacity>
          </View>

          {/* 快速上报 */}
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => router.push('/(tabs)/report')}
          >
            <LinearGradient
              colors={['#FB923C', '#EF4444', '#EC4899']}
              style={styles.reportButtonGradient}
            >
              <MaterialIcons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.reportButtonText}>快速上报</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* 筛选标签 - 根据角色动态显示 */}
          <View style={styles.filterTabs}>
            {renderFilterTab('all', '全部')}
            {getFilterTabsForRole().map(tab => 
              renderFilterTab(tab.value, tab.label)
            )}
          </View>
        </View>

        {/* 工单列表 */}
        <FlatList
          data={getFilteredWorkOrders()}
          renderItem={renderWorkOrder}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              {isLoading ? (
                <>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.emptyText}>加载中...</Text>
                </>
              ) : error ? (
                <>
                  <MaterialIcons name="error" size={48} color="#EF4444" />
                  <Text style={[styles.emptyText, { color: '#EF4444' }]}>
                    加载失败: {error.message}
                  </Text>
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={() => loadWorkOrdersFromBackend()}
                  >
                    <Text style={styles.retryButtonText}>重试</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <MaterialIcons name="assignment" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>暂无工单数据</Text>
                </>
              )}
            </View>
          )}
        />
      </LinearGradient>
      <Toast />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
    color: '#1F2937',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportButton: {
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  reportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  reportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterTabText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  workOrderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  workOrderHeader: {
    marginBottom: 12,
  },
  workOrderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workOrderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  workOrderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workOrderLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workOrderLocationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  workOrderTime: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  workOrderDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  workOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workOrderType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workOrderTypeText: {
    fontSize: 12,
    color: '#6B7280',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});