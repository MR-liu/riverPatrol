-- 更新巡检员的区域分配
-- 将巡检员001分配到东区
UPDATE users 
SET area_id = 'AREA_EAST_001' 
WHERE id = 'U_INSPECTOR_001';

-- 将巡检员002分配到西区
UPDATE users 
SET area_id = 'AREA_WEST_001' 
WHERE id = 'U_INSPECTOR_002';

-- 验证更新结果
SELECT id, username, name, role_id, area_id 
FROM users 
WHERE role_id IN ('R003', 'R004')
ORDER BY role_id, id;