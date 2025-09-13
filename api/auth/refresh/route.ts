/**
 * 刷新会话 API 接口
 * POST /api/auth/refresh
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  logApiActivity
} from '@/lib/supabase'

const SESSION_CONFIG = {
  tokenSecret: process.env.JWT_SECRET || 'default-secret-key',
  cookieName: 'auth-token',
  defaultExpiry: 24 * 60 * 60, // 24小时
}

export async function POST(request: NextRequest) {
  try {
    // 获取当前 token
    const cookieStore = await cookies()
    const currentToken = cookieStore.get(SESSION_CONFIG.cookieName)?.value

    if (!currentToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证当前 token
    let decoded: any
    try {
      decoded = jwt.verify(currentToken, SESSION_CONFIG.tokenSecret)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const supabase = createServiceClient()

    // JWT 已经验证通过，可以继续

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        role_id,
        status
      `)
      .eq('id', decoded.userId)
      .single()

    if (userError || !user) {
      return errorResponse('用户不存在', 404)
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return errorResponse('账号已被禁用', 403)
    }

    // 生成新的 token
    const newToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        roleId: user.role_id,
        iat: Math.floor(Date.now() / 1000),
      },
      SESSION_CONFIG.tokenSecret,
      { expiresIn: SESSION_CONFIG.defaultExpiry }
    )

    const newExpiresAt = new Date(Date.now() + SESSION_CONFIG.defaultExpiry * 1000)

    // 设置新的 Cookie
    cookieStore.set({
      name: SESSION_CONFIG.cookieName,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_CONFIG.defaultExpiry,
      path: '/'
    })

    // 记录日志
    logApiActivity('session_refresh', user.id, {
      username: user.username
    })

    return successResponse({
      token: newToken,
      expires_at: newExpiresAt.toISOString()
    }, '会话刷新成功')

  } catch (error) {
    console.error('Refresh session error:', error)
    return errorResponse('会话刷新失败', 500)
  }
}