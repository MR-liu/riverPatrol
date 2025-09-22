/**
 * 移动设备管理API
 * GET /api/mobile-devices - 获取设备列表
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value || cookieStore.get('app-auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的访问令牌', 401)
    }
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('mobile_devices')
      .select(`
        *,
        user:users (
          id,
          username,
          name,
          role:roles (
            id,
            name,
            code
          )
        )
      `)
      .order('created_at', { ascending: false })
    
    // 如果不是管理员，只能看到自己的设备
    if (decoded.roleCode !== 'R001' && decoded.roleCode !== 'admin') {
      query = query.eq('user_id', decoded.userId)
    }
    
    const { data: devices, error } = await query
    
    if (error) {
      console.error('Get devices error:', error)
      return errorResponse('获取设备列表失败', 500)
    }
    
    // 统计信息
    const stats = {
      total: devices?.length || 0,
      active: devices?.filter(d => d.is_active).length || 0,
      ios: devices?.filter(d => d.device_type === 'iOS').length || 0,
      android: devices?.filter(d => d.device_type === 'Android').length || 0
    }
    
    return successResponse({
      devices: devices || [],
      stats
    })
    
  } catch (error) {
    console.error('Mobile devices error:', error)
    return errorResponse('获取设备列表失败', 500)
  }
}