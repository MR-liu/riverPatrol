/**
 * 移动端登出 API 接口
 * POST /api/app-auth/logout
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { successResponse, errorResponse, logApiActivity } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'

export async function POST(request: NextRequest) {
  try {
    // 获取 token（从 cookie 或 header）
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get(COOKIE_NAME)?.value
    
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const token = cookieToken || headerToken

    // 清除 cookie
    if (cookieToken) {
      cookieStore.delete({
        name: COOKIE_NAME,
        path: '/'
      })
    }

    // 记录登出日志（如果有token，尝试解析用户信息）
    if (token) {
      try {
        const jwt = require('jsonwebtoken')
        const decoded = jwt.decode(token) as any
        if (decoded?.userId) {
          logApiActivity('mobile_logout', decoded.userId, {
            username: decoded.username,
            platform: 'mobile'
          })
        }
      } catch (error) {
        console.error('Failed to decode token for logging:', error)
      }
    }

    return successResponse(
      { 
        message: '登出成功',
        redirect: '/login' 
      }, 
      '已安全退出'
    )

  } catch (error) {
    console.error('Mobile logout error:', error)
    return errorResponse('登出失败', 500)
  }
}