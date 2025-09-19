/**
 * 极光推送服务端实现
 * 用于后端API调用极光推送接口
 */

import https from 'https';

const APP_KEY = process.env.EXPO_PUBLIC_JPUSH_APP_KEY || '463f52032571434a7a2ddeee';
const MASTER_SECRET = process.env.EXPO_PUBLIC_JPUSH_MASTER_SECRET || 'dae68cd8344bdd329d032915';

// Base64编码认证信息
const auth = Buffer.from(`${APP_KEY}:${MASTER_SECRET}`).toString('base64');

interface PushOptions {
  title: string;
  content: string;
  extras?: Record<string, any>;
  platform?: string | string[];
  alert_type?: number;
  badge?: string | number;
  sound?: string;
}

interface PushResult {
  success: boolean;
  message?: string;
  msgId?: string;
  error?: string;
}

class JPushService {
  /**
   * 发送推送到指定设备
   * @param registrationIds - 设备注册ID数组
   * @param options - 推送选项
   */
  async sendToDevices(registrationIds: string[], options: PushOptions): Promise<PushResult> {
    if (!registrationIds || registrationIds.length === 0) {
      return {
        success: false,
        error: 'No registration IDs provided'
      };
    }

    // 过滤掉空的registrationId
    const validIds = registrationIds.filter(id => id && id.trim());
    if (validIds.length === 0) {
      return {
        success: false,
        error: 'All registration IDs are empty'
      };
    }

    const pushData = {
      platform: options.platform || 'all',
      audience: {
        registration_id: validIds
      },
      notification: {
        alert: options.content,
        android: {
          alert: options.content,
          title: options.title,
          builder_id: 1,
          style: 1,
          alert_type: options.alert_type || 1,
          large_icon: '',
          intent: {
            url: 'intent:#Intent;action=android.intent.action.MAIN;end'
          },
          extras: options.extras || {}
        },
        ios: {
          alert: {
            title: options.title,
            body: options.content
          },
          sound: options.sound || 'default',
          badge: options.badge || '+1',
          extras: options.extras || {}
        }
      },
      message: {
        msg_content: JSON.stringify({
          title: options.title,
          content: options.content,
          ...options.extras
        }),
        content_type: 'application/json',
        title: options.title,
        extras: options.extras || {}
      },
      options: {
        sendno: Math.floor(Math.random() * 2147483647) + 1, // 生成1-2147483647之间的随机数
        time_to_live: 86400,
        apns_production: process.env.NODE_ENV === 'production',
        big_push_duration: 0
      }
    };

    return this.sendPush(pushData);
  }

  /**
   * 发送推送到所有设备
   * @param options - 推送选项
   */
  async sendToAll(options: PushOptions): Promise<PushResult> {
    const pushData = {
      platform: options.platform || 'all',
      audience: 'all',
      notification: {
        alert: options.content,
        android: {
          alert: options.content,
          title: options.title,
          builder_id: 1,
          extras: options.extras || {}
        },
        ios: {
          alert: {
            title: options.title,
            body: options.content
          },
          sound: options.sound || 'default',
          badge: options.badge || '+1',
          extras: options.extras || {}
        }
      },
      options: {
        sendno: Math.floor(Math.random() * 2147483647) + 1,
        time_to_live: 86400,
        apns_production: process.env.NODE_ENV === 'production'
      }
    };

    return this.sendPush(pushData);
  }

  /**
   * 发送推送到标签
   * @param tags - 标签数组
   * @param options - 推送选项
   */
  async sendToTags(tags: string[], options: PushOptions): Promise<PushResult> {
    const pushData = {
      platform: options.platform || 'all',
      audience: {
        tag: tags
      },
      notification: {
        alert: options.content,
        android: {
          alert: options.content,
          title: options.title,
          builder_id: 1,
          extras: options.extras || {}
        },
        ios: {
          alert: {
            title: options.title,
            body: options.content
          },
          sound: options.sound || 'default',
          badge: options.badge || '+1',
          extras: options.extras || {}
        }
      },
      options: {
        sendno: Math.floor(Math.random() * 2147483647) + 1,
        time_to_live: 86400,
        apns_production: process.env.NODE_ENV === 'production'
      }
    };

    return this.sendPush(pushData);
  }

  /**
   * 发送推送到别名
   * @param aliases - 别名数组
   * @param options - 推送选项
   */
  async sendToAliases(aliases: string[], options: PushOptions): Promise<PushResult> {
    const pushData = {
      platform: options.platform || 'all',
      audience: {
        alias: aliases
      },
      notification: {
        alert: options.content,
        android: {
          alert: options.content,
          title: options.title,
          builder_id: 1,
          extras: options.extras || {}
        },
        ios: {
          alert: {
            title: options.title,
            body: options.content
          },
          sound: options.sound || 'default',
          badge: options.badge || '+1',
          extras: options.extras || {}
        }
      },
      options: {
        sendno: Math.floor(Math.random() * 2147483647) + 1,
        time_to_live: 86400,
        apns_production: process.env.NODE_ENV === 'production'
      }
    };

    return this.sendPush(pushData);
  }

  /**
   * 发送推送请求到极光服务器
   * @param pushData - 推送数据
   */
  private async sendPush(pushData: any): Promise<PushResult> {
    return new Promise((resolve) => {
      const data = JSON.stringify(pushData);
      
      console.log('[JPush] Sending push with data:', {
        audience: pushData.audience,
        title: pushData.notification?.android?.title || pushData.notification?.alert,
        sendno: pushData.options?.sendno
      });

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
          console.log('[JPush] Response status:', res.statusCode);
          console.log('[JPush] Response data:', responseData);
          
          try {
            const result = JSON.parse(responseData);
            
            if (res.statusCode === 200) {
              resolve({
                success: true,
                message: '推送成功',
                msgId: result.msg_id
              });
            } else {
              resolve({
                success: false,
                error: result.error?.message || responseData
              });
            }
          } catch (error) {
            resolve({
              success: false,
              error: `解析响应失败: ${responseData}`
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('[JPush] Request error:', error);
        resolve({
          success: false,
          error: error.message
        });
      });
      
      req.write(data);
      req.end();
    });
  }
}

// 导出单例
const jpushService = new JPushService();
export default jpushService;