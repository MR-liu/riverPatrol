#!/usr/bin/env node

/**
 * 简单测试认证功能脚本
 * 验证用户登录是否正常工作
 */

import { createClient } from '@supabase/supabase-js';

// Supabase配置
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// 创建Supabase客户端（使用service role key绕过RLS）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 测试登录
async function testLogin(username, password) {
  console.log(`\n测试登录: ${username}`);
  console.log('='.repeat(40));
  
  try {
    // 使用已知的密码哈希
    const passwordHash = '9dfb6c0fe2cb6776ba923ccd7e23b6a77ab88bd38e9a34d774dd30db146e66ef';
    
    // 查询用户
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', passwordHash)
      .eq('status', 'active')
      .single();
    
    if (userError) {
      console.error('✗ 用户验证失败:', userError.message);
      return false;
    }
    
    if (!userData) {
      console.error('✗ 用户不存在或密码错误');
      return false;
    }
    
    console.log('✓ 用户验证成功');
    console.log(`  - 用户ID: ${userData.id}`);
    console.log(`  - 姓名: ${userData.name}`);
    console.log(`  - 角色: ${userData.role_id}`);
    console.log(`  - 部门: ${userData.department_id || '无'}`);
    
    return true;
  } catch (error) {
    console.error('✗ 登录测试失败:', error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('智慧河道监控系统 - 认证功能测试');
  console.log('='.repeat(50));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  
  // 测试账号
  const testAccounts = [
    { username: 'admin2', password: 'password', name: '管理员' },
    { username: 'I001', password: 'password', name: '张三' },
    { username: 'M001', password: 'password', name: '赵六' },
    { username: 'S001', password: 'password', name: '李四' },
  ];
  
  console.log('\n开始测试用户登录...');
  const results = [];
  
  for (const account of testAccounts) {
    const success = await testLogin(account.username, account.password);
    results.push({
      username: account.username,
      name: account.name,
      success
    });
  }
  
  // 输出测试结果
  console.log('\n' + '='.repeat(50));
  console.log('测试结果汇总:');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    const status = result.success ? '✅ 成功' : '❌ 失败';
    console.log(`${result.username.padEnd(10)} (${result.name.padEnd(8)}) : ${status}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = Math.round((successCount / totalCount) * 100);
  
  console.log('='.repeat(50));
  console.log(`总测试数: ${totalCount}`);
  console.log(`成功数: ${successCount}`);
  console.log(`失败数: ${totalCount - successCount}`);
  console.log(`成功率: ${successRate}%`);
  
  if (successCount === totalCount) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查数据库和配置');
  }
}

// 运行测试
runTests().catch(console.error);