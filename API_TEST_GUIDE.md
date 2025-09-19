# 智慧巡河 API 测试指南

## 环境配置
- **API基础URL**: `http://192.168.50.68:3000`
- **Supabase URL**: `http://192.168.50.68:54321`

## 测试账号信息

### 所有账号统一密码
```
password
```

### 用户列表
| 用户名 | 姓名 | 角色 | 权限说明 | 部门 |
|--------|------|------|----------|------|
| admin | 系统管理员 | R001-系统管理员 | 全部权限 | 系统管理部 |
| monitor01 | 张监控 | R002-监控中心主管 | AI/人工告警审核、工单创建 | 监控中心 |
| monitor02 | 李监控 | R002-监控中心主管 | AI/人工告警审核、工单创建 | 监控中心 |
| maintain01 | 王维护 | R003-河道维护员 | 工单执行、东区 | 维护一队 |
| maintain02 | 赵维护 | R003-河道维护员 | 工单执行、东区 | 维护一队 |
| maintain03 | 孙维护 | R003-河道维护员 | 工单执行、西区 | 维护二队 |
| maintain04 | 周维护 | R003-河道维护员 | 工单执行、西区 | 维护二队 |
| patrol01 | 钱巡检 | R004-河道巡检员 | 问题上报、工单确认 | 巡检队 |
| patrol02 | 吴巡检 | R004-河道巡检员 | 问题上报、工单确认 | 巡检队 |
| patrol03 | 郑巡检 | R004-河道巡检员 | 问题上报、工单确认 | 巡检队 |
| leader01 | 刘领导 | R005-领导看板用户 | 查看统计报表 | 系统管理部 |
| leader02 | 张领导 | R005-领导看板用户 | 查看统计报表 | 系统管理部 |
| area01 | 陈区域 | R006-区域管理员 | 东区工单分派审核 | 维护一队 |
| area02 | 冯区域 | R006-区域管理员 | 西区工单分派审核 | 维护二队 |

## API 测试流程

### 1. 用户登录

#### 1.1 河道维护员登录
```bash
curl -X POST http://192.168.50.68:3000/api/app-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "maintain01",
    "password": "password",
    "remember_me": true,
    "device_info": {
      "platform": "mobile",
      "model": "iPhone 14",
      "version": "1.0.0"
    }
  }' | python3 -m json.tool
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "U_R003_01",
      "username": "maintain01",
      "name": "王维护",
      "role_id": "R003",
      "permissions": ["workorder.process", "workorder.complete"]
    },
    "token": "eyJ...",
    "expires_at": "2025-10-16T02:00:44.171Z"
  }
}
```

#### 1.2 巡检员登录
```bash
curl -X POST http://192.168.50.68:3000/api/app-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "patrol01",
    "password": "password",
    "remember_me": true,
    "device_info": {
      "platform": "mobile",
      "model": "iPhone 14",
      "version": "1.0.0"
    }
  }' | python3 -m json.tool
```

#### 1.3 监控主管登录
```bash
curl -X POST http://192.168.50.68:3000/api/app-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "monitor01",
    "password": "password",
    "remember_me": true,
    "device_info": {
      "platform": "mobile",
      "model": "Android",
      "version": "1.0.0"
    }
  }' | python3 -m json.tool
```

### 2. 问题上报（巡检员权限）

先登录获取TOKEN，然后使用TOKEN上报问题：

```bash
# 设置TOKEN变量（使用patrol01的token）
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJVX1IwMDJfMDEiLCJ1c2VybmFtZSI6Im1vbml0b3IwMSIsInJvbGVJZCI6IlIwMDIiLCJyb2xlQ29kZSI6IlIwMDIiLCJhcmVhSWQiOm51bGwsInBsYXRmb3JtIjoibW9iaWxlIiwiaWF0IjoxNzU4MDQ0NTI3LCJleHAiOjE3NjA2MzY1Mjd9.Iae5jQVGIGkfixOCN_ACHixX88MtIb7FoZAxfzWJbQs"

# 上报问题
curl -X POST http://192.168.50.68:3000/api/app-problem-report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "东一河发现大量塑料瓶漂浮",
    "description": "巡检时发现东一河中游段有大量塑料瓶和生活垃圾漂浮，影响河道景观，需要及时清理",
    "category": "AT010",
    "selectedItems": ["垃圾污染", "河道漂浮物"],
    "location": {
      "address": "东一河中游段，靠近东河桥200米处",
      "coordinates": {
        "latitude": 31.235,
        "longitude": 121.475
      }
    },
    "priority": "紧急",
    "photos": [
      "https://cdn.chengyishi.com/riverpatrol/river/2025/09/16/1-0_1757989268239_b65652bd.jpg",
      "https://cdn.chengyishi.com/riverpatrol/river/2025/09/16/2-0_1757989268945_b8ab7ebb.jpg",
      "https://cdn.chengyishi.com/riverpatrol/river/2025/09/16/3-1_1757989272845_f422414c.jpg"
    ],
    "reporterInfo": {
      "name": "钱巡检",
      "phone": "13800004001"
    }
  }' | python3 -m json.tool
```

