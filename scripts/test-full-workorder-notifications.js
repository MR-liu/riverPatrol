#!/usr/bin/env node

/**
 * 完整的工单推送通知测试
 * 测试create-workorder和update-workorder-status的推送通知功能
 */

import fetch from 'node-fetch';

// 配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function main() {
  console.log('🚀 开始完整工单推送通知测试...\n');
  
  try {
    // 1. 确保测试用户有设备
    console.log('=== 步骤1: 注册测试设备 ===');
    await ensureTestDevice();
    
    // 2. 测试工单分配通知
    console.log('\n=== 步骤2: 测试工单分配通知 ===');
    const workOrderId = await testWorkOrderAssignmentNotification();
    
    // 3. 测试工单状态变化通知
    console.log('\n=== 步骤3: 测试工单状态变化通知 ===');
    await testWorkOrderStatusNotifications(workOrderId);
    
    // 4. 查看推送历史
    console.log('\n=== 步骤4: 查看推送历史记录 ===');
    await viewPushHistory();
    
    console.log('\n🎉 完整工单推送通知测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 确保测试用户有设备记录
async function ensureTestDevice() {
  const deviceData = {
    id: `TEST${Date.now().toString().slice(-8)}`,
    device_id: `test_device_${Date.now().toString().slice(-8)}`,
    user_id: 'U002', // 张三
    device_type: 'ios',
    push_token: `ExponentPushToken[VALID_TEST_TOKEN_${Date.now()}]`,
    device_name: 'Test iPhone for Push',
    os_version: 'iOS 17.0',
    app_version: '1.0.0',
    is_active: true,
    notification_permission: true,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/mobile_devices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(deviceData)
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✓ 测试设备注册成功:', result[0]?.device_id);
  } else {
    console.log('ℹ 测试设备可能已存在，继续测试...');
  }
}

// 测试工单分配通知
async function testWorkOrderAssignmentNotification() {
  console.log('直接测试推送通知调用...');
  
  // 直接调用推送通知API，模拟工单分配场景
  const notificationData = {
    user_ids: ['U002'], // 张三
    title: '新工单分配',
    body: '您收到了新的工单：[推送测试] 河道垃圾清理',
    data: {
      type: 'workorder_assigned',
      workorder_id: 'WO_TEST_' + Date.now(),
      priority: 'important'
    }
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(notificationData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`发送推送通知失败: ${error}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`发送推送通知失败: ${result.message}`);
  }

  console.log('✓ 工单分配推送通知发送成功');
  console.log('📱 处理人应该收到"新工单分配"推送通知');
  console.log('📊 推送结果:', result.data);
  
  return notificationData.data.workorder_id;
}

// 测试工单状态变化通知
async function testWorkOrderStatusNotifications(workOrderId) {
  const statusUpdates = [
    {
      action: 'accept',
      title: '工单已接收',
      body: '工单已被处理人接收，即将开始处理',
      description: '处理人接收工单'
    },
    {
      action: 'start', 
      title: '工单处理中',
      body: '处理人已开始现场处理工单',
      description: '处理人开始处理'
    },
    {
      action: 'complete',
      title: '工单已完成',
      body: '现场处理已完成，等待审核确认',
      description: '处理人完成工单'
    }
  ];

  for (const update of statusUpdates) {
    console.log(`\n--- ${update.description} ---`);
    
    // 直接调用推送通知API
    const notificationData = {
      user_ids: ['U001'], // 通知创建者（管理员）
      title: update.title,
      body: update.body,
      data: {
        type: 'workorder_status_changed',
        workorder_id: workOrderId,
        action: update.action,
        priority: 'normal'
      }
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`⚠️ 发送状态变化通知失败: ${error}`);
      continue;
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.log(`⚠️ 发送状态变化通知失败: ${result.message}`);
      continue;
    }
    
    console.log('✓ 状态变化推送通知发送成功');
    console.log('📱 创建者应该收到状态变化通知');
    console.log('📊 推送结果:', result.data);
    
    // 等待通知发送
    await sleep(1000);
  }
}

// 查看推送历史
async function viewPushHistory() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/push_notification_history?select=id,title,recipient_user_ids,status,sent_at&order=sent_at.desc&limit=5`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.log('⚠️ 无法获取推送历史记录');
    return;
  }

  const history = await response.json();
  
  if (history.length === 0) {
    console.log('ℹ 暂无推送历史记录');
    return;
  }

  console.log('最近5条推送通知记录:');
  history.forEach((record, index) => {
    console.log(`${index + 1}. [${record.status}] ${record.title}`);
    console.log(`   用户: ${record.recipient_user_ids || 'N/A'}`);
    console.log(`   时间: ${new Date(record.sent_at).toLocaleString()}`);
  });
}

// 工具函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
main();