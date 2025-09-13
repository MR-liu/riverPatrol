# 智慧河道监控系统数据库文档

## 概述

智慧河道监控系统是一套完整的河道监控解决方案，包含告警管理、工单处理、设备监控、用户管理、权限控制等核心功能。

**系统版本**: 3.3  
**数据库类型**: PostgreSQL (Supabase)  
**更新日期**: 2025-01-10  
**架构特点**: 
- 基于RLS（行级安全）的权限控制
- 完整的业务流程闭环
- 支持移动端和Web端
- GIS地理信息集成
- 实时数据分析

## 系统架构

### 核心模块
1. **用户认证系统** - 用户管理、角色权限、会话控制
2. **告警管理系统** - AI告警、人工确认、状态流转
3. **工单管理系统** - 工单创建、分配、处理、审核
4. **设备监控系统** - 设备状态、心跳监测、故障管理
5. **问题上报系统** - 移动端上报、审核处理
6. **区域管理系统** - 河道区域、维护团队管理
7. **数据分析系统** - 统计报表、业务看板
8. **通知推送系统** - 实时通知、消息队列

---

## 数据表详细说明

### 1. 基础管理表

#### 1.1 用户表 (users)
**描述**: 系统用户基本信息表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 用户唯一标识 |
| username | VARCHAR(50) | UNIQUE NOT NULL | 登录用户名 |
| password | VARCHAR(255) | NOT NULL | 密码哈希(SHA256) |
| name | VARCHAR(100) | NOT NULL | 用户真实姓名 |
| phone | VARCHAR(20) | | 手机号码 |
| email | VARCHAR(100) | | 邮箱地址 |
| avatar | VARCHAR(255) | | 头像URL |
| role_id | VARCHAR(20) | NOT NULL FK | 关联角色ID |
| department_id | VARCHAR(20) | FK | 关联部门ID |
| status | user_status | DEFAULT 'active' | 用户状态(active/inactive/suspended) |
| login_attempts | INTEGER | DEFAULT 0 | 登录失败次数 |
| last_login_attempt | TIMESTAMP | | 最后登录尝试时间 |
| last_login_at | TIMESTAMP | | 最后成功登录时间 |
| password_changed_at | TIMESTAMP | | 密码修改时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**索引**:
- `idx_users_username` - 用户名查询
- `idx_users_status` - 状态查询(仅活跃用户)
- `idx_users_role_id` - 角色查询
- `idx_users_department_id` - 部门查询

#### 1.2 角色表 (roles)
**描述**: 系统角色定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 角色唯一标识 |
| name | VARCHAR(50) | NOT NULL | 角色名称 |
| code | VARCHAR(30) | UNIQUE NOT NULL | 角色编码 |
| role_code | VARCHAR(10) | FK | 角色代码(R002/R003/R004/R005/R006/SysAdmin) |
| description | TEXT | | 角色描述 |
| is_system | BOOLEAN | DEFAULT false | 是否系统角色 |
| sort_order | INTEGER | DEFAULT 0 | 排序顺序 |
| status | dict_status | DEFAULT 'active' | 角色状态 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**系统预定义角色**:
- **SysAdmin**: 系统管理员 - 最高权限，管理全局配置与用户，可强制干预任何流程
- **R002**: 监控中心主管 - AI告警与人工告警的审核者，AI工单的创建者与最终关闭者
- **R003**: 河道维护员 - 工单的执行者，负责现场处理问题并反馈结果
- **R004**: 河道巡检员 - 人工告警的发起者与最终确认关闭者，人工工单优先级的设定者
- **R005**: 领导看板用户 - 数据监督、决策支持
- **R005**: 领导看板用户 - 数据监督、决策支持
- **R006**: 区域管理员 - 区域"调度员"，负责接收、分派和审核本区域内的工单

#### 1.3 权限表 (permissions)
**描述**: 系统权限定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 权限唯一标识 |
| module | VARCHAR(50) | NOT NULL | 权限模块 |
| code | VARCHAR(100) | UNIQUE NOT NULL | 权限代码 |
| name | VARCHAR(100) | NOT NULL | 权限名称 |
| description | TEXT | | 权限描述 |
| sort_order | INTEGER | DEFAULT 0 | 排序顺序 |
| status | dict_status | DEFAULT 'active' | 权限状态 |

**权限模块**:
1. **alarm_management** - 告警管理 (8个权限点)
2. **workorder_management** - 工单管理 (14个权限点)
3. **user_management** - 用户管理 (8个权限点)
4. **data_analytics** - 数据分析 (5个权限点)
5. **gis_center** - GIS中心 (5个权限点)
6. **mobile_functions** - 移动端功能 (6个权限点)
7. **system_management** - 系统管理 (7个权限点)
8. **dashboard** - 数据看板 (3个权限点)
9. **area_management** - 区域管理 (4个权限点)
10. **device_management** - 设备管理 (5个权限点)

#### 1.4 部门表 (departments)
**描述**: 组织部门表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 部门唯一标识 |
| name | VARCHAR(100) | NOT NULL | 部门名称 |
| code | VARCHAR(50) | | 部门编码 |
| parent_id | VARCHAR(20) | FK | 上级部门ID |
| type | VARCHAR(50) | | 部门类型 |
| region | VARCHAR(50) | | 所属区域 |
| level | INTEGER | DEFAULT 1 | 部门层级 |
| sort_order | INTEGER | DEFAULT 0 | 排序顺序 |
| description | TEXT | | 部门描述 |
| status | dict_status | DEFAULT 'active' | 部门状态 |

### 2. 设备监控表

#### 2.1 监控点表 (monitoring_points)
**描述**: 监控点位信息表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 监控点唯一标识 |
| name | VARCHAR(100) | NOT NULL | 监控点名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 监控点编码 |
| river_name | VARCHAR(100) | | 河道名称 |
| river_section | VARCHAR(100) | | 河道段落 |
| longitude | DECIMAL(10,7) | NOT NULL | 经度 |
| latitude | DECIMAL(10,7) | NOT NULL | 纬度 |
| address | TEXT | | 详细地址 |
| department_id | VARCHAR(20) | FK | 所属部门 |
| region | VARCHAR(50) | | 所属区域 |
| river_id | VARCHAR(20) | FK | 关联河道ID |
| gis_coordinates | JSONB | | GIS坐标信息 |
| installation_height | DECIMAL(6,2) | | 安装高度(米) |
| monitoring_range | DECIMAL(8,2) | | 监控范围(米) |
| monitoring_angle | INTEGER | | 监控角度(度) |
| description | TEXT | | 描述说明 |
| status | dict_status | DEFAULT 'active' | 监控点状态 |

#### 2.2 设备类型表 (device_types)
**描述**: 设备类型定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 设备类型ID |
| name | VARCHAR(100) | NOT NULL | 类型名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 类型编码 |
| category | VARCHAR(50) | | 设备类别 |
| heartbeat_interval | INTEGER | DEFAULT 5 | 心跳间隔(分钟) |
| description | TEXT | | 类型描述 |

**预定义设备类型**:
- **DT_001**: 高清摄像头 - 5分钟心跳间隔
- **DT_002**: 球机摄像头 - 5分钟心跳间隔  
- **DT_003**: 热成像摄像头 - 5分钟心跳间隔
- **DT_004**: 水位传感器 - 10分钟心跳间隔
- **DT_005**: 水质传感器 - 15分钟心跳间隔
- **DT_006**: 流速传感器 - 10分钟心跳间隔
- **DT_007**: 气象站 - 30分钟心跳间隔
- **DT_008**: AI分析服务器 - 5分钟心跳间隔
- **DT_009**: 边缘计算盒 - 5分钟心跳间隔
- **DT_010**: 网络设备 - 5分钟心跳间隔

#### 2.3 设备表 (devices)
**描述**: 监控设备信息表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 设备唯一标识 |
| name | VARCHAR(100) | NOT NULL | 设备名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 设备编码 |
| type_id | VARCHAR(20) | NOT NULL FK | 设备类型ID |
| point_id | VARCHAR(20) | NOT NULL FK | 监控点ID |
| brand | VARCHAR(50) | | 设备品牌 |
| model | VARCHAR(50) | | 设备型号 |
| serial_number | VARCHAR(100) | | 序列号 |
| ip_address | INET | | IP地址 |
| port | INTEGER | | 端口号 |
| rtsp_url | VARCHAR(255) | | RTSP流地址 |
| status | device_status | DEFAULT 'offline' | 设备状态(online/offline/fault/maintenance) |
| install_date | DATE | | 安装日期 |
| warranty_date | DATE | | 保修到期日期 |
| last_heartbeat | TIMESTAMP | | 最后心跳时间 |
| maintenance_by | VARCHAR(20) | FK | 维护负责人 |
| gis_coordinates | JSONB | | GIS坐标 |
| altitude | DECIMAL(8,2) | | 海拔高度 |
| azimuth | DECIMAL(5,2) | | 方位角 |
| tilt_angle | DECIMAL(5,2) | | 倾斜角 |
| zoom_level | INTEGER | | 变焦级别 |
| network_config | JSONB | | 网络配置 |
| stream_urls | JSONB | | 视频流地址 |
| ptz_support | BOOLEAN | DEFAULT false | 云台控制支持 |
| night_vision | BOOLEAN | DEFAULT false | 夜视功能支持 |

### 3. 告警管理表

#### 3.1 告警类型表 (alarm_types)
**描述**: 告警类型定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 告警类型ID |
| name | VARCHAR(100) | NOT NULL | 类型名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 类型编码 |
| category | VARCHAR(50) | | 告警类别 |
| description | TEXT | | 类型描述 |

**预定义告警类型**:
- **AT_001**: 设备离线 (device)
- **AT_002**: 设备故障 (device)
- **AT_003**: 水位异常 (environment)
- **AT_004**: 水质异常 (environment)
- **AT_005**: 垃圾漂浮 (environment)
- **AT_006**: 非法排放 (violation)
- **AT_007**: 非法捕捞 (violation)
- **AT_008**: 非法倾倒 (violation)
- **AT_009**: 堤防损坏 (infrastructure)
- **AT_010**: 异常人员 (security)

#### 3.2 告警级别表 (alarm_levels)
**描述**: 告警级别定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 告警级别ID |
| name | VARCHAR(50) | NOT NULL | 级别名称 |
| code | VARCHAR(30) | NOT NULL UNIQUE | 级别编码 |
| priority | INTEGER | NOT NULL | 优先级数字 |
| color | VARCHAR(20) | | 显示颜色 |
| description | TEXT | | 级别描述 |

