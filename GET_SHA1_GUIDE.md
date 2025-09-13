# 获取Android SHA1安全码指南

## 🔑 什么是SHA1安全码

SHA1是Android应用签名证书的指纹，用于：
- 验证应用身份，防止API被盗用
- 确保只有你的应用可以使用高德地图API Key
- 提供额外的安全保护

## 📋 获取SHA1的方法

### 方法1: 使用keytool命令（最常用）

#### 开发环境SHA1（调试证书）
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Windows用户使用:**
```cmd
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

输出示例：
```
Certificate fingerprints:
SHA1: A1:B2:C3:D4:E5:F6:G7:H8:I9:J0:K1:L2:M3:N4:O5:P6:Q7:R8:S9:T0
```

#### 生产环境SHA1（发布证书）
```bash
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
```

### 方法2: 使用Expo CLI

如果你使用Expo Development Build：
```bash
# 查看项目凭据
expo credentials:manager

# 选择: Android → 你的项目 → Build Credentials → Keystore
```

### 方法3: 使用Android Studio

1. 打开Android Studio
2. 点击 `Build` → `Generate Signed Bundle / APK`
3. 选择 `APK` → `Next`
4. 在Key store path处，如果选择调试证书：
   - 路径: `~/.android/debug.keystore`
   - 密码: `android`
   - Key alias: `androiddebugkey` 
   - Key password: `android`
5. 会显示证书信息包括SHA1

### 方法4: 使用gradlew（如果有Android项目）

```bash
cd android
./gradlew signingReport
```

## 🛠️ 具体操作步骤

### 步骤1: 打开终端/命令行

在你的电脑上打开终端（Mac/Linux）或命令提示符（Windows）

### 步骤2: 运行keytool命令

复制并运行以下命令：

**Mac/Linux:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Windows:**
```cmd
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### 步骤3: 查找SHA1值

在输出中找到类似这样的内容：
```
Certificate fingerprints:
         MD5:  XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
         SHA1: A1:B2:C3:D4:E5:F6:G7:H8:I9:J0:K1:L2:M3:N4:O5:P6:Q7:R8:S9:T0
         SHA256: ...
```

**A1:B2:C3:D4:E5:F6:G7:H8:I9:J0:K1:L2:M3:N4:O5:P6:Q7:R8:S9:T0** 就是你的SHA1安全码

### 步骤4: 在高德后台配置

1. 登录高德开放平台控制台
2. 进入你的应用管理
3. 编辑Android平台的Key
4. 在"安全码SHA1"字段填入获取到的SHA1值

## ⚠️ 重要注意事项

### 开发vs生产环境

- **开发环境**: 使用调试证书的SHA1（如上面命令获取的）
- **生产环境**: 需要使用发布证书的SHA1

### Expo项目特殊说明

如果你使用Expo管理的工作流：
- **Expo Go**: 使用Expo的证书，SHA1为固定值
- **Development Build**: 使用你自己的证书，需要获取对应SHA1

### 多个SHA1支持

高德地图支持配置多个SHA1值，你可以添加：
- 开发环境的SHA1
- 生产环境的SHA1
- 团队其他成员的SHA1

## 🔍 故障排除

### 问题1: 找不到debug.keystore文件

**解决方案:**
```bash
# 创建调试证书
keytool -genkey -v -keystore ~/.android/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

### 问题2: keytool命令不存在

**解决方案:**
- 确保已安装Java JDK
- 确保JDK的bin目录在系统PATH中
- 或使用完整路径：`/path/to/jdk/bin/keytool`

### 问题3: 权限被拒绝

**解决方案:**
```bash
# 修复keystore文件权限
chmod 600 ~/.android/debug.keystore
```

## 📝 配置示例

获取到SHA1后，在高德后台这样配置：

```
应用名称: RiverPatrol
服务平台: Android平台
包    名: com.riverpatrol.app
安全码SHA1: A1:B2:C3:D4:E5:F6:G7:H8:I9:J0:K1:L2:M3:N4:O5:P6:Q7:R8:S9:T0
```

完成后点击"提交"即可。

## 🎯 快速命令

复制这个命令直接运行（Mac/Linux）：
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

这会直接显示SHA1值，更加简洁。