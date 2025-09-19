# APP端推送通知接入指南

## 目录
1. [概述](#概述)
2. [极光推送SDK集成](#极光推送sdk集成)
3. [设备注册流程](#设备注册流程)
4. [API接口文档](#api接口文档)
5. [推送消息处理](#推送消息处理)
6. [测试与调试](#测试与调试)

---

## 概述

智慧河道监控系统使用**极光推送（JPush）**作为移动端消息推送服务，支持iOS和Android双平台。

### 核心功能
- 🔔 实时推送通知（告警、工单、系统公告等）
- 📱 设备注册与管理
- 📊 推送统计与追踪
- 🎯 精准推送（按用户、角色、全员）

### 配置信息
```
AppKey: 463f52032571434a7a2ddeee
MasterSecret: dae68cd8344bdd329d032915
Channel: developer (开发) / App Store (生产)
```

---

## 极光推送SDK集成

### 1. React Native集成

#### 安装依赖
```bash
npm install jpush-react-native --save
npm install jcore-react-native --save

# iOS额外配置
cd ios && pod install
```

#### 初始化代码
```javascript
import JPush from 'jpush-react-native'

// App.js 或 index.js
export default class App extends Component {
  componentDidMount() {
    // 初始化JPush
    JPush.init()
    
    // 设置调试模式（开发环境开启）
    if (__DEV__) {
      JPush.setLoggerEnable(true)
    }
    
    // 获取RegistrationID
    JPush.getRegistrationID((registrationId) => {
      console.log("JPush RegistrationID: " + registrationId)
      // 注册设备到服务器
      this.registerDevice(registrationId)
    })
    
    // 监听推送消息
    this.setupNotificationListeners()
  }
  
  setupNotificationListeners() {
    // 收到推送消息（APP在前台）
    JPush.addReceiveNotificationListener((message) => {
      console.log("收到推送消息: ", message)
      this.handleNotification(message)
    })
    
    // 点击推送消息
    JPush.addReceiveOpenNotificationListener((message) => {
      console.log("点击推送消息: ", message)
      this.handleNotificationClick(message)
    })
    
    // 收到自定义消息
    JPush.addReceiveCustomMsgListener((message) => {
      console.log("收到自定义消息: ", message)
      this.handleCustomMessage(message)
    })
  }
  
  // 注册设备
  async registerDevice(registrationId) {
    try {
      const response = await fetch('https://your-server.com/api/app-device-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAuthToken()
        },
        body: JSON.stringify({
          jpush_registration_id: registrationId,
          device_type: Platform.OS,
          device_model: DeviceInfo.getModel(),
          os_version: DeviceInfo.getSystemVersion(),
          app_version: DeviceInfo.getVersion()
        })
      })
      
      const result = await response.json()
      if (result.success) {
        console.log('设备注册成功')
      }
    } catch (error) {
      console.error('设备注册失败:', error)
    }
  }
  
  // 处理通知点击
  handleNotificationClick(message) {
    const extras = message.extras || {}
    
    switch (extras.template_code) {
      case 'ALARM_NEW':
        // 跳转到告警详情
        this.props.navigation.navigate('AlarmDetail', { 
          alarmId: extras.alarmId 
        })
        break
        
      case 'WORKORDER_ASSIGNED':
        // 跳转到工单详情
        this.props.navigation.navigate('WorkOrderDetail', { 
          orderId: extras.orderId 
        })
        break
        
      case 'SYSTEM_NOTIFICATION':
        // 跳转到通知中心
        this.props.navigation.navigate('NotificationCenter', {
          notificationId: extras.notificationId
        })
        break
        
      default:
        // 默认跳转到通知列表
        this.props.navigation.navigate('Notifications')
    }
    
    // 标记通知为已读
    if (extras.notificationId) {
      this.markAsRead(extras.notificationId)
    }
  }
}
```

### 2. Android原生集成

#### build.gradle配置
```gradle
android {
    defaultConfig {
        applicationId "com.smartriver.monitor"
        
        manifestPlaceholders = [
            JPUSH_APPKEY: "463f52032571434a7a2ddeee",
            JPUSH_CHANNEL: "developer"
        ]
    }
}

dependencies {
    implementation 'cn.jiguang.sdk:jpush:4.9.0'
    implementation 'cn.jiguang.sdk:jcore:3.3.0'
}
```

#### MainActivity.java
```java
import cn.jpush.android.api.JPushInterface;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 设置调试模式
        JPushInterface.setDebugMode(BuildConfig.DEBUG);
        
        // 初始化JPush
        JPushInterface.init(this);
        
        // 获取RegistrationID
        String registrationId = JPushInterface.getRegistrationID(this);
        Log.d("JPush", "RegistrationID: " + registrationId);
        
        // 注册设备
        if (!TextUtils.isEmpty(registrationId)) {
            registerDevice(registrationId);
        }
    }
    
    private void registerDevice(String registrationId) {
        // 调用API注册设备
        ApiService.getInstance().registerDevice(
            registrationId,
            "Android",
            Build.MODEL,
            Build.VERSION.RELEASE,
            BuildConfig.VERSION_NAME
        );
    }
}
```

#### JPushReceiver.java
```java
public class JPushReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle bundle = intent.getExtras();
        
        if (JPushInterface.ACTION_REGISTRATION_ID.equals(intent.getAction())) {
            // 获取到RegistrationID
            String regId = bundle.getString(JPushInterface.EXTRA_REGISTRATION_ID);
            Log.d("JPush", "接收到RegistrationID: " + regId);
            // 保存并上报到服务器
            
        } else if (JPushInterface.ACTION_NOTIFICATION_RECEIVED.equals(intent.getAction())) {
            // 收到推送通知
            String title = bundle.getString(JPushInterface.EXTRA_NOTIFICATION_TITLE);
            String content = bundle.getString(JPushInterface.EXTRA_ALERT);
            String extras = bundle.getString(JPushInterface.EXTRA_EXTRA);
            
            Log.d("JPush", "收到通知: " + title + " - " + content);
            
        } else if (JPushInterface.ACTION_NOTIFICATION_OPENED.equals(intent.getAction())) {
            // 用户点击了通知
            handleNotificationClick(context, bundle);
        }
    }
    
    private void handleNotificationClick(Context context, Bundle bundle) {
        String extras = bundle.getString(JPushInterface.EXTRA_EXTRA);
        try {
            JSONObject json = new JSONObject(extras);
            String templateCode = json.optString("template_code");
            
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            switch (templateCode) {
                case "ALARM_NEW":
                    intent.putExtra("page", "alarm_detail");
                    intent.putExtra("alarmId", json.optString("alarmId"));
                    break;
                    
                case "WORKORDER_ASSIGNED":
                    intent.putExtra("page", "workorder_detail");
                    intent.putExtra("orderId", json.optString("orderId"));
                    break;
                    
                default:
                    intent.putExtra("page", "notifications");
                    break;
            }
            
            context.startActivity(intent);
            
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }
}
```

### 3. iOS原生集成

#### AppDelegate.swift
```swift
import UserNotifications
import JPush

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ application: UIApplication, 
                    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // 初始化JPush
        let entity = JPUSHRegisterEntity()
        entity.types = Int(JPAuthorizationOptions.alert.rawValue) |
                      Int(JPAuthorizationOptions.badge.rawValue) |
                      Int(JPAuthorizationOptions.sound.rawValue)
        
        JPUSHService.register(forRemoteNotificationConfig: entity, delegate: self)
        
        // 配置JPush
        #if DEBUG
        JPUSHService.setup(withOption: launchOptions,
                          appKey: "463f52032571434a7a2ddeee",
                          channel: "developer",
                          apsForProduction: false)
        #else
        JPUSHService.setup(withOption: launchOptions,
                          appKey: "463f52032571434a7a2ddeee",
                          channel: "App Store",
                          apsForProduction: true)
        #endif
        
        // 获取RegistrationID
        JPUSHService.registrationIDCompletionHandler { (resCode, registrationID) in
            if resCode == 0 {
                print("JPush RegistrationID: \(registrationID ?? "")")
                self.registerDevice(registrationID)
            }
        }
        
        // 设置角标为0
        UIApplication.shared.applicationIconBadgeNumber = 0
        JPUSHService.setBadge(0)
        
        return true
    }
    
    // 注册设备
    func registerDevice(_ registrationId: String?) {
        guard let regId = registrationId else { return }
        
        let params = [
            "jpush_registration_id": regId,
            "device_type": "iOS",
            "device_model": UIDevice.current.model,
            "os_version": UIDevice.current.systemVersion,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        ]
        
        ApiService.shared.registerDevice(params: params) { success in
            if success {
                print("设备注册成功")
            }
        }
    }
}

// MARK: - JPUSHRegisterDelegate
extension AppDelegate: JPUSHRegisterDelegate {
    
    // iOS 10+ 前台收到通知
    func jpushNotificationCenter(_ center: UNUserNotificationCenter!, 
                                willPresent notification: UNNotification!, 
                                withCompletionHandler completionHandler: ((Int) -> Void)!) {
        
        let userInfo = notification.request.content.userInfo
        JPUSHService.handleRemoteNotification(userInfo)
        
        // 显示通知
        completionHandler(Int(UNNotificationPresentationOptions.alert.rawValue | 
                            UNNotificationPresentationOptions.sound.rawValue | 
                            UNNotificationPresentationOptions.badge.rawValue))
    }
    
    // iOS 10+ 点击通知
    func jpushNotificationCenter(_ center: UNUserNotificationCenter!, 
                                didReceive response: UNNotificationResponse!, 
                                withCompletionHandler completionHandler: (() -> Void)!) {
        
        let userInfo = response.notification.request.content.userInfo
        JPUSHService.handleRemoteNotification(userInfo)
        
        // 处理通知点击
        handleNotificationClick(userInfo: userInfo)
        
        completionHandler()
    }
    
    func handleNotificationClick(userInfo: [AnyHashable: Any]) {
        guard let extras = userInfo["extras"] as? [String: Any],
              let templateCode = extras["template_code"] as? String else {
            return
        }
        
        DispatchQueue.main.async {
            let storyboard = UIStoryboard(name: "Main", bundle: nil)
            
            switch templateCode {
            case "ALARM_NEW":
                if let alarmId = extras["alarmId"] as? String,
                   let vc = storyboard.instantiateViewController(withIdentifier: "AlarmDetailVC") as? AlarmDetailViewController {
                    vc.alarmId = alarmId
                    self.window?.rootViewController?.present(vc, animated: true)
                }
                
            case "WORKORDER_ASSIGNED":
                if let orderId = extras["orderId"] as? String,
                   let vc = storyboard.instantiateViewController(withIdentifier: "WorkOrderDetailVC") as? WorkOrderDetailViewController {
                    vc.orderId = orderId
                    self.window?.rootViewController?.present(vc, animated: true)
                }
                
            default:
                // 跳转到通知中心
                if let vc = storyboard.instantiateViewController(withIdentifier: "NotificationCenterVC") as? NotificationCenterViewController {
                    self.window?.rootViewController?.present(vc, animated: true)
                }
            }
        }
    }
}
```

---

## 设备注册流程

### 流程图
```
APP启动
  ↓
初始化JPush SDK
  ↓
获取Registration ID
  ↓
调用设备注册API (/api/app-device-register)
  ↓
服务器保存设备信息
  ↓
设置用户别名(可选)
  ↓
订阅标签(可选)
  ↓
准备接收推送
```

### 设备注册时机
1. **首次安装启动**：必须注册
2. **用户登录成功**：更新用户关联
3. **APP版本更新**：更新设备信息
4. **Registration ID变化**：重新注册

---

## API接口文档

### 1. 设备注册接口

**POST** `/api/app-device-register`

注册或更新移动设备信息，用于推送通知。

#### 请求头
```http
Content-Type: application/json
Authorization: Bearer {token}
```

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| jpush_registration_id | string | 是 | 极光推送注册ID |
| device_type | string | 是 | 设备类型(iOS/Android) |
| device_model | string | 否 | 设备型号 |
| os_version | string | 否 | 操作系统版本 |
| app_version | string | 否 | APP版本号 |

#### 请求示例
```json
{
  "jpush_registration_id": "1a0018970a5964b3582",
  "device_type": "iOS",
  "device_model": "iPhone 13 Pro",
  "os_version": "15.5",
  "app_version": "1.2.0",
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "device_id": "DEV_001",
    "user_id": "USER001",
    "is_active": true,
    "created_at": "2025-01-19T08:00:00Z"
  },
  "message": "设备注册成功"
}
```

### 2. 设备注销接口

**POST** `/api/app-device-unregister`

用户登出或卸载APP时注销设备。

#### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| jpush_registration_id | string | 否 | 极光推送注册ID |
| device_id | string | 否 | 设备ID(二选一) |

### 3. 获取通知列表

**GET** `/api/app-notifications`

获取当前用户的通知列表。

#### 查询参数
| 参数 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量 |
| status | string | all | 状态(all/read/unread) |
| type | string | all | 类型(all/alarm/workorder/system) |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "N001",
        "title": "新告警通知",
        "content": "检测到水质异常告警",
        "type": "alarm",
        "priority": "high",
        "is_read": false,
        "created_at": "2025-01-19T08:00:00Z",
        "action_url": "/alarms/ALARM001"
      }
    ],
    "unread_count": 5,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```

### 4. 标记通知已读

**PUT** `/api/app-notifications/{id}/read`

标记指定通知为已读。

### 5. 批量标记已读

**PUT** `/api/app-notifications/read-all`

标记所有通知为已读。

### 6. 获取未读数量

**GET** `/api/app-notifications/unread-count`

获取未读通知数量，用于APP角标显示。

#### 响应示例
```json
{
  "success": true,
  "data": {
    "unread_count": 5,
    "alarm_count": 2,
    "workorder_count": 3
  }
}
```

### 7. 推送偏好设置

**GET** `/api/app-push-settings`
**PUT** `/api/app-push-settings`

获取和更新用户的推送偏好设置。

#### 设置参数
```json
{
  "enable_push": true,
  "alarm_push": true,
  "workorder_push": true,
  "system_push": true,
  "quiet_hours": {
    "enabled": true,
    "start_time": "22:00",
    "end_time": "08:00"
  },
  "priority_filter": ["urgent", "high", "normal"]
}
```

---

## 推送消息处理

### 消息模板类型

| 模板代码 | 说明 | 跳转页面 |
|---------|------|---------|
| ALARM_NEW | 新告警通知 | 告警详情页 |
| ALARM_CONFIRMED | 告警确认通知 | 告警详情页 |
| ALARM_RESOLVED | 告警解决通知 | 告警详情页 |
| WORKORDER_ASSIGNED | 工单分配通知 | 工单详情页 |
| WORKORDER_REASSIGNED | 工单转派通知 | 工单详情页 |
| WORKORDER_URGING | 工单催办通知 | 工单详情页 |
| WORKORDER_COMPLETED | 工单完成通知 | 工单详情页 |
| INSPECTION_REMINDER | 巡检提醒 | 巡检任务页 |
| INSPECTION_OVERDUE | 巡检超时提醒 | 巡检任务页 |
| SYSTEM_NOTIFICATION | 系统通知 | 通知详情页 |
| SYSTEM_ANNOUNCEMENT | 系统公告 | 公告详情页 |

### 消息extras字段

```json
{
  "template_code": "ALARM_NEW",
  "notification_id": "N001",
  "alarm_id": "ALARM001",
  "action_url": "/alarms/ALARM001",
  "priority": "high",
  "timestamp": "2025-01-19T08:00:00Z"
}
```

### 处理流程

```javascript
// 统一的消息处理函数
function handlePushMessage(message) {
  const { title, content, extras } = message
  
  // 1. 显示本地通知（如果APP在后台）
  if (AppState.currentState !== 'active') {
    showLocalNotification(title, content)
  }
  
  // 2. 更新未读数量
  updateBadgeCount()
  
  // 3. 刷新通知列表
  refreshNotificationList()
  
  // 4. 处理特定业务逻辑
  switch (extras.template_code) {
    case 'ALARM_NEW':
      // 播放告警音
      playAlarmSound()
      // 显示告警弹窗
      showAlarmAlert(extras)
      break
      
    case 'WORKORDER_ASSIGNED':
      // 刷新工单列表
      refreshWorkOrderList()
      break
  }
  
  // 5. 上报接收统计
  reportPushReceived(extras.notification_id)
}
```

---

## 测试与调试

### 1. 开发环境测试

#### 获取测试设备的Registration ID
```bash
# iOS模拟器不支持推送，需要真机
# Android可以使用模拟器

# 查看日志中的Registration ID
adb logcat | grep JPush
```

#### 使用极光推送控制台测试
1. 登录 [极光推送控制台](https://www.jiguang.cn)
2. 选择应用
3. 进入"推送" -> "发送通知"
4. 选择目标（Registration ID/别名/标签）
5. 填写推送内容
6. 点击发送

### 2. 测试API

**POST** `/api/app-push-test`

发送测试推送到指定设备。

```json
{
  "registration_id": "1a0018970a5964b3582",
  "title": "测试推送",
  "content": "这是一条测试消息",
  "template_code": "SYSTEM_NOTIFICATION"
}
```

### 3. 实际测试示例

#### 测试设备注册
```bash
curl -X POST http://localhost:3001/api/app-device-register \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "jpush_registration_id": "1a0018970a5964b3582",
    "device_type": "iOS",
    "device_model": "iPhone 13 Pro",
    "os_version": "15.5",
    "app_version": "1.0.0"
  }'
```

#### 测试推送发送
```bash
curl -X POST http://localhost:3001/api/app-push-send \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "target_user_ids": ["USER001"],
    "title": "测试推送",
    "content": "这是一条测试消息",
    "priority": "high"
  }'
```

### 4. 常见问题

#### Q: iOS收不到推送
A: 检查以下几点：
- 证书是否正确配置
- aps-environment是否正确（development/production）
- 设备是否允许通知权限
- Registration ID是否有效

#### Q: Android推送延迟
A: 可能原因：
- 设备处于省电模式
- APP被系统杀死
- 网络不稳定
- 需要配置厂商通道（小米、华为、OPPO等）

#### Q: Registration ID获取失败
A: 解决方案：
- 检查网络连接
- 确认AppKey配置正确
- 清除APP数据重试
- 延迟获取（初始化后1-2秒）

#### Q: 设备注册失败
A: 检查以下字段是否正确：
- `mobile_devices`表字段：`device_token`（非`push_token`）
- `mobile_devices`表字段：`last_active`（非`last_active_at`）
- 表中不存在`device_name`和`push_enabled`字段

### 5. 日志收集

```javascript
// 开启JPush日志
JPush.setLoggerEnable(true)

// 自定义日志上报
function logPushEvent(event, data) {
  const log = {
    event,
    data,
    timestamp: new Date().toISOString(),
    device_id: getDeviceId(),
    user_id: getUserId()
  }
  
  // 上报到服务器
  fetch('/api/app-push-logs', {
    method: 'POST',
    body: JSON.stringify(log)
  })
}
```

---

## 附录

### 推送限制
- 单次推送目标用户数：1000
- 推送频率限制：600次/分钟
- 消息大小限制：4KB
- 离线消息保存：1天

### 数据库表结构

#### mobile_devices 表
```sql
CREATE TABLE mobile_devices (
    id VARCHAR(20) PRIMARY KEY,           -- 设备唯一标识
    user_id VARCHAR(20) NOT NULL,         -- 用户ID
    device_type VARCHAR(20),              -- 设备类型(iOS/Android)
    device_model VARCHAR(50),             -- 设备型号
    os_version VARCHAR(20),               -- 操作系统版本
    app_version VARCHAR(20),              -- APP版本
    device_token VARCHAR(255),            -- 设备令牌
    jpush_registration_id VARCHAR(255),   -- 极光推送注册ID
    is_active BOOLEAN DEFAULT true,       -- 是否活跃
    last_active TIMESTAMP WITH TIME ZONE, -- 最后活跃时间
    created_at TIMESTAMP WITH TIME ZONE,  -- 创建时间
    updated_at TIMESTAMP WITH TIME ZONE   -- 更新时间
);
```

注意：
- 使用 `device_token` 而非 `push_token`
- 使用 `last_active` 而非 `last_active_at`
- 不存在 `device_name` 和 `push_enabled` 字段

### 相关链接
- [极光推送官方文档](https://docs.jiguang.cn/jpush/guideline/intro)
- [React Native SDK文档](https://github.com/jpush/jpush-react-native)
- [Android SDK文档](https://docs.jiguang.cn/jpush/client/Android/android_sdk)
- [iOS SDK文档](https://docs.jiguang.cn/jpush/client/iOS/ios_sdk)

### 技术支持
- 内部支持：admin@smartriver.com
- 极光技术支持：support@jiguang.cn