/**
 * 获取当前用户信息 API 接口
 * GET /api/auth/me
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: NextRequest) {
  try {
    // 获取 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    // 调试信息
    console.log('[Me API] Cookie check:', {
      hasCookie: !!token,
      cookieName: COOKIE_NAME,
      allCookies: cookieStore.getAll().map(c => c.name)
    })

    if (!token) {
      console.log('[Me API] No auth token found in cookies')
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证 token
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const supabase = createServiceClient()

    // JWT 已经验证通过，直接使用 decoded 信息

    // 获取用户信息
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
        created_at,
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
      .eq('id', decoded.userId)
      .single()

    if (userError || !user) {
      return errorResponse('用户信息获取失败', 404)
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return errorResponse('账号已被禁用', 403)
    }

    // 获取用户权限
    const { data: permissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permission:permissions(
          id,
          module,
          code,
          name
        )
      `)
      .eq('role_id', user.role_id)

    const userPermissions = permissions?.map(p => p.permission?.code).filter(Boolean) || []

    // 返回用户信息
    const responseData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role_id: user.role_id,
      role: user.role,
      department_id: user.department_id,
      department: user.department,
      permissions: userPermissions,
      last_login_at: user.last_login_at,
      created_at: user.created_at
    }

    return successResponse(responseData)

  } catch (error) {
    console.error('Get current user error:', error)
    return errorResponse('获取用户信息失败', 500)
  }
}