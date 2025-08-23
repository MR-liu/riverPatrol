import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
import DataExportService, { ExportOptions } from '@/utils/DataExportService';
import { LoadingState } from '@/components/LoadingState';

export default function DataExportScreen() {
  const { workOrders } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv' | 'excel'>('json');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [exportType, setExportType] = useState<'all' | 'workorders' | 'statistics' | 'attendance'>('all');

  const exportTypes = [
    { value: 'all', label: '完整数据导出', description: '导出所有数据，包括工单、报告、考勤等' },
    { value: 'workorders', label: '工单数据', description: '仅导出工单相关数据' },
    { value: 'statistics', label: '统计报告', description: '导出数据分析和统计报告' },
    { value: 'attendance', label: '考勤记录', description: '导出考勤打卡记录' },
  ];

  useEffect(() => {
    loadExportHistory();
  }, []);

  const loadExportHistory = async () => {
    try {
      const history = await DataExportService.getExportHistory();
      setExportHistory(history);
    } catch (error) {
      console.error('Load export history error:', error);
    }
  };

  const handleExport = async () => {
    if (!selectedFormat || !exportType) {
      Alert.alert('设置不完整', '请选择导出格式和类型');
      return;
    }

    setIsLoading(true);
    try {
      const options: ExportOptions = {
        format: selectedFormat,
        dateRange: dateRange ? {
          start: dateRange.start.getTime(),
          end: dateRange.end.getTime(),
        } : undefined,
        includeCharts: true,
        includeImages: false,
      };

      let filePath: string | null = null;

      switch (exportType) {
        case 'all':
          filePath = await DataExportService.exportAllData(options);
          break;
        case 'workorders':
          filePath = await DataExportService.exportWorkOrders(workOrders, options);
          break;
        case 'statistics':
          // 这里需要从统计页面获取统计数据
          const mockStatistics = {
            overview: { totalReports: workOrders.length, completionRate: 85 },
            categories: [],
            performanceMetrics: {},
          };
          filePath = await DataExportService.exportStatisticsReport(mockStatistics, options);
          break;
        case 'attendance':
          filePath = await DataExportService.exportAttendanceData([], options);
          break;
      }

      if (filePath) {
        Alert.alert(
          '导出成功',
          '数据已成功导出，是否立即分享？',
          [
            { text: '稍后处理', style: 'cancel' },
            { 
              text: '立即分享', 
              onPress: () => DataExportService.shareExportFile(filePath!) 
            },
          ]
        );
        
        // 刷新导出历史
        await loadExportHistory();
        setShowExportModal(false);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('导出失败', '数据导出过程中发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareFile = async (filePath: string) => {
    const success = await DataExportService.shareExportFile(filePath);
    if (success) {
      Alert.alert('分享成功', '文件已分享');
    }
  };

  const handleDeleteFile = async (exportId: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个导出文件吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            const success = await DataExportService.deleteExportFile(exportId);
            if (success) {
              await loadExportHistory();
              Alert.alert('删除成功', '导出文件已删除');
            }
          },
        },
      ]
    );
  };

  const handleClearAllExports = () => {
    if (exportHistory.length === 0) {
      Alert.alert('提示', '没有可清理的导出文件');
      return;
    }

    Alert.alert(
      '确认清理',
      `确定要删除所有 ${exportHistory.length} 个导出文件吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '全部删除',
          style: 'destructive',
          onPress: async () => {
            const success = await DataExportService.clearAllExports();
            if (success) {
              await loadExportHistory();
              Alert.alert('清理完成', '所有导出文件已删除');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json':
        return 'code';
      case 'csv':
        return 'table-chart';
      case 'excel':
        return 'description';
      default:
        return 'insert-drive-file';
    }
  };

  const renderExportHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyLeft}>
        <MaterialIcons
          name={getFormatIcon(item.format) as any}
          size={24}
          color="#3B82F6"
        />
        <View style={styles.historyInfo}>
          <Text style={styles.historyFileName}>{item.fileName}</Text>
          <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
          <Text style={styles.historySize}>
            {DataExportService.formatFileSize(item.size)} • {item.format.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.historyActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShareFile(item.filePath)}
        >
          <MaterialIcons name="share" size={20} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteFile(item.id)}
        >
          <MaterialIcons name="delete" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormatOption = (format: any) => (
    <TouchableOpacity
      key={format.value}
      style={[
        styles.optionCard,
        selectedFormat === format.value && styles.optionCardSelected,
      ]}
      onPress={() => setSelectedFormat(format.value)}
    >
      <View style={styles.optionHeader}>
        <MaterialIcons
          name={getFormatIcon(format.value) as any}
          size={20}
          color={selectedFormat === format.value ? '#3B82F6' : '#6B7280'}
        />
        <Text
          style={[
            styles.optionTitle,
            selectedFormat === format.value && styles.optionTitleSelected,
          ]}
        >
          {format.label}
        </Text>
      </View>
      <Text style={styles.optionDescription}>{format.description}</Text>
    </TouchableOpacity>
  );

  const renderExportTypeOption = (type: any) => (
    <TouchableOpacity
      key={type.value}
      style={[
        styles.optionCard,
        exportType === type.value && styles.optionCardSelected,
      ]}
      onPress={() => setExportType(type.value)}
    >
      <View style={styles.optionHeader}>
        <MaterialIcons
          name={
            type.value === 'all' ? 'backup' :
            type.value === 'workorders' ? 'assignment' :
            type.value === 'statistics' ? 'bar-chart' :
            'access-time'
          }
          size={20}
          color={exportType === type.value ? '#3B82F6' : '#6B7280'}
        />
        <Text
          style={[
            styles.optionTitle,
            exportType === type.value && styles.optionTitleSelected,
          ]}
        >
          {type.label}
        </Text>
      </View>
      <Text style={styles.optionDescription}>{type.description}</Text>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>数据导出</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowExportModal(true)}
        >
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        <LoadingState isLoading={isLoading} loadingMessage="正在导出数据...">
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 快速导出 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="flash-on" size={16} color="#374151" />
                <Text style={styles.cardTitle}>快速导出</Text>
              </View>
              <View style={styles.quickExportGrid}>
                <TouchableOpacity
                  style={styles.quickExportItem}
                  onPress={() => {
                    setExportType('workorders');
                    setSelectedFormat('csv');
                    setShowExportModal(true);
                  }}
                >
                  <MaterialIcons name="assignment" size={32} color="#3B82F6" />
                  <Text style={styles.quickExportLabel}>工单数据</Text>
                  <Text style={styles.quickExportSubtitle}>CSV格式</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickExportItem}
                  onPress={() => {
                    setExportType('statistics');
                    setSelectedFormat('json');
                    setShowExportModal(true);
                  }}
                >
                  <MaterialIcons name="bar-chart" size={32} color="#10B981" />
                  <Text style={styles.quickExportLabel}>统计报告</Text>
                  <Text style={styles.quickExportSubtitle}>JSON格式</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickExportItem}
                  onPress={() => {
                    setExportType('all');
                    setSelectedFormat('json');
                    setShowExportModal(true);
                  }}
                >
                  <MaterialIcons name="backup" size={32} color="#F59E0B" />
                  <Text style={styles.quickExportLabel}>完整备份</Text>
                  <Text style={styles.quickExportSubtitle}>JSON格式</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 导出历史 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="history" size={16} color="#374151" />
                <Text style={styles.cardTitle}>导出历史</Text>
                {exportHistory.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearAllExports}
                  >
                    <Text style={styles.clearButtonText}>清空</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {exportHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="folder-open" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>暂无导出记录</Text>
                  <Text style={styles.emptyStateSubtext}>点击右上角 + 开始导出数据</Text>
                </View>
              ) : (
                <FlatList
                  data={exportHistory}
                  keyExtractor={(item) => item.id}
                  renderItem={renderExportHistoryItem}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}
            </View>

            {/* 使用说明 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="help" size={16} color="#374151" />
                <Text style={styles.cardTitle}>使用说明</Text>
              </View>
              <View style={styles.helpContent}>
                <View style={styles.helpItem}>
                  <MaterialIcons name="info" size={16} color="#3B82F6" />
                  <Text style={styles.helpText}>
                    JSON格式适合程序处理，包含完整的结构化数据
                  </Text>
                </View>
                <View style={styles.helpItem}>
                  <MaterialIcons name="info" size={16} color="#3B82F6" />
                  <Text style={styles.helpText}>
                    CSV格式适合在Excel等表格软件中查看
                  </Text>
                </View>
                <View style={styles.helpItem}>
                  <MaterialIcons name="info" size={16} color="#3B82F6" />
                  <Text style={styles.helpText}>
                    导出文件会自动保存到本地，可以随时分享
                  </Text>
                </View>
                <View style={styles.helpItem}>
                  <MaterialIcons name="info" size={16} color="#3B82F6" />
                  <Text style={styles.helpText}>
                    系统最多保留10个导出文件，超出会自动删除旧文件
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </LoadingState>

        {/* 导出配置弹窗 */}
        <Modal
          visible={showExportModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>配置导出</Text>
              <TouchableOpacity onPress={handleExport}>
                <Text style={styles.modalSaveText}>导出</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* 导出类型 */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>导出类型</Text>
                <View style={styles.optionsGrid}>
                  {exportTypes.map(renderExportTypeOption)}
                </View>
              </View>

              {/* 导出格式 */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>导出格式</Text>
                <View style={styles.optionsGrid}>
                  {DataExportService.getSupportedFormats().map(renderFormatOption)}
                </View>
              </View>

              {/* 日期范围选择 */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>时间范围（可选）</Text>
                <View style={styles.dateRangeContainer}>
                  <TouchableOpacity style={styles.dateRangeButton}>
                    <MaterialIcons name="date-range" size={16} color="#6B7280" />
                    <Text style={styles.dateRangeText}>
                      {dateRange ? 
                        `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}` :
                        '全部时间'
                      }
                    </Text>
                  </TouchableOpacity>
                  {dateRange && (
                    <TouchableOpacity
                      style={styles.clearDateButton}
                      onPress={() => setDateRange(null)}
                    >
                      <MaterialIcons name="clear" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 预览信息 */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>导出预览</Text>
                <View style={styles.previewContainer}>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>类型</Text>
                    <Text style={styles.previewValue}>
                      {exportTypes.find(t => t.value === exportType)?.label}
                    </Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>格式</Text>
                    <Text style={styles.previewValue}>{selectedFormat.toUpperCase()}</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>数据量</Text>
                    <Text style={styles.previewValue}>
                      {exportType === 'workorders' ? `${workOrders.length} 条工单` :
                       exportType === 'all' ? '完整数据集' :
                       exportType === 'statistics' ? '统计摘要' :
                       '考勤记录'}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  quickExportGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickExportItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickExportLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginTop: 8,
  },
  quickExportSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyFileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  historySize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  helpContent: {
    gap: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  optionsGrid: {
    gap: 8,
  },
  optionCard: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF4FF',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  optionTitleSelected: {
    color: '#3B82F6',
  },
  optionDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateRangeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#374151',
  },
  clearDateButton: {
    padding: 8,
  },
  previewContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
});