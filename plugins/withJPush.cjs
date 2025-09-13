/**
 * Expo 配置插件 - 极光推送
 * 用于配置 iOS 和 Android 的极光推送原生设置
 */

const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

const JPUSH_APP_KEY = process.env.EXPO_PUBLIC_JPUSH_APP_KEY || '463f52032571434a7a2ddeee';
const JPUSH_CHANNEL = process.env.EXPO_PUBLIC_JPUSH_CHANNEL || 'default';

// Android 配置
function withJPushAndroid(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // 添加极光推送权限
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
    ];

    permissions.forEach((permission) => {
      const hasPermission = androidManifest.manifest['uses-permission'].some(
        (perm) => perm.$['android:name'] === permission
      );
      if (!hasPermission) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // 添加极光推送元数据
    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }

    // JPUSH_APPKEY
    const hasAppKey = mainApplication['meta-data'].some(
      (meta) => meta.$['android:name'] === 'JPUSH_APPKEY'
    );
    if (!hasAppKey) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': 'JPUSH_APPKEY',
          'android:value': JPUSH_APP_KEY,
        },
      });
    }

    // JPUSH_CHANNEL
    const hasChannel = mainApplication['meta-data'].some(
      (meta) => meta.$['android:name'] === 'JPUSH_CHANNEL'
    );
    if (!hasChannel) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': 'JPUSH_CHANNEL',
          'android:value': JPUSH_CHANNEL,
        },
      });
    }

    return config;
  });
}

// iOS 配置
function withJPushIOS(config) {
  return withInfoPlist(config, (config) => {
    // 添加推送权限描述
    config.modResults.NSUserNotificationUsageDescription =
      config.modResults.NSUserNotificationUsageDescription ||
      '应用需要推送权限来接收重要通知';

    // 添加后台模式
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    if (!config.modResults.UIBackgroundModes.includes('remote-notification')) {
      config.modResults.UIBackgroundModes.push('remote-notification');
    }
    if (!config.modResults.UIBackgroundModes.includes('fetch')) {
      config.modResults.UIBackgroundModes.push('fetch');
    }

    // 添加极光推送配置
    config.modResults.JPushAppKey = JPUSH_APP_KEY;
    config.modResults.JPushChannel = JPUSH_CHANNEL;
    config.modResults.JPushProduction = false; // 开发环境设为 false

    return config;
  });
}

// 导出插件
module.exports = (config) => {
  config = withJPushAndroid(config);
  config = withJPushIOS(config);
  return config;
};