**预定义告警级别**:
- **AL_001**: 紧急 (critical) - 优先级1，#FF0000
- **AL_002**: 重要 (major) - 优先级2，#FF9900
- **AL_003**: 警告 (warning) - 优先级3，#FFCC00
- **AL_004**: 提示 (info) - 优先级4，#0099FF

#### 3.3 告警表 (alarms)
**描述**: 告警记录主表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 告警唯一标识 |
| type_id | VARCHAR(20) | NOT NULL FK | 告警类型ID |
| level_id | VARCHAR(20) | NOT NULL FK | 告警级别ID |
| device_id | VARCHAR(20) | FK | 设备ID |
| point_id | VARCHAR(20) | NOT NULL FK | 监控点ID |
| title | VARCHAR(200) | NOT NULL | 告警标题 |
| description | TEXT | | 告警描述 |
| confidence | DECIMAL(3,2) | DEFAULT 1.0 | 置信度(0-1) |
| image_url | VARCHAR(255) | | 告警图片URL |
| video_url | VARCHAR(255) | | 告警视频URL |
| coordinates | JSONB | | 告警位置坐标 |
| status | alarm_status | DEFAULT 'pending' | 告警状态 |
| source_type | VARCHAR(20) | DEFAULT 'ai' | 告警来源(ai/manual) |
| reporter_id | VARCHAR(20) | FK | 人工告警发起人(R004) |
| initial_priority | priority_level | | 初始优先级 |
| audit_status | VARCHAR(20) | | 审核状态 |
| auditor_id | VARCHAR(20) | FK | 审核人(R002) |
| audit_time | TIMESTAMP | | 审核时间 |
| audit_note | TEXT | | 审核备注 |
| confirmed_by | VARCHAR(20) | FK | 确认人 |
| confirmed_at | TIMESTAMP | | 确认时间 |
| resolved_by | VARCHAR(20) | FK | 处理人 |
| resolved_at | TIMESTAMP | | 处理时间 |
| resolution_note | TEXT | | 处理说明 |
| department_id | VARCHAR(20) | FK | 所属部门 |
| region_code | VARCHAR(20) | | 区域编码 |
| is_public | BOOLEAN | DEFAULT false | 是否公开 |
| priority_index | INTEGER | DEFAULT 0 | 优先级索引 |

**告警状态流转**:
- **AI告警**: `pending` → `审核(R002)` → `confirmed`/`false_alarm` → `processing` → `resolved`
- **人工告警**: `pending` → `审核(R002)` → `confirmed` → `processing` → `resolved`

### 4. 工单管理表

#### 4.1 工单类型表 (workorder_types)
**描述**: 工单类型定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 工单类型ID |
| name | VARCHAR(100) | NOT NULL | 类型名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 类型编码 |
| category | VARCHAR(50) | | 工单类别 |
| sla_hours | INTEGER | DEFAULT 24 | SLA时长(小时) |
| description | TEXT | | 类型描述 |

**预定义工单类型**:
- **WT_001**: 告警处理 - 4小时SLA
- **WT_002**: 设备维修 - 24小时SLA
- **WT_003**: 设备巡检 - 72小时SLA
- **WT_004**: 河道清理 - 48小时SLA
- **WT_005**: 水质处理 - 24小时SLA
- **WT_006**: 违法处置 - 12小时SLA
- **WT_007**: 基础设施维修 - 48小时SLA
- **WT_008**: 应急处置 - 2小时SLA
- **WT_009**: 问题核查 - 24小时SLA
- **WT_010**: 其他 - 72小时SLA

#### 4.2 工单表 (workorders)
**描述**: 工单主表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(30) | PRIMARY KEY | 工单唯一标识 |
| type_id | VARCHAR(20) | NOT NULL FK | 工单类型ID |
| alarm_id | VARCHAR(20) | FK | 关联告警ID |
| report_id | VARCHAR(20) | FK | 关联问题报告ID |
| title | VARCHAR(200) | NOT NULL | 工单标题 |
| description | TEXT | | 工单描述 |
| priority | priority_level | DEFAULT 'normal' | 优先级(urgent/important/normal) |
| status | workorder_status | DEFAULT 'pending' | 工单状态 |
| sla_status | sla_status | DEFAULT 'active' | SLA状态 |
| department_id | VARCHAR(20) | FK | 所属部门 |
| point_id | VARCHAR(20) | FK | 监控点ID |
| area_id | VARCHAR(20) | FK | 管理区域ID |
| river_id | VARCHAR(20) | FK | 关联河道ID(直接关联) |
| location | VARCHAR(255) | | 位置描述 |
| coordinates | JSONB | | 位置坐标 |
| creator_id | VARCHAR(20) | NOT NULL FK | 创建人 |
| assignee_id | VARCHAR(20) | FK | 处理人 |
| workorder_source | VARCHAR(20) | DEFAULT 'ai' | 工单来源(ai/manual/system) |
| initial_reporter_id | VARCHAR(20) | FK | 初始告警发起人(R004) |
| dispatcher_id | VARCHAR(20) | FK | 分派人(R006) |
| dispatched_at | TIMESTAMP | | 分派时间 |
| current_handler_id | VARCHAR(20) | FK | 当前处理人 |
| area_reviewer_id | VARCHAR(20) | FK | 区域审核人(R006) |
| area_reviewed_at | TIMESTAMP | | 区域审核时间 |
| area_review_note | TEXT | | 区域审核备注 |
| final_reviewer_id | VARCHAR(20) | FK | 最终审核人(R002) |
| final_reviewed_at | TIMESTAMP | | 最终审核时间 |
| final_review_note | TEXT | | 最终审核备注 |
| reporter_confirmed_at | TIMESTAMP | | 发起人确认时间 |
| reporter_confirm_note | TEXT | | 发起人确认备注 |
| reporter_confirm_result | VARCHAR(20) | | 确认结果(confirmed/rejected/timeout) |
| timeout_intervener_id | VARCHAR(20) | FK | 超时介入人(R006) |
| timeout_intervened_at | TIMESTAMP | | 超时介入时间 |
| reject_count | INTEGER | DEFAULT 0 | 拒绝次数 |
| is_reassigned | BOOLEAN | DEFAULT false | 是否重新分派 |
| reassign_reason | TEXT | | 重新分派原因 |
| updated_by | VARCHAR(20) | FK | 更新人 |
| supervisor_id | VARCHAR(20) | FK | 主管 |
| reviewer_id | VARCHAR(20) | FK | 审核人 |
| source | VARCHAR(50) | | 工单来源 |
| is_resubmit | BOOLEAN | DEFAULT false | 是否重新提交 |
| estimated_cost | DECIMAL(10,2) | | 预估成本 |
| assigned_at | TIMESTAMP | | 分配时间 |
| started_at | TIMESTAMP | | 开始处理时间 |
| expected_complete_at | TIMESTAMP | | 预期完成时间 |
| completed_at | TIMESTAMP | | 完成时间 |
| reviewed_at | TIMESTAMP | | 审核时间 |

**工单状态流转**:
- **AI工单**: `pending` → `pending_dispatch` → `dispatched` → `processing` → `pending_review`(R006) → `pending_final_review`(R002) → `completed`
- **人工工单**: `pending` → `pending_dispatch` → `dispatched` → `processing` → `pending_review`(R006) → `pending_reporter_confirm`(R004) → `completed`
- **拒绝流程**: `dispatched` → `rejected` → `pending_dispatch`(重新分派，无次数限制)
- **驳回流程**: `pending_final_review` → `pending_dispatch`(R002驳回) / `confirmed_failed` → `pending_dispatch`(R004确认失败)

#### 4.3 工单结果表 (workorder_results)
**描述**: 工单处理结果表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 结果记录ID |
| workorder_id | VARCHAR(30) | NOT NULL FK | 工单ID |
| processor_id | VARCHAR(20) | NOT NULL FK | 处理人ID |
| before_photos | JSONB | | 处理前照片 |
| after_photos | JSONB | | 处理后照片 |
| process_method | TEXT | NOT NULL | 处理方法 |
| process_result | TEXT | NOT NULL | 处理结果 |
| process_duration | INTEGER | | 处理耗时(分钟) |
| need_followup | BOOLEAN | DEFAULT FALSE | 是否需要后续跟进 |
| followup_reason | TEXT | | 跟进原因 |
| location_info | JSONB | | 位置信息 |
| device_info | JSONB | | 设备信息 |
| review_status | VARCHAR(50) | | 审核状态 |
| submitted_at | TIMESTAMP | DEFAULT NOW() | 提交时间 |
| reviewed_by | VARCHAR(20) | FK | 审核人 |
| reviewed_at | TIMESTAMP | | 审核时间 |
| review_note | TEXT | | 审核备注 |

### 5. 问题上报表

#### 5.1 问题类别表 (problem_categories)
**描述**: 问题报告分类表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 类别ID |
| name | VARCHAR(100) | NOT NULL | 类别名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 类别编码 |
| parent_id | VARCHAR(20) | FK | 父类别ID |
| icon | VARCHAR(50) | | 图标名称 |
| color | VARCHAR(20) | | 显示颜色 |
| sort_order | INTEGER | DEFAULT 0 | 排序顺序 |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |

**预定义问题类别**:
- **PC_001**: 水质问题 - #0099FF
- **PC_002**: 垃圾污染 - #FF9900
- **PC_003**: 违法行为 - #FF0000
- **PC_004**: 设施损坏 - #FFCC00
- **PC_005**: 生态破坏 - #00CC66
- **PC_006**: 安全隐患 - #FF3366
- **PC_007**: 其他问题 - #999999

