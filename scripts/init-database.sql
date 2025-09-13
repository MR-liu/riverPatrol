-- 初始化数据库脚本（开发环境）
-- 创建基本表结构和测试数据

-- 1. 创建用户表（如果不存在）
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    avatar VARCHAR(255),
    role_id VARCHAR(20) NOT NULL DEFAULT 'R003',
    department_id VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    login_attempts INTEGER DEFAULT 0,
    last_login_attempt TIMESTAMP,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 创建工单表（如果不存在）
CREATE TABLE IF NOT EXISTS workorders (
    id VARCHAR(30) PRIMARY KEY,
    type_id VARCHAR(20) NOT NULL DEFAULT 'WT_009',
    alarm_id VARCHAR(20),
    report_id VARCHAR(20),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    sla_status VARCHAR(20) DEFAULT 'active',
    department_id VARCHAR(20),
    point_id VARCHAR(20),
    area_id VARCHAR(20),
    location VARCHAR(255),
    coordinates JSONB,
    creator_id VARCHAR(20) NOT NULL,
    assignee_id VARCHAR(20),
    supervisor_id VARCHAR(20),
    reviewer_id VARCHAR(20),
    source VARCHAR(50),
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    expected_complete_at TIMESTAMP,
    completed_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 创建问题报告表（如果不存在）
CREATE TABLE IF NOT EXISTS problem_reports (
    id VARCHAR(20) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_ids JSONB NOT NULL,
    images JSONB,
    videos JSONB,
    location VARCHAR(255),
    coordinates JSONB,
    reporter_id VARCHAR(20) NOT NULL,
    department_id VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    severity VARCHAR(20),
    anonymous BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(20),
    verified_at TIMESTAMP,
    resolved_by VARCHAR(20),
    resolved_at TIMESTAMP,
    resolution TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 创建问题分类表（如果不存在）
CREATE TABLE IF NOT EXISTS problem_categories (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    parent_id VARCHAR(20),
    icon VARCHAR(50),
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. 插入测试用户数据（如果不存在）
INSERT INTO users (id, username, password, name, phone, email, role_id, status)
VALUES 
    ('U001', 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', '管理员', '13800138000', 'admin@test.com', 'R001', 'active'),
    ('U002', 'test', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', '测试用户', '13800138001', 'test@test.com', 'R003', 'active'),
    ('U003', 'inspector', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', '巡检员', '13800138002', 'inspector@test.com', 'R004', 'active')
ON CONFLICT (id) DO NOTHING;

-- 6. 插入测试问题分类（如果不存在）
INSERT INTO problem_categories (id, name, code, parent_id, color, sort_order)
VALUES
    ('PC_001', '水质问题', 'water_quality', NULL, '#0099FF', 1),
    ('PC_002', '垃圾污染', 'garbage', NULL, '#FF9900', 2),
    ('PC_003', '违法行为', 'violation', NULL, '#FF0000', 3),
    ('PC_004', '设施损坏', 'facility', NULL, '#FFCC00', 4),
    ('PC_005', '生态破坏', 'ecology', NULL, '#00CC66', 5),
    ('PC_006', '安全隐患', 'safety', NULL, '#FF3366', 6),
    ('PC_007', '其他问题', 'other', NULL, '#999999', 7)
ON CONFLICT (id) DO NOTHING;

-- 7. 创建存储上传bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('uploads', 'uploads', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- 8. 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '测试用户：';
    RAISE NOTICE '  - 管理员: admin / admin';
    RAISE NOTICE '  - 测试用户: test / test';
    RAISE NOTICE '  - 巡检员: inspector / test';
END $$;