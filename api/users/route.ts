/**
 * 用户管理API
 * 处理用户的查询和管理操作
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { USER_PERMISSIONS } from '@/lib/permissions/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// GET - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const { searchParams } = new URL(request.url)
    const roleCode = searchParams.get('role')
    const departmentId = searchParams.get('department')
    const status = searchParams.get('status')
    
    console.log('用户API请求 - 用户角色:', decoded.roleCode, '请求角色过滤:', roleCode, '用户ID:', decoded.userId)
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        name,
        phone,
        email,
        role_id,
        department_id,
        status,
        created_at,
        updated_at,
        roles!users_role_id_fkey(
          id,
          code,
          name,
          description
        ),
        departments!users_department_id_fkey(
          id,
          name,
          code
        )
      `)
      .order('created_at', { ascending: false })
    
    // 按角色筛选
    if (roleCode) {
      // 先获取角色ID
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('code', roleCode)
        .single()
      
      if (role) {
        query = query.eq('role_id', role.id)
      }
    }
    
    // 按部门筛选
    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }
    
    // 按状态筛选
    if (status) {
      query = query.eq('status', status)
    }
    
    // R006(维护员主管)权限限制：只能看到自己管辖区域的维护员
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      console.log('维护员主管权限限制 - 用户ID:', decoded.userId)
      // 获取主管负责的区域
      const { data: supervisorAreas } = await supabase
        .from('river_management_areas')
        .select('id')
        .eq('supervisor_id', decoded.userId)
      
      console.log('主管负责的区域:', supervisorAreas)
      
      if (supervisorAreas && supervisorAreas.length > 0) {
        // 获取这些区域的维护团队成员
        const { data: teamMembers } = await supabase
          .from('maintenance_teams')
          .select('worker_id')
          .in('area_id', supervisorAreas.map(area => area.id))
        
        if (teamMembers && teamMembers.length > 0) {
          const workerIds = teamMembers.map(tm => tm.worker_id)
          query = query.in('id', workerIds)
        } else {
          // 如果没有团队成员，返回空结果
          query = query.eq('id', 'no-users') // 这会返回空结果
        }
      } else {
        // 如果主管没有负责的区域，返回空结果
        query = query.eq('id', 'no-users')
      }
    } else if (decoded.roleCode === 'ADMIN' || decoded.roleCode === 'MONITOR_MANAGER') {
      console.log('管理员或监控中心主管，可以查看所有用户')
      // 无需额外限制，可以查看所有用户
    }
    
    const { data: users, error } = await query
    
    if (error) {
      console.error('Query users error:', error)
      return errorResponse('获取用户列表失败', 500)
    }
    
    console.log('用户查询结果:', users?.length, '个用户')
    console.log('用户数据示例:', users?.slice(0, 2))
    
    // 格式化用户数据
    const formattedUsers = users?.map(user => ({
      ...user,
      role_name: user.roles?.name || '未分配',
      role_code: user.roles?.code || '',
      department_name: user.departments?.name || '未分配'
    })) || []
    
    console.log('返回格式化用户:', formattedUsers.length, '个用户')
    
    return successResponse({
      users: formattedUsers,
      total: formattedUsers.length
    })
  } catch (error) {
    console.error('Get users error:', error)
    return errorResponse('获取用户列表失败', 500)
  }
}