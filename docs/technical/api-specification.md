# 智慧河道巡查系统 - API接口规范

## 1. 接口设计规范

### 1.1 设计原则
- **RESTful设计**: 遵循REST架构风格，语义化URL设计
- **版本控制**: 通过URL路径进行版本控制 `/api/v1/`
- **统一响应**: 统一的响应格式和错误处理机制
- **安全第一**: 所有接口需要认证，敏感操作需要权限验证
- **幂等性**: GET/PUT/DELETE操作保证幂等性
- **分页查询**: 列表接口支持分页、排序和筛选

### 1.2 请求规范
- **Base URL**: `https://api.riverpatrol.com/api/v1`
- **Content-Type**: `application/json`
- **字符编码**: `UTF-8`
- **请求头**: 必须包含 `Authorization` 和 `Content-Type`

### 1.3 响应格式
```json
{
  \"code\": 200,
  \"message\": \"success\",
  \"data\": {},
  \"timestamp\": \"2024-01-20T10:30:00Z\",
  \"requestId\": \"uuid-request-id\"
}
```

### 1.4 状态码规范
- **200**: 请求成功
- **201**: 创建成功
- **400**: 请求参数错误
- **401**: 未认证或认证失败
- **403**: 权限不足
- **404**: 资源不存在
- **500**: 服务器内部错误

## 2. 认证授权接口

### 2.1 用户登录
```http
POST /api/v1/auth/login
```

**请求参数**:
```json
{
  \"username\": \"P001\",
  \"password\": \"password123\",
  \"deviceId\": \"device-uuid\",
  \"deviceInfo\": {
    \"platform\": \"ios\",
    \"version\": \"1.0.0\",
    \"model\": \"iPhone 13\"
  }
}
```

**响应示例**:
```json
{
  \"code\": 200,
  \"message\": \"登录成功\",
  \"data\": {
    \"accessToken\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\",
    \"refreshToken\": \"refresh-token-string\",
    \"expiresIn\": 7200,
    \"user\": {
      \"id\": \"user-uuid\",
      \"username\": \"P001\",
      \"realName\": \"张三\",
      \"role\": \"patrol\",
      \"avatar\": \"https://cdn.example.com/avatar.jpg\",
      \"permissions\": [\"workorder:read\", \"workorder:create\"]
    }
  }
}
```

### 2.2 刷新Token
```http
POST /api/v1/auth/refresh
```

**请求参数**:
```json
{
  \"refreshToken\": \"refresh-token-string\"
}
```

### 2.3 退出登录
```http
POST /api/v1/auth/logout
```

**请求头**:
```
Authorization: Bearer {access_token}
```

## 3. 用户管理接口

### 3.1 获取用户信息
```http
GET /api/v1/users/profile
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"id\": \"user-uuid\",
    \"username\": \"P001\",
    \"realName\": \"张三\",
    \"email\": \"zhangsan@example.com\",
    \"phone\": \"13800138000\",
    \"role\": \"patrol\",
    \"department\": \"河道巡查一队\",
    \"avatar\": \"https://cdn.example.com/avatar.jpg\",
    \"status\": \"active\",
    \"lastLoginTime\": \"2024-01-20T08:30:00Z\",
    \"createdAt\": \"2024-01-01T00:00:00Z\"
  }
}
```

### 3.2 更新用户信息
```http
PUT /api/v1/users/profile
```

**请求参数**:
```json
{
  \"realName\": \"张三\",
  \"email\": \"zhangsan@example.com\",
  \"phone\": \"13800138000\",
  \"avatar\": \"https://cdn.example.com/new-avatar.jpg\"
}
```

### 3.3 修改密码
```http
PUT /api/v1/users/password
```

**请求参数**:
```json
{
  \"oldPassword\": \"old-password\",
  \"newPassword\": \"new-password\",
  \"confirmPassword\": \"new-password\"
}
```

## 4. 工单管理接口

### 4.1 创建工单
```http
POST /api/v1/workorders
```

