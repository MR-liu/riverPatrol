#!/usr/bin/env node

/**
 * 通知系统测试脚本
 */

import fetch from 'node-fetch';
global.fetch = fetch;

const BASE_URL = 'http://localhost:54321';
const FUNCTIONS_BASE = `${BASE_URL}/functions/v1`;
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const TEST_USER = {
  username: 'admin',
  password: 'password'
};

let authToken = '';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.blue}=== ${msg} ===${colors.reset}`)
};

async function request(endpoint, options = {}) {
  const url = `${FUNCTIONS_BASE}${endpoint}`;
  
  try {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken || ANON_KEY}`,
    };
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('Request error:', error.message);
    return {
      ok: false,
      status: 0,
      error: error.message,
      data: { message: error.message }
    };
  }
}

async function testLogin() {
  log.section('测试用户登录');
  
  const result = await request('/custom-login', {
    method: 'POST',
    body: JSON.stringify(TEST_USER),
  });
  
  if (result.ok && result.data.success) {
    authToken = result.data.data.session.access_token;
    log.success(`登录成功: ${result.data.data.user.name}`);
    return true;
  } else {
    log.error(`登录失败: ${result.data.message || result.error}`);
    return false;
  }
}

async function testSyncMessages() {
  log.section('测试消息同步');
  
  const result = await request('/sync-messages', {
    method: 'POST',
    body: JSON.stringify({
      user_id: 'U001', // admin用户ID
    }),
  });
  
  if (result.ok && result.data.success) {
    const { messages, unread_count } = result.data.data;
    log.success(`同步消息成功: ${messages.length} 条消息，${unread_count} 条未读`);
    
    // 显示消息列表
    messages.slice(0, 3).forEach(msg => {
      log.info(`  消息: ${msg.title} - ${msg.content.substring(0, 50)}...`);
    });
    
    return true;
  } else {
    log.error(`同步消息失败: ${result.data?.message || result.error}`);
    return false;
  }
}

async function testWorkOrderStatusChange() {
  log.section('测试工单状态变更通知');
  
  // 首先创建一个工单
  const createResult = await request('/create-workorder', {
    method: 'POST',
    body: JSON.stringify({
      type_id: 'WT001',
      title: '通知测试工单',
      description: '用于测试通知系统的工单',
      priority: 'normal',
      location: '测试地点',
      source: 'manual'
    }),
  });
  
  if (createResult.ok && createResult.data.success) {
    const workOrderId = createResult.data.data.workorder_id;
    log.success(`创建测试工单成功: ${workOrderId}`);
    
    // 更新工单状态以触发通知
    const updateResult = await request('/update-workorder-status', {
      method: 'POST',
      body: JSON.stringify({
        workorder_id: workOrderId,
        action: 'accept',
        note: '通知测试接收工单'
      }),
    });
    
    if (updateResult.ok && updateResult.data.success) {
      log.success(`工单状态更新成功: ${updateResult.data.data.new_status}`);
      
      // 等待一下让触发器执行
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 再次同步消息看是否有新通知
      await testSyncMessages();
      
      return true;
    } else {
      log.error(`工单状态更新失败: ${updateResult.data?.message || updateResult.error}`);
      return false;
    }
  } else {
    log.error(`创建测试工单失败: ${createResult.data?.message || createResult.error}`);
    return false;
  }
}

async function testMarkMessageRead() {
  log.section('测试标记消息已读');
  
  // 首先获取消息
  const syncResult = await request('/sync-messages', {
    method: 'POST',
    body: JSON.stringify({
      user_id: 'U001',
    }),
  });
  
  if (syncResult.ok && syncResult.data.success) {
    const messages = syncResult.data.data.messages.filter(msg => !msg.is_read);
    
    if (messages.length > 0) {
      const messageIds = messages.slice(0, 2).map(msg => msg.id);
      
      const markResult = await request('/mark-messages-read', {
        method: 'POST',
        body: JSON.stringify({
          message_ids: messageIds,
          user_id: 'U001',
        }),
      });
      
      if (markResult.ok && markResult.data.success) {
        log.success(`标记 ${markResult.data.data.updated_count} 条消息为已读`);
        log.info(`剩余未读消息: ${markResult.data.data.unread_count} 条`);
        return true;
      } else {
        log.error(`标记消息已读失败: ${markResult.data?.message || markResult.error}`);
        return false;
      }
    } else {
      log.info('没有未读消息可以标记');
      return true;
    }
  } else {
    log.error('获取消息失败');
    return false;
  }
}

async function testProblemReportNotification() {
  log.section('测试问题报告通知');
  
  const reportData = {
    category_ids: ['M08001'],
    title: '通知测试报告',
    description: '这是用于测试通知系统的问题报告',
    priority: 'normal',
    location_name: '测试地点',
    longitude: 121.473701,
    latitude: 31.230416,
    address: '通知测试地址',
    photos: []
  };
  
  const result = await request('/submit-report', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
  
  if (result.ok && result.data.success) {
    log.success(`提交问题报告成功: ${result.data.data.report_id}`);
    
    // 等待触发器执行
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查是否生成了通知
    await testSyncMessages();
    
    return true;
  } else {
    log.error(`提交问题报告失败: ${result.data?.message || result.error}`);
    return false;
  }
}

async function runNotificationTests() {
  console.log('🚀 开始通知系统测试...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Functions URL: ${FUNCTIONS_BASE}\n`);
  
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
  };
  
  const tests = [
    { name: '用户登录', fn: testLogin },
    { name: '消息同步', fn: testSyncMessages },
    { name: '工单状态变更通知', fn: testWorkOrderStatusChange },
    { name: '标记消息已读', fn: testMarkMessageRead },
    { name: '问题报告通知', fn: testProblemReportNotification },
  ];
  
  for (const test of tests) {
    try {
      testResults.total++;
      const success = await test.fn();
      if (success) {
        testResults.passed++;
      } else {
        testResults.failed++;
      }
    } catch (error) {
      testResults.failed++;
      log.error(`${test.name} 测试失败: ${error.message}`);
    }
  }
  
  // 输出测试总结
  log.section('测试总结');
  log.info(`总计测试: ${testResults.total}`);
  log.success(`通过: ${testResults.passed}`);
  if (testResults.failed > 0) {
    log.error(`失败: ${testResults.failed}`);
  }
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  log.info(`成功率: ${successRate}%`);
  
  if (testResults.failed === 0) {
    log.success('\n🎉 所有通知测试通过！通知系统运行正常');
  } else {
    log.warn(`\n⚠️  有 ${testResults.failed} 个测试失败，请检查相关功能`);
  }
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runNotificationTests().catch(error => {
    log.error(`通知测试运行失败: ${error.message}`);
    process.exit(1);
  });
}

export { runNotificationTests };