#### 5.2 问题报告表 (problem_reports)
**描述**: 问题报告主表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 报告唯一标识 |
| title | VARCHAR(200) | NOT NULL | 报告标题 |
| description | TEXT | NOT NULL | 问题描述 |
| category_ids | JSONB | NOT NULL | 问题类别ID数组 |
| images | JSONB | | 图片URL数组 |
| videos | JSONB | | 视频URL数组 |
| audio_url | VARCHAR(255) | | 音频URL |
| location | VARCHAR(255) | | 位置描述 |
| coordinates | JSONB | | 位置坐标 |
| reporter_id | VARCHAR(20) | NOT NULL FK | 上报人ID |
| department_id | VARCHAR(20) | FK | 处理部门 |
| status | VARCHAR(20) | DEFAULT 'pending' | 报告状态 |
| severity | VARCHAR(20) | | 严重程度 |
| anonymous | BOOLEAN | DEFAULT false | 是否匿名 |
| verified | BOOLEAN | DEFAULT false | 是否已验证 |
| verified_by | VARCHAR(20) | FK | 验证人 |
| verified_at | TIMESTAMP | | 验证时间 |
| resolved_by | VARCHAR(20) | FK | 处理人 |
| resolved_at | TIMESTAMP | | 处理时间 |
| resolution | TEXT | | 处理结果 |

### 6. 区域管理表

#### 6.1 河道管理区域表 (river_management_areas)
**描述**: 河道管理区域定义表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 区域ID |
| name | VARCHAR(100) | NOT NULL | 区域名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 区域编码 |
| supervisor_id | VARCHAR(20) | FK | 区域负责人 |
| monitoring_point_ids | JSONB | | 监控点ID数组 |
| device_ids | JSONB | | 设备ID数组 |
| boundary_coordinates | JSONB | | 边界坐标 |
| center_coordinates | JSONB | | 中心坐标 |
| area_type | VARCHAR(50) | | 区域类型 |
| risk_level | VARCHAR(20) | | 风险等级 |
| maintenance_schedule | JSONB | | 维护计划 |
| special_requirements | TEXT | | 特殊要求 |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |

#### 6.2 河道表 (rivers)
**描述**: 区域下的具体河道信息表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 河道ID |
| area_id | VARCHAR(20) | NOT NULL FK | 所属区域ID |
| name | VARCHAR(100) | NOT NULL | 河道名称 |
| code | VARCHAR(50) | NOT NULL UNIQUE | 河道编码 |
| river_type | VARCHAR(50) | | 河道类型 |
| length_km | DECIMAL(10,2) | | 河道长度(公里) |
| width_m | DECIMAL(8,2) | | 平均宽度(米) |
| start_coordinates | JSONB | | 起点坐标 |
| end_coordinates | JSONB | | 终点坐标 |
| centerline_coordinates | JSONB | | 中心线坐标(GIS) |
| boundary_coordinates | JSONB | | 边界坐标(GIS) |
| water_level_normal | DECIMAL(6,2) | | 正常水位 |
| water_level_warning | DECIMAL(6,2) | | 警戒水位 |
| water_level_danger | DECIMAL(6,2) | | 危险水位 |
| flow_direction | VARCHAR(10) | | 流向 |
| description | TEXT | | 河道描述 |
| maintenance_level | VARCHAR(20) | | 维护等级 |
| risk_assessment | VARCHAR(50) | | 风险评估 |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |

#### 6.3 维护团队表 (maintenance_teams)
**描述**: 区域维护团队信息表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 团队记录ID |
| area_id | VARCHAR(20) | NOT NULL FK | 管理区域ID |
| supervisor_id | VARCHAR(20) | NOT NULL FK | 主管ID |
| worker_id | VARCHAR(20) | NOT NULL FK | 工作人员ID |
| team_name | VARCHAR(100) | | 团队名称 |
| position | VARCHAR(50) | | 职位 |
| specialties | JSONB | | 专业技能 |
| certification_level | VARCHAR(50) | | 认证等级 |
| max_concurrent_orders | INTEGER | DEFAULT 3 | 最大并行工单数 |
| current_workload | INTEGER | DEFAULT 0 | 当前工作负载 |
| is_available | BOOLEAN | DEFAULT true | 是否可用 |
| is_emergency_responder | BOOLEAN | DEFAULT false | 是否应急响应员 |
| performance_score | DECIMAL(3,2) | | 绩效评分 |

#### 6.4 区域主管权限表 (area_supervisor_permissions)
**描述**: 区域主管权限管理表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 权限记录ID |
| area_id | VARCHAR(20) | NOT NULL FK | 管理区域ID |
| supervisor_id | VARCHAR(20) | NOT NULL FK | 主管用户ID |
| permission_scope | JSONB | NOT NULL | 权限范围配置 |
| can_assign_workorders | BOOLEAN | DEFAULT true | 是否可分配工单 |
| can_approve_workorders | BOOLEAN | DEFAULT true | 是否可审批工单 |
| can_reject_workorders | BOOLEAN | DEFAULT true | 是否可拒绝工单 |
| can_manage_devices | BOOLEAN | DEFAULT false | 是否可管理设备 |
| can_manage_users | BOOLEAN | DEFAULT false | 是否可管理用户 |
| approval_limit_amount | DECIMAL(10,2) | | 审批金额限制 |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |
| effective_date | DATE | NOT NULL | 生效日期 |
| expiry_date | DATE | | 过期日期 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |
| created_by | VARCHAR(20) | FK | 创建人 |

**业务规则**:
- 每个区域的主管权限记录唯一 (UNIQUE 约束)
- 支持权限时效管理，过期权限自动失效
- 权限变更时旧记录保留作为历史审计

#### 6.5 区域主管变更历史表 (area_supervisor_change_history)
**描述**: 区域主管变更历史记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 变更记录ID |
| area_id | VARCHAR(20) | NOT NULL FK | 管理区域ID |
| old_supervisor_id | VARCHAR(20) | FK | 原主管用户ID |
| new_supervisor_id | VARCHAR(20) | NOT NULL FK | 新主管用户ID |
| change_reason | TEXT | | 变更原因 |
| workorders_transferred | INTEGER | DEFAULT 0 | 转移的工单数量 |
| permissions_updated | BOOLEAN | DEFAULT false | 权限是否已更新 |
| change_date | TIMESTAMP | DEFAULT NOW() | 变更时间 |
| created_by | VARCHAR(20) | FK | 变更操作人 |

**业务用途**:
- 完整记录所有主管变更历史
- 支持变更影响分析（转移工单数量等）
- 提供审计追踪和合规支持

### 7. 新增业务表（v3.3）

#### 7.1 角色代码映射表 (role_code_mapping)
**描述**: 角色代码与系统角色的映射关系表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 映射记录ID |
| role_code | VARCHAR(10) | NOT NULL UNIQUE | 角色代码 |
| role_name | VARCHAR(50) | NOT NULL | 角色名称 |
| role_description | TEXT | | 角色描述 |
| permissions_summary | JSONB | | 权限摘要 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**预定义映射**:
- `R002` - 监控中心主管
- `R003` - 河道维护员
- `R004` - 河道巡检员
- `R006` - 区域管理员
- `SysAdmin` - 系统管理员

#### 7.2 工单拒绝记录表 (workorder_rejections)
**描述**: 工单拒绝历史记录表（支持无限次拒绝）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 拒绝记录ID |
| workorder_id | VARCHAR(30) | NOT NULL FK | 工单ID |
| rejector_id | VARCHAR(20) | NOT NULL FK | 拒绝人(R003) |
| reject_reason | TEXT | NOT NULL | 拒绝理由 |
| reject_time | TIMESTAMP | DEFAULT NOW() | 拒绝时间 |
| reject_sequence | INTEGER | NOT NULL | 第几次拒绝 |
| reassigned_to | VARCHAR(20) | FK | 重新分派给谁 |
| reassigned_by | VARCHAR(20) | FK | 重新分派人(R006) |
| reassigned_at | TIMESTAMP | | 重新分派时间 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 7.3 工单最终审核记录表 (workorder_final_reviews)
**描述**: 监控中心主管最终审核记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 审核记录ID |
| workorder_id | VARCHAR(30) | NOT NULL FK | 工单ID |
| reviewer_id | VARCHAR(20) | NOT NULL FK | 审核人(R002) |
| review_action | VARCHAR(20) | NOT NULL | 审核动作(approve/reject) |
| review_note | TEXT | | 审核备注 |
| review_time | TIMESTAMP | DEFAULT NOW() | 审核时间 |
| rollback_to_status | VARCHAR(50) | | 驳回后的目标状态 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 7.4 发起人确认记录表 (workorder_reporter_confirmations)
**描述**: 人工工单发起人现场确认记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 确认记录ID |
| workorder_id | VARCHAR(30) | NOT NULL FK | 工单ID |
| reporter_id | VARCHAR(20) | NOT NULL FK | 发起人(R004) |
| confirm_action | VARCHAR(20) | NOT NULL | 确认动作(confirm/reject) |
| confirm_note | TEXT | | 确认备注 |
| site_photos | JSONB | | 现场确认照片 |
| confirm_time | TIMESTAMP | DEFAULT NOW() | 确认时间 |
| is_timeout_intervention | BOOLEAN | DEFAULT false | 是否超时介入 |
| intervener_id | VARCHAR(20) | FK | 介入人(R006) |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

### 8. 扩展业务表

#### 8.1 工单协作表 (workorder_collaborations)
**描述**: 工单协作处理记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 协作记录ID |
| workorder_id | VARCHAR(30) | NOT NULL FK | 工单ID |
| primary_assignee_id | VARCHAR(20) | NOT NULL FK | 主要处理人 |
| collaborator_id | VARCHAR(20) | NOT NULL FK | 协作人员 |
| collaboration_type | VARCHAR(50) | | 协作类型 |
| task_description | TEXT | | 任务描述 |
| start_time | TIMESTAMP | | 开始时间 |
| end_time | TIMESTAMP | | 结束时间 |
| contribution_percentage | INTEGER | | 贡献百分比 |
| status | VARCHAR(50) | DEFAULT 'active' | 状态 |

#### 7.2 工单审核表 (workorder_reviews)
**描述**: 工单审核记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 审核记录ID |
| workorder_id | VARCHAR(30) | NOT NULL FK | 工单ID |
| reviewer_id | VARCHAR(20) | NOT NULL FK | 审核人ID |
| review_level | VARCHAR(50) | NOT NULL | 审核级别 |
| review_action | VARCHAR(50) | NOT NULL | 审核动作 |
| review_note | TEXT | | 审核意见 |
| requirements_met | JSONB | | 要求满足情况 |
| issues_found | JSONB | | 发现的问题 |
| quality_rating | INTEGER | | 质量评分 |
| review_started_at | TIMESTAMP | DEFAULT NOW() | 审核开始时间 |
| review_completed_at | TIMESTAMP | | 审核完成时间 |

