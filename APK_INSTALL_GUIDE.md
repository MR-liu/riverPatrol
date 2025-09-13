# APK 安装指南

## 📱 Development Build 安装说明

### 当前状态
- ✅ 极光推送已集成
- ✅ 原生项目已生成
- ✅ APK 构建成功（176MB）

### 构建 APK 文件

```bash
# 进入 android 目录构建
cd android
./gradlew assembleDebug

# APK 文件位置
# android/app/build/outputs/apk/debug/app-debug.apk
```

### 安装到设备

#### 方法 1：使用 ADB（推荐）
```bash
# 确保设备已连接并开启开发者模式
adb devices

# 安装 APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### 方法 2：直接传输
1. 将 APK 文件传输到手机
2. 在手机上打开文件管理器
3. 找到 APK 文件并点击安装
4. 允许"安装未知应用"权限

### 运行应用

1. **启动开发服务器**
   ```bash
   npx expo start --dev-client
   ```

2. **打开应用**
   - 在手机上打开"RiverPatrol"应用
   - 应用会自动连接到开发服务器

3. **扫描二维码（可选）**
   - 如果无法自动连接，可以扫描终端显示的二维码

### 测试极光推送

1. **查看 RegistrationID**
   - 打开应用后查看控制台日志
   - 找到类似这样的日志：`[JPush] 获取到RegistrationID: xxxxx`

2. **发送测试推送**
   ```bash
   # 使用极光 API 发送
   curl -X POST https://api.jpush.cn/v3/push \
     -H "Authorization: Basic $(echo -n '463f52032571434a7a2ddeee:dae68cd8344bdd329d032915' | base64)" \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "android",
       "audience": "all",
       "notification": {
         "android": {
           "alert": "测试推送消息",
           "title": "智慧河道巡查"
         }
       }
     }'
   ```

3. **或使用极光控制台**
   - 访问 https://www.jiguang.cn/
   - 登录后选择应用
   - 发送测试推送

### 常见问题

#### Q: 安装时提示"应用未安装"
- 检查手机存储空间
- 卸载旧版本后重新安装
- 开启"允许安装未知应用"

#### Q: 无法连接开发服务器
- 确保手机和电脑在同一网络
- 检查防火墙设置
- 尝试使用 `--tunnel` 参数：`npx expo start --dev-client --tunnel`

#### Q: 收不到推送
- 检查应用通知权限
- 确认 RegistrationID 已生成
- 查看极光控制台推送记录

### 设备要求
- Android 5.0 (API 21) 或更高版本
- 至少 100MB 可用存储空间
- 网络连接（用于接收推送）

---

*构建时间：2024-09-14*
*包名：com.riverpatrol.app*