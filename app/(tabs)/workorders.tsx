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
import { router } from 'expo-router';
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';

import { useAppContext } from '@/contexts/AppContext';
import EnhancedProblemCategoryService from '@/utils/EnhancedProblemCategoryService';

export default function WorkOrdersScreen() {
  const { 
    workOrders, 
    workOrderFilter, 
    setWorkOrderFilter, 
    setSelectedWorkOrder,
    loadWorkOrdersFromBackend,
    isLoading,
    error,
  } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // 使用后端搜索功能
      loadWorkOrdersFromBackend({ search: searchQuery });
    }
  };

  const handleFilter = () => {
    Alert.alert('筛选功能', '高级筛选功能开发中，敬请期待');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadWorkOrdersFromBackend();
      Alert.alert('刷新成功', '工单列表已刷新');
    } catch (error) {
      console.error('Refresh error:', error);
      Alert.alert('刷新失败', '请检查网络连接');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 监听筛选条件变化，自动刷新数据
  useEffect(() => {
    loadWorkOrdersFromBackend();
  }, [workOrderFilter, loadWorkOrdersFromBackend]);

  const handleWorkOrderPress = (workOrder: any) => {
    setSelectedWorkOrder(workOrder);
    router.push('/workorder-detail');
  };

  const getFilteredWorkOrders = () => {
    let filtered = workOrders;

    if (workOrderFilter !== 'all') {
      filtered = workOrders.filter(order => order.status === workOrderFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const categoryName = EnhancedProblemCategoryService.getCategoryFullName(order.type) || order.type;
        return order.title.toLowerCase().includes(query) ||
               order.location.toLowerCase().includes(query) ||
               categoryName.toLowerCase().includes(query);
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
            {EnhancedProblemCategoryService.getCategoryFullName(item.type) || item.type}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
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

          {/* 筛选标签 */}
          <View style={styles.filterTabs}>
            {renderFilterTab('all', '全部')}
            {renderFilterTab('待接收', '待接收')}
            {renderFilterTab('处理中', '处理中')}
            {renderFilterTab('待审核', '待审核')}
            {renderFilterTab('已完成', '已完成')}
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