#### 7.3 工单质量评估表 (workorder_quality_assessments)
**描述**: 工单质量评估表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 评估记录ID |
| workorder_id | VARCHAR(30) | NOT NULL UNIQUE FK | 工单ID |
| overall_quality_score | DECIMAL(3,2) | | 总体质量得分 |
| timeliness_score | DECIMAL(3,2) | | 及时性得分 |
| completeness_score | DECIMAL(3,2) | | 完整性得分 |
| safety_score | DECIMAL(3,2) | | 安全性得分 |
| supervisor_rating | INTEGER | | 主管评分 |
| final_reviewer_rating | INTEGER | | 最终审核员评分 |
| self_rating | INTEGER | | 自评分 |
| quality_dimensions | JSONB | | 质量维度详情 |
| improvement_suggestions | JSONB | | 改进建议 |
| best_practices_identified | JSONB | | 识别的最佳实践 |
| supervisor_feedback | TEXT | | 主管反馈 |
| final_reviewer_feedback | TEXT | | 最终审核员反馈 |
| assessed_at | TIMESTAMP | DEFAULT NOW() | 评估时间 |
| assessed_by | VARCHAR(20) | FK | 评估人 |

### 8. SLA监控表

#### 8.1 SLA配置表 (sla_configs)
**描述**: SLA服务水平协议配置表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 配置ID |
| name | VARCHAR(100) | NOT NULL | 配置名称 |
| workorder_type_id | VARCHAR(20) | FK | 工单类型ID |
| priority_level | priority_level | | 优先级 |
| response_time_minutes | INTEGER | NOT NULL | 响应时限(分钟) |
| resolution_time_minutes | INTEGER | NOT NULL | 解决时限(分钟) |
| escalation_time_minutes | INTEGER | | 升级时限(分钟) |
| warning_threshold_percentage | INTEGER | DEFAULT 80 | 警告阈值百分比 |
| business_hours_only | BOOLEAN | DEFAULT false | 仅工作时间 |
| exclude_holidays | BOOLEAN | DEFAULT true | 排除节假日 |
| notification_rules | JSONB | | 通知规则 |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |

#### 8.2 SLA监控表 (sla_monitoring)
**描述**: SLA监控记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 监控记录ID |
| workorder_id | VARCHAR(30) | NOT NULL UNIQUE FK | 工单ID |
| sla_config_id | VARCHAR(20) | NOT NULL FK | SLA配置ID |
| expected_response_time | TIMESTAMP | | 预期响应时间 |
| actual_response_time | TIMESTAMP | | 实际响应时间 |
| expected_resolution_time | TIMESTAMP | | 预期解决时间 |
| actual_resolution_time | TIMESTAMP | | 实际解决时间 |
| actual_response_time_minutes | INTEGER | | 实际响应耗时(分钟) |
| actual_process_time | INTEGER | | 实际处理耗时(分钟) |
| total_duration | INTEGER | | 总耗时(分钟) |
| response_sla_met | BOOLEAN | | 响应SLA是否满足 |
| process_sla_met | BOOLEAN | | 处理SLA是否满足 |
| resolution_sla_met | BOOLEAN | | 解决SLA是否满足 |
| overall_sla_met | BOOLEAN | | 整体SLA是否满足 |
| response_time_percentage | DECIMAL(5,2) | | 响应时间百分比 |
| resolution_time_percentage | DECIMAL(5,2) | | 解决时间百分比 |
| overall_sla_score | DECIMAL(5,2) | | 整体SLA得分 |
| breach_reasons | JSONB | | 违约原因 |
| mitigation_actions | JSONB | | 缓解措施 |
| monitoring_status | VARCHAR(50) | DEFAULT 'active' | 监控状态 |

### 9. 通知推送表

#### 9.1 通知队列表 (notification_queue)
**描述**: 系统通知队列表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 通知ID |
| user_id | VARCHAR(20) | FK | 目标用户ID |
| role_id | VARCHAR(20) | FK | 目标角色ID |
| department_id | VARCHAR(20) | FK | 目标部门ID |
| type | VARCHAR(50) | NOT NULL | 通知类型 |
| title | VARCHAR(200) | NOT NULL | 通知标题 |
| content | TEXT | NOT NULL | 通知内容 |
| priority | priority_level | DEFAULT 'normal' | 通知优先级 |
| related_type | VARCHAR(50) | | 关联业务类型 |
| related_id | VARCHAR(50) | | 关联业务ID |
| category | VARCHAR(50) | | 通知分类 |
| status | VARCHAR(20) | DEFAULT 'pending' | 发送状态 |
| retry_count | INTEGER | DEFAULT 0 | 重试次数 |
| sent_at | TIMESTAMP | | 发送时间 |
| read_at | TIMESTAMP | | 阅读时间 |
| error_message | TEXT | | 错误信息 |

#### 9.2 用户消息表 (user_messages)
**描述**: 用户消息记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 消息ID |
| user_id | VARCHAR(20) | NOT NULL FK | 用户ID |
| title | VARCHAR(200) | NOT NULL | 消息标题 |
| content | TEXT | NOT NULL | 消息内容 |
| message_type | VARCHAR(50) | NOT NULL | 消息类型 |
| priority | VARCHAR(20) | DEFAULT 'normal' | 消息优先级 |
| category | VARCHAR(50) | | 消息分类 |
| related_type | VARCHAR(50) | | 关联业务类型 |
| related_id | VARCHAR(50) | | 关联业务ID |
| sender_id | VARCHAR(20) | FK | 发送者ID |
| is_read | BOOLEAN | DEFAULT false | 是否已读 |
| read_at | TIMESTAMP | | 阅读时间 |
| is_archived | BOOLEAN | DEFAULT false | 是否归档 |
| archived_at | TIMESTAMP | | 归档时间 |
| expires_at | TIMESTAMP | | 过期时间 |
| action_url | VARCHAR(500) | | 操作链接 |
| action_text | VARCHAR(100) | | 操作按钮文本 |
| metadata | JSONB | | 元数据 |

#### 9.3 推送通知历史表 (push_notification_history)
**描述**: 推送通知发送历史表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 历史记录ID |
| user_id | VARCHAR(20) | NOT NULL FK | 用户ID |
| device_id | VARCHAR(20) | FK | 设备ID |
| notification_id | VARCHAR(20) | FK | 通知ID |
| push_token | TEXT | | 推送token |
| title | VARCHAR(200) | | 推送标题 |
| body | TEXT | | 推送内容 |
| data | JSONB | | 推送数据 |
| status | VARCHAR(50) | | 推送状态 |
| sent_at | TIMESTAMP | | 发送时间 |
| delivered_at | TIMESTAMP | | 送达时间 |
| read_at | TIMESTAMP | | 阅读时间 |
| error_message | TEXT | | 错误信息 |
| retry_count | INTEGER | DEFAULT 0 | 重试次数 |

### 10. 统计分析表

#### 10.1 告警统计表 (alarm_statistics)
**描述**: 告警统计数据表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 统计记录ID |
| stat_date | DATE | NOT NULL | 统计日期 |
| stat_hour | INTEGER | | 统计小时 |
| type_id | VARCHAR(20) | FK | 告警类型ID |
| level_id | VARCHAR(20) | FK | 告警级别ID |
| point_id | VARCHAR(20) | FK | 监控点ID |
| total_count | INTEGER | DEFAULT 0 | 总数量 |
| confirmed_count | INTEGER | DEFAULT 0 | 确认数量 |
| resolved_count | INTEGER | DEFAULT 0 | 解决数量 |
| false_alarm_count | INTEGER | DEFAULT 0 | 误报数量 |
| avg_response_time | INTEGER | | 平均响应时间(分钟) |
| avg_resolve_time | INTEGER | | 平均解决时间(分钟) |

#### 10.2 工单统计表 (workorder_statistics)
**描述**: 工单统计数据表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 统计记录ID |
| stat_date | DATE | NOT NULL | 统计日期 |
| stat_hour | INTEGER | | 统计小时 |
| type_id | VARCHAR(20) | FK | 工单类型ID |
| assignee_id | VARCHAR(20) | FK | 处理人ID |
| department_id | VARCHAR(20) | FK | 部门ID |
| total_count | INTEGER | DEFAULT 0 | 总数量 |
| completed_count | INTEGER | DEFAULT 0 | 完成数量 |
| overdue_count | INTEGER | DEFAULT 0 | 超时数量 |
| avg_process_time | INTEGER | | 平均处理时间(分钟) |
| avg_response_time | INTEGER | | 平均响应时间(分钟) |
| completion_rate | DECIMAL(5,2) | | 完成率 |
| on_time_rate | DECIMAL(5,2) | | 按时完成率 |

#### 10.3 设备统计表 (device_statistics)
**描述**: 设备统计数据表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 统计记录ID |
| stat_date | DATE | NOT NULL | 统计日期 |
| device_id | VARCHAR(20) | FK | 设备ID |
| online_duration | INTEGER | DEFAULT 0 | 在线时长(分钟) |
| offline_duration | INTEGER | DEFAULT 0 | 离线时长(分钟) |
| fault_count | INTEGER | DEFAULT 0 | 故障次数 |
| alarm_count | INTEGER | DEFAULT 0 | 告警次数 |
| availability_rate | DECIMAL(5,2) | | 可用性百分比 |
| performance_score | DECIMAL(5,2) | | 性能评分 |

### 11. 系统管理表

#### 11.1 系统配置表 (system_configs)
**描述**: 系统配置参数表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 配置ID |
| category | VARCHAR(50) | NOT NULL | 配置分类 |
| key | VARCHAR(100) | NOT NULL | 配置键 |
| value | JSONB | NOT NULL | 配置值 |
| value_type | VARCHAR(20) | DEFAULT 'string' | 值类型 |
| description | TEXT | | 配置描述 |
| is_public | BOOLEAN | DEFAULT false | 是否公开 |
| is_readonly | BOOLEAN | DEFAULT false | 是否只读 |
| updated_by | VARCHAR(20) | FK | 更新人 |

**系统预设配置**:
- `system.app_name` - 系统名称
- `system.app_version` - 系统版本
- `system.session_timeout` - 会话超时时间
- `system.max_login_attempts` - 最大登录尝试次数
- `alarm.auto_create_workorder` - 告警自动创建工单
- `device.offline_threshold` - 离线判定倍数
- `notification.enable_email` - 启用邮件通知
- `notification.enable_sms` - 启用短信通知

