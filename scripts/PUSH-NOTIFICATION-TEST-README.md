# 推送通知功能测试指南

智慧河道巡查系统现已集成完整的推送通知功能。本文档说明如何测试推送通知功能。

## 📱 功能概述

当运营后台转发工单给人员时，人员的APP将收到以下类型的推送通知：

### 🔔 通知类型

1. **工单分配通知**
   - 触发条件：运营后台创建工单并分配给处理人
   - 通知对象：被分配的处理人
   - 通知内容：`新工单分配 - [工单标题]`

2. **工单状态变化通知**
   - 触发条件：工单状态发生变化（接收、开始处理、完成、审核等）
   - 通知对象：工单创建者、处理人、审核者（排除当前操作人）
   - 通知内容：根据具体操作而定

### 📊 支持的状态变化

| 操作 | 通知标题 | 通知对象 |
|------|----------|----------|
| accept | 工单已接收 | 创建者 |
| start | 工单处理中 | 创建者 |
| complete | 工单已完成 | 创建者、审核者 |
| review | 工单待审核 | 审核者 |
| approve | 工单审核通过 | 处理人、创建者 |
| reject | 工单审核不通过 | 处理人 |
| cancel | 工单已取消 | 处理人、创建者 |

## 🚀 测试准备

### 1. 数据库迁移

首先运行数据库迁移创建通知相关表：

```bash
# 应用数据库迁移
npx supabase db push

# 或者手动执行迁移文件
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/20240826000001_add_notification_tables.sql
```

### 2. 环境变量

确保设置了以下环境变量：

```bash
export SUPABASE_URL="http://localhost:54321"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 3. 测试用户

确保数据库中存在测试用户：

- **U001** - admin (系统管理员)
- **U002** - worker01 (张巡查员) 
- **U003** - supervisor01 (李主管)

## 🧪 运行测试

### 自动化测试

运行推送通知功能测试脚本：

```bash
# 安装依赖（如果还没有）
npm install node-fetch

# 运行测试脚本
node scripts/test-push-notifications.js
```

### 预期输出

```
🚀 开始推送通知功能测试...

=== 步骤1: 用户登录 ===
✓ 登录成功: 系统管理员
ℹ Token: eyJhbGciOiJIUzI1NiIsI...

=== 步骤2: 测试工单分配通知 ===
创建工单并分配给处理人...
✓ 工单创建成功: WO12345678
✓ 已分配给处理人: 张巡查员
📱 处理人应该收到"新工单分配"推送通知

=== 步骤3: 测试工单状态变化通知 ===

--- 处理人接收工单 ---
✓ 状态更新成功: assigned → in_progress
📱 创建者应该收到"工单已接收"通知

--- 处理人开始处理工单 ---
✓ 状态更新成功: in_progress → processing
📱 创建者应该收到"工单处理中"通知

--- 处理人完成工单 ---
✓ 状态更新成功: processing → completed
📱 创建者应该收到"工单已完成"通知

🎉 推送通知功能测试完成！
```

## 📱 APP端验证

### 1. 检查推送权限

在APP中验证：

1. 启动APP时会请求推送通知权限
2. 登录后会自动注册推送Token到服务器
3. 在设置中可以查看和管理通知设置

### 2. 接收通知

当执行测试脚本时，对应的用户APP应该收到推送通知：

- 通知会显示标题和内容
- 点击通知会打开相关工单详情
- 通知会同时保存到APP内的消息列表

### 3. 消息同步

APP会通过以下方式同步消息：

- **实时同步**: 使用Supabase Realtime订阅
- **定期同步**: 每30秒自动同步一次
- **手动同步**: 下拉刷新消息列表

## 🔍 故障排除

### 常见问题

1. **推送通知没有发送**
   - 检查用户是否已注册推送Token
   - 确认移动设备表中有有效的push_token记录
   - 查看Edge Function的日志输出

2. **通知权限被拒绝**
   - 用户需要在APP设置中手动开启通知权限
   - 或者在手机系统设置中开启APP的通知权限

3. **消息没有保存到数据库**
   - 检查user_messages表是否创建成功
   - 确认RLS策略配置正确
   - 查看函数执行日志

### 调试方法

1. **查看函数日志**：
   ```bash
   npx supabase functions logs create-workorder
   npx supabase functions logs update-workorder-status
   npx supabase functions logs send-push-notification
   ```

2. **检查数据库记录**：
   ```sql
   -- 查看消息记录
   SELECT * FROM user_messages ORDER BY created_at DESC LIMIT 10;
   
   -- 查看设备注册
   SELECT * FROM mobile_devices WHERE is_active = true;
   
   -- 查看通知设置
   SELECT * FROM notification_settings;
   ```

3. **手动测试推送**：
   ```bash
   # 直接调用推送通知API
   curl -X POST "http://localhost:54321/functions/v1/send-push-notification" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "user_ids": ["U002"],
       "title": "测试通知",
       "body": "这是一个测试推送通知"
     }'
   ```

## 📋 验证清单

- [ ] 数据库表创建成功
- [ ] Edge Functions部署成功
- [ ] 用户可以正常登录
- [ ] 推送Token注册成功
- [ ] 工单分配时发送通知
- [ ] 工单状态变化时发送通知  
- [ ] 通知消息保存到数据库
- [ ] APP能接收到推送通知
- [ ] 通知点击跳转工单详情
- [ ] 消息列表显示通知历史

## 🎯 下一步

推送通知功能实现后，可以考虑以下扩展：

1. **通知模板管理**: 支持自定义通知模板
2. **批量通知**: 支持向多个用户发送批量通知
3. **通知统计**: 统计通知的发送和阅读情况
4. **智能提醒**: 基于用户行为的智能提醒
5. **富媒体通知**: 支持图片、按钮等富媒体内容

---

**注意**: 在生产环境中，请确保：
- 使用正确的Supabase项目URL和密钥
- 配置合适的RLS安全策略  
- 设置适当的通知频率限制
- 考虑用户隐私和通知偏好设置