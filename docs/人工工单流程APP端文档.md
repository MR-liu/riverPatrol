# 智慧河道监控系统 - 人工工单流程APP端文档

## 1. 概述

人工工单流程是由河道巡检员（R004）在移动APP端发起告警，经过系统审核后转化为工单，最终由巡检员现场确认的完整闭环流程。

## 2. 流程角色说明

### 2.1 角色定义
- **R004 - 河道巡检员**: 人工告警发起者、现场问题发现者、工单完成确认者
- **R002 - 监控中心主管**: 人工告警审核者、AI工单创建者、最终关闭者
- **R006 - 区域管理员**: 工单分派者、区域审核者、超时介入者
- **R003 - 河道维护员**: 工单执行者、现场处理人员

## 3. APP端完整流程

### 3.1 阶段一：问题发现与上报（R004 APP操作）

#### 3.1.1 上报界面功能
```javascript
// 问题上报表单
{
  title: "问题标题",           // 必填，简短描述
  description: "详细描述",     // 必填，问题详细说明  
  category_ids: [],          // 问题分类（多选）
  images: [],               // 现场照片（最多5张）
  videos: [],               // 现场视频（可选）
  location: "GPS定位地址",    // 自动获取
  coordinates: {            // GPS坐标
    latitude: 31.123456,
    longitude: 121.654321
  },
  severity: "important",    // 严重程度：urgent/important/normal
  anonymous: false          // 是否匿名上报
}
```

#### 3.1.2 上报流程步骤
1. **打开上报界面**
   - 自动获取GPS位置
   - 显示当前位置地址
   - 选择问题分类

2. **填写问题信息**
   - 输入问题标题（必填）
   - 详细描述问题现象（必填）
   - 选择严重程度

3. **现场取证**
   - 拍摄现场照片（支持多张）
   - 录制现场视频（可选）
   - 照片/视频自动带GPS信息

4. **提交上报**
   - 检查信息完整性
   - 提交到服务器
   - 获取上报编号

### 3.2 阶段二：告警审核（R002 Web端操作）

#### 3.2.1 审核决策
- **通过审核**: 标记为已验证，进入工单创建流程
- **拒绝上报**: 标记为已拒绝，通知R004上报人
- **转为工单**: 直接创建人工工单，进入派发流程

#### 3.2.2 工单创建
```sql
-- 创建人工工单
INSERT INTO workorders (
  id, type_id, title, description, priority, status,
  creator_id, initial_reporter_id, workorder_source,
  point_id, coordinates, created_at
) VALUES (
  'WO_' + YYYYMMDD + '_' + sequence,
  'WT_001', -- 告警处理类型
  problem_report.title,
  problem_report.description,
  problem_report.severity,
  'pending_dispatch', -- 待派发状态
  current_user_id, -- R002创建
  problem_report.reporter_id, -- R004原始上报人
  'manual', -- 人工工单来源
  problem_report.point_id,
  problem_report.coordinates,
  NOW()
);
```

### 3.3 阶段三：工单派发（R006 Web端操作）

#### 3.3.1 派发逻辑
```javascript
// 派发工单API调用
POST /api/workorders/{workorder_id}/actions
{
  "action": "dispatch",
  "assignee_id": "selected_r003_user_id", // 选中的R003维护员
  "note": "派发说明",
  "estimated_hours": 2 // 预计工时
}
```

#### 3.3.2 状态更新
- 工单状态: `pending_dispatch` → `dispatched`
- 分配时间: `dispatched_at` = 当前时间
- 分派人: `dispatcher_id` = R006用户ID

### 3.4 阶段四：现场处理（R003 APP操作）

#### 3.4.1 接单界面（APP端）
```javascript
// 工单详情显示
{
  workorder_id: "WO_20250111_001",
  title: "河道垃圾堆积",
  description: "发现大量生活垃圾堆积在河道边",
  priority: "important",
  estimated_hours: 2,
  reporter_info: {
    name: "张巡检员",
    phone: "138****1234"
  },
  location: "XX河道XX段",
  coordinates: { lat: 31.123, lng: 121.654 },
  images: ["image1.jpg", "image2.jpg"],
  created_at: "2025-01-11 09:30:00"
}
```