#### 11.2 操作日志表 (operation_logs)
**描述**: 系统操作日志表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 日志ID |
| user_id | VARCHAR(20) | FK | 操作用户ID |
| username | VARCHAR(50) | | 操作用户名 |
| module | VARCHAR(50) | | 操作模块 |
| action | VARCHAR(50) | | 操作动作 |
| target_type | VARCHAR(50) | | 目标类型 |
| target_id | VARCHAR(50) | | 目标ID |
| target_name | VARCHAR(200) | | 目标名称 |
| ip_address | INET | | 操作IP地址 |
| user_agent | TEXT | | 用户代理 |
| request_data | JSONB | | 请求数据 |
| response_data | JSONB | | 响应数据 |
| status | VARCHAR(20) | | 操作状态 |
| error_message | TEXT | | 错误信息 |
| duration | INTEGER | | 操作耗时(毫秒) |

#### 11.3 用户会话表 (user_sessions)
**描述**: 用户会话管理表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 会话ID |
| user_id | VARCHAR(20) | NOT NULL FK | 用户ID |
| token | TEXT | NOT NULL UNIQUE | 会话token |
| ip_address | INET | | IP地址 |
| user_agent | TEXT | | 用户代理 |
| last_activity | TIMESTAMP | DEFAULT NOW() | 最后活动时间 |
| expires_at | TIMESTAMP | NOT NULL | 过期时间 |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |

#### 11.4 文件上传表 (file_uploads)
**描述**: 文件上传记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 文件ID |
| original_name | VARCHAR(255) | | 原始文件名 |
| file_name | VARCHAR(255) | NOT NULL | 存储文件名 |
| file_path | VARCHAR(500) | NOT NULL | 文件路径 |
| file_url | VARCHAR(500) | | 访问URL |
| file_type | VARCHAR(100) | | 文件类型 |
| file_size | BIGINT | | 文件大小(字节) |
| mime_type | VARCHAR(100) | | MIME类型 |
| upload_type | VARCHAR(50) | | 上传类型 |
| related_type | VARCHAR(50) | | 关联业务类型 |
| related_id | VARCHAR(50) | | 关联业务ID |
| uploaded_by | VARCHAR(20) | NOT NULL FK | 上传人 |
| is_public | BOOLEAN | DEFAULT false | 是否公开 |
| is_processed | BOOLEAN | DEFAULT false | 是否已处理 |
| download_count | INTEGER | DEFAULT 0 | 下载次数 |

#### 11.5 移动设备表 (mobile_devices)
**描述**: 移动设备注册表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 设备记录ID |
| user_id | VARCHAR(20) | NOT NULL FK | 用户ID |
| device_id | VARCHAR(255) | NOT NULL | 设备唯一标识 |
| device_type | VARCHAR(50) | | 设备类型(iOS/Android) |
| device_model | VARCHAR(100) | | 设备型号 |
| os_version | VARCHAR(50) | | 系统版本 |
| app_version | VARCHAR(50) | | 应用版本 |
| push_token | TEXT | | 推送token |
| is_active | BOOLEAN | DEFAULT true | 是否活跃 |
| last_active_at | TIMESTAMP | | 最后活跃时间 |

#### 11.6 用户签到表 (user_checkins)
**描述**: 用户签到记录表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(20) | PRIMARY KEY | 签到记录ID |
| user_id | VARCHAR(20) | NOT NULL FK | 用户ID |
| checkin_type | VARCHAR(20) | DEFAULT 'normal' | 签到类型 |
| longitude | DECIMAL(10,7) | | 签到经度 |
| latitude | DECIMAL(10,7) | | 签到纬度 |
| address | VARCHAR(255) | | 签到地址 |
| checkin_location | JSONB | | 签到位置信息 |
| checkin_address | VARCHAR(255) | | 签到详细地址 |
| note | TEXT | | 签到备注 |
| photo_url | VARCHAR(500) | | 签到照片 |
| device_info | JSONB | | 设备信息 |
| device_id | VARCHAR(20) | FK | 设备ID |
| checkin_time | TIMESTAMP | DEFAULT NOW() | 签到时间 |

---

## 视图(Views)详细说明

### 1. 用户相关视图

#### v_user_details
**描述**: 用户详细信息视图，包含角色和部门信息
```sql
SELECT 
    u.id, u.username, u.name, u.phone, u.email, u.avatar,
    u.status, u.last_login_at, u.created_at,
    r.name as role_name, r.code as role_code,
    d.name as department_name, d.code as department_code,
    -- 在线状态判断
    CASE 
        WHEN u.last_login_at > NOW() - INTERVAL '15 minutes' THEN 'online'
        WHEN u.last_login_at > NOW() - INTERVAL '1 hour' THEN 'away'
        ELSE 'offline'
    END as online_status,
    -- 活跃会话数量
    (SELECT COUNT(*) FROM user_sessions 
     WHERE user_id = u.id AND is_active = true AND expires_at > NOW()
    ) as active_sessions
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN departments d ON u.department_id = d.id
```

#### v_user_permissions_summary
**描述**: 用户权限汇总视图
```sql
SELECT 
    u.id as user_id, u.username, u.name as user_name,
    r.name as role_name,
    array_agg(DISTINCT p.code ORDER BY p.code) as permission_codes,
    array_agg(DISTINCT p.module ORDER BY p.module) as modules,
    COUNT(DISTINCT p.id) as permission_count
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.status = 'active'
GROUP BY u.id, u.username, u.name, r.name
```

### 2. 告警相关视图

#### v_alarm_details
**描述**: 告警详细信息视图，包含关联信息
```sql
SELECT 
    a.id, a.title, a.description, a.confidence,
    a.image_url, a.video_url, a.status,
    a.created_at, a.confirmed_at, a.resolved_at,
    at.name as type_name, at.code as type_code,
    al.name as level_name, al.priority as level_priority,
    d.name as device_name, d.code as device_code,
    mp.name as point_name, mp.river_name, mp.river_section,
    dept.name as department_name,
    u1.name as confirmed_by_name,
    u2.name as resolved_by_name,
    -- 待处理时长计算
    CASE 
        WHEN a.status = 'pending' THEN 
            EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 60
        WHEN a.status IN ('confirmed', 'processing') THEN
            EXTRACT(EPOCH FROM (NOW() - COALESCE(a.confirmed_at, a.created_at))) / 60
        ELSE 0
    END as pending_minutes
FROM alarms a
JOIN alarm_types at ON a.type_id = at.id
JOIN alarm_levels al ON a.level_id = al.id
JOIN monitoring_points mp ON a.point_id = mp.id
LEFT JOIN devices d ON a.device_id = d.id
LEFT JOIN departments dept ON a.department_id = dept.id
LEFT JOIN users u1 ON a.confirmed_by = u1.id
LEFT JOIN users u2 ON a.resolved_by = u2.id
```

#### v_alarm_realtime
**描述**: 实时告警监控视图
```sql
SELECT 
    a.*, at.name as type_name, al.name as level_name, al.color as level_color,
    mp.name as point_name, mp.longitude, mp.latitude,
    d.name as device_name,
    EXTRACT(EPOCH FROM (NOW() - a.created_at)) as age_seconds
FROM alarms a
JOIN alarm_types at ON a.type_id = at.id
JOIN alarm_levels al ON a.level_id = al.id
JOIN monitoring_points mp ON a.point_id = mp.id
LEFT JOIN devices d ON a.device_id = d.id
WHERE a.status IN ('pending', 'confirmed', 'processing')
AND a.created_at > NOW() - INTERVAL '24 hours'
ORDER BY al.priority ASC, a.created_at DESC
```

### 3. 工单相关视图

#### v_workorder_details
**描述**: 工单详细信息视图
```sql
SELECT 
    w.id, w.title, w.description, w.priority, w.status, w.sla_status,
    w.created_at, w.assigned_at, w.started_at, w.expected_complete_at,
    w.completed_at, w.reviewed_at,
    wt.name as type_name, wt.sla_hours,
    creator.name as creator_name,
    assignee.name as assignee_name,
    reviewer.name as reviewer_name,
    dept.name as department_name,
    mp.name as point_name,
    a.title as alarm_title,
    pr.title as report_title,
    -- 持续时间计算
    CASE 
        WHEN w.status = 'completed' THEN
            EXTRACT(EPOCH FROM (w.completed_at - w.created_at)) / 3600
        ELSE
            EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600
    END as duration_hours,
    -- 超时时长计算
    CASE 
        WHEN w.expected_complete_at < NOW() AND w.status NOT IN ('completed', 'cancelled') THEN
            EXTRACT(EPOCH FROM (NOW() - w.expected_complete_at)) / 3600
        ELSE 0
    END as overdue_hours
FROM workorders w
JOIN workorder_types wt ON w.type_id = wt.id
JOIN users creator ON w.creator_id = creator.id
LEFT JOIN users assignee ON w.assignee_id = assignee.id
LEFT JOIN users reviewer ON w.reviewer_id = reviewer.id
LEFT JOIN departments dept ON w.department_id = dept.id
LEFT JOIN monitoring_points mp ON w.point_id = mp.id
LEFT JOIN alarms a ON w.alarm_id = a.id
LEFT JOIN problem_reports pr ON w.report_id = pr.id
```

#### v_user_workload
**描述**: 用户工单负载视图
```sql
SELECT 
    u.id as user_id, u.name as user_name, u.department_id,
    d.name as department_name,
    COUNT(*) FILTER (WHERE w.status = 'assigned') as assigned_count,
    COUNT(*) FILTER (WHERE w.status = 'processing') as processing_count,
    COUNT(*) FILTER (WHERE w.status = 'pending_review') as pending_review_count,
    COUNT(*) FILTER (WHERE w.status = 'completed' AND DATE(w.completed_at) = CURRENT_DATE) as today_completed,
    COUNT(*) FILTER (WHERE w.sla_status = 'at_risk') as at_risk_count,
    COUNT(*) FILTER (WHERE w.sla_status = 'inactive') as overdue_count,
    AVG(CASE 
        WHEN w.status = 'completed' THEN
            EXTRACT(EPOCH FROM (w.completed_at - w.assigned_at)) / 3600
        ELSE NULL
    END) as avg_processing_hours
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN workorders w ON u.id = w.assignee_id
WHERE u.status = 'active'
GROUP BY u.id, u.name, u.department_id, d.name
```

### 4. 设备相关视图

