/**
 * 单个通知操作API
 * GET /api/app-notifications/[id] - 获取通知详情
 * PUT /api/app-notifications/[id] - 更新通知状态 (标记已读/归档)
 * DELETE /api/app-notifications/[id] - 删除通知
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse, logApiActivity } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

interface JWTPayload {
  userId: string;
  username: string;
  roleId: string;
  roleCode: string;
  areaId?: string;
  platform?: string;
  iat?: number;
  exp?: number;
}

/**
 * 获取通知详情
 * GET /api/app-notifications/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id
    
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const supabase = createServiceClient()
    
    // 获取通知详情，确保只能查看自己的通知
    const { data: notification, error } = await supabase
      .from('user_messages')
      .select(`
        *,
        sender:users!user_messages_sender_id_fkey(id, name, username),
        related_workorder:workorders(id, title, status),
        related_alarm:alarms(id, title, status)
      `)
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single()

    if (error || !notification) {
      return errorResponse('通知不存在', 404)
    }

    // 如果通知未读，自动标记为已读
    if (!notification.is_read) {
      await supabase
        .from('user_messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
    }

    return successResponse({
      notification: {
        ...notification,
        is_read: true,
        read_at: notification.read_at || new Date().toISOString()
      }
    }, '获取通知详情成功')

  } catch (error) {
    console.error('[app-notifications/id] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 更新通知状态
 * PUT /api/app-notifications/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id
    
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    
    // 解析请求体
    const body = await request.json()
    const {
      is_read,
      is_archived
    } = body

    const supabase = createServiceClient()
    
    // 验证通知存在且属于当前用户
    const { data: notification, error: checkError } = await supabase
      .from('user_messages')
      .select('id, is_read, is_archived')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single()

    if (checkError || !notification) {
      return errorResponse('通知不存在', 404)
    }

    // 构建更新数据
    let updateData: any = {}
    
    if (typeof is_read === 'boolean' && is_read !== notification.is_read) {
      updateData.is_read = is_read
      updateData.read_at = is_read ? new Date().toISOString() : null
    }
    
    if (typeof is_archived === 'boolean' && is_archived !== notification.is_archived) {
      updateData.is_archived = is_archived
      updateData.archived_at = is_archived ? new Date().toISOString() : null
    }

    if (Object.keys(updateData).length === 0) {
      return successResponse({ notification }, '通知状态无需更新')
    }

    // 更新通知状态
    const { data: updatedNotification, error: updateError } = await supabase
      .from('user_messages')
      .update(updateData)
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (updateError) {
      console.error('更新通知状态失败:', updateError)
      return errorResponse('更新失败', 500)
    }

    // 记录API活动日志
    await logApiActivity('PUT', `app-notifications/${notificationId}`, userId, updateData)

    return successResponse({
      notification: updatedNotification
    }, '通知状态更新成功')

  } catch (error) {
    console.error('[app-notifications/id] PUT error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 删除通知
 * DELETE /api/app-notifications/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id
    
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const supabase = createServiceClient()
    
    // 删除通知（只能删除自己的）
    const { error } = await supabase
      .from('user_messages')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      console.error('删除通知失败:', error)
      return errorResponse('删除失败', 500)
    }

    // 记录API活动日志
    await logApiActivity('DELETE', `app-notifications/${notificationId}`, userId)

    return successResponse({ deleted_id: notificationId }, '通知删除成功')

  } catch (error) {
    console.error('[app-notifications/id] DELETE error:', error)
    return errorResponse('服务器错误', 500)
  }
}