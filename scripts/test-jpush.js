#!/usr/bin/env node

/**
 * 极光推送测试脚本
 * 用于向指定设备发送测试推送消息
 * 
 * 使用方法：
 * 1. 先运行APP获取RegistrationID
 * 2. node scripts/test-jpush.js <registrationId>
 * 3. 或者发送给所有设备: node scripts/test-jpush.js --all
 */

import https from 'https';

// 极光推送配置
const APP_KEY = '463f52032571434a7a2ddeee';
const MASTER_SECRET = 'dae68cd8344bdd329d032915';

// Base64编码认证信息
const auth = Buffer.from(`${APP_KEY}:${MASTER_SECRET}`).toString('base64');

/**
 * 发送推送消息
 * @param {Object} pushData - 推送数据
 */
function sendPush(pushData) {
  const data = JSON.stringify(pushData);
  
  const options = {
    hostname: 'api.jpush.cn',
    port: 443,
    path: '/v3/push',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ 推送成功！');
          console.log('响应:', responseData);
          resolve(JSON.parse(responseData));
        } else {
          console.error('❌ 推送失败！');
          console.error('状态码:', res.statusCode);
          console.error('响应:', responseData);
          reject(new Error(responseData));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ 请求失败:', error);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * 发送测试推送到指定设备
 * @param {string} registrationId - 设备的RegistrationID
 */
async function sendTestPush(registrationId) {
  const timestamp = new Date().toLocaleString('zh-CN');
  
  // 简化的推送数据
  const pushData = {
    platform: 'all',
    audience: registrationId === '--all' ? 'all' : {
      registration_id: [registrationId]
    },
    notification: {
      alert: `极光推送测试 - ${timestamp}`
    }
  };
  
  try {
    await sendPush(pushData);
  } catch (error) {
    process.exit(1);
  }
}

/**
 * 获取所有设备的RegistrationID（通过管理API）
 */
async function getDeviceList() {
  console.log('📱 获取设备列表功能需要通过APP端上报RegistrationID');
  console.log('请先运行APP，查看控制台输出的RegistrationID');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 极光推送测试工具

使用方法：
1. 发送到指定设备:
   node scripts/test-jpush.js <registrationId>
   
2. 发送给所有设备:
   node scripts/test-jpush.js --all
   
3. 查看帮助:
   node scripts/test-jpush.js --help

获取RegistrationID的方法：
1. 运行APP
2. 查看控制台日志，找到类似这样的输出：
   [JPush] 获取到RegistrationID: 1507bao29f8283abc123
3. 复制RegistrationID用于测试

配置信息：
- AppKey: ${APP_KEY}
- 服务器: api.jpush.cn
    `);
    return;
  }
  
  const command = args[0];
  
  if (command === '--help' || command === '-h') {
    main();
    return;
  }
  
  if (command === '--all') {
    console.log('📢 向所有设备发送推送...');
    await sendTestPush('--all');
  } else if (command === '--list') {
    await getDeviceList();
  } else {
    console.log(`📱 向设备 ${command} 发送推送...`);
    await sendTestPush(command);
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});