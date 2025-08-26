# API 接口测试指南

这个脚本用于测试智慧河道巡查系统的所有API接口功能。

## 使用方法

### 1. 安装依赖
```bash
# 确保你在项目根目录
npm install node-fetch
```

### 2. 设置环境变量
```bash
# 设置你的Supabase URL（如果不是本地开发）
export SUPABASE_URL="https://your-project.supabase.co"
```

### 3. 运行测试
```bash
# 运行所有API测试
node scripts/test-api.js

# 或者给脚本添加执行权限后直接运行
chmod +x scripts/test-api.js
./scripts/test-api.js
```

## 测试内容

### 🔐 用户认证测试
- [x] 用户登录接口
- [x] 获取访问Token
- [x] Token验证

### 📋 问题分类测试  
- [x] 获取所有分类
- [x] 获取指定层级分类
- [x] 获取子分类

### 🎫 工单管理测试
- [x] 获取工单列表 (分页、筛选)
- [x] 创建新工单
- [x] 更新工单状态

### 📊 统计数据测试
- [x] 获取仪表板统计
- [x] 验证数据结构

### 📁 文件上传测试
- [x] 单文件上传
- [x] 文件类型验证
- [x] 文件大小验证

### 📝 问题报告测试
- [x] 提交问题报告
- [x] 自动转工单逻辑

## 预期结果

正常情况下应该看到类似以下输出：

```
🚀 开始API接口测试...

=== 测试用户登录 ===
✓ 登录成功: 系统管理员
ℹ Token: eyJhbGciOiJIUzI1NiIsI...

=== 测试问题分类接口 ===
✓ 获取所有分类成功: 45 个分类
✓ 获取三级分类成功: 35 个分类
✓ 获取子分类成功: 6 个分类

=== 测试工单接口 ===
✓ 获取工单列表成功: 10/125 个工单
✓ 创建工单成功: WO20240120001
✓ 更新工单状态成功: assigned

=== 测试统计数据接口 ===
✓ 获取仪表板统计成功:
ℹ   总工单数: 125
ℹ   待处理: 15
ℹ   已完成: 85
ℹ   完成率: 68%
ℹ   今日新增: 8

=== 测试文件上传接口 ===  
✓ 文件上传成功: FILE20240120001
ℹ   文件URL: https://...
ℹ   文件大小: 34 bytes

=== 测试问题报告接口 ===
✓ 提交问题报告成功: PR20240120001

=== 测试总结 ===
ℹ 总计测试: 6
✓ 通过: 6
ℹ 成功率: 100.0%

🎉 所有测试通过！API服务运行正常
```

## 故障排除

### 登录失败
- 检查测试用户credentials是否正确
- 确认Supabase项目中存在相应用户
- 验证custom-login函数是否部署

### 接口404错误
- 确认Edge Functions是否已部署
- 检查SUPABASE_URL是否正确
- 验证函数名称是否匹配

### 认证错误
- 确认Token是否正确获取
- 检查RLS策略是否配置正确
- 验证用户权限

### 数据错误
- 检查数据库表是否已创建
- 确认种子数据是否已导入
- 验证表结构是否匹配

## 自定义测试

你可以修改脚本中的测试数据：

```javascript
// 修改测试用户
const TEST_USER = {
  username: 'your_test_user',
  password: 'your_password'
};

// 修改测试数据
const newWorkOrder = {
  type_id: 'WT001', 
  title: '自定义测试工单',
  // ...
};
```

## 集成到CI/CD

可以将此脚本集成到你的CI/CD流程中：

```yaml
# GitHub Actions 示例
- name: Run API Tests
  run: |
    export SUPABASE_URL=${{ secrets.SUPABASE_URL }}
    node scripts/test-api.js
  env:
    NODE_ENV: test
```