#!/usr/bin/env node

/**
 * 极光推送配置脚本
 * 用于配置Android和iOS的极光推送原生设置
 */

const fs = require('fs');
const path = require('path');

const JPUSH_APP_KEY = '463f52032571434a7a2ddeee';
const JPUSH_CHANNEL = 'default';

console.log('🚀 开始配置极光推送...');

// Android配置
function configureAndroid() {
  console.log('📱 配置Android...');
  
  const androidManifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
  
  if (!fs.existsSync(androidManifestPath)) {
    console.log('⚠️  Android目录不存在，请先运行: npx expo prebuild');
    return false;
  }
  
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');
  
  // 检查是否已配置
  if (manifest.includes('JPUSH_APPKEY')) {
    console.log('✅ Android已配置极光推送');
    return true;
  }
  
  // 添加极光推送配置
  const jpushPermissions = `
    <!-- 极光推送权限 -->
    <uses-permission android:name="\${applicationId}.permission.JPUSH_MESSAGE" />
    <permission
        android:name="\${applicationId}.permission.JPUSH_MESSAGE"
        android:protectionLevel="signature" />`;
  
  const jpushMeta = `
        <!-- 极光推送配置 -->
        <meta-data android:name="JPUSH_CHANNEL" android:value="${JPUSH_CHANNEL}" />
        <meta-data android:name="JPUSH_APPKEY" android:value="${JPUSH_APP_KEY}" />`;
  
  // 在</manifest>前添加权限
  manifest = manifest.replace('</manifest>', jpushPermissions + '\n</manifest>');
  
  // 在</application>前添加meta-data
  manifest = manifest.replace('</application>', jpushMeta + '\n    </application>');
  
  fs.writeFileSync(androidManifestPath, manifest);
  console.log('✅ Android配置完成');
  return true;
}

// iOS配置
function configureIOS() {
  console.log('🍎 配置iOS...');
  
  const iosInfoPlistPath = path.join(__dirname, '../ios/RiverPatrol/Info.plist');
  
  if (!fs.existsSync(iosInfoPlistPath)) {
    console.log('⚠️  iOS目录不存在，请先运行: npx expo prebuild');
    return false;
  }
  
  let plist = fs.readFileSync(iosInfoPlistPath, 'utf8');
  
  // 检查是否已配置
  if (plist.includes('JPushAppKey')) {
    console.log('✅ iOS已配置极光推送');
    return true;
  }
  
  // 添加极光推送配置
  const jpushConfig = `
	<key>JPushAppKey</key>
	<string>${JPUSH_APP_KEY}</string>
	<key>JPushChannel</key>
	<string>${JPUSH_CHANNEL}</string>
	<key>JPushProduction</key>
	<false/>`;
  
  // 在</dict>前添加配置
  plist = plist.replace('</dict>\n</plist>', jpushConfig + '\n</dict>\n</plist>');
  
  fs.writeFileSync(iosInfoPlistPath, plist);
  console.log('✅ iOS配置完成');
  return true;
}

// 执行配置
function main() {
  const hasAndroid = fs.existsSync(path.join(__dirname, '../android'));
  const hasIOS = fs.existsSync(path.join(__dirname, '../ios'));
  
  if (!hasAndroid && !hasIOS) {
    console.log('\n❌ 未找到原生代码目录');
    console.log('请先运行以下命令生成原生代码：');
    console.log('  npx expo prebuild');
    console.log('\n然后重新运行此脚本：');
    console.log('  node scripts/setup-jpush.js');
    process.exit(1);
  }
  
  if (hasAndroid) {
    configureAndroid();
  }
  
  if (hasIOS) {
    configureIOS();
  }
  
  console.log('\n✨ 极光推送配置完成！');
  console.log('\n下一步：');
  if (hasAndroid) {
    console.log('  Android: npx expo run:android');
  }
  if (hasIOS) {
    console.log('  iOS: npx expo run:ios');
  }
}

main();