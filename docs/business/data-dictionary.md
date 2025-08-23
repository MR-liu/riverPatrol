# 智慧河道巡查系统 - 数据字典

## 1. 数据模型概述

### 1.1 设计原则
- **标准化**: 统一的命名规范和数据类型定义
- **规范化**: 消除数据冗余，保证数据一致性
- **可扩展**: 预留扩展字段，支持业务发展需要
- **性能优化**: 合理的索引设计和分区策略
- **数据安全**: 敏感数据加密存储和访问控制

### 1.2 表命名规范
- **前缀规范**: `rp_` (River Patrol)
- **命名风格**: 下划线命名法 (snake_case)
- **表类型**: 
  - 业务表: `rp_workorders`、`rp_users`
  - 关联表: `rp_user_roles`、`rp_workorder_files`
  - 日志表: `rp_operation_logs`、`rp_audit_logs`

### 1.3 字段命名规范
- **主键**: `id` (UUID类型)
- **外键**: `{table_name}_id`
- **时间字段**: `created_at`、`updated_at`、`deleted_at`
- **状态字段**: `status`、`is_active`、`is_deleted`
- **布尔字段**: `is_` 或 `has_` 开头

## 2. 核心业务表

### 2.1 用户表 (rp_users)

**表说明**: 系统用户基本信息表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 用户唯一标识 |
| username | VARCHAR | 50 | Y | - | 用户名(登录账号) |
| password_hash | VARCHAR | 255 | Y | - | 密码哈希值 |
| real_name | VARCHAR | 50 | Y | - | 真实姓名 |
| email | VARCHAR | 100 | N | - | 邮箱地址 |
| phone | VARCHAR | 20 | N | - | 手机号码 |
| avatar | VARCHAR | 500 | N | - | 头像URL |
| employee_id | VARCHAR | 20 | N | - | 员工工号 |
| department | VARCHAR | 100 | N | - | 所属部门 |
| position | VARCHAR | 50 | N | - | 职位 |
| status | ENUM | - | Y | active | 用户状态: active, inactive, suspended |
| last_login_at | TIMESTAMP | - | N | - | 最后登录时间 |
| last_login_ip | VARCHAR | 45 | N | - | 最后登录IP |
| password_changed_at | TIMESTAMP | - | N | - | 密码修改时间 |
| is_deleted | BOOLEAN | - | Y | false | 是否删除 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |
| deleted_at | TIMESTAMP | - | N | - | 删除时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
UNIQUE KEY uk_username (username)
UNIQUE KEY uk_phone (phone)
KEY idx_status (status)
KEY idx_department (department)
KEY idx_created_at (created_at)
```

### 2.2 角色表 (rp_roles)

**表说明**: 系统角色定义表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 角色唯一标识 |
| name | VARCHAR | 50 | Y | - | 角色名称 |
| code | VARCHAR | 50 | Y | - | 角色编码 |
| description | TEXT | - | N | - | 角色描述 |
| level | INT | - | Y | 1 | 角色层级 |
| permissions | JSON | - | N | - | 权限列表 |
| is_system | BOOLEAN | - | Y | false | 是否系统角色 |
| is_active | BOOLEAN | - | Y | true | 是否启用 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
UNIQUE KEY uk_code (code)
KEY idx_level (level)
KEY idx_is_active (is_active)
```

### 2.3 用户角色关联表 (rp_user_roles)

**表说明**: 用户与角色多对多关联表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 关联唯一标识 |
| user_id | UUID | - | Y | - | 用户ID |
| role_id | UUID | - | Y | - | 角色ID |
| granted_by | UUID | - | Y | - | 授权人ID |
| granted_at | TIMESTAMP | - | Y | NOW() | 授权时间 |
| expires_at | TIMESTAMP | - | N | - | 过期时间 |
| is_active | BOOLEAN | - | Y | true | 是否有效 |

