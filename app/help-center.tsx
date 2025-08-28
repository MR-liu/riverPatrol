import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PageContainer } from '@/components/PageContainer';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'basic' | 'operation' | 'technical' | 'other';
}

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  action: () => void;
}

export default function HelpCenterScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: '如何进行签到签退？',
      answer: '在考勤管理页面，点击中央的签到/签退按钮即可。系统会自动记录您的位置和时间。请确保已开启位置权限。',
      category: 'operation',
    },
    {
      id: '2', 
      question: '如何上报河道问题？',
      answer: '点击底部导航的"上报"按钮，选择问题类型，填写详细描述，上传现场照片，确认位置信息后提交即可。',
      category: 'operation',
    },
    {
      id: '3',
      question: '工单处理流程是什么？',
      answer: '工单处理流程：接收工单→前往现场→处理问题→上传处理结果→审核完成。每个步骤都有详细的操作指引。',
      category: 'operation',
    },
    {
      id: '4',
      question: '离线模式如何使用？',
      answer: '在设置中开启离线模式后，应用可在无网络环境下正常使用。离线期间的数据会在网络恢复后自动同步。',
      category: 'technical',
    },
    {
      id: '5',
      question: '如何查看巡视轨迹？',
      answer: '在地图页面可以查看实时轨迹，在数据分析页面可以查看历史轨迹统计和详细信息。',
      category: 'operation',
    },
    {
      id: '6',
      question: '忘记密码怎么办？',
      answer: '在登录页面点击"忘记密码"，输入手机号码，系统会发送验证码重置密码。或联系管理员重置。',
      category: 'basic',
    },
    {
      id: '7',
      question: '如何更新个人信息？',
      answer: '在"我的"页面点击个人信息，可以修改头像、姓名、联系方式等基本信息。',
      category: 'basic',
    },
    {
      id: '8',
      question: '应用崩溃或运行缓慢怎么办？',
      answer: '尝试清理应用缓存、重启应用或设备。如问题持续存在，请联系技术支持。',
      category: 'technical',
    },
  ];

  const helpSections: HelpSection[] = [
    {
      id: 'user_guide',
      title: '使用指南',
      icon: 'book',
      description: '详细的功能使用说明和操作步骤',
      action: () => showUserGuide(),
    },
    {
      id: 'video_tutorial', 
      title: '视频教程',
      icon: 'play-circle-filled',
      description: '观看视频了解应用各项功能',
      action: () => showVideoTutorial(),
    },
    {
      id: 'contact_support',
      title: '联系客服',
      icon: 'headset-mic',
      description: '遇到问题？联系我们的客服团队',
      action: () => contactSupport(),
    },
    {
      id: 'feedback',
      title: '意见反馈',
      icon: 'feedback',
      description: '提交您的宝贵意见和建议',
      action: () => submitFeedback(),
    },
    {
      id: 'version_info',
      title: '版本信息',
      icon: 'info',
      description: '查看应用版本和更新日志',
      action: () => showVersionInfo(),
    },
  ];

  const categories = [
    { key: 'all', name: '全部' },
    { key: 'basic', name: '基础操作' },
    { key: 'operation', name: '功能使用' },
    { key: 'technical', name: '技术问题' },
    { key: 'other', name: '其他' },
  ];

  const filteredFAQ = selectedCategory === 'all' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory);

  const showUserGuide = () => {
    Alert.alert(
      '使用指南',
      '这里将显示详细的使用指南，包括各个功能模块的操作说明。',
      [{ text: '知道了' }]
    );
  };

  const showVideoTutorial = () => {
    Alert.alert(
      '视频教程',
      '即将跳转到视频教程页面，您可以观看详细的操作演示。',
      [
        { text: '取消', style: 'cancel' },
        { text: '观看', onPress: () => {
          // 这里可以打开视频链接或内置播放器
          console.log('Open video tutorial');
        }},
      ]
    );
  };

  const contactSupport = () => {
    Alert.alert(
      '联系客服',
      '请选择联系方式：',
      [
        { text: '取消', style: 'cancel' },
        { text: '拨打电话', onPress: () => Linking.openURL('tel:400-123-4567') },
        { text: '发送邮件', onPress: () => Linking.openURL('mailto:support@riverpatrol.com') },
      ]
    );
  };

  const submitFeedback = () => {
    router.push('/feedback');
  };

  const showVersionInfo = () => {
    Alert.alert(
      '版本信息',
      '智慧河道巡查系统\n版本：1.0.0\n构建：2024.01.15\n\n更新内容：\n• 新增考勤管理功能\n• 优化界面交互体验\n• 修复已知问题',
      [{ text: '确定' }]
    );
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const renderHelpSection = (section: HelpSection) => (
    <TouchableOpacity
      key={section.id}
      style={styles.helpSection}
      onPress={section.action}
    >
      <View style={styles.helpSectionLeft}>
        <View style={styles.helpSectionIcon}>
          <MaterialIcons name={section.icon as any} size={24} color="#3B82F6" />
        </View>
        <View style={styles.helpSectionContent}>
          <Text style={styles.helpSectionTitle}>{section.title}</Text>
          <Text style={styles.helpSectionDescription}>{section.description}</Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );

  const renderFAQItem = (item: FAQItem) => (
    <View key={item.id} style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => toggleFAQ(item.id)}
      >
        <Text style={styles.faqQuestionText}>{item.question}</Text>
        <MaterialIcons 
          name={expandedFAQ === item.id ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
          size={20} 
          color="#6B7280" 
        />
      </TouchableOpacity>
      {expandedFAQ === item.id && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );

  const renderCategoryButton = (category: any) => (
    <TouchableOpacity
      key={category.key}
      style={[
        styles.categoryButton,
        selectedCategory === category.key && styles.categoryButtonActive,
      ]}
      onPress={() => setSelectedCategory(category.key)}
    >
      <Text
        style={[
          styles.categoryButtonText,
          selectedCategory === category.key && styles.categoryButtonTextActive,
        ]}
      >
        {category.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <PageContainer
      title="帮助中心"
      rightButton={{
        icon: 'search',
        onPress: () => router.push('/search-help')
      }}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 快捷帮助 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="help-outline" size={16} color="#374151" />
              <Text style={styles.cardTitle}>快捷帮助</Text>
            </View>
            <View style={styles.helpSections}>
              {helpSections.map(renderHelpSection)}
            </View>
          </View>

          {/* 常见问题 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="quiz" size={16} color="#374151" />
              <Text style={styles.cardTitle}>常见问题</Text>
            </View>
            
            {/* 分类筛选 */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryContainer}
            >
              <View style={styles.categoryButtons}>
                {categories.map(renderCategoryButton)}
              </View>
            </ScrollView>

            {/* FAQ列表 */}
            <View style={styles.faqList}>
              {filteredFAQ.map(renderFAQItem)}
            </View>
          </View>

          {/* 联系信息 */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="contact-support" size={16} color="#374151" />
              <Text style={styles.cardTitle}>联系我们</Text>
            </View>
            
            <View style={styles.contactInfo}>
              <View style={styles.contactItem}>
                <MaterialIcons name="phone" size={20} color="#3B82F6" />
                <View style={styles.contactDetails}>
                  <Text style={styles.contactLabel}>客服热线</Text>
                  <Text style={styles.contactValue}>400-123-4567</Text>
                  <Text style={styles.contactTime}>工作时间: 9:00-18:00</Text>
                </View>
              </View>
              
              <View style={styles.contactItem}>
                <MaterialIcons name="email" size={20} color="#3B82F6" />
                <View style={styles.contactDetails}>
                  <Text style={styles.contactLabel}>邮箱支持</Text>
                  <Text style={styles.contactValue}>support@riverpatrol.com</Text>
                  <Text style={styles.contactTime}>24小时内回复</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 底部说明 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              如果您在使用过程中遇到任何问题，请随时联系我们。
            </Text>
            <Text style={styles.footerText}>
              我们致力于为您提供最优质的服务体验。
            </Text>
          </View>
        </ScrollView>
      </PageContainer>
    );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
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
  },
  helpSections: {
    gap: 2,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  helpSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  helpSectionIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EBF4FF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helpSectionContent: {
    flex: 1,
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  helpSectionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  categoryButtonActive: {
    backgroundColor: '#3B82F6',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  faqList: {
    gap: 8,
  },
  faqItem: {
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  contactInfo: {
    gap: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 2,
  },
  contactTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});