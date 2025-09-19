#!/usr/bin/env node

/**
 * 测试后端推送API
 * 直接调用极光API测试推送功能
 */

import https from 'https';

const APP_KEY = '463f52032571434a7a2ddeee';
const MASTER_SECRET = 'dae68cd8344bdd329d032915';
const auth = Buffer.from(`${APP_KEY}:${MASTER_SECRET}`).toString('base64');

// 生成有效的sendno
const sendno = Math.floor(Math.random() * 2147483647) + 1;

const pushData = {
  platform: 'all',
  audience: 'all',
  notification: {
    alert: '测试推送消息',
    android: {
      alert: '测试推送内容',
      title: '极光推送测试',
      builder_id: 1
    },
    ios: {
      alert: '极光推送测试 - 测试推送内容',
      sound: 'default',
      badge: '+1'
    }
  },
  options: {
    sendno: sendno,
    time_to_live: 86400,
    apns_production: false
  }
};

console.log('发送推送数据:');
console.log('- AppKey:', APP_KEY);
console.log('- Sendno:', sendno);
console.log('- Audience: all');
console.log('- Alert: 测试推送消息');

const data = JSON.stringify(pushData);

const options = {
  hostname: 'api.jpush.cn',
  port: 443,
  path: '/v3/push',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\n响应状态码:', res.statusCode);
    console.log('响应内容:', responseData);
    
    if (res.statusCode === 200) {
      console.log('✅ 推送请求成功！');
      const result = JSON.parse(responseData);
      console.log('Message ID:', result.msg_id);
      console.log('\n注意：即使请求成功，如果没有活跃设备，推送也不会送达。');
    } else {
      console.log('❌ 推送请求失败');
      try {
        const error = JSON.parse(responseData);
        console.log('错误信息:', error.error?.message || responseData);
      } catch (e) {
        console.log('错误信息:', responseData);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error);
});

console.log('\n正在发送推送请求...\n');
req.write(data);
req.end();