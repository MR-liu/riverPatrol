# Development Build 构建指南

## 极光推送集成完成状态

✅ 已完成的配置：
- 安装了 jpush-react-native 和 jcore-react-native SDK
- 配置了极光推送环境变量 (AppKey: 463f52032571434a7a2ddeee)
- 创建了 JPushService 服务类
- 在应用启动时初始化极光推送
- 在设置页面添加了推送通知控制
- 创建了 Expo 配置插件 (plugins/withJPush.js)
- 生成了原生项目文件 (ios/ 和 android/)

## 🚀 构建 Development Build

### Android 构建

#### 方法一：使用 Expo CLI（推荐）
```bash
# 构建并运行在连接的设备/模拟器上
npx expo run:android

# 或者只构建 APK
cd android
./gradlew assembleDebug
# APK 文件位置：android/app/build/outputs/apk/debug/app-debug.apk
```

#### 方法二：使用 EAS Build（云构建）
```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账号
eas login

# 配置 EAS
eas build:configure

# 构建开发版本
eas build --platform android --profile development
```

### iOS 构建

#### 前置要求
- macOS 系统
- Xcode 已安装
- Apple Developer 账号（用于真机测试）

#### 构建步骤
```bash
# 1. 安装 iOS 依赖
cd ios
pod install

# 2. 使用 Expo CLI 运行
cd ..
npx expo run:ios

# 或者使用 Xcode
# 打开 ios/RiverPatrol.xcworkspace
# 选择设备并运行
```

## 📱 测试极光推送

### 1. 安装 Development Build
- Android: 安装生成的 APK 文件
- iOS: 通过 Xcode 安装到设备

### 2. 启动开发服务器
```bash
npx expo start --dev-client
```

### 3. 验证推送功能
1. 打开应用，查看控制台日志确认极光推送初始化成功
2. 在设置页面开启推送通知
3. 记录 RegistrationID（在控制台日志中）
4. 使用极光控制台发送测试推送

### 4. 测试推送 API
```bash
# 使用 curl 测试推送发送
curl -X POST https://api.jpush.cn/v3/push \
  -H "Authorization: Basic $(echo -n '463f52032571434a7a2ddeee:dae68cd8344bdd329d032915' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "all",
    "audience": {
      "registration_id": ["YOUR_REGISTRATION_ID"]
    },
    "notification": {
      "alert": "测试推送消息",
      "android": {
        "title": "工单通知"
      },
      "ios": {
        "sound": "default",
        "badge": 1
      }
    }
  }'
```

## ⚠️ 常见问题

### Android 问题

1. **构建失败：找不到 SDK**
   ```bash
   # 设置 Android SDK 路径
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

2. **权限问题**
   - 确保 AndroidManifest.xml 包含推送相关权限
   - 检查应用设置中的通知权限

### iOS 问题

1. **Pod install 失败**
   ```bash
   # 清理并重新安装
   cd ios
   pod deintegrate
   pod install
   ```

2. **推送证书配置**
   - 需要在 Apple Developer 中配置推送证书
   - 在极光控制台上传推送证书

## 📝 开发注意事项

1. **环境变量**
   - 确保 .env.local 文件包含正确的极光推送配置
   - 不要将 Master Secret 提交到代码仓库

2. **调试模式**
   - Development build 默认开启调试模式
   - 可以使用 Chrome DevTools 调试 JavaScript 代码

3. **热重载**
   - JavaScript 代码支持热重载
   - 原生代码修改需要重新构建

## 🔗 相关资源

- [Expo Development Build 文档](https://docs.expo.dev/develop/development-builds/introduction/)
- [极光推送 React Native 文档](https://docs.jiguang.cn/jpush/client/react_native/react_native_api)
- [极光控制台](https://www.jiguang.cn/dev2/#/app/list)

## 📞 支持

如遇到问题，请检查：
1. 控制台日志输出
2. 极光推送初始化状态
3. 设备网络连接
4. 推送权限设置

---

*最后更新：2024-09-14*