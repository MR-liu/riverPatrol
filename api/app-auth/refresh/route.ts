/**
 * 移动端刷新 Token API
 * POST /api/app-auth/refresh
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const COOKIE_NAME = 'app-auth-token'

/**
 * 生成新的 JWT Token
 */
function generateToken(
  userId: string,
  username: string,
  roleId: string,
  roleCode: string,
  areaId: string | null,
  expiresIn: number
): string {
  return jwt.sign(
    {
      userId,
      username,
      roleId,
      roleCode,
      areaId,
      platform: 'mobile',
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn }
  )
}

export async function POST(request: NextRequest) {
  try {
    // 获取当前 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const currentToken = token || headerToken
    
    if (!currentToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证当前 token
    let decoded: any
    try {
      decoded = jwt.verify(currentToken, JWT_SECRET)
    } catch (error: any) {
      // 如果token过期但能解码，尝试刷新
      if (error.name === 'TokenExpiredError') {
        try {
          decoded = jwt.decode(currentToken)
        } catch {
          return errorResponse('无效的会话', 401)
        }
      } else {
        return errorResponse('会话无效', 401)
      }
    }

    const userId = decoded.userId
    const supabase = createServiceClient()

    // 验证用户是否仍然有效
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        status,
        role_id,
        role:roles!inner(
          code
        )
      `)
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return errorResponse('用户不存在', 404)
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return errorResponse('账号已被禁用', 403)
    }

    // 生成新的 token
    const newToken = generateToken(
      user.id,
      user.username,
      user.role_id,
      user.role.code,
      decoded.areaId, // 保留原有的区域ID
      7 * 24 * 60 * 60 // 7天有效期
    )

    // 设置新的 Cookie
    cookieStore.set({
      name: COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    return successResponse({
      token: newToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }, 'Token刷新成功')

  } catch (error) {
    console.error('Refresh token error:', error)
    return errorResponse('Token刷新失败', 500)
  }
}