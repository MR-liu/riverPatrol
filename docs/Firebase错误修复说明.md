# Firebase错误修复说明

## 问题描述

运行Android应用时出现错误：
```
Default FirebaseApp is not initialized in this process com.riverpatrol.app. 
Make sure to call FirebaseApp.initializeApp(Context) first.
```

## 问题原因

项目中存在两套推送系统的冲突：
1. **极光推送（JPush）** - 我们要使用的
2. **Expo推送通知（需要Firebase）** - 需要禁用的

`EnhancedNotificationService.ts`和`MessageService.ts`尝试使用Expo的推送通知服务，它需要Firebase配置，但我们使用的是极光推送。

## 已完成的修复

### 1. 禁用Expo推送通知
- ✅ 注释掉`EnhancedNotificationService.ts`中的`expo-notifications`相关代码
- ✅ 注释掉`MessageService.ts`中的`expo-notifications`相关代码

### 2. 更新API地址配置
- ✅ 更新`JPushService.ts`使用环境变量中的API地址
- ✅ 更新`push-settings.tsx`使用环境变量中的API地址

### 3. 环境变量配置
`.env`文件中已配置：
```
EXPO_PUBLIC_API_URL=http://172.20.10.12:3000
```

## 验证步骤

### 1. 重新加载应用
如果应用正在运行，按`r`键重新加载

### 2. 检查控制台
应该看到：
```
[EnhancedNotificationService] 使用极光推送，跳过Expo推送注册
[JPush] 开始初始化...
[JPush] 初始化成功
[JPush] 获取到RegistrationID: xxxx
```

### 3. 测试极光推送
1. 记录RegistrationID
2. 在极光控制台或APP内测试推送
3. 确认能收到推送通知

## 注意事项

1. **不要使用Expo Go测试**
   - 极光推送需要原生代码，Expo Go不支持
   - 使用`npx expo run:android`构建开发版本

2. **真机测试**
   - iOS必须使用真机（模拟器不支持推送）
   - Android建议使用真机或支持Google Play的模拟器

3. **API地址配置**
   - 确保`.env`中的`EXPO_PUBLIC_API_URL`指向正确的后端地址
   - Android模拟器使用：`http://10.0.2.2:3000`
   - 真机使用局域网IP：`http://192.168.x.x:3000`

## 相关文件

- `/utils/JPushService.ts` - 极光推送服务
- `/utils/EnhancedNotificationService.ts` - 通知服务（已禁用Expo推送）
- `/utils/MessageService.ts` - 消息服务（已禁用Expo推送）
- `/app/push-settings.tsx` - 推送设置页面
- `/.env` - 环境变量配置

## 后续优化

1. 完全移除`expo-notifications`依赖（如果确定不需要）
2. 统一所有推送相关功能到`JPushService`
3. 添加推送失败的降级处理