**请求参数**:
```json
{
  \"title\": \"河道垃圾堆积\",
  \"category\": \"garbage\",
  \"subcategory\": \"生活垃圾堆积\",
  \"priority\": \"normal\",
  \"description\": \"河道内发现大量生活垃圾...\",
  \"location\": {
    \"address\": \"东河段桥下\",
    \"latitude\": 39.9042,
    \"longitude\": 116.4074,
    \"accuracy\": 5.0
  },
  \"photos\": [
    \"https://cdn.example.com/photo1.jpg\",
    \"https://cdn.example.com/photo2.jpg\"
  ],
  \"reportedBy\": \"用户举报\"
}
```

**响应示例**:
```json
{
  \"code\": 201,
  \"message\": \"工单创建成功\",
  \"data\": {
    \"id\": \"WO20240120001\",
    \"title\": \"河道垃圾堆积\",
    \"status\": \"pending\",
    \"priority\": \"normal\",
    \"assignee\": null,
    \"createdAt\": \"2024-01-20T10:30:00Z\"
  }
}
```

### 4.2 获取工单列表
```http
GET /api/v1/workorders
```

**查询参数**:
```
?page=1&size=20&status=pending&priority=urgent&category=garbage&sort=createdAt:desc
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"items\": [
      {
        \"id\": \"WO20240120001\",
        \"title\": \"河道垃圾堆积\",
        \"category\": \"garbage\",
        \"priority\": \"urgent\",
        \"status\": \"pending\",
        \"location\": {
          \"address\": \"东河段桥下\",
          \"latitude\": 39.9042,
          \"longitude\": 116.4074
        },
        \"assignee\": {
          \"id\": \"user-uuid\",
          \"name\": \"李四\"
        },
        \"createdAt\": \"2024-01-20T10:30:00Z\",
        \"updatedAt\": \"2024-01-20T10:30:00Z\"
      }
    ],
    \"pagination\": {
      \"page\": 1,
      \"size\": 20,
      \"total\": 150,
      \"pages\": 8
    }
  }
}
```

### 4.3 获取工单详情
```http
GET /api/v1/workorders/{workorderId}
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"id\": \"WO20240120001\",
    \"title\": \"河道垃圾堆积\",
    \"category\": \"garbage\",
    \"subcategory\": \"生活垃圾堆积\",
    \"priority\": \"urgent\",
    \"status\": \"in_progress\",
    \"description\": \"河道内发现大量生活垃圾...\",
    \"location\": {
      \"address\": \"东河段桥下\",
      \"latitude\": 39.9042,
      \"longitude\": 116.4074,
      \"accuracy\": 5.0
    },
    \"photos\": [
      {
        \"id\": \"photo-uuid-1\",
        \"url\": \"https://cdn.example.com/photo1.jpg\",
        \"thumbnail\": \"https://cdn.example.com/photo1_thumb.jpg\"
      }
    ],
    \"assignee\": {
      \"id\": \"user-uuid\",
      \"name\": \"李四\",
      \"phone\": \"13900139000\"
    },
    \"reporter\": {
      \"name\": \"用户举报\",
      \"contact\": \"13800138000\"
    },
    \"timeline\": [
      {
        \"action\": \"created\",
        \"actor\": \"张三\",
        \"timestamp\": \"2024-01-20T10:30:00Z\",
        \"note\": \"工单创建\"
      },
      {
        \"action\": \"assigned\",
        \"actor\": \"班组长\",
        \"timestamp\": \"2024-01-20T11:00:00Z\",
        \"note\": \"分配给李四处理\"
      }
    ],
    \"createdAt\": \"2024-01-20T10:30:00Z\",
    \"updatedAt\": \"2024-01-20T11:00:00Z\"
  }
}
```

### 4.4 接收工单
```http
POST /api/v1/workorders/{workorderId}/accept
```

**请求参数**:
```json
{
  \"note\": \"已接收工单，正在前往现场\"
}
```

### 4.5 更新工单状态
```http
PUT /api/v1/workorders/{workorderId}/status
```

**请求参数**:
```json
{
  \"status\": \"in_progress\",
  \"note\": \"开始处理问题\"
}
```

### 4.6 提交处理结果
```http
POST /api/v1/workorders/{workorderId}/result
```