#### v_device_details
**描述**: 设备详细信息视图
```sql
SELECT 
    d.id, d.name, d.code, d.status, d.ip_address, d.port,
    d.install_date, d.warranty_date, d.last_heartbeat,
    dt.name as type_name, dt.heartbeat_interval,
    mp.name as point_name, mp.river_name, mp.longitude, mp.latitude,
    mu.name as maintenance_user_name,
    -- 健康状态评估
    CASE 
        WHEN d.last_heartbeat > NOW() - (dt.heartbeat_interval || ' minutes')::INTERVAL THEN 'normal'
        WHEN d.last_heartbeat > NOW() - (dt.heartbeat_interval * 2 || ' minutes')::INTERVAL THEN 'warning'
        ELSE 'critical'
    END as health_status,
    EXTRACT(EPOCH FROM (NOW() - d.last_heartbeat)) / 60 as offline_minutes,
    -- 活跃故障数量
    (SELECT COUNT(*) FROM device_faults 
     WHERE device_id = d.id AND is_resolved = false
    ) as active_fault_count,
    -- 活跃告警数量
    (SELECT COUNT(*) FROM alarms 
     WHERE device_id = d.id AND status IN ('pending', 'confirmed', 'processing')
    ) as active_alarm_count
FROM devices d
JOIN device_types dt ON d.type_id = dt.id
JOIN monitoring_points mp ON d.point_id = mp.id
LEFT JOIN users mu ON d.maintenance_by = mu.id
```

### 5. 统计分析视图

#### v_alarm_statistics
**描述**: 告警统计视图
```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
    COUNT(*) FILTER (WHERE status = 'false_alarm') as false_alarm_count,
    COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
    AVG(CASE 
        WHEN resolved_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
        ELSE NULL
    END) as avg_resolution_hours,
    COUNT(DISTINCT device_id) as affected_devices,
    COUNT(DISTINCT point_id) as affected_points
FROM alarms
GROUP BY DATE(created_at)
```

#### v_system_overview
**描述**: 系统运行状态概览视图
```sql
SELECT 
    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM user_sessions WHERE is_active = true AND expires_at > NOW()) as active_sessions,
    (SELECT COUNT(*) FROM devices) as total_devices,
    (SELECT COUNT(*) FROM devices WHERE status = 'online') as online_devices,
    (SELECT COUNT(*) FROM monitoring_points WHERE status = 'active') as active_points,
    (SELECT COUNT(*) FROM alarms WHERE DATE(created_at) = CURRENT_DATE) as today_alarms,
    (SELECT COUNT(*) FROM alarms WHERE status IN ('pending', 'confirmed', 'processing')) as active_alarms,
    (SELECT COUNT(*) FROM workorders WHERE DATE(created_at) = CURRENT_DATE) as today_workorders,
    (SELECT COUNT(*) FROM workorders WHERE status NOT IN ('completed', 'cancelled')) as active_workorders,
    (SELECT COUNT(*) FROM problem_reports WHERE DATE(created_at) = CURRENT_DATE) as today_reports,
    (SELECT COUNT(*) FROM notification_queue WHERE status = 'pending') as pending_notifications,
    NOW() as last_updated
```

---

## 函数(Functions)详细说明

### 1. 认证相关函数

#### authenticate_user
**描述**: 用户登录验证函数
**参数**: 
- `p_username` VARCHAR - 用户名
- `p_password` VARCHAR - 密码

**返回**: 
```sql
TABLE(
    success BOOLEAN,
    user_id VARCHAR,
    token TEXT,
    message TEXT
)
```

**功能**:
- 用户名和密码验证
- 账号状态检查(active/inactive/suspended)
- 登录失败次数限制(5次，锁定30分钟)
- 生成会话token
- 记录登录日志

#### verify_session_token
**描述**: 验证会话token有效性
**参数**:
- `p_token` TEXT - 会话token

**返回**:
```sql
TABLE(
    valid BOOLEAN,
    user_id VARCHAR,
    username VARCHAR,
    role_id VARCHAR,
    department_id VARCHAR
)
```

#### change_password
**描述**: 修改用户密码
**参数**:
- `p_user_id` VARCHAR - 用户ID
- `p_old_password` VARCHAR - 旧密码
- `p_new_password` VARCHAR - 新密码

**返回**:
```sql
TABLE(
    success BOOLEAN,
    message TEXT
)
```

**功能**:
- 验证旧密码
- 检查密码历史(90天内不能重复)
- 更新密码并保存历史记录
- 使所有会话失效

### 2. 权限管理函数

#### get_user_permissions
**描述**: 获取用户权限列表
**参数**:
- `p_user_id` VARCHAR - 用户ID

**返回**:
```sql
TABLE(
    permission_code VARCHAR,
    permission_name VARCHAR,
    module_code VARCHAR
)
```

#### verify_user_permission
**描述**: 验证用户权限
**参数**:
- `p_user_id` VARCHAR - 用户ID
- `p_permission_code` VARCHAR - 权限代码

**返回**: `BOOLEAN`

**功能**:
- 检查用户是否有指定权限
- 系统管理员默认拥有所有权限
- 支持角色权限和特殊权限

### 3. 告警管理函数

#### create_alarm
**描述**: 创建新告警
**参数**:
- `p_type_id` VARCHAR - 告警类型ID
- `p_level_id` VARCHAR - 告警级别ID
- `p_device_id` VARCHAR - 设备ID
- `p_point_id` VARCHAR - 监控点ID
- `p_title` VARCHAR - 告警标题
- `p_description` TEXT - 告警描述
- `p_confidence` DECIMAL - 置信度
- `p_image_url` VARCHAR - 图片URL
- `p_video_url` VARCHAR - 视频URL
- `p_coordinates` JSONB - 坐标信息

**返回**: `VARCHAR` - 告警ID

**功能**:
- 生成唯一告警ID
- 计算优先级索引
- 获取部门和区域信息
- 发送告警通知

#### confirm_alarm
**描述**: 确认告警
**参数**:
- `p_alarm_id` VARCHAR - 告警ID
- `p_user_id` VARCHAR - 确认人ID
- `p_note` TEXT - 备注

**返回**: `BOOLEAN`

#### resolve_alarm
**描述**: 处理告警
**参数**:
- `p_alarm_id` VARCHAR - 告警ID
- `p_user_id` VARCHAR - 处理人ID
- `p_resolution_note` TEXT - 处理说明

**返回**: `BOOLEAN`

### 4. 工单管理函数

#### create_workorder
**描述**: 创建工单
**参数**:
- `p_type_id` VARCHAR - 工单类型ID
- `p_title` VARCHAR - 工单标题
- `p_description` TEXT - 工单描述
- `p_creator_id` VARCHAR - 创建人ID
- `p_priority` priority_level - 优先级
- `p_alarm_id` VARCHAR - 关联告警ID(可选)
- `p_report_id` VARCHAR - 关联报告ID(可选)
- `p_department_id` VARCHAR - 部门ID(可选)
- `p_area_id` VARCHAR - 区域ID(可选)

**返回**: `VARCHAR` - 工单ID

**功能**:
- 生成工单ID(WO_YYYYMMDD_xxx格式)
- 根据工单类型设置SLA时间
- 记录状态历史
- 发送创建通知

#### assign_workorder
**描述**: 分配工单
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_assignee_id` VARCHAR - 处理人ID
- `p_assigner_id` VARCHAR - 分配人ID

**返回**: `BOOLEAN`

#### start_workorder
**描述**: 开始处理工单
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_processor_id` VARCHAR - 处理人ID

**返回**: `BOOLEAN`

#### submit_workorder_result
**描述**: 提交工单结果
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_processor_id` VARCHAR - 处理人ID
- `p_process_method` TEXT - 处理方法
- `p_process_result` TEXT - 处理结果
- `p_before_photos` JSONB - 处理前照片
- `p_after_photos` JSONB - 处理后照片
- `p_need_followup` BOOLEAN - 是否需要跟进
- `p_followup_reason` TEXT - 跟进原因

**返回**: `VARCHAR` - 结果记录ID

#### approve_workorder
**描述**: 审核通过工单
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_reviewer_id` VARCHAR - 审核人ID
- `p_review_note` TEXT - 审核备注
- `p_quality_rating` INTEGER - 质量评分

**返回**: `BOOLEAN`

#### reject_workorder
**描述**: 拒绝工单(需要返工)
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_reviewer_id` VARCHAR - 审核人ID
- `p_rejection_reason` TEXT - 拒绝原因
- `p_back_to_assignee` BOOLEAN - 是否返回给原处理人

**返回**: `BOOLEAN`

### 5. 设备管理函数

#### update_device_heartbeat
**描述**: 更新设备心跳
**参数**:
- `p_device_id` VARCHAR - 设备ID
- `p_metrics` JSONB - 设备指标数据

**返回**: `BOOLEAN`

**功能**:
- 记录设备心跳
- 更新设备状态为在线
- 清除离线类型的故障记录

#### mark_device_offline
**描述**: 标记设备离线
**参数**:
- `p_device_id` VARCHAR - 设备ID

**返回**: `BOOLEAN`

**功能**:
- 更新设备状态为离线
- 记录设备故障
- 创建离线告警

#### check_device_offline
**描述**: 检查设备离线状态
**返回**:
```sql
TABLE(
    device_id VARCHAR,
    device_name VARCHAR,
    offline_duration INTERVAL
)
```

### 6. 问题上报函数

#### review_problem_report
**描述**: 审核问题上报
**参数**:
- `p_report_id` VARCHAR - 报告ID
- `p_reviewer_id` VARCHAR - 审核人ID
- `p_action` VARCHAR - 操作(verify/reject/convert)
- `p_review_note` TEXT - 审核备注

**返回**: `BOOLEAN`

**功能**:
- 验证通过 - 更新为已验证状态
- 拒绝 - 标记为已拒绝
- 转工单 - 自动创建对应工单
- 发送审核结果通知

#### resolve_problem_report
**描述**: 处理完成问题上报
**参数**:
- `p_report_id` VARCHAR - 报告ID
- `p_resolver_id` VARCHAR - 处理人ID
- `p_resolution` TEXT - 处理结果

**返回**: `BOOLEAN`

### 7. 新增函数（v3.3）

#### check_workorder_permission_v2
**描述**: 检查用户是否有权限执行工单操作（兼容新旧权限系统）
**参数**:
- `p_user_id` VARCHAR - 用户ID
- `p_workorder_id` VARCHAR - 工单ID
- `p_action` VARCHAR - 操作类型

**返回**: `BOOLEAN`

**功能**:
- 支持基于角色代码的权限检查（R002、R003、R004、R006）
- 兼容传统permissions表的权限检查
- 根据工单来源（AI/人工）验证不同的权限规则
- 支持以下操作：
  - `dispatch` - 分派工单（R006）
  - `reject` - 拒绝工单（R003，无次数限制）
  - `process` - 处理工单（R003）
  - `area_review` - 区域审核（R006）
  - `final_review` - 最终审核（R002，仅AI工单）
  - `reporter_confirm` - 发起人确认（R004或R006超时介入）
  - `close` - 关闭工单（R002关AI工单，R004关人工工单）

### 8. 区域管理函数

#### handle_area_supervisor_change
**描述**: 处理区域主管变更的核心函数
**参数**:
- `p_area_id` VARCHAR - 区域ID
- `p_old_supervisor_id` VARCHAR - 原主管ID
- `p_new_supervisor_id` VARCHAR - 新主管ID
- `p_transfer_workorders` BOOLEAN - 是否转移工单 (默认true)
- `p_change_reason` TEXT - 变更原因 (默认'区域主管变更')

**返回**:
```sql
TABLE(
    success BOOLEAN,
    workorders_transferred INTEGER,
    permissions_updated BOOLEAN,
    change_history_id VARCHAR,
    message TEXT
)
```

**功能**:
- 自动禁用旧主管的区域权限
- 为新主管创建或激活权限记录
- 转移符合条件的待处理工单
- 在工单中添加变更说明
- 记录变更历史
- 发送通知给新旧主管
- 完整的错误处理和事务控制

**触发条件**:
- 可以手动调用
- 通过 `river_management_areas` 表的 `supervisor_id` 字段更新自动触发

#### area_supervisor_assign_workorder
**描述**: 区域主管分配工单
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_assignee_id` VARCHAR - 分配给的处理人ID
- `p_supervisor_id` VARCHAR - 主管ID
- `p_note` TEXT - 分配备注 (可选)

