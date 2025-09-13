# 智慧河道监控系统 - 完整工作流程API文档

## 概述

本文档描述了智慧河道监控系统从告警产生到工单完成的完整业务流程API。

## 系统架构

### 角色定义
- **R001**: 系统管理员 (ADMIN)
- **R002**: 监控中心主管 (MONITOR_MANAGER) 
- **R003**: 河道维护员 (MAINTAINER)
- **R004**: 河道巡检员 (INSPECTOR)
- **R005**: 领导看板用户 (LEADERSHIP_VIEWER)
- **R006**: 河道维护员主管 (MAINTENANCE_SUPERVISOR)

### 业务流程
```
告警产生 → R002确认/退回 → 创建工单 → R006分派 → R003处理 → R006审核 → R002最终审核 → 完成
```

---

## API端点详细说明

### 1. 用户认证

#### 1.1 登录
**端点**: `POST /api/app-auth/login`

**请求体**:
```json
{
  "username": "monitor001",
  "password": "password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "U_MONITOR_001",
      "username": "monitor001",
      "name": "监控中心张主管",
      "role_id": "R002",
      "role": {
        "id": "R002",
        "name": "监控中心主管",
        "code": "MONITOR_MANAGER"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2025-10-09T16:45:10.706Z"
  },
  "message": "登录成功",
  "statusCode": 200
}
```

#### 1.2 登出
**端点**: `POST /api/app-auth/logout`

**请求头**:
```
Authorization: Bearer {token}
```

---

### 2. 告警管理API

#### 2.1 获取告警列表
**端点**: `GET /api/app-alarms`

**权限**: R001, R002

**查询参数**:
- `status`: pending | confirmed | false_alarm (默认: pending)
- `type`: ai | manual
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 20)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ALARM003",
        "title": "西河段水质异常",
        "description": "水体颜色异常呈黄褐色，疑似工业污染",
        "type": "manual",
        "severity": "high",
        "status": "pending",
        "location": "西河段中游",
        "coordinates": {
          "lat": 31.225,
          "lng": 121.465,
          "address": "西河段中游断面"
        },
        "areaId": "AREA_WEST_001",
        "images": [],
        "videos": [],
        "confirmedBy": null,
        "confirmedAt": null,
        "createdAt": "2025-09-09T15:00:09.299159+00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 2.2 确认告警并转工单
**端点**: `POST /api/app-alarms/confirm`

**权限**: R001, R002

**请求体**:
```json
{
  "alarmId": "ALARM003",
  "title": "处理西河段水质异常",
  "description": "需要立即检查并处理西河段水质问题",
  "typeId": "WT_001",  // 工单类型ID
  "priority": "urgent", // urgent | important | normal
  "areaId": "AREA_WEST_001",
  "departmentId": "DEPT_002"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "alarm": {
      "id": "ALARM003",
      "status": "confirmed"
    },
    "workorder": {
      "id": "WO_20250909_9499",
      "title": "处理西河段水质异常",
      "status": "pending",
      "alarm_id": "ALARM003"
    }
  },
  "message": "告警已确认并转工单"
}
```

#### 2.3 退回告警
**端点**: `POST /api/app-alarms/reject`

**权限**: R001, R002

**请求体**:
```json
{
  "alarmId": "ALARM003",
  "reason": "信息不足，需要进一步核实"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "alarm": {
      "id": "ALARM003",
      "status": "false_alarm",
      "reason": "信息不足，需要进一步核实"
    }
  },
  "message": "告警已退回"
}
```

---

### 3. 工单管理API

#### 3.1 获取工单列表
**端点**: `GET /api/app-workorders`

**查询参数**:
- `status`: pending | assigned | processing | pending_review | completed | cancelled
- `page`: 页码
- `limit`: 每页数量
- `priority`: urgent | important | normal

**权限说明**:
- R001, R002: 查看所有工单
- R006: 只查看自己管理区域的工单
- R003: 只查看分配给自己的工单
- R004: 查看自己创建或参与的工单

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "WO_20250909_9499",
        "title": "处理西河段水质异常",
        "description": "需要立即检查并处理西河段水质问题",
        "status": "pending",
        "priority": "urgent",
        "alarm_id": "ALARM003",
        "area_id": "AREA_WEST_001",
        "creator": {
          "id": "U_MONITOR_001",
          "name": "监控中心张主管"
        },
        "assignee": null,
        "createdAt": "2025-09-09T16:55:51.564+00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

#### 3.2 获取工单详情
**端点**: `GET /api/app-workorders/{id}`

**响应**: 包含工单完整信息、状态历史、处理结果等

#### 3.3 更新工单状态
**端点**: `PUT /api/app-workorders/{id}`

**请求体格式**:
```json
{
  "action": "assign | start | submit_result | approve | reject | cancel",
  "assigneeId": "U_MAINTAINER_001",  // 分配时需要
  "note": "操作说明",
  "attachments": []  // 提交结果时可选
}
```

