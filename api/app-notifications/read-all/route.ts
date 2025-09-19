/**
 * APP批量标记已读API
 * PUT /api/app-notifications/read-all
 * 批量标记通知为已读
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

export async function PUT(request: NextRequest) {
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
    
    const body = await request.json()
    const { notification_ids } = body // 可选，不传则标记所有为已读
    
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    
    let updateQuery = supabase
      .from('user_notifications')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('user_id', decoded.userId)
      .eq('is_read', false) // 只更新未读的
    
    // 如果指定了ID列表，只更新这些
    if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
      updateQuery = updateQuery.in('notification_id', notification_ids)
    }
    
    const { data: updated, error: updateError } = await updateQuery.select()
    
    if (updateError) {
      console.error('Mark notifications as read error:', updateError)
      return errorResponse('标记已读失败', 500)
    }
    
    return successResponse({
      message: notification_ids 
        ? `已标记 ${updated?.length || 0} 条通知为已读`
        : '所有通知已标记为已读',
      count: updated?.length || 0
    })
    
  } catch (error) {
    console.error('Mark all as read error:', error)
    return errorResponse('标记已读失败', 500)
  }
}