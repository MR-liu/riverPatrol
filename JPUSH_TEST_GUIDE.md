# 极光推送测试指南

## 当前配置
- AppKey: `463f52032571434a7a2ddeee`
- MasterSecret: `dae68cd8344bdd329d032915`

## 测试步骤

### 1. 确认设备已注册

首先需要确认你的设备已成功注册到极光服务器：

1. **运行APP查看日志**
   ```bash
   # 清理日志
   adb logcat -c
   
   # 查看JPush相关日志
   adb logcat | grep -i jpush
   ```

2. **应该看到的成功日志**
   ```
   [JPush] 开始初始化...
   [JPush] 初始化成功
   [JPush] 获取到RegistrationID: 1507bfd3b7c8283abc123  # 这是你设备的ID
   [JPush] 连接状态: 已连接
   ```

### 2. 发送测试推送

有三种方式测试推送：

#### 方法1: 使用极光控制台（最简单）

1. 登录 [极光控制台](https://www.jiguang.cn/accounts/login)
2. 选择你的应用（AppKey: 463f52032571434a7a2ddeee）
3. 点击"推送" → "发送通知"
4. 选择"所有人"或输入RegistrationID
5. 输入通知内容，点击发送

#### 方法2: 使用测试脚本

```bash
# 发送给所有设备（需要有活跃设备）
node scripts/test-jpush.js --all

# 发送给指定设备（替换为你的RegistrationID）
node scripts/test-jpush.js 1507bfd3b7c8283abc123
```

#### 方法3: 使用curl命令

```bash
# 发送给所有设备
curl -X POST https://api.jpush.cn/v3/push \
  -H "Authorization: Basic $(echo -n '463f52032571434a7a2ddeee:dae68cd8344bdd329d032915' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "all",
    "audience": "all", 
    "notification": {
      "alert": "测试推送消息"
    }
  }'

# 发送给指定设备（替换YOUR_REGISTRATION_ID）
curl -X POST https://api.jpush.cn/v3/push \
  -H "Authorization: Basic $(echo -n '463f52032571434a7a2ddeee:dae68cd8344bdd329d032915' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "all",
    "audience": {
      "registration_id": ["YOUR_REGISTRATION_ID"]
    },
    "notification": {
      "alert": "测试推送消息"
    }
  }'
```

### 3. 在APP中查看推送

成功发送后，你应该：
1. 在手机通知栏看到推送通知
2. 在APP日志中看到：
   ```
   [JPush] 收到远程通知: {title: "xxx", content: "xxx"}
   ```

## 常见问题

### 问题1: "cannot find user by this audience"
**原因**: 没有设备注册或设备超过255天未活跃
**解决**: 
1. 确认APP已运行并成功初始化JPush
2. 查看日志确认获取到RegistrationID
3. 使用具体的RegistrationID而不是"all"

### 问题2: 收不到推送
**可能原因**:
1. 设备没有网络连接
2. APP没有通知权限
3. JPush没有成功初始化
4. Android: 被系统省电模式限制
5. iOS: 推送证书配置问题

**排查步骤**:
1. 检查APP日志确认JPush初始化成功
2. 检查手机设置中APP的通知权限
3. 尝试将APP加入电池优化白名单
4. 使用极光控制台的"推送历史"查看推送状态

### 问题3: API返回400错误
**原因**: 请求参数格式错误
**解决**: 使用上面提供的最简格式，确保JSON格式正确

## 推送格式示例

### 最简单的推送
```json
{
  "platform": "all",
  "audience": "all",
  "notification": {
    "alert": "Hello!"
  }
}
```

### 带标题和附加信息
```json
{
  "platform": "all",
  "audience": "all",
  "notification": {
    "android": {
      "alert": "消息内容",
      "title": "消息标题",
      "extras": {
        "type": "news",
        "id": "123"
      }
    },
    "ios": {
      "alert": "消息内容",
      "sound": "default",
      "badge": "+1",
      "extras": {
        "type": "news",
        "id": "123"
      }
    }
  }
}
```

### 自定义消息（透传）
```json
{
  "platform": "all",
  "audience": "all",
  "message": {
    "msg_content": "自定义消息内容",
    "content_type": "text",
    "extras": {
      "key": "value"
    }
  }
}
```

## 下一步

1. 先确认设备成功注册（查看RegistrationID）
2. 使用极光控制台发送测试
3. 确认能收到推送后，再使用API测试
4. 集成到后端服务中