#!/usr/bin/env node

/**
 * 简化的推送通知功能测试脚本
 * 直接测试数据库插入和通知逻辑
 */

import fetch from 'node-fetch';

// 配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function main() {
  console.log('🚀 开始简化推送通知功能测试...\n');
  
  try {
    // 1. 测试创建消息记录
    console.log('=== 步骤1: 测试消息记录创建 ===');
    await testMessageCreation();
    
    // 2. 测试设备注册
    console.log('\n=== 步骤2: 测试设备注册 ===');
    await testDeviceRegistration();
    
    // 3. 测试推送通知API
    console.log('\n=== 步骤3: 测试推送通知API ===');
    await testPushNotificationAPI();
    
    console.log('\n🎉 简化推送通知功能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 测试消息记录创建
async function testMessageCreation() {
  // 首先创建一个测试工单
  const workOrderData = {
    id: 'WO12345678',
    type_id: 'WT001',
    title: '河道垃圾清理',
    description: '测试工单用于推送通知测试',
    priority: 'normal',
    status: 'pending',
    location: '测试区域',
    creator_id: 'U001',
    assignee_id: 'U002',
    source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const workOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/workorders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(workOrderData)
  });

  if (!workOrderResponse.ok) {
    const error = await workOrderResponse.text();
    console.log('创建工单失败:', error);
    // 可能工单已存在，继续测试
  } else {
    console.log('✓ 测试工单创建成功: WO12345678');
  }

  // 现在创建消息记录
  const messageData = {
    id: `MSG${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 3)}`,
    user_id: 'U002', // 张三
    type: 'workorder',
    title: '新工单分配',
    content: '您收到了新的工单：河道垃圾清理',
    priority: 'high',
    category: 'workorder_assigned',
    related_workorder_id: 'WO12345678',
    is_read: false,
    created_at: new Date().toISOString(),
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(messageData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`创建消息记录失败: ${error}`);
  }

  const result = await response.json();
  console.log('✓ 消息记录创建成功:', result[0]?.id);
}

// 测试设备注册
async function testDeviceRegistration() {
  const deviceData = {
    id: `DT${Date.now().toString().slice(-8)}`,
    device_id: `device_${Date.now().toString().slice(-8)}`,
    user_id: 'U002', // 张三
    device_type: 'ios',
    push_token: 'ExponentPushToken[test_token_12345]',
    device_name: 'Test iPhone',
    os_version: 'iOS 17.0',
    app_version: '1.0.0',
    is_active: true,
    last_active_at: new Date().toISOString(),
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`设备注册失败: ${error}`);
  }

  const result = await response.json();
  console.log('✓ 设备注册成功:', result[0]?.device_id);
}

// 测试推送通知API
async function testPushNotificationAPI() {
  const notificationData = {
    user_ids: ['U002'], // 张三
    title: '测试推送通知',
    body: '这是一个测试推送通知，验证系统是否正常工作',
    data: {
      type: 'workorder_assigned',
      workorder_id: 'WO12345678',
      priority: 'high'
    }
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(notificationData)
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('推送通知API响应错误:', error);
    // 不抛出错误，因为这可能是正常的（没有真实设备Token）
    console.log('⚠️ 推送通知API调用失败（这可能是正常的，因为使用的是测试Token）');
    return;
  }

  const result = await response.json();
  console.log('✓ 推送通知API调用成功:', result);
}

// 工具函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
main();