/**
 * 移动端获取当前用户信息 API
 * GET /api/app-auth/me
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const COOKIE_NAME = 'app-auth-token'

export async function GET(request: NextRequest) {
  try {
    // 获取 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    // 也支持从 Authorization header 获取 token（用于移动端）
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证 token
    let decoded: any
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const supabase = createServiceClient()

    // 查询用户详细信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        name,
        phone,
        email,
        avatar,
        role_id,
        department_id,
        status,
        last_login_at,
        role:roles!inner(
          id,
          name,
          code,
          description
        ),
        department:departments(
          id,
          name,
          code
        )
      `)
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('获取用户信息失败:', userError)
      return errorResponse('用户不存在', 404)
    }

    // 获取用户管理的区域
    let areaInfo = {
      area_id: null as string | null,
      area_name: null as string | null,
      area_code: null as string | null,
    }

    // 根据角色获取区域信息
    if (user.role.code === 'R006') {
      // 河道维护员主管
      const { data: areaData } = await supabase
        .from('river_management_areas')
        .select('id, name, code')
        .eq('supervisor_id', userId)
        .single()
      
      if (areaData) {
        areaInfo = {
          area_id: areaData.id,
          area_name: areaData.name,
          area_code: areaData.code,
        }
      }
    } else if (user.role.code === 'R003' || user.role.code === 'R004') {
      // 维护员或巡检员
      const { data: teamData } = await supabase
        .from('maintenance_teams')
        .select(`
          area_id,
          river_management_areas!inner(
            id,
            name,
            code
          )
        `)
        .eq('worker_id', userId)
        .eq('status', 'active')
        .single()
      
      if (teamData && teamData.river_management_areas) {
        areaInfo = {
          area_id: teamData.river_management_areas.id,
          area_name: teamData.river_management_areas.name,
          area_code: teamData.river_management_areas.code,
        }
      }
    }

    // 获取用户权限
    const { data: permissions } = await supabase
      .from('role_permissions')
      .select(`
        permission:permissions(
          code,
          name
        )
      `)
      .eq('role_id', user.role_id)

    const userPermissions = permissions?.map(p => p.permission?.code).filter(Boolean) || []

    // 构建返回数据
    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role_id: user.role_id,
      role: {
        id: user.role.id,
        name: user.role.name,
        code: user.role.code,
      },
      department_id: user.department_id,
      department: user.department,
      ...areaInfo,
      permissions: userPermissions,
      last_login_at: user.last_login_at,
      status: user.status,
      platform: 'mobile'
    }

    return successResponse(userData, '获取用户信息成功')

  } catch (error) {
    console.error('Get current user error:', error)
    return errorResponse('获取用户信息失败', 500)
  }
}