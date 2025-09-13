/**
 * 测试权限中间件 API
 */

import { NextRequest } from 'next/server'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  withAuth
} from '@/lib/supabase'

// 不需要权限的测试
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    
    // 获取用户数量
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    
    return successResponse({
      message: 'API working',
      userCount: count
    })
  } catch (error) {
    console.error('Test API error:', error)
    return errorResponse('测试失败', 500)
  }
}

// 需要权限的测试
export const POST = withAuth({ 
  requiredPermissions: ['user.view']
})(async (request: NextRequest) => {
  try {
    const user = (request as any).user
    
    return successResponse({
      message: 'Auth working',
      user: {
        id: user.id,
        username: user.username,
        role: user.role.name,
        permissions: user.permissions?.length || 0
      }
    })
  } catch (error) {
    console.error('Test auth API error:', error)
    return errorResponse('权限测试失败', 500)
  }
})