**索引设计**:
```sql
PRIMARY KEY (id)
UNIQUE KEY uk_user_role (user_id, role_id)
KEY idx_user_id (user_id)
KEY idx_role_id (role_id)
FOREIGN KEY fk_user_id (user_id) REFERENCES rp_users(id)
FOREIGN KEY fk_role_id (role_id) REFERENCES rp_roles(id)
```

### 2.4 工单表 (rp_workorders)

**表说明**: 工单主表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | VARCHAR | 20 | Y | - | 工单号(WO+日期+序号) |
| uuid | UUID | - | Y | - | 工单UUID |
| title | VARCHAR | 200 | Y | - | 工单标题 |
| category | ENUM | - | Y | - | 问题分类: garbage, facility, violation, water |
| subcategory | VARCHAR | 100 | Y | - | 问题子分类 |
| priority | ENUM | - | Y | normal | 优先级: urgent, high, normal, low |
| status | ENUM | - | Y | pending | 状态: pending, assigned, in_progress, completed, closed, rejected |
| description | TEXT | - | Y | - | 问题描述 |
| location_address | VARCHAR | 500 | Y | - | 位置地址 |
| location_latitude | DECIMAL | 10,8 | N | - | 纬度 |
| location_longitude | DECIMAL | 11,8 | N | - | 经度 |
| location_accuracy | DECIMAL | 8,2 | N | - | 定位精度(米) |
| reporter_name | VARCHAR | 100 | N | - | 举报人姓名 |
| reporter_phone | VARCHAR | 20 | N | - | 举报人电话 |
| reporter_type | ENUM | - | Y | system | 举报类型: system, citizen, patrol |
| assignee_id | UUID | - | N | - | 分配人员ID |
| assigned_at | TIMESTAMP | - | N | - | 分配时间 |
| accepted_at | TIMESTAMP | - | N | - | 接收时间 |
| started_at | TIMESTAMP | - | N | - | 开始处理时间 |
| completed_at | TIMESTAMP | - | N | - | 完成时间 |
| closed_at | TIMESTAMP | - | N | - | 关闭时间 |
| due_date | TIMESTAMP | - | N | - | 截止日期 |
| estimated_hours | DECIMAL | 5,2 | N | - | 预计用时(小时) |
| actual_hours | DECIMAL | 5,2 | N | - | 实际用时(小时) |
| quality_score | DECIMAL | 3,1 | N | - | 质量评分(1-5) |
| tags | JSON | - | N | - | 标签列表 |
| metadata | JSON | - | N | - | 扩展信息 |
| created_by | UUID | - | Y | - | 创建人ID |
| is_deleted | BOOLEAN | - | Y | false | 是否删除 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |
| deleted_at | TIMESTAMP | - | N | - | 删除时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
UNIQUE KEY uk_uuid (uuid)  
KEY idx_status (status)
KEY idx_priority (priority)
KEY idx_category (category)
KEY idx_assignee_id (assignee_id)
KEY idx_location (location_latitude, location_longitude)
KEY idx_created_at (created_at)
KEY idx_due_date (due_date)
FOREIGN KEY fk_assignee_id (assignee_id) REFERENCES rp_users(id)
FOREIGN KEY fk_created_by (created_by) REFERENCES rp_users(id)
```

### 2.5 工单处理记录表 (rp_workorder_processes)

**表说明**: 工单处理过程记录表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 处理记录ID |
| workorder_id | VARCHAR | 20 | Y | - | 工单ID |
| processor_id | UUID | - | Y | - | 处理人ID |
| process_method | VARCHAR | 100 | Y | - | 处理方法 |
| process_description | TEXT | - | Y | - | 处理描述 |
| process_result | ENUM | - | Y | - | 处理结果: solved, partial, failed, pending |
| before_photos | JSON | - | N | - | 处理前照片 |
| after_photos | JSON | - | N | - | 处理后照片 |
| materials_used | JSON | - | N | - | 使用材料清单 |
| cost_amount | DECIMAL | 10,2 | N | - | 费用金额 |
| need_followup | BOOLEAN | - | Y | false | 是否需要跟进 |
| followup_reason | TEXT | - | N | - | 跟进原因 |
| followup_date | TIMESTAMP | - | N | - | 跟进日期 |
| quality_check | JSON | - | N | - | 质量检查结果 |
| notes | TEXT | - | N | - | 备注信息 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
KEY idx_workorder_id (workorder_id)
KEY idx_processor_id (processor_id)
KEY idx_created_at (created_at)
FOREIGN KEY fk_workorder_id (workorder_id) REFERENCES rp_workorders(id)
FOREIGN KEY fk_processor_id (processor_id) REFERENCES rp_users(id)
```