**请求参数**:
```json
{
  \"processMethod\": \"现场清理\",
  \"description\": \"已完成垃圾清理工作...\",
  \"result\": \"问题已解决\",
  \"beforePhotos\": [
    \"https://cdn.example.com/before1.jpg\"
  ],
  \"afterPhotos\": [
    \"https://cdn.example.com/after1.jpg\"
  ],
  \"needFollowUp\": false,
  \"followUpReason\": \"\"
}
```

## 5. 文件上传接口

### 5.1 单文件上传
```http
POST /api/v1/files/upload
```

**请求格式**: `multipart/form-data`

**请求参数**:
```
file: [Binary File]
type: photo|video|document
category: workorder|avatar|report
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"id\": \"file-uuid\",
    \"filename\": \"photo.jpg\",
    \"url\": \"https://cdn.example.com/photo.jpg\",
    \"thumbnail\": \"https://cdn.example.com/photo_thumb.jpg\",
    \"size\": 1024000,
    \"mimeType\": \"image/jpeg\",
    \"uploadedAt\": \"2024-01-20T10:30:00Z\"
  }
}
```

### 5.2 批量文件上传
```http
POST /api/v1/files/batch-upload
```

**请求格式**: `multipart/form-data`

**请求参数**:
```
files[]: [Binary Files Array]
type: photo
category: workorder
```

## 6. 地图服务接口

### 6.1 获取附近工单
```http
GET /api/v1/maps/nearby-workorders
```

**查询参数**:
```
?latitude=39.9042&longitude=116.4074&radius=1000&status=pending
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": [
    {
      \"id\": \"WO20240120001\",
      \"title\": \"河道垃圾堆积\",
      \"location\": {
        \"latitude\": 39.9042,
        \"longitude\": 116.4074
      },
      \"status\": \"pending\",
      \"priority\": \"urgent\",
      \"distance\": 500
    }
  ]
}
```

### 6.2 记录GPS轨迹
```http
POST /api/v1/maps/tracks
```

**请求参数**:
```json
{
  \"points\": [
    {
      \"latitude\": 39.9042,
      \"longitude\": 116.4074,
      \"altitude\": 45.6,
      \"accuracy\": 5.0,
      \"timestamp\": \"2024-01-20T10:30:00Z\"
    }
  ],
  \"activity\": \"patrol\",
  \"startTime\": \"2024-01-20T10:00:00Z\",
  \"endTime\": \"2024-01-20T11:00:00Z\"
}
```

### 6.3 获取路径规划
```http
GET /api/v1/maps/routes
```

**查询参数**:
```
?origin=39.9042,116.4074&destination=39.9142,116.4174&strategy=fastest
```

## 7. 统计分析接口

### 7.1 获取工作台数据
```http
GET /api/v1/stats/dashboard
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"overview\": {
      \"totalWorkorders\": 1250,
      \"pendingCount\": 45,
      \"inProgressCount\": 89,
      \"completedCount\": 1116,
      \"completionRate\": 89.3
    },
    \"todayStats\": {
      \"newWorkorders\": 12,
      \"completedWorkorders\": 18,
      \"activeUsers\": 156
    },
    \"categoryStats\": [
      {
        \"category\": \"garbage\",
        \"name\": \"垃圾污染\",
        \"count\": 456,
        \"percentage\": 36.5
      }
    ],
    \"trendData\": [
      {
        \"date\": \"2024-01-15\",
        \"created\": 15,
        \"completed\": 18
      }
    ]
  }
}
```

### 7.2 获取个人统计
```http
GET /api/v1/stats/personal
```

**查询参数**:
```
?period=month&startDate=2024-01-01&endDate=2024-01-31
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"summary\": {
      \"totalHandled\": 89,
      \"completedCount\": 85,
      \"completionRate\": 95.5,
      \"avgProcessTime\": 2.5,
      \"qualityScore\": 4.8
    },
    \"categoryBreakdown\": [
      {
        \"category\": \"garbage\",
        \"count\": 32,
        \"avgTime\": 2.1
      }
    ],
    \"dailyStats\": [
      {
        \"date\": \"2024-01-20\",
        \"handled\": 5,
        \"completed\": 4
      }
    ]
  }
}
```

