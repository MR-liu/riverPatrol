/**
 * APP通知已读标记API
 * PUT /api/app-notifications/[id]/read
 * 标记指定通知为已读
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params
    
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
    const now = new Date().toISOString()
    
    // 检查用户通知是否存在
    const { data: userNotification, error: checkError } = await supabase
      .from('user_notifications')
      .select('id, is_read')
      .eq('notification_id', notificationId)
      .eq('user_id', decoded.userId)
      .single()
    
    if (checkError || !userNotification) {
      return errorResponse('通知不存在或无权访问', 404)
    }
    
    if (userNotification.is_read) {
      return successResponse({
        message: '通知已经是已读状态'
      })
    }
    
    // 更新为已读
    const { error: updateError } = await supabase
      .from('user_notifications')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('id', userNotification.id)
    
    if (updateError) {
      console.error('Update notification read status error:', updateError)
      return errorResponse('更新通知状态失败', 500)
    }
    
    return successResponse({
      message: '通知已标记为已读',
      read_at: now
    })
    
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return errorResponse('标记通知已读失败', 500)
  }
}