### 2.6 文件附件表 (rp_files)

**表说明**: 系统文件附件表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 文件唯一标识 |
| filename | VARCHAR | 255 | Y | - | 文件名 |
| original_name | VARCHAR | 255 | Y | - | 原始文件名 |
| file_path | VARCHAR | 500 | Y | - | 文件路径 |
| file_url | VARCHAR | 500 | Y | - | 文件访问URL |
| thumbnail_url | VARCHAR | 500 | N | - | 缩略图URL |
| file_size | BIGINT | - | Y | - | 文件大小(字节) |
| mime_type | VARCHAR | 100 | Y | - | MIME类型 |
| file_type | ENUM | - | Y | - | 文件类型: image, video, document, audio |
| category | VARCHAR | 50 | Y | - | 文件分类 |
| related_type | VARCHAR | 50 | N | - | 关联类型 |
| related_id | VARCHAR | 50 | N | - | 关联ID |
| storage_type | ENUM | - | Y | local | 存储类型: local, oss, cos |
| storage_info | JSON | - | N | - | 存储详细信息 |
| upload_ip | VARCHAR | 45 | N | - | 上传IP |
| uploaded_by | UUID | - | Y | - | 上传人ID |
| is_deleted | BOOLEAN | - | Y | false | 是否删除 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |
| deleted_at | TIMESTAMP | - | N | - | 删除时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
KEY idx_related (related_type, related_id)
KEY idx_file_type (file_type)
KEY idx_category (category)
KEY idx_uploaded_by (uploaded_by)
KEY idx_created_at (created_at)
FOREIGN KEY fk_uploaded_by (uploaded_by) REFERENCES rp_users(id)
```

### 2.7 GPS轨迹表 (rp_gps_tracks)

**表说明**: GPS轨迹记录表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 轨迹点ID |
| track_id | UUID | - | Y | - | 轨迹ID |
| user_id | UUID | - | Y | - | 用户ID |
| latitude | DECIMAL | 10,8 | Y | - | 纬度 |
| longitude | DECIMAL | 11,8 | Y | - | 经度 |
| altitude | DECIMAL | 8,2 | N | - | 海拔高度 |
| accuracy | DECIMAL | 8,2 | N | - | 定位精度 |
| bearing | DECIMAL | 6,2 | N | - | 方向角 |
| speed | DECIMAL | 8,2 | N | - | 速度(m/s) |
| activity_type | ENUM | - | Y | patrol | 活动类型: patrol, transit, rest |
| battery_level | INT | - | N | - | 电量百分比 |
| network_type | VARCHAR | 20 | N | - | 网络类型 |
| recorded_at | TIMESTAMP | - | Y | - | 记录时间 |
| uploaded_at | TIMESTAMP | - | Y | NOW() | 上传时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
KEY idx_track_id (track_id)
KEY idx_user_id (user_id)
KEY idx_location (latitude, longitude)
KEY idx_recorded_at (recorded_at)
FOREIGN KEY fk_user_id (user_id) REFERENCES rp_users(id)
```

### 2.8 消息通知表 (rp_notifications)

