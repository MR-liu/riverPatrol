/**
 * 获取当前用户权限 API 接口
 * GET /api/auth/permissions - 获取当前用户的权限列表
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

    if (!token) {
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

    // 获取用户角色权限
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        role_id,
        role:roles!inner(
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

    // 获取角色对应的权限
    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permission:permissions!inner(
          id,
          module,
          code,
          name,
          description
        )
      `)
      .eq('role_id', user.role_id)

    if (permError) {
      console.error('Get permissions error:', permError)
      return errorResponse('获取权限失败', 500)
    }

    // 提取权限代码
    const permissions = rolePermissions?.map(rp => rp.permission).filter(Boolean) || []
    const permissionCodes = permissions.map(p => p.code)

    // 返回权限信息
    const responseData = {
      user_id: user.id,
      username: user.username,
      role: {
        id: user.role.id,
        name: user.role.name,
        code: user.role.code
      },
      permissions: permissionCodes,
      permissionDetails: permissions,
      isAdmin: user.role.code === 'ADMIN'
    }

    return successResponse(responseData)

  } catch (error) {
    console.error('Get user permissions error:', error)
    return errorResponse('获取用户权限失败', 500)
  }
}