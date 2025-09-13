/**
 * 退出登录 API 接口
 * POST /api/auth/logout
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

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (token) {
      try {
        // 验证并解析 token
        const decoded = jwt.verify(token, JWT_SECRET) as {
          userId: string
          username: string
        }

        // 记录登出日志
        logApiActivity('logout', decoded.userId, {
          username: decoded.username
        })
      } catch (error) {
        // Token 无效或已过期，忽略错误继续清除 cookie
        console.log('Invalid token during logout:', error)
      }
    }

    // 清除 Cookie
    cookieStore.set({
      name: COOKIE_NAME,
      value: '',
      maxAge: 0,
      path: '/'
    })

    return successResponse(null, '退出登录成功')
  } catch (error) {
    console.error('Logout error:', error)
    // 即使出错也要尝试清除 cookie
    try {
      const cookieStore = await cookies()
      cookieStore.set({
        name: COOKIE_NAME,
        value: '',
        maxAge: 0,
        path: '/'
      })
    } catch {}
    
    return successResponse(null, '退出登录成功')
  }
}