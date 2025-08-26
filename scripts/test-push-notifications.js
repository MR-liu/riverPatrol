#!/usr/bin/env node

/**
 * 推送通知功能测试脚本
 * 测试工单分配和状态更新的推送通知功能
 */

import fetch from 'node-fetch';

// 配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const TEST_USER_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// 测试用户和工单
const TEST_USERS = {
  admin: { id: 'U001', username: 'admin', name: '系统管理员' },
  worker: { id: 'U002', username: 'P001', name: '张三' },
  supervisor: { id: 'U003', username: 'P002', name: '李四' }
};

let accessToken = '';

/**
 * 测试步骤：
 * 1. 登录获取Token
 * 2. 创建一个分配给处理人的工单（测试分配通知）
 * 3. 处理人接收工单（测试状态变化通知）
 * 4. 处理人完成工单（测试完成通知）
 * 5. 管理员审核工单（测试审核通知）
 */

async function main() {
  console.log('🚀 开始推送通知功能测试...\n');
  
  try {
    // 1. 登录
    console.log('=== 步骤1: 用户登录 ===');
    await login();
    
    // 2. 测试工单分配通知
    console.log('\n=== 步骤2: 测试工单分配通知 ===');
    const workOrderId = await testWorkOrderAssignmentNotification();
    
    // 3. 测试工单状态变化通知
    console.log('\n=== 步骤3: 测试工单状态变化通知 ===');
    await testWorkOrderStatusNotifications(workOrderId);
    
    console.log('\n🎉 推送通知功能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 登录获取访问Token
async function login() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/custom-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    },
    body: JSON.stringify(TEST_USER_CREDENTIALS)
  });
  
  const result = await response.json();
  console.log('登录API响应:', result);
  
  if (!result.success) {
    throw new Error(`登录失败: ${result.message || '未知错误'}`);
  }
  
  accessToken = result.data.session.access_token;
  console.log('✓ 登录成功:', result.data.user.name);
  console.log('ℹ Token:', accessToken.substring(0, 50) + '...');
}

// 测试工单分配通知
async function testWorkOrderAssignmentNotification() {
  console.log('创建工单并分配给处理人...');
  
  const workOrderData = {
    type_id: 'WT001',
    title: `[测试] 推送通知功能测试 - ${new Date().toLocaleTimeString()}`,
    description: '这是一个用于测试推送通知功能的工单',
    priority: 'important',
    location: '测试区域A段',
    coordinates: {
      latitude: 31.230416,
      longitude: 121.473701
    },
    assignee_id: TEST_USERS.worker.id, // 分配给张巡查员
    source: 'manual'
  };
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-workorder`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(workOrderData)
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`创建工单失败: ${result.message}`);
  }
  
  const workOrderId = result.data.workorder_id;
  console.log('✓ 工单创建成功:', workOrderId);
  console.log('✓ 已分配给处理人:', TEST_USERS.worker.name);
  console.log('📱 处理人应该收到"新工单分配"推送通知');
  
  // 等待通知发送
  await sleep(2000);
  
  return workOrderId;
}

// 测试工单状态变化通知
async function testWorkOrderStatusNotifications(workOrderId) {
  const statusUpdates = [
    {
      action: 'accept',
      description: '处理人接收工单',
      expectedNotification: '创建者应该收到"工单已接收"通知'
    },
    {
      action: 'start', 
      description: '处理人开始处理工单',
      expectedNotification: '创建者应该收到"工单处理中"通知'
    },
    {
      action: 'complete',
      description: '处理人完成工单',
      expectedNotification: '创建者应该收到"工单已完成"通知',
      note: '垃圾清理完成，现场已恢复',
      attachments: ['https://example.com/after1.jpg']
    }
  ];
  
  for (const update of statusUpdates) {
    console.log(`\n--- ${update.description} ---`);
    
    const updateData = {
      workorder_id: workOrderId,
      action: update.action,
      note: update.note,
      attachments: update.attachments
    };
    
    if (update.action === 'start') {
      updateData.location_info = {
        latitude: 31.230416,
        longitude: 121.473701,
        address: '测试区域A段现场'
      };
    }
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-workorder-status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`更新工单状态失败: ${result.message}`);
    }
    
    console.log('✓ 状态更新成功:', `${result.data.old_status} → ${result.data.new_status}`);
    console.log('📱', update.expectedNotification);
    
    // 等待通知发送
    await sleep(1500);
  }
}

// 工具函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
main();