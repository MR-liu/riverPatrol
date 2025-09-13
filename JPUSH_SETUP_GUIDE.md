# 极光推送集成配置指南

## 一、极光推送账号注册

### 1. 注册极光账号
访问 [极光官网](https://www.jiguang.cn/) 注册开发者账号

### 2. 创建应用
1. 登录极光控制台：https://www.jiguang.cn/dev2/#/app/list
2. 点击"创建应用"
3. 填写应用信息：
   - 应用名称：智慧河道监控系统
   - 应用包名（Android）：com.rivermonitor.app
   - Bundle ID（iOS）：com.rivermonitor.app

### 3. 获取配置信息
创建成功后，在应用详情页获取：
- **AppKey**: 应用唯一标识
- **Master Secret**: 服务端密钥（请妥善保管）

## 二、环境变量配置

### 1. 创建环境变量文件
在项目根目录创建 `.env.local` 文件（如果不存在）：

```bash
# 极光推送配置
JPUSH_APP_KEY=your_app_key_here
JPUSH_MASTER_SECRET=your_master_secret_here

# 推送环境（development/production）
JPUSH_ENVIRONMENT=development
```

### 2. 更新配置文件
修改 `/lib/jpush/config.ts`：

```typescript
export const JPUSH_CONFIG = {
  appKey: process.env.JPUSH_APP_KEY || 'your-jpush-app-key',
  masterSecret: process.env.JPUSH_MASTER_SECRET || 'your-master-secret',
  // ...
}
```

## 三、数据库配置

### 1. 执行数据库迁移
运行迁移脚本添加极光推送相关字段：

```bash
# 使用 Supabase CLI
supabase db push

# 或直接在 Supabase Dashboard 执行
# SQL Editor > New Query > 粘贴迁移文件内容
```

### 2. 验证表结构
确认以下字段已添加：
- `mobile_devices.jpush_registration_id` - 极光推送ID
- `mobile_devices.push_channel` - 推送渠道
- `push_configs` 表 - 用户推送配置
- `push_queue` 表 - 推送队列

## 四、APP端集成

### 1. Android集成

#### 安装SDK
```gradle
// app/build.gradle
dependencies {
    implementation 'cn.jiguang.sdk:jpush:5.2.3'
    implementation 'cn.jiguang.sdk:jcore:4.3.0'
}
```

#### 配置AndroidManifest.xml
```xml
<!-- 权限配置 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- 极光推送配置 -->
<meta-data
    android:name="JPUSH_APPKEY"
    android:value="your_app_key_here" />
<meta-data
    android:name="JPUSH_CHANNEL"
    android:value="default" />
```

#### 初始化代码
```java
// MainActivity.java
import cn.jpush.android.api.JPushInterface;

@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    
    // 初始化极光推送
    JPushInterface.setDebugMode(true);
    JPushInterface.init(this);
    
    // 获取RegistrationID
    String registrationId = JPushInterface.getRegistrationID(this);
    // 发送给服务器
    registerDevice(registrationId);
}
```

### 2. iOS集成

#### 使用CocoaPods
```ruby
# Podfile
pod 'JPush', '~> 5.2.0'
```

#### 初始化代码
```swift
// AppDelegate.swift
import JPush

func application(_ application: UIApplication, 
                didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // 初始化极光推送
    let entity = JPUSHRegisterEntity()
    entity.types = Int(JPAuthorizationOptions.alert.rawValue) |
                   Int(JPAuthorizationOptions.badge.rawValue) |
                   Int(JPAuthorizationOptions.sound.rawValue)
    
    JPUSHService.register(forRemoteNotificationConfig: entity, delegate: self)
    JPUSHService.setup(withOption: launchOptions,
                       appKey: "your_app_key_here",
                       channel: "App Store",
                       apsForProduction: false)
    
    // 获取RegistrationID
    JPUSHService.registrationIDCompletionHandler { (resCode, registrationID) in
        if resCode == 0 {
            // 发送给服务器
            self.registerDevice(registrationID)
        }
    }
    
    return true
}
```

### 3. React Native集成

#### 安装依赖
```bash
npm install jpush-react-native --save
npm install jcore-react-native --save

# iOS需要
cd ios && pod install
```

#### 使用示例
```javascript
import JPush from 'jpush-react-native'

// 初始化
JPush.init()

// 获取RegistrationID
JPush.getRegistrationID((registrationId) => {
  // 注册到服务器
  registerDevice(registrationId)
})

// 监听推送
JPush.addReceiveNotificationListener((message) => {
  console.log('收到推送:', message)
})

// 注册设备到服务器
async function registerDevice(registrationId) {
  await fetch('/api/app-device-register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      device_id: DeviceInfo.getUniqueId(),
      device_type: Platform.OS === 'ios' ? 'iOS' : 'Android',
      device_model: DeviceInfo.getModel(),
      os_version: DeviceInfo.getSystemVersion(),
      app_version: DeviceInfo.getVersion(),
      jpush_registration_id: registrationId,
      push_channel: 'jpush'
    })
  })
}
```

## 五、测试推送

### 1. 使用API测试
```bash
# 发送测试推送
curl -X POST http://localhost:3000/api/app-push-send \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your_token" \
  -d '{
    "target_user_ids": ["U_R004_01"],
    "template_code": "SYSTEM_ANNOUNCEMENT",
    "template_data": {
      "title": "测试推送",
      "content": "这是一条测试推送消息"
    }
  }'
```

### 2. 使用极光控制台测试
1. 登录极光控制台
2. 选择应用 > 推送 > 发送通知
3. 选择目标（RegistrationID）
4. 填写通知内容
5. 点击发送

### 3. 查看推送统计
- 极光控制台 > 统计 > 推送统计
- 查看送达率、点击率等数据

## 六、常见问题

### 1. 收不到推送
- 检查设备是否成功获取RegistrationID
- 检查RegistrationID是否正确保存到服务器
- 检查AppKey和Master Secret是否正确
- iOS检查推送证书配置
- Android检查包名配置

### 2. 推送延迟
- 检查网络连接
- 检查推送优先级设置
- 使用极光推送的VIP通道（付费）

### 3. 推送去重
- 使用消息ID进行客户端去重
- 设置合理的推送间隔

## 七、生产环境注意事项

### 1. 安全配置
- Master Secret 绝不能暴露在客户端
- 使用环境变量管理敏感信息
- 定期更换Master Secret

### 2. 推送策略
- 设置合理的推送频率限制
- 实现用户推送偏好设置
- 支持免打扰时段

### 3. 监控告警
- 监控推送成功率
- 设置推送失败告警
- 记录推送日志用于问题排查

## 八、费用说明

### 免费版
- 1000个注册用户
- 无限制消息数
- 基础统计功能

### 付费版
- 按注册用户数计费
- VIP推送通道
- 高级统计分析
- 技术支持服务

具体价格请访问：https://www.jiguang.cn/push/price

## 九、技术支持

- 官方文档：https://docs.jiguang.cn/jpush/guideline/intro/
- 技术论坛：https://community.jiguang.cn/
- 客服邮箱：support@jpush.cn
- 技术QQ群：请查看官网

---

*文档更新日期：2024-01-12*
*极光推送SDK版本：5.2.3*