#### 3.4.2 开始处理
```javascript
// 开始处理API
POST /api/workorders/{workorder_id}/actions
{
  "action": "start_processing",
  "note": "已到达现场，开始处理",
  "estimated_hours": 2
}
```
- 状态更新: `dispatched` → `processing`
- 开始时间: `started_at` = 当前时间

#### 3.4.3 处理完成提交
```javascript
// 提交处理结果
POST /api/workorders/{workorder_id}/actions
{
  "action": "submit_review",
  "resolution": "已清理河道垃圾，恢复河道清洁",
  "process_method": "使用清洁工具人工清理",
  "before_photos": ["before1.jpg", "before2.jpg"], // 处理前照片
  "after_photos": ["after1.jpg", "after2.jpg"],   // 处理后照片
  "actual_hours": 1.5, // 实际工时
  "note": "处理完成，请审核"
}
```
- 状态更新: `processing` → `pending_review`
- 完成时间: 记录实际处理时间

### 3.5 阶段五：区域审核（R006 Web端操作）

#### 3.5.1 审核选项
```javascript
// 区域审核API
POST /api/workorders/{workorder_id}/actions
{
  "action": "approve_review", // 或 "reject_review"
  "note": "审核意见",
  "quality_rating": 5 // 质量评分 1-5
}
```

#### 3.5.2 审核结果
- **审核通过**: 状态 `pending_review` → `pending_reporter_confirm`
- **审核退回**: 状态 `pending_review` → `dispatched`（重新处理）

### 3.6 阶段六：现场确认（R004 APP操作）

#### 3.6.1 确认通知
```javascript
// APP推送通知
{
  type: "workorder_confirmation",
  title: "工单待确认",
  message: "您上报的问题已处理完成，请前往现场确认",
  workorder_id: "WO_20250111_001",
  deadline: "2025-01-13 18:00:00", // 确认截止时间
  action_url: "/workorders/confirm/{workorder_id}"
}
```

#### 3.6.2 现场确认界面（APP端）
```javascript
// 确认表单
{
  workorder_info: {
    title: "河道垃圾堆积",
    processor_name: "李维护员",
    process_result: "已清理河道垃圾，恢复河道清洁",
    after_photos: ["after1.jpg", "after2.jpg"]
  },
  confirmation: {
    result: "confirmed", // confirmed/rejected
    site_photos: [], // 现场确认照片
    note: "确认处理效果良好，问题已解决"
  }
}
```

#### 3.6.3 确认提交
```javascript
// 提交确认结果
POST /api/workorders/{workorder_id}/actions
{
  "action": "reporter_confirm",
  "confirm_result": "confirmed", // 或 "rejected"
  "site_photos": ["confirm1.jpg", "confirm2.jpg"],
  "note": "现场确认问题已彻底解决"
}
```

#### 3.6.4 确认结果处理
- **确认通过**: 状态 `pending_reporter_confirm` → `completed`
- **确认失败**: 状态 `pending_reporter_confirm` → `confirmed_failed` → `pending_dispatch`

### 3.7 超时处理机制

#### 3.7.1 超时触发条件
```sql
-- 检查超时的确认工单
SELECT * FROM workorders 
WHERE status = 'pending_reporter_confirm' 
  AND expected_complete_at < NOW() - INTERVAL '24 hours'
  AND reporter_confirm_result IS NULL;
```

#### 3.7.2 超时介入（R006操作）
```javascript
// R006超时介入API
POST /api/workorders/{workorder_id}/actions
{
  "action": "timeout_intervention",
  "note": "发起人超时未确认，区域主管介入处理",
  "intervention_result": "completed" // 或其他处理结果
}
```

## 4. APP端界面设计要求

### 4.1 问题上报界面
- **位置获取**: 自动GPS定位，可手动调整
- **分类选择**: 多级分类选择器
- **媒体上传**: 支持拍照、录像、从相册选择
- **表单验证**: 必填项检查、格式验证
- **网络处理**: 支持离线暂存、网络恢复自动上传

