import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import MessageService, { Message, MessageStats } from '@/utils/MessageService';

// 导出页面选项以隐藏header
export const unstable_settings = {
  headerShown: false,
};

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState('all');
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([]);
  const [messageStats, setMessageStats] = useState<MessageStats>(() => ({
    total: 0,
    unread: 0,
    starred: 0,
    archived: 0,
    expired: 0,
    encrypted: 0,
    byType: {},
    byPriority: {},
    byCategory: {},
    bySender: {},
    recentActivity: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      last24Hours: 0,
      last7Days: 0,
    },
    complianceMetrics: {
      auditedMessages: 0,
      retentionCompliant: 0,
      encryptionCompliant: 0,
    },
    performanceMetrics: {
      averageDeliveryTime: 0,
      averageReadTime: 0,
      deliverySuccessRate: 0,
    },
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const [allMessages, unreadMsgs, stats] = await Promise.all([
        MessageService.getMessages(),
        MessageService.getUnreadMessages(),
        MessageService.getMessageStats(),
      ]);
      
      setMessages(allMessages);
      setUnreadMessages(unreadMsgs);
      setMessageStats(stats);
      
      // 检查并发送定期提醒
      await MessageService.checkAndSendReminders();
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMessages();
    setIsRefreshing(false);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'system':
        return 'notifications';
      case 'workorder':
        return 'assignment';
      case 'reminder':
        return 'notification-important';
      default:
        return 'message';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'system':
        return '#3B82F6';
      case 'workorder':
        return '#10B981';
      case 'reminder':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '普通';
    }
  };

  const currentMessages = selectedTab === 'unread' ? unreadMessages : messages;

  const handleMarkAllRead = async () => {
    try {
      const success = await MessageService.markAllAsRead();
      if (success) {
        Alert.alert('操作成功', '已将所有消息标记为已读');
        await loadMessages();
      }
    } catch (error) {
      Alert.alert('操作失败', '标记已读时发生错误');
    }
  };

  const handleClearRead = async () => {
    Alert.alert(
      '确认删除',
      '确定要清空所有已读消息吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await MessageService.deleteReadMessages();
              if (success) {
                Alert.alert('操作成功', '已清空所有已读消息');
                await loadMessages();
              }
            } catch (error) {
              Alert.alert('操作失败', '清空消息时发生错误');
            }
          },
        },
      ]
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条消息吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await MessageService.deleteMessage(messageId);
              if (success) {
                await loadMessages();
              }
            } catch (error) {
              Alert.alert('删除失败', '删除消息时发生错误');
            }
          },
        },
      ]
    );
  };

  const handleMessagePress = async (message: Message) => {
    // 标记为已读
    if (!message.isRead) {
      await MessageService.markAsRead(message.id);
      await loadMessages();
    }

    // 处理消息动作
    if (message.actions && message.actions.length > 0) {
      const action = message.actions[0]; // 使用第一个动作
      if (action.action === 'navigate' && action.parameters?.target) {
        // 如果是工单消息，需要设置相关数据
        if (message.type === 'workorder' && message.relatedWorkOrderId) {
          // 这里可以通过context设置选中的工单
        }
        router.push(action.parameters.target as any);
      }
    }
  };

  const renderMessage = ({ item: message }: { item: Message }) => (
    <TouchableOpacity 
      style={styles.messageCard}
      onPress={() => handleMessagePress(message)}
    >
      <View style={[styles.messageContent, !message.isRead && styles.unreadMessage]}>
        <View style={styles.messageHeader}>
          <View style={styles.messageLeft}>
            <MaterialIcons
              name={getIcon(message.type) as any}
              size={20}
              color={getIconColor(message.type)}
            />
            <View style={styles.messageInfo}>
              <View style={styles.messageTitleRow}>
                <Text style={[styles.messageTitle, !message.isRead && styles.unreadTitle]}>
                  {message.title}
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: getPriorityColor(message.priority) + '20' },
                  ]}
                >
                  <Text style={[styles.priorityText, { color: getPriorityColor(message.priority) }]}>
                    {getPriorityLabel(message.priority)}
                  </Text>
                </View>
              </View>
              <Text style={styles.messageContentText} numberOfLines={2}>
                {message.content}
              </Text>
              <View style={styles.messageFooter}>
                <View style={styles.timeContainer}>
                  <MaterialIcons name="schedule" size={12} color="#9CA3AF" />
                  <Text style={styles.messageTime}>
                    {MessageService.formatMessageTime(message.timestamp)}
                  </Text>
                </View>
                <View style={styles.messageActions}>
                  {!message.isRead && <View style={styles.unreadDot} />}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteMessage(message.id)}
                  >
                    <MaterialIcons name="delete" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="message" size={48} color="#D1D5DB" />
      <Text style={styles.emptyText}>暂无消息</Text>
    </View>
  );

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
          <Text style={styles.headerTitle}>消息中心</Text>
          <View style={styles.headerButton} />
        </View>
      </View>

      <LinearGradient
        colors={['#F8FAFC', '#EBF4FF', '#E0E7FF']}
        style={styles.background}
      >
        {/* 标签页 */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
            onPress={() => setSelectedTab('all')}
          >
            <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
              全部消息
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'unread' && styles.activeTab]}
            onPress={() => setSelectedTab('unread')}
          >
            <Text style={[styles.tabText, selectedTab === 'unread' && styles.activeTabText]}>
              未读消息
            </Text>
            {messageStats.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{messageStats.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 消息列表 */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : (
          <FlatList
            data={currentMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyList}
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={onRefresh}
                tintColor="#3B82F6"
              />
            }
          />
        )}

        {/* 底部操作 */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleMarkAllRead}>
            <Text style={styles.actionButtonText}>全部标记为已读</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleClearRead}>
            <Text style={styles.actionButtonText}>清空已读消息</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
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
  tabsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#EBF4FF',
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageCard: {
    marginBottom: 12,
  },
  messageContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  messageLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  messageInfo: {
    flex: 1,
  },
  messageTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '600',
    color: '#1F2937',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageContentText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  footer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
});