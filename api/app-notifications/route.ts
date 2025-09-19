/**
 * 实时通知API
 * GET /api/app-notifications - 获取用户通知列表
 * POST /api/app-notifications - 创建通知
 * PUT /api/app-notifications/[id] - 标记通知已读
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
 * 获取用户通知列表
 * GET /api/app-notifications
 */
export async function GET(request: NextRequest) {
  try {
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
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // workorder | alarm | system
    const isRead = searchParams.get('is_read') // true | false
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('user_messages')
      .select(`
        *,
        sender:users!user_messages_sender_id_fkey(id, name, username)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 应用过滤条件
    if (type) {
      query = query.eq('message_type', type)
    }

    if (isRead !== null) {
      query = query.eq('is_read', isRead === 'true')
    }

    // 排除已归档的消息（除非特别请求）
    const includeArchived = searchParams.get('include_archived') === 'true'
    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    // 排除过期的消息
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    // 分页
    query = query.range(offset, offset + limit - 1)

    const { data: notifications, error, count } = await query

    if (error) {
      console.error('查询通知失败:', error)
      return errorResponse('查询失败', 500)
    }

    // 获取未读消息统计
    const { data: unreadStats } = await supabase
      .from('user_messages')
      .select('message_type')
      .eq('user_id', userId)
      .eq('is_read', false)
      .eq('is_archived', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    const unreadSummary = {
      total: unreadStats?.length || 0,
      workorder: unreadStats?.filter(n => n.message_type === 'workorder').length || 0,
      alarm: unreadStats?.filter(n => n.message_type === 'alarm').length || 0,
      system: unreadStats?.filter(n => n.message_type === 'system').length || 0
    }

    return successResponse({
      notifications: notifications || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      unread_summary: unreadSummary
    }, '获取通知列表成功')

  } catch (error) {
    console.error('[app-notifications] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 创建通知 (系统内部或管理员使用)
 * POST /api/app-notifications
 */
export async function POST(request: NextRequest) {
  try {
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

    const senderId = decoded.userId
    const roleId = decoded.roleId
    
    // 解析请求体
    const body = await request.json()
    const {
      target_user_id,
      target_role_id, // 可选，发送给特定角色的所有用户
      title,
      content,
      message_type, // 'workorder' | 'alarm' | 'system'
      priority = 'normal', // 'urgent' | 'important' | 'normal'
      related_type, // 关联业务类型
      related_id, // 关联业务ID
      action_url, // 操作链接
      action_text, // 操作按钮文本
      expires_at // 过期时间
    } = body

    if (!title || !content || !message_type) {
      return errorResponse('参数不完整', 400)
    }

    // 权限检查：只有管理员角色可以创建系统通知
    const canCreateNotification = ['R001', 'R002', 'R006'].includes(roleId)
    if (!canCreateNotification && message_type === 'system') {
      return errorResponse('无权限创建系统通知', 403)
    }

    const supabase = createServiceClient()
    
    // 确定目标用户列表
    let targetUserIds: string[] = []
    
    if (target_user_id) {
      // 发送给特定用户
      targetUserIds = [target_user_id]
    } else if (target_role_id) {
      // 发送给特定角色的所有用户
      const { data: roleUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', target_role_id)
        .eq('status', 'active')
      
      targetUserIds = roleUsers?.map(u => u.id) || []
    } else {
      return errorResponse('必须指定目标用户或角色', 400)
    }

    if (targetUserIds.length === 0) {
      return errorResponse('未找到目标用户', 400)
    }

    // 批量创建通知记录
    const notifications = targetUserIds.map(userId => ({
      id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${userId}`,
      user_id: userId,
      title,
      content,
      message_type,
      priority,
      category: related_type || message_type,
      related_type,
      related_id,
      sender_id: senderId,
      action_url,
      action_text,
      expires_at,
      created_at: new Date().toISOString()
    }))

    const { data: createdNotifications, error: insertError } = await supabase
      .from('user_messages')
      .insert(notifications)
      .select('*')

    if (insertError) {
      console.error('创建通知失败:', insertError)
      return errorResponse('创建通知失败', 500)
    }

    // 同时添加到通知队列用于推送
    const queueItems = targetUserIds.map(userId => ({
      id: `NQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${userId}`,
      user_id: userId,
      type: message_type,
      title,
      content,
      priority,
      related_type,
      related_id,
      status: 'pending',
      created_at: new Date().toISOString()
    }))

    await supabase
      .from('notification_queue')
      .insert(queueItems)
    
    // 发送极光推送通知
    if (process.env.ENABLE_PUSH_NOTIFICATIONS === 'true') {
      try {
        const { default: pushNotificationService } = await import('@/lib/push-notification.service')
        
        // 根据消息类型选择推送模板
        let templateCode = 'SYSTEM_ANNOUNCEMENT'
        const templateData: any = {
          title,
          content,
          action_url
        }
        
        // 根据不同的消息类型使用不同的模板
        if (message_type === 'workorder' && related_id) {
          templateCode = 'WORKORDER_ASSIGNED'
          templateData.orderId = related_id
          templateData.orderType = related_type || '工单'
        } else if (message_type === 'alarm' && related_id) {
          templateCode = 'ALARM_NEW'
          templateData.alarmId = related_id
          templateData.alarmType = related_type || '告警'
        }
        
        // 发送推送
        await pushNotificationService.sendTemplateNotification(
          templateCode,
          templateData,
          targetUserIds,
          {
            priority: priority === 'urgent' ? 'urgent' : priority === 'important' ? 'high' : 'normal',
            saveToDatabase: false, // 已经在上面保存了
            sendAppPush: true
          }
        )
      } catch (pushError) {
        console.error('发送推送失败:', pushError)
        // 不影响主流程，记录错误即可
      }
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-notifications', senderId, {
      target_users: targetUserIds.length,
      message_type,
      priority
    })

    return successResponse({
      notifications: createdNotifications,
      target_users: targetUserIds.length,
      queued_for_push: true
    }, `通知创建成功，已发送给 ${targetUserIds.length} 个用户`)

  } catch (error) {
    console.error('[app-notifications] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}