### 4.2 工单处理界面（R003）
- **工单列表**: 按状态分类显示
- **详情查看**: 原始问题信息展示
- **进度更新**: 实时状态同步
- **现场取证**: 处理前后对比照片
- **工时记录**: 开始/结束时间自动记录

### 4.3 确认界面（R004）
- **对比展示**: 处理前后效果对比
- **现场验证**: 当前现场照片上传
- **确认选项**: 通过/拒绝二选一
- **意见反馈**: 确认意见文字说明

## 5. API接口规范

### 5.1 问题上报API
```javascript
POST /api/problem-reports
Content-Type: multipart/form-data

{
  title: string,              // 问题标题
  description: string,        // 问题描述
  category_ids: string[],     // 分类ID数组
  severity: string,           // 严重程度
  location: string,           // 位置描述
  coordinates: {              // GPS坐标
    latitude: number,
    longitude: number
  },
  images: File[],             // 图片文件数组
  videos: File[],             // 视频文件数组
  anonymous: boolean          // 是否匿名
}
```

### 5.2 工单操作API
```javascript
POST /api/workorders/{id}/actions
{
  action: string,             // 操作类型
  note: string,               // 操作说明
  assignee_id?: string,       // 分配人ID（dispatch时）
  resolution?: string,        // 处理结果（submit_review时）
  confirm_result?: string,    // 确认结果（reporter_confirm时）
  site_photos?: string[],     // 现场照片（确认时）
  estimated_hours?: number,   // 预计工时
  actual_hours?: number       // 实际工时
}
```

### 5.3 推送通知API
```javascript
POST /api/notifications/push
{
  user_id: string,           // 目标用户
  type: string,              // 通知类型
  title: string,             // 通知标题
  message: string,           // 通知内容
  data: object,              // 额外数据
  priority: string           // 优先级
}
```

## 6. 数据库状态跟踪

### 6.1 工单状态流转
```
pending → pending_dispatch → dispatched → processing → 
pending_review → pending_reporter_confirm → completed/confirmed_failed
```

### 6.2 关键字段说明
- `initial_reporter_id`: R004原始上报人ID
- `reporter_confirm_result`: confirmed/rejected/timeout
- `timeout_intervener_id`: 超时介入的R006用户ID
- `reporter_confirmed_at`: 发起人确认时间
- `area_reviewer_id`: 区域审核人ID

## 7. APP端技术要求

### 7.1 平台支持
- **iOS**: React Native或Flutter
- **Android**: React Native或Flutter
- **离线支持**: 关键功能离线可用

### 7.2 功能模块
- **用户认证**: JWT token认证
- **位置服务**: GPS定位、地图显示
- **媒体处理**: 拍照、录像、图片压缩
- **推送通知**: 实时消息推送
- **数据同步**: 离线数据同步机制

### 7.3 安全要求
- **数据加密**: 敏感数据本地加密存储
- **传输安全**: HTTPS通信
- **权限控制**: 基于角色的功能访问控制
- **审计日志**: 关键操作记录

## 8. 测试用例

### 8.1 完整流程测试
1. R004上报问题 → 生成问题报告
2. R002审核通过 → 创建人工工单
3. R006派发工单 → 分配给R003
4. R003处理完成 → 提交审核
5. R006审核通过 → 等待确认
6. R004现场确认 → 工单完成

### 8.2 异常流程测试
1. **审核拒绝**: R002拒绝问题上报
2. **处理退回**: R006审核退回重新处理
3. **确认失败**: R004确认处理效果不满意
4. **超时处理**: R004超时未确认，R006介入

## 9. 部署和维护

### 9.1 版本发布
- **渐进式发布**: 分批次推送更新
- **回滚机制**: 支持快速版本回滚
- **兼容性**: 向下兼容旧版本API

### 9.2 监控告警
- **性能监控**: 接口响应时间、成功率
- **业务监控**: 工单处理时效、确认率
- **异常告警**: 系统错误、超时处理

这份文档详细描述了人工工单流程在APP端的完整实现方案，涵盖了从问题发现到最终确认的全流程操作。