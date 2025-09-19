/**
 * 通知阅读状态管理 API
 * PUT /api/notifications/[id]/read - 标记通知为已读
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

// PUT - 标记通知为已读
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
      .select('id, is_read, read_at')
      .eq('notification_id', notificationId)
      .eq('user_id', decoded.userId)
      .single()
    
    if (checkError || !userNotification) {
      return errorResponse('通知不存在或无权访问', 404)
    }
    
    if (userNotification.is_read) {
      return successResponse({
        message: '通知已经是已读状态',
        read_at: userNotification.read_at
      })
    }
    
    // 更新为已读
    const { data: updatedNotification, error: updateError } = await supabase
      .from('user_notifications')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('id', userNotification.id)
      .select()
      .single()
    
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

// DELETE - 标记通知为未读
export async function DELETE(
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
      .select('id')
      .eq('notification_id', notificationId)
      .eq('user_id', decoded.userId)
      .single()
    
    if (checkError || !userNotification) {
      return errorResponse('通知不存在或无权访问', 404)
    }
    
    // 更新为未读
    const { error: updateError } = await supabase
      .from('user_notifications')
      .update({
        is_read: false,
        read_at: null
      })
      .eq('id', userNotification.id)
    
    if (updateError) {
      console.error('Update notification unread status error:', updateError)
      return errorResponse('更新通知状态失败', 500)
    }
    
    return successResponse({
      message: '通知已标记为未读'
    })
    
  } catch (error) {
    console.error('Mark notification as unread error:', error)
    return errorResponse('标记通知未读失败', 500)
  }
}