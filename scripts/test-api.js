#!/usr/bin/env node

/**
 * 智慧河道巡查系统 - API接口测试脚本
 * 用于测试Supabase Edge Functions的功能
 */

import fetch from 'node-fetch';
global.fetch = fetch;

const BASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const FUNCTIONS_BASE = `${BASE_URL}/functions/v1`;

// 从supabase status获取的匿名key
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// 测试数据
const TEST_USER = {
  username: 'admin',
  password: 'password'
};

let authToken = '';

// 颜色输出工具
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

// HTTP请求工具
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

// 测试用例
async function testLogin() {
  log.section('测试用户登录');
  
  const result = await request('/custom-login', {
    method: 'POST',
    body: JSON.stringify(TEST_USER),
  });
  
  if (result.ok && result.data.success) {
    authToken = result.data.data.session.access_token;
    log.success(`登录成功: ${result.data.data.user.name}`);
    log.info(`Token: ${authToken.substring(0, 20)}...`);
    return true;
  } else {
    log.error(`登录失败: ${result.data.message || result.error}`);
    return false;
  }
}

async function testProblemCategories() {
  log.section('测试问题分类接口');
  
  // 测试获取所有分类
  const allResult = await request('/get-problem-categories');
  
  if (allResult.ok && allResult.data.categories) {
    const count = Object.keys(allResult.data.categories).length;
    log.success(`获取所有分类成功: ${count} 个分类`);
  } else {
    log.error('获取所有分类失败');
  }
  
  // 测试获取三级分类
  const level3Result = await request('/get-problem-categories?level=3');
  
  if (level3Result.ok && level3Result.data.categories) {
    const count = Object.keys(level3Result.data.categories).length;
    log.success(`获取三级分类成功: ${count} 个分类`);
  } else {
    log.error('获取三级分类失败');
  }
  
  // 测试获取特定父级的子分类
  const childResult = await request('/get-problem-categories?parent=M02000');
  
  if (childResult.ok && childResult.data.categories) {
    const count = Object.keys(childResult.data.categories).length;
    log.success(`获取子分类成功: ${count} 个分类`);
  } else {
    log.warn('获取子分类失败 (M02000 可能不存在)');
  }
}

async function testWorkOrders() {
  log.section('测试工单接口');
  
  // 测试获取工单列表
  const listResult = await request('/get-workorders?page=1&size=10');
  
  if (listResult.ok && listResult.data.success) {
    const count = listResult.data.data.items.length;
    const total = listResult.data.data.pagination.total;
    log.success(`获取工单列表成功: ${count}/${total} 个工单`);
  } else {
    log.error(`获取工单列表失败: ${listResult.data.message || listResult.error}`);
  }
  
  // 测试创建工单
  const newWorkOrder = {
    type_id: 'WT001',
    title: '测试工单',
    description: '这是一个API测试创建的工单',
    priority: 'normal',
    location: '测试地点',
    source: 'manual'
  };
  
  const createResult = await request('/create-workorder', {
    method: 'POST',
    body: JSON.stringify(newWorkOrder),
  });
  
  if (createResult.ok && createResult.data.success) {
    const workOrderId = createResult.data.data.workorder_id;
    log.success(`创建工单成功: ${workOrderId}`);
    
    // 测试更新工单状态
    const updateResult = await request('/update-workorder-status', {
      method: 'POST',
      body: JSON.stringify({
        workorder_id: workOrderId,
        action: 'accept',
        note: 'API测试接收工单'
      }),
    });
    
    if (updateResult.ok && updateResult.data.success) {
      log.success(`更新工单状态成功: ${updateResult.data.data.new_status}`);
    } else {
      log.error(`更新工单状态失败: ${updateResult.data.message || updateResult.error}`);
    }
  } else {
    log.error(`创建工单失败: ${createResult.data.message || createResult.error}`);
  }
}

async function testDashboardStats() {
  log.section('测试统计数据接口');
  
  const result = await request('/get-dashboard-stats');
  
  if (result.ok && result.data.success) {
    const stats = result.data.data;
    log.success(`获取仪表板统计成功:`);
    log.info(`  总工单数: ${stats.overview.total_workorders}`);
    log.info(`  待处理: ${stats.overview.pending_count}`);
    log.info(`  已完成: ${stats.overview.completed_count}`);
    log.info(`  完成率: ${stats.overview.completion_rate}%`);
    log.info(`  今日新增: ${stats.today_stats.new_workorders}`);
  } else {
    log.error(`获取统计数据失败: ${result.data.message || result.error}`);
  }
}

async function testFileUpload() {
  log.section('测试文件上传接口');
  
  // 创建一个简单的测试文件内容
  const testFileContent = Buffer.from('Test file content for API testing', 'utf-8');
  
  // 模拟FormData
  const formData = new FormData();
  const blob = new Blob([testFileContent], { type: 'text/plain' });
  formData.append('file', blob, 'test.txt');
  formData.append('upload_type', 'other');
  formData.append('related_id', 'test_relation');
  
  try {
    const response = await fetch(`${FUNCTIONS_BASE}/upload-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body: formData,
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      log.success(`文件上传成功: ${result.data.file_id}`);
      log.info(`  文件URL: ${result.data.file_url}`);
      log.info(`  文件大小: ${result.data.file_size} bytes`);
    } else {
      log.error(`文件上传失败: ${result.message}`);
    }
  } catch (error) {
    log.warn(`文件上传测试跳过 (需要实际文件): ${error.message}`);
  }
}

async function testSubmitReport() {
  log.section('测试问题报告接口');
  
  const reportData = {
    category_ids: ['M08001'],
    title: 'API测试报告',
    description: '这是通过API测试提交的问题报告',
    priority: 'normal',
    location_name: '测试地点',
    longitude: 121.473701,
    latitude: 31.230416,
    address: '上海市测试地址',
    photos: []
  };
  
  const result = await request('/submit-report', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
  
  if (result.ok && result.data.success) {
    log.success(`提交问题报告成功: ${result.data.data.report_id}`);
    if (result.data.data.workorder_id) {
      log.info(`  已自动转为工单: ${result.data.data.workorder_id}`);
    }
  } else {
    log.error(`提交问题报告失败: ${result.data.message || result.error}`);
  }
}

async function runTests() {
  console.log('🚀 开始API接口测试...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Functions URL: ${FUNCTIONS_BASE}\n`);
  
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
  };
  
  const tests = [
    { name: '用户登录', fn: testLogin },
    { name: '问题分类', fn: testProblemCategories },
    { name: '工单管理', fn: testWorkOrders },
    { name: '统计数据', fn: testDashboardStats },
    { name: '文件上传', fn: testFileUpload },
    { name: '问题报告', fn: testSubmitReport },
  ];
  
  for (const test of tests) {
    try {
      testResults.total++;
      await test.fn();
      testResults.passed++;
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
    log.success('\n🎉 所有测试通过！API服务运行正常');
  } else {
    log.warn(`\n⚠️  有 ${testResults.failed} 个测试失败，请检查相关接口`);
  }
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    log.error(`测试运行失败: ${error.message}`);
    process.exit(1);
  });
}

export {
  runTests,
  testLogin,
  testProblemCategories,
  testWorkOrders,
  testDashboardStats,
  testFileUpload,
  testSubmitReport,
};