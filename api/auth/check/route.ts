/**
 * 检查认证状态 API（用于调试）
 * GET /api/auth/check
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { successResponse } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')
  
  const debugInfo = {
    hasCookie: !!authToken,
    cookieName: authToken?.name,
    cookieValue: authToken?.value ? `${authToken.value.substring(0, 20)}...` : null,
    allCookies: cookieStore.getAll().map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0
    })),
    headers: {
      cookie: request.headers.get('cookie'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    }
  }
  
  return successResponse(debugInfo, 'Cookie 调试信息')
}