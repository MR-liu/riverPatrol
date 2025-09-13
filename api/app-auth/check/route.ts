/**
 * 移动端检查登录状态 API
 * GET /api/app-auth/check
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { successResponse, errorResponse } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const COOKIE_NAME = 'app-auth-token'

export async function GET(request: NextRequest) {
  try {
    // 获取 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return successResponse({
        isAuthenticated: false,
        message: '未登录'
      })
    }

    // 验证 token
    try {
      const decoded = jwt.verify(finalToken, JWT_SECRET) as any
      
      // 检查是否为移动端token
      if (decoded.platform !== 'mobile') {
        return successResponse({
          isAuthenticated: false,
          message: '非移动端会话'
        })
      }

      // 计算剩余有效时间
      const now = Math.floor(Date.now() / 1000)
      const expiresIn = decoded.exp - now
      const isExpiringSoon = expiresIn < 24 * 60 * 60 // 少于24小时

      return successResponse({
        isAuthenticated: true,
        userId: decoded.userId,
        username: decoded.username,
        roleCode: decoded.roleCode,
        areaId: decoded.areaId,
        expiresIn,
        isExpiringSoon,
        shouldRefresh: isExpiringSoon,
        message: '已登录'
      })
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return successResponse({
          isAuthenticated: false,
          expired: true,
          message: '会话已过期'
        })
      }
      
      return successResponse({
        isAuthenticated: false,
        invalid: true,
        message: '会话无效'
      })
    }

  } catch (error) {
    console.error('Check auth error:', error)
    return errorResponse('检查登录状态失败', 500)
  }
}