**表说明**: 系统消息通知表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 消息ID |
| recipient_id | UUID | - | Y | - | 接收人ID |
| sender_id | UUID | - | N | - | 发送人ID |
| type | ENUM | - | Y | - | 消息类型: system, workorder, reminder, announcement |
| priority | ENUM | - | Y | normal | 优先级: urgent, high, normal, low |
| title | VARCHAR | 200 | Y | - | 消息标题 |
| content | TEXT | - | Y | - | 消息内容 |
| data | JSON | - | N | - | 扩展数据 |
| channels | JSON | - | Y | - | 推送渠道: app, sms, email |
| is_read | BOOLEAN | - | Y | false | 是否已读 |
| read_at | TIMESTAMP | - | N | - | 阅读时间 |
| is_sent | BOOLEAN | - | Y | false | 是否已发送 |
| sent_at | TIMESTAMP | - | N | - | 发送时间 |
| scheduled_at | TIMESTAMP | - | N | - | 定时发送时间 |
| expires_at | TIMESTAMP | - | N | - | 过期时间 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |

**索引设计**:
```sql
PRIMARY KEY (id)
KEY idx_recipient_id (recipient_id)
KEY idx_type (type)
KEY idx_is_read (is_read)
KEY idx_created_at (created_at)
FOREIGN KEY fk_recipient_id (recipient_id) REFERENCES rp_users(id)
FOREIGN KEY fk_sender_id (sender_id) REFERENCES rp_users(id)
```

## 3. 系统配置表

### 3.1 系统配置表 (rp_system_configs)

**表说明**: 系统配置参数表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 配置ID |
| config_key | VARCHAR | 100 | Y | - | 配置键 |
| config_value | TEXT | - | N | - | 配置值 |
| config_type | ENUM | - | Y | string | 数据类型: string, number, boolean, json |
| category | VARCHAR | 50 | Y | - | 配置分类 |
| description | VARCHAR | 500 | N | - | 配置说明 |
| is_encrypted | BOOLEAN | - | Y | false | 是否加密 |
| is_editable | BOOLEAN | - | Y | true | 是否可编辑 |
| sort_order | INT | - | Y | 0 | 排序序号 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |

### 3.2 数据字典表 (rp_dictionaries)

**表说明**: 系统数据字典表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | UUID | - | Y | - | 字典项ID |
| dict_type | VARCHAR | 50 | Y | - | 字典类型 |
| dict_code | VARCHAR | 50 | Y | - | 字典编码 |
| dict_value | VARCHAR | 200 | Y | - | 字典值 |
| dict_label | VARCHAR | 100 | Y | - | 字典标签 |
| parent_code | VARCHAR | 50 | N | - | 父级编码 |
| sort_order | INT | - | Y | 0 | 排序序号 |
| css_class | VARCHAR | 100 | N | - | CSS样式类 |
| list_class | VARCHAR | 100 | N | - | 列表样式类 |
| is_default | BOOLEAN | - | Y | false | 是否默认 |
| is_active | BOOLEAN | - | Y | true | 是否启用 |
| remark | VARCHAR | 500 | N | - | 备注 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | Y | NOW() | 更新时间 |

## 4. 日志审计表

### 4.1 操作日志表 (rp_operation_logs)

**表说明**: 用户操作日志表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | BIGINT | - | Y | - | 日志ID(自增) |
| user_id | UUID | - | N | - | 操作用户ID |
| username | VARCHAR | 50 | N | - | 用户名 |
| operation | VARCHAR | 100 | Y | - | 操作类型 |
| method | VARCHAR | 10 | Y | - | 请求方法 |
| request_url | VARCHAR | 500 | Y | - | 请求URL |
| request_ip | VARCHAR | 45 | Y | - | 请求IP |
| request_params | JSON | - | N | - | 请求参数 |
| response_data | JSON | - | N | - | 响应数据 |
| user_agent | VARCHAR | 1000 | N | - | 用户代理 |
| status | INT | - | Y | - | 响应状态码 |
| error_message | TEXT | - | N | - | 错误信息 |
| execution_time | INT | - | Y | - | 执行时长(ms) |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |

**分区策略**:
```sql
-- 按月分区
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at))
```

### 4.2 系统日志表 (rp_system_logs)

**表说明**: 系统运行日志表