### 3. 查询问题列表

```bash
# 查询自己上报的问题（巡检员）
curl -X GET "http://192.168.50.68:3000/api/app-problem-report?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

### 4. 获取问题分类

```bash
# 获取问题分类树（无需认证）
curl -X GET "http://192.168.50.68:3000/api/app-problem-categories" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

### 5. 工单管理

#### 5.1 获取工单列表（维护员）
```bash
# 使用maintain01的token
TOKEN="YOUR_MAINTAIN_TOKEN_HERE"

# 获取分配给自己的工单
curl -X GET "http://192.168.50.68:3000/api/app-workorders?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool

# 按状态筛选
curl -X GET "http://192.168.50.68:3000/api/app-workorders?status=处理中&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

#### 5.2 获取工单详情
```bash
curl -X GET "http://192.168.50.68:3000/api/app-workorders/WO_AI_002" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

### 6. Token解析工具

解析JWT Token查看包含的信息：
```bash
# 提取payload并解码
echo "YOUR_TOKEN_HERE" | cut -d'.' -f2 | base64 -d 2>/dev/null

# 如果上面命令失败，尝试添加padding
TOKEN_PAYLOAD=$(echo "YOUR_TOKEN_HERE" | cut -d'.' -f2)
echo "${TOKEN_PAYLOAD}==" | base64 -d
```

## 完整测试场景

### 场景1：巡检员上报问题流程
1. 巡检员(patrol01)登录
2. 上报河道垃圾问题
3. 查询上报记录
4. 等待监控主管确认

### 场景2：维护员处理工单流程
1. 维护员(maintain01)登录
2. 查询分配给自己的工单
3. 接收工单
4. 处理工单
5. 提交处理结果

### 场景3：监控主管审核流程
1. 监控主管(monitor01)登录
2. 查询待审核的问题上报
3. 确认问题并创建工单
4. 分派工单给维护员

## 常见问题

### 1. Token过期
- 默认有效期：30天（remember_me=true）
- 7天（remember_me=false）
- 解决方法：重新登录获取新token

### 2. 权限不足
- 检查用户角色是否正确
- R003只能看分配给自己的工单
- R004只能看自己上报的问题
- R006只能管理自己区域的工单

### 3. 区域限制
- 东区：maintain01, maintain02, area01管理
- 西区：maintain03, maintain04, area02管理

## 测试数据说明

### 预置告警
- **AI告警**: 4条（待审核2条，已确认1条，处理中1条）
- **人工告警**: 2条（待审核1条，已确认1条）

### 预置工单
- **AI工单**: 5条（涵盖完整流程状态）
  - WO_AI_001: 待分派
  - WO_AI_002: 已分派（分配给maintain01）
  - WO_AI_003: 处理中（maintain01处理中）
  - WO_AI_004: 待区域审核
  - WO_AI_005: 待最终审核

- **人工工单**: 3条
  - WO_MANUAL_001: 待分派
  - WO_MANUAL_002: 处理中
  - WO_MANUAL_003: 待发起人确认

### 监控点分布
- **东区**: MP_E01, MP_E02, MP_E03
- **西区**: MP_W01, MP_W02, MP_W03

## 批量测试脚本

```bash
#!/bin/bash
# test_api.sh

API_URL="http://192.168.50.68:3000"

# 函数：登录并保存token
login() {
    local username=$1
    local response=$(curl -s -X POST $API_URL/api/app-auth/login \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$username\",
            \"password\": \"password\",
            \"remember_me\": true
        }")
    
    echo $response | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])"
}

# 登录各类用户
echo "登录巡检员..."
PATROL_TOKEN=$(login "patrol01")
echo "Token: ${PATROL_TOKEN:0:50}..."

echo "登录维护员..."
MAINTAIN_TOKEN=$(login "maintain01")
echo "Token: ${MAINTAIN_TOKEN:0:50}..."

echo "登录监控主管..."
MONITOR_TOKEN=$(login "monitor01")
echo "Token: ${MONITOR_TOKEN:0:50}..."

# 测试各个API
echo "测试问题上报..."
curl -s -X POST $API_URL/api/app-problem-report \
    -H "Authorization: Bearer $PATROL_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "测试问题上报",
        "description": "这是一个测试上报",
        "category": "AT010",
        "priority": "普通"
    }' | python3 -m json.tool | head -10

echo "测试工单查询..."
curl -s -X GET "$API_URL/api/app-workorders?page=1&limit=5" \
    -H "Authorization: Bearer $MAINTAIN_TOKEN" \
    -H "Content-Type: application/json" | python3 -m json.tool | head -20
```

## 注意事项
1. 所有密码统一为 `password`
2. Token在Header中传递：`Authorization: Bearer YOUR_TOKEN`
3. 建议使用 `python3 -m json.tool` 格式化JSON输出
4. 生产环境请替换API URL
5. 测试环境数据会定期重置