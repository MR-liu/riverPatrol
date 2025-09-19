/**
 * 极光推送配置
 */

export const JPushConfig = {
  // AppKey - 客户端使用
  appKey: process.env.EXPO_PUBLIC_JPUSH_APP_KEY || '463f52032571434a7a2ddeee',
  
  // 渠道
  channel: process.env.EXPO_PUBLIC_JPUSH_CHANNEL || 'default',
  
  // 是否生产环境
  production: process.env.EXPO_PUBLIC_JPUSH_PRODUCTION === 'true' || false,
  
  // 调试模式
  debug: __DEV__,
};

// MasterSecret只能在服务端使用，不要在客户端代码中使用
// 如果需要在客户端调用需要MasterSecret的API，应该通过你的后端服务器中转