| 字段名 | 数据类型 | 长度 | 是否必填 | 默认值 | 说明 |
|--------|----------|------|----------|--------|------|
| id | BIGINT | - | Y | - | 日志ID(自增) |
| level | ENUM | - | Y | - | 日志级别: DEBUG, INFO, WARN, ERROR, FATAL |
| logger | VARCHAR | 200 | Y | - | 日志记录器 |
| message | TEXT | - | Y | - | 日志消息 |
| exception | TEXT | - | N | - | 异常信息 |
| thread | VARCHAR | 100 | N | - | 线程名称 |
| server_name | VARCHAR | 100 | N | - | 服务器名称 |
| server_ip | VARCHAR | 45 | N | - | 服务器IP |
| trace_id | VARCHAR | 64 | N | - | 链路追踪ID |
| extra_data | JSON | - | N | - | 额外数据 |
| created_at | TIMESTAMP | - | Y | NOW() | 创建时间 |

## 5. 数据类型说明

### 5.1 ENUM类型定义

#### 用户状态 (user_status)
```sql
ENUM('active', 'inactive', 'suspended', 'pending')
```

#### 工单状态 (workorder_status)  
```sql
ENUM('pending', 'assigned', 'in_progress', 'completed', 'closed', 'rejected')
```

#### 优先级 (priority)
```sql
ENUM('urgent', 'high', 'normal', 'low')
```

#### 问题分类 (problem_category)
```sql
ENUM('garbage', 'facility', 'violation', 'water')
```

#### 文件类型 (file_type)
```sql
ENUM('image', 'video', 'document', 'audio')
```

### 5.2 JSON字段说明

#### 权限列表 (permissions)
```json
{
  \"modules\": [\"workorder\", \"user\", \"report\"],
  \"actions\": [\"create\", \"read\", \"update\", \"delete\"],
  \"resources\": [\"own\", \"department\", \"all\"]
}
```

#### 位置信息 (location_info)
```json
{
  \"address\": \"详细地址\",
  \"latitude\": 39.9042,
  \"longitude\": 116.4074,
  \"accuracy\": 5.0,
  \"province\": \"北京市\",
  \"city\": \"北京市\",
  \"district\": \"朝阳区\"
}
```

#### 文件列表 (file_list)
```json
[
  {
    \"id\": \"file-uuid\",
    \"url\": \"https://cdn.example.com/file.jpg\",
    \"thumbnail\": \"https://cdn.example.com/thumb.jpg\",
    \"size\": 1024000,
    \"type\": \"image/jpeg\"
  }
]
```

## 6. 索引优化建议

### 6.1 查询优化索引
- **工单查询**: 状态 + 分类 + 创建时间的复合索引
- **地理查询**: 经纬度的空间索引 (SPATIAL INDEX)
- **用户查询**: 部门 + 状态的复合索引
- **日志查询**: 用户ID + 时间范围的复合索引

### 6.2 分区表设计
- **日志表**: 按月分区，提高查询性能
- **轨迹表**: 按日期分区，便于数据归档
- **大表拆分**: 超过1000万记录考虑分库分表

## 7. 数据迁移脚本

### 7.1 初始化脚本
```sql
-- 创建数据库
CREATE DATABASE riverpatrol CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'rp_user'@'%' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON riverpatrol.* TO 'rp_user'@'%';

-- 初始化基础数据
INSERT INTO rp_roles (id, name, code, description, level) VALUES
('system-admin-uuid', '系统管理员', 'SYSTEM_ADMIN', '系统管理员角色', 1),
('business-manager-uuid', '业务主管', 'BUSINESS_MANAGER', '业务主管角色', 2),
('patrol-user-uuid', '巡查员', 'PATROL_USER', '巡查员角色', 3);
```

### 7.2 升级脚本示例
```sql
-- v1.1 升级脚本
ALTER TABLE rp_workorders ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0 COMMENT '预估成本';
ALTER TABLE rp_workorders ADD INDEX idx_estimated_cost (estimated_cost);

-- 数据迁移
UPDATE rp_workorders SET estimated_cost = 0 WHERE estimated_cost IS NULL;
```

---

**文档版本**: v1.0  
**最后更新**: 2024-01-20  
**维护团队**: 数据库设计团队  
**审批状态**: 待审批