##### 3.3.1 分配工单 (assign)
**权限**: R001, R002, R006(仅自己区域)

**状态变更**: pending → assigned

**请求示例**:
```json
{
  "action": "assign",
  "assigneeId": "U_MAINTAINER_001",
  "note": "分配给维护员处理水质问题"
}
```

##### 3.3.2 开始处理 (start)
**权限**: 被分配的处理人

**状态变更**: assigned → processing

**请求示例**:
```json
{
  "action": "start",
  "note": "到达现场，开始处理"
}
```

##### 3.3.3 提交处理结果 (submit_result)
**权限**: 被分配的处理人

**状态变更**: processing → pending_review

**请求示例**:
```json
{
  "action": "submit_result",
  "note": "已完成水质异常处理，清理了污染源",
  "attachments": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ]
}
```

##### 3.3.4 审核通过 (approve)
**权限**: R001, R002, R006(仅自己区域)

**状态变更**: pending_review → completed

**请求示例**:
```json
{
  "action": "approve",
  "note": "处理结果符合要求，审核通过"
}
```

##### 3.3.5 驳回工单 (reject)
**权限**: R001, R002, R006(仅自己区域)

**状态变更**: pending_review → assigned

**请求示例**:
```json
{
  "action": "reject",
  "note": "处理不彻底，需要重新处理"
}
```

##### 3.3.6 取消工单 (cancel)
**权限**: R001, R002, 创建者

**状态变更**: any → cancelled

**请求示例**:
```json
{
  "action": "cancel",
  "note": "告警误报，取消工单"
}
```

---

## 完整业务流程示例

### 场景：处理水质异常告警

#### Step 1: R002登录系统
```bash
curl -X POST "http://localhost:3000/api/app-auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"monitor001","password":"password"}'
```

#### Step 2: R002查看待处理告警
```bash
curl -X GET "http://localhost:3000/api/app-alarms?status=pending" \
  -H "Authorization: Bearer {token}"
```

#### Step 3: R002确认告警并转工单
```bash
curl -X POST "http://localhost:3000/api/app-alarms/confirm" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "alarmId": "ALARM003",
    "title": "处理西河段水质异常",
    "typeId": "WT_001",
    "priority": "urgent",
    "areaId": "AREA_WEST_001"
  }'
```

#### Step 4: R006登录并分配工单
```bash
# 登录
curl -X POST "http://localhost:3000/api/app-auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor002","password":"password"}'

# 分配工单
curl -X PUT "http://localhost:3000/api/app-workorders/WO_20250909_9499" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "assign",
    "assigneeId": "U_MAINTAINER_001",
    "note": "分配给维护员处理"
  }'
```

#### Step 5: R003处理工单
```bash
# 登录
curl -X POST "http://localhost:3000/api/app-auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"maintainer001","password":"password"}'

# 提交处理结果
curl -X PUT "http://localhost:3000/api/app-workorders/WO_20250909_9499" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "submit_result",
    "note": "已完成处理",
    "attachments": ["photo1.jpg", "photo2.jpg"]
  }'
```

#### Step 6: R006审核工单
```bash
curl -X PUT "http://localhost:3000/api/app-workorders/WO_20250909_9499" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "note": "处理合格"
  }'
```

---

## 状态流转图

```
告警状态流转:
pending (待处理) → confirmed (已确认) / false_alarm (误报)

工单状态流转:
pending (待分配) → assigned (已分配) → processing (处理中) → pending_review (待审核) → completed (已完成)
                                                                               ↓
                                                                         cancelled (已取消)
```

---

## 重要说明

### 用户ID格式
数据库中的用户ID格式为：
- 管理员: U_ADMIN
- 监控主管: U_MONITOR_001
- 维护员: U_MAINTAINER_001, U_MAINTAINER_002
- 巡检员: U_INSPECTOR_001
- 区域主管: U_SUPERVISOR_001, U_SUPERVISOR_002

### 工单类型ID
- WT_001: 告警处理
- WT_002: 设备维修
- WT_003: 设备巡检
- WT_004: 河道清理
- WT_005: 水质处理

### 区域ID
- AREA_EAST_001: 东区河道管理区域
- AREA_WEST_001: 西区河道管理区域

### 测试账号
| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin001 | password | R001 | 系统管理员 |
| monitor001 | password | R002 | 监控中心主管 |
| maintainer001 | password | R003 | 河道维护员 |
| inspector001 | password | R004 | 河道巡检员 |
| supervisor001 | password | R006 | 东区主管 |
| supervisor002 | password | R006 | 西区主管 |

---

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录或token无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

## 更新日志

- 2025-09-09: 初始版本，完成告警转工单完整流程
- 修复用户ID格式问题 (USR_20240101_003 → U_MAINTAINER_001)
- 修复工单类型ID格式 (WT001 → WT_001)
- 使用resolution_note字段存储告警退回原因