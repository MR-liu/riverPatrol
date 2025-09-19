/**
 * APP未读通知数量API
 * GET /api/app-notifications/unread-count
 * 获取未读通知数量，用于APP角标显示
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
    const token = cookieStore.get('auth-token')?.value
    
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
    
    // 获取总未读数
    const { count: unreadCount } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', decoded.userId)
      .eq('is_read', false)
    
    // 获取告警相关未读数
    const { data: alarmNotifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'alarm')
      .eq('user_notifications.user_id', decoded.userId)
      .eq('user_notifications.is_read', false)
    
    // 获取工单相关未读数  
    const { data: workorderNotifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'workorder')
      .eq('user_notifications.user_id', decoded.userId)
      .eq('user_notifications.is_read', false)
    
    return successResponse({
      unread_count: unreadCount || 0,
      alarm_count: alarmNotifications?.length || 0,
      workorder_count: workorderNotifications?.length || 0
    })
    
  } catch (error) {
    console.error('Get unread count error:', error)
    return errorResponse('获取未读数量失败', 500)
  }
}