## 8. 消息通知接口

### 8.1 获取消息列表
```http
GET /api/v1/notifications/messages
```

**查询参数**:
```
?page=1&size=20&type=system&isRead=false
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"items\": [
      {
        \"id\": \"msg-uuid\",
        \"type\": \"workorder\",
        \"title\": \"新工单分配\",
        \"content\": \"您有新的工单待处理\",
        \"data\": {
          \"workorderId\": \"WO20240120001\"
        },
        \"isRead\": false,
        \"createdAt\": \"2024-01-20T10:30:00Z\"
      }
    ],
    \"pagination\": {
      \"page\": 1,
      \"size\": 20,
      \"total\": 45,
      \"pages\": 3
    }
  }
}
```

### 8.2 标记消息已读
```http
PUT /api/v1/notifications/messages/{messageId}/read
```

### 8.3 批量标记已读
```http
PUT /api/v1/notifications/messages/mark-all-read
```

**请求参数**:
```json
{
  \"messageIds\": [\"msg-uuid-1\", \"msg-uuid-2\"]
}
```

## 9. 设置配置接口

### 9.1 获取用户设置
```http
GET /api/v1/settings/user
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"notifications\": {
      \"workorderUpdates\": true,
      \"systemMessages\": true,
      \"reminderAlerts\": false
    },
    \"appearance\": {
      \"theme\": \"light\",
      \"fontSize\": \"medium\"
    },
    \"privacy\": {
      \"locationTracking\": true,
      \"dataCollection\": false
    }
  }
}
```

### 9.2 更新用户设置
```http
PUT /api/v1/settings/user
```

**请求参数**:
```json
{
  \"notifications\": {
    \"workorderUpdates\": false
  },
  \"appearance\": {
    \"theme\": \"dark\"
  }
}
```

## 10. 系统配置接口

### 10.1 获取系统配置
```http
GET /api/v1/system/config
```

**响应示例**:
```json
{
  \"code\": 200,
  \"data\": {
    \"app\": {
      \"version\": \"1.0.0\",
      \"minVersion\": \"1.0.0\",
      \"downloadUrl\": \"https://download.example.com/app.apk\"
    },
    \"features\": {
      \"offlineMode\": true,
      \"voiceReport\": false,
      \"videoUpload\": true
    },
    \"limits\": {
      \"maxPhotoSize\": 5242880,
      \"maxPhotosPerReport\": 5,
      \"maxVideoSize\": 52428800
    }
  }
}
```

## 11. 错误码定义

### 11.1 业务错误码
| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| 10000 | 成功 | 200 |
| 10001 | 参数错误 | 400 |
| 10002 | 用户名或密码错误 | 401 |
| 10003 | 权限不足 | 403 |
| 10004 | 资源不存在 | 404 |
| 10005 | 请求频率过高 | 429 |
| 10006 | 服务器内部错误 | 500 |

### 11.2 工单相关错误码  
| 错误码 | 说明 |
|--------|------|
| 20001 | 工单不存在 |
| 20002 | 工单状态不允许此操作 |
| 20003 | 工单已被其他人接收 |
| 20004 | 上传文件格式不支持 |
| 20005 | 处理结果不完整 |

### 11.3 文件相关错误码
| 错误码 | 说明 |
|--------|------|
| 30001 | 文件大小超出限制 |
| 30002 | 文件格式不支持 |
| 30003 | 文件上传失败 |
| 30004 | 文件不存在 |

## 12. 接口测试

### 12.1 测试环境
- **开发环境**: https://dev-api.riverpatrol.com
- **测试环境**: https://test-api.riverpatrol.com  
- **生产环境**: https://api.riverpatrol.com

### 12.2 Postman集合
提供完整的Postman接口测试集合，包含所有接口的示例请求和响应。

### 12.3 Mock数据
开发阶段提供Mock API服务，支持前端独立开发和测试。

---

**文档版本**: v1.0  
**最后更新**: 2024-01-20  
**维护团队**: 后端开发团队  
**审批状态**: 待审批