**返回**: `BOOLEAN`

**功能**:
- 验证主管是否有权限分配该区域的工单
- 检查权限有效期
- 调用标准工单分配函数

#### area_supervisor_review_workorder
**描述**: 区域主管审核工单
**参数**:
- `p_workorder_id` VARCHAR - 工单ID
- `p_supervisor_id` VARCHAR - 主管ID
- `p_action` VARCHAR - 审核动作 (approve/reject/return)
- `p_review_note` TEXT - 审核备注 (可选)

**返回**: `BOOLEAN`

**功能**:
- 验证主管是否有权限审核该区域的工单
- 根据动作执行相应操作:
  - approve: 审核通过
  - reject: 拒绝工单
  - return: 打回重新处理
- 发送审核结果通知

#### get_area_rivers_and_devices
**描述**: 获取区域内的河道和设备信息
**参数**:
- `p_area_id` VARCHAR - 区域ID

**返回**:
```sql
TABLE(
    river_id VARCHAR,
    river_name VARCHAR,
    device_count BIGINT,
    online_device_count BIGINT,
    camera_list JSONB
)
```

**功能**:
- 统计区域内河道数量
- 统计设备总数和在线设备数
- 返回设备详细信息列表

### 8. 批量操作函数

#### batch_process_alarms
**描述**: 批量处理告警
**参数**:
- `p_alarm_ids` JSONB - 告警ID数组
- `p_user_id` VARCHAR - 操作用户ID
- `p_action` VARCHAR - 操作类型(confirm/resolve/false_alarm/ignore)
- `p_note` TEXT - 操作备注

**返回**: `INTEGER` - 成功处理数量

#### batch_assign_workorders
**描述**: 批量分配工单
**参数**:
- `p_workorder_ids` JSONB - 工单ID数组
- `p_assignee_id` VARCHAR - 处理人ID
- `p_assigner_id` VARCHAR - 分配人ID

**返回**: `INTEGER` - 成功分配数量

### 8. 统计分析函数

#### get_alarm_statistics
**描述**: 获取告警统计数据
**参数**:
- `p_start_date` DATE - 开始日期
- `p_end_date` DATE - 结束日期
- `p_department_id` VARCHAR - 部门ID(可选)

**返回**:
```sql
TABLE(
    date DATE,
    total_count BIGINT,
    pending_count BIGINT,
    confirmed_count BIGINT,
    processing_count BIGINT,
    resolved_count BIGINT,
    false_alarm_count BIGINT
)
```

#### get_workorder_statistics
**描述**: 获取工单统计数据
**参数**: 同告警统计
**返回**:
```sql
TABLE(
    date DATE,
    total_count BIGINT,
    pending_count BIGINT,
    assigned_count BIGINT,
    processing_count BIGINT,
    completed_count BIGINT,
    overdue_count BIGINT,
    avg_completion_time INTERVAL
)
```

### 9. 系统管理函数

#### cleanup_expired_sessions
**描述**: 清理过期会话
**返回**: `INTEGER` - 清理数量

#### check_business_integrity
**描述**: 检查业务流程完整性
**返回**:
```sql
TABLE(
    check_item VARCHAR,
    check_status VARCHAR,
    details TEXT
)
```

**检查项目**:
- 未处理告警数量
- 超时工单数量  
- 离线设备数量
- 待审核工单数量
- 未验证问题上报数量

---

## 触发器(Triggers)详细说明

### 1. 自动更新时间戳触发器

#### update_updated_at_column
**描述**: 通用更新时间戳函数
**触发表**: users, departments, roles, permissions, monitoring_points, devices, alarms, workorders, problem_reports, system_configs

**功能**: 在记录更新时自动设置`updated_at`字段为当前时间

### 2. 业务逻辑触发器

#### on_alarm_status_change
**描述**: 告警状态变更触发器
**触发条件**: alarms表状态字段更新
**功能**:
- 记录状态变更历史
- 告警解决时自动完成相关工单

#### check_workorder_sla
**描述**: 工单SLA检查触发器
**触发条件**: workorders表更新前
**功能**:
- 检查工单是否即将超时(2小时内)
- 标记SLA状态为at_risk
- 检查工单是否已超时，标记为inactive

#### workorder_complete_close_alarm
**描述**: 工单完成关闭告警触发器
**触发条件**: workorders表状态更新为completed
**功能**: 自动关闭相关告警

#### sync_report_workorder_status
**描述**: 问题上报工单状态同步触发器
**触发条件**: workorders表状态更新为completed且有关联报告
**功能**: 同步更新问题上报状态为已解决

### 3. 数据完整性触发器

#### validate_workorder_assignment
**描述**: 工单分配验证触发器
**触发条件**: workorders表插入或更新且有分配人
**功能**:
- 验证分配用户状态为活跃
- 验证部门匹配关系

#### check_user_login_lock
**描述**: 用户登录锁定检查触发器
**触发条件**: users表login_attempts字段增加
**功能**:
- 连续失败5次锁定账号30分钟
- 发送账号安全提醒通知

### 4. 级联删除触发器

#### cascade_delete_user
**描述**: 用户删除级联处理触发器
**触发条件**: users表删除前
**功能**:
- 更新工单创建者为DELETED_USER
- 清空工单分配人
- 删除用户会话和特殊权限
- 删除移动设备记录

### 5. 通知触发器

#### notify_new_alarm
**描述**: 新告警通知触发器
**触发条件**: alarms表插入新记录
**功能**:
- 发送告警通知
- 紧急告警自动创建工单(优先级<=2)

### 6. 审计触发器

#### log_operation
**描述**: 操作日志记录触发器
**触发表**: users, roles, permissions, role_permissions(敏感操作)
**功能**: 记录所有敏感操作到operation_logs表

### 7. 新增触发器（v3.3）

#### trigger_workorder_status_change_logging
**描述**: 工单状态变更记录触发器（宽松版）
**触发条件**: workorders表状态更新
**触发时机**: BEFORE UPDATE
**功能**:
- 验证AI工单和人工工单的状态流转合法性
- 不合法的流转只记录警告，不阻止操作
- 自动记录状态变更历史到workorder_status_history表
- 支持传统工单的兼容性

**状态流转规则**:
- **AI工单**: pending → pending_dispatch → dispatched → processing → pending_review → pending_final_review → completed
- **人工工单**: pending → pending_dispatch → dispatched → processing → pending_review → pending_reporter_confirm → completed/confirmed_failed
- **拒绝流**: dispatched → rejected → pending_dispatch（可重复）
- **驳回流**: pending_final_review → pending_dispatch（R002驳回）

### 8. 区域管理触发器

#### trigger_area_supervisor_change
**描述**: 区域主管变更自动处理触发器
**触发条件**: river_management_areas表的supervisor_id字段更新
**触发时机**: AFTER UPDATE
**功能**:
- 自动检测区域主管变更
- 调用 `handle_area_supervisor_change()` 函数
- 自动转移相关工单和权限
- 记录变更日志
- 发送通知给相关人员

**业务价值**:
- 确保业务连续性，避免主管变更导致工单无人处理
- 自动化流程，减少人工干预
- 提供完整的审计追踪

#### update_area_supervisor_permissions_updated_at
**描述**: 区域主管权限表更新时间戳触发器
**触发条件**: area_supervisor_permissions表更新
**触发时机**: BEFORE UPDATE
**功能**: 自动更新 `updated_at` 字段

#### update_area_supervisor_change_history_updated_at
**描述**: 区域主管变更历史表更新时间戳触发器
**触发条件**: area_supervisor_change_history表更新
**触发时机**: BEFORE UPDATE
**功能**: 自动更新 `updated_at` 字段

---

## RLS(行级安全)策略详细说明

### 1. RLS策略概述

智慧河道监控系统采用PostgreSQL的行级安全(Row Level Security)机制来实现细粒度的数据访问控制。每个表都根据业务需求设置了相应的RLS策略。

### 2. 权限验证函数

#### 基础权限函数
```sql
-- 获取当前用户ID
get_current_user_id() RETURNS VARCHAR

-- 获取当前用户角色ID
get_current_role_id() RETURNS VARCHAR

-- 获取当前用户部门ID
get_current_department_id() RETURNS VARCHAR

-- 检查是否为管理员
is_admin() RETURNS BOOLEAN

-- 检查是否为部门管理员
is_department_admin() RETURNS BOOLEAN
```

### 3. 主要表的RLS策略

#### users表策略
**SELECT策略**: 
- 管理员查看所有用户
- 部门管理员查看本部门用户
- 普通用户只能查看自己

**INSERT策略**: 只有管理员可以创建用户

**UPDATE策略**: 
- 管理员可更新所有用户
- 部门管理员可更新本部门用户
- 用户可更新自己的部分信息

**DELETE策略**: 只有超级管理员可以删除用户

#### alarms表策略
**SELECT策略**:
- 管理员查看所有告警
- 部门用户查看本部门告警
- 普通用户查看公开告警

**INSERT策略**: 有告警创建权限的用户可创建

**UPDATE策略**: 管理员或本部门有权限用户可更新

**DELETE策略**: 只有管理员可以删除告警

#### workorders表策略
**SELECT策略**:
- 管理员查看所有工单
- 部门管理员查看本部门工单
- 用户查看自己创建、被分配或审核的工单

**INSERT策略**: 有工单创建权限的用户可创建

**UPDATE策略**: 管理员、创建者、处理人或部门管理员可更新

**DELETE策略**: 管理员和创建者可删除待处理状态的工单

#### devices表策略
**SELECT策略**: 所有用户可查看设备信息

**INSERT策略**: 有设备管理权限的用户可创建

**UPDATE策略**: 有设备管理权限或设备维护人员可更新

**DELETE策略**: 只有管理员可以删除设备

#### problem_reports表策略
**SELECT策略**:
- 管理员查看所有报告
- 部门管理员查看本部门报告
- 用户查看自己的报告
- 已验证报告公开可见

**INSERT策略**: 所有用户可创建问题报告

**UPDATE策略**: 管理员、报告者、有验证权限的部门用户可更新

**DELETE策略**: 管理员和报告者可删除未处理的报告

#### notification_queue表策略
**SELECT策略**: 用户只能查看发给自己的通知

**INSERT策略**: 管理员和有通知发送权限的用户可创建

**UPDATE策略**: 接收者可标记已读，管理员可更新所有

**DELETE策略**: 只有管理员可以删除通知

#### operation_logs表策略
**SELECT策略**: 管理员查看所有日志，用户查看自己的日志

**INSERT/UPDATE策略**: 不允许手动操作，仅系统自动生成

**DELETE策略**: 只有超级管理员可以删除日志

### 4. RLS策略实现原则

1. **最小权限原则**: 用户只能访问其工作需要的最小数据集
2. **角色层级控制**: 根据角色层级提供不同的数据访问范围
3. **部门边界隔离**: 部门间数据相互隔离，避免越权访问
4. **业务流程支持**: 策略设计支持完整的业务流程流转
5. **审计完整性**: 保证所有敏感操作都有完整的审计记录

---

## 索引优化策略

### 1. 索引设计原则

1. **高频查询优化**: 为经常使用的查询条件创建索引
2. **组合索引优先**: 多字段查询使用复合索引
3. **部分索引**: 针对特定条件的查询使用部分索引
4. **避免过度索引**: 平衡查询性能和写入性能

### 2. 主要索引

#### 用户认证相关索引
```sql
-- 登录验证优化
CREATE INDEX idx_users_login ON users(username, password, status);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at) 
WHERE is_active = true;
```

#### 告警查询优化索引
```sql
-- 告警状态查询
CREATE INDEX idx_alarms_active ON alarms(status, created_at DESC) 
WHERE status IN ('pending', 'confirmed', 'processing');

-- 告警优先级查询
CREATE INDEX idx_alarms_priority ON alarms(priority_index, created_at DESC);

-- 部门告警查询
CREATE INDEX idx_alarms_dept_status ON alarms(department_id, status, created_at DESC);
```

#### 工单处理优化索引
```sql
-- 工单分配查询
CREATE INDEX idx_workorders_user_active ON workorders(assignee_id, status) 
WHERE status IN ('assigned', 'processing');

-- SLA监控索引
CREATE INDEX idx_workorders_sla ON workorders(sla_status, expected_complete_at) 
WHERE status NOT IN ('completed', 'cancelled');

-- 工单状态历史
CREATE INDEX idx_workorder_status_history_workorder ON workorder_status_history(workorder_id);
```

#### 设备监控优化索引
```sql
-- 在线设备查询
CREATE INDEX idx_devices_online ON devices(status, last_heartbeat DESC) 
WHERE status = 'online';

-- 设备故障查询
CREATE INDEX idx_device_faults_unresolved ON device_faults(device_id, detected_at DESC) 
WHERE is_resolved = false;
```

#### 统计分析索引
```sql
-- 告警趋势分析
CREATE INDEX idx_alarms_trend ON alarms(created_at, type_id, level_id);

-- 工单趋势分析  
CREATE INDEX idx_workorders_trend ON workorders(created_at, type_id, status);

-- 设备可用性分析
CREATE INDEX idx_device_heartbeats_analysis ON device_heartbeats(device_id, heartbeat_time, status);
```

---

## 数据类型和约束说明

### 1. 自定义枚举类型

```sql
-- 字典状态枚举
CREATE TYPE dict_status AS ENUM ('active', 'inactive');

-- 用户状态枚举
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

-- 设备状态枚举
CREATE TYPE device_status AS ENUM ('online', 'offline', 'fault', 'maintenance');

-- 告警状态枚举
CREATE TYPE alarm_status AS ENUM ('pending', 'confirmed', 'processing', 'resolved', 'false_alarm', 'ignored');

-- 工单状态枚举（扩展版）
CREATE TYPE workorder_status AS ENUM (
    'pending', 'pending_dispatch', 'dispatched', 'assigned', 
    'processing', 'rejected', 'pending_review', 'pending_final_review',
    'pending_reporter_confirm', 'confirmed_failed', 'completed', 'cancelled'
);

-- 优先级枚举
CREATE TYPE priority_level AS ENUM ('urgent', 'important', 'normal');

-- SLA状态枚举
CREATE TYPE sla_status AS ENUM ('active', 'inactive', 'at_risk');

-- 维护类型枚举
CREATE TYPE maintenance_type AS ENUM ('routine', 'emergency', 'upgrade');

-- 维护状态枚举
CREATE TYPE maintenance_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
```

### 2. 主键约束规范

- 所有表使用VARCHAR(20)作为主键类型
- 主键格式：`[表前缀]_[唯一ID]`
- 使用`generate_unique_id()`函数生成唯一标识

### 3. 外键约束规范

- 所有外键关系都明确定义
- 使用适当的ON DELETE策略（CASCADE/SET NULL/RESTRICT）
- 重要业务数据使用RESTRICT防止误删

### 4. 数据完整性约束

- 关键字段使用NOT NULL约束
- 枚举字段使用自定义类型确保数据一致性
- 使用CHECK约束验证数据范围和格式

---

## 性能优化建议

### 1. 查询优化

1. **使用合适的索引**: 根据查询模式创建和使用索引
2. **避免全表扫描**: 查询条件尽量使用索引字段
3. **分页查询**: 大数据量查询使用LIMIT和OFFSET
4. **联表优化**: 合理使用JOIN，避免过多嵌套

### 2. 数据库配置优化

1. **连接池配置**: 合理设置连接池大小
2. **内存配置**: 根据硬件资源调整shared_buffers等参数
3. **WAL配置**: 优化WAL写入性能
4. **统计信息**: 定期更新表统计信息

### 3. 维护策略

1. **定期VACUUM**: 清理死元组和更新统计信息
2. **索引维护**: 定期重建或重组索引
3. **日志轮转**: 及时清理旧的日志记录
4. **备份策略**: 制定合理的备份和恢复策略

### 4. 监控指标

1. **查询性能**: 监控慢查询和执行计划
2. **资源使用**: 监控CPU、内存、IO使用情况
3. **连接数**: 监控活跃连接数和连接池状态
4. **锁等待**: 监控数据库锁等待情况

---

## 安全考虑

### 1. 数据安全

1. **RLS策略**: 实现行级数据访问控制
2. **权限最小化**: 用户仅获得必要的最小权限
3. **敏感数据加密**: 密码等敏感信息进行哈希处理
4. **数据脱敏**: 日志中避免记录敏感信息

### 2. 访问控制

1. **会话管理**: 实现安全的用户会话机制
2. **登录保护**: 防止暴力破解攻击
3. **API安全**: 实现接口访问控制和限流
4. **审计日志**: 完整记录所有操作日志

### 3. 数据备份

1. **定期备份**: 制定自动化备份策略
2. **异地备份**: 重要数据实现异地备份
3. **恢复测试**: 定期测试数据恢复流程
4. **版本控制**: 数据库结构版本化管理

---

## 扩展性设计

### 1. 水平扩展

1. **读写分离**: 实现主从复制，读写分离
2. **分区表**: 对大表实现分区存储
3. **缓存层**: 使用Redis等缓存热点数据
4. **CDN加速**: 静态资源使用CDN分发

### 2. 垂直扩展

1. **硬件升级**: 提升服务器CPU、内存、存储
2. **存储优化**: 使用高性能SSD存储
3. **网络优化**: 提升网络带宽和延迟
4. **数据库调优**: 优化数据库配置参数

### 3. 业务扩展

1. **模块化设计**: 支持功能模块独立部署
2. **API标准化**: 提供标准化的API接口
3. **插件机制**: 支持第三方插件扩展
4. **多租户**: 支持多租户隔离部署

---

## 部署和运维

### 1. 环境配置

1. **开发环境**: 本地开发和测试环境配置
2. **测试环境**: 集成测试和压力测试环境
3. **预生产环境**: 生产前最后验证环境
4. **生产环境**: 正式运行环境配置

### 2. 监控运维

1. **健康检查**: 实现数据库健康状态检查
2. **性能监控**: 监控关键性能指标
3. **告警机制**: 异常情况及时告警通知
4. **自动化运维**: 实现自动化部署和维护

### 3. 版本管理

1. **Schema版本**: 数据库结构版本化管理
2. **数据迁移**: 安全的数据迁移策略
3. **回滚机制**: 支持快速版本回滚
4. **文档同步**: 保持文档与代码同步

---

这份文档详细描述了智慧河道监控系统的完整数据库设计，包括所有表结构、视图、函数、触发器、RLS策略和索引优化。该系统支持完整的河道监控业务流程，具备良好的扩展性和安全性。