# 极光推送问题排查

## 当前状态
- ✅ jpush-react-native 3.2.0 已正确安装
- ✅ API方法名问题已修复
- ✅ AndroidManifest.xml配置正确
- ❌ **无法连接极光服务器（状态码3003）**
- ❌ **RegistrationID为空**

## 日志分析
```
[SisConn] [key-step]all sis and connect failed:null
[NetworkingClient] connect failed, errCode: 1
[HttpHelper] status code:3003 retry left:2
```

## 问题原因

### 1. 网络连接问题
- 极光SDK无法连接到服务器
- 可能是防火墙/代理问题
- 模拟器网络限制

### 2. 配置不匹配
需要在极光控制台确认：
- 应用包名：`com.riverpatrol.app`
- AppKey：`463f52032571434a7a2ddeee`
- 应用是否已激活

## 解决步骤

### 1. 登录极光控制台验证
1. 访问 [极光控制台](https://www.jiguang.cn)
2. 使用你的账号登录
3. 找到AppKey为`463f52032571434a7a2ddeee`的应用
4. 确认：
   - 包名是否为`com.riverpatrol.app`
   - 应用状态是否正常
   - 是否有推送权限

### 2. 使用真机测试
```bash
# 在真机上测试（模拟器可能有网络限制）
adb devices  # 确认手机已连接
npx expo run:android --device
```

### 3. 检查网络环境
```bash
# 测试设备是否能访问极光服务器
adb shell ping sis.jpush.cn
adb shell ping api.jpush.cn
```

### 4. 添加网络权限（如果缺失）
确认AndroidManifest.xml有以下权限：
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 5. 清理并重新构建
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
npx expo run:android
```

## 测试推送的前提

**必须先解决注册问题，获取到RegistrationID后才能测试推送！**

成功注册后应看到：
```
[JPush] 获取到RegistrationID: 1507bfd3b7c8283abc123
[JPush] 连接状态: 已连接
```

## 替代方案

如果极光推送持续无法工作，考虑：

1. **使用Firebase Cloud Messaging (FCM)**
   - Expo原生支持
   - 国际通用方案
   
2. **使用OneSignal**
   - 易于集成
   - 免费额度充足

3. **联系极光技术支持**
   - 提供AppKey和错误日志
   - 询问状态码3003的具体原因

## 相关链接
- [极光推送Android SDK文档](https://docs.jiguang.cn/jpush/client/Android/android_sdk)
- [极光推送状态码说明](https://docs.jiguang.cn/jpush/client/Android/android_api#错误码定义)
- [React Native集成指南](https://github.com/jpush/jpush-react-native)