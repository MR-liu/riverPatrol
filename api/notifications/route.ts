/**
 * 通知管理 API
 * GET /api/notifications - 获取用户通知列表
 * POST /api/notifications - 创建新通知
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { z } from 'zod'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// 通知创建请求验证模式
const createNotificationSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  type: z.enum(['info', 'warning', 'error', 'success'], {
    invalid_type_error: '通知类型必须是 info, warning, error 或 success'
  }),
  target_users: z.array(z.string()).optional(), // 目标用户ID列表，为空则发送给所有用户
  target_roles: z.array(z.string()).optional(), // 目标角色列表
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  expires_at: z.string().optional(), // 过期时间
  action_url: z.string().optional(), // 点击跳转链接
  metadata: z.record(z.any()).optional(), // 额外元数据
  send_push: z.boolean().optional().default(true) // 是否发送极光推送
})

// GET - 获取用户通知列表
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
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // 'unread', 'read', 'all'
    const type = searchParams.get('type')
    
    const offset = (page - 1) * limit
    const supabase = createServiceClient()
    
    // 构建查询 - 适配新的多对多结构
    let query = supabase
      .from('notifications')
      .select(`
        id,
        title,
        content,
        type,
        priority,
        send_type,
        target_roles,
        target_users,
        related_type,
        related_id,
        action_url,
        expires_at,
        metadata,
        created_by,
        created_at,
        user_notifications!inner(
          id,
          is_read,
          read_at,
          user_id
        )
      `)
      .eq('user_notifications.user_id', decoded.userId)
      .order('created_at', { ascending: false })
    
    // 应用过滤条件
    if (status && status !== 'all') {
      if (status === 'unread') {
        query = query.eq('user_notifications.is_read', false)
      } else if (status === 'read') {
        query = query.eq('user_notifications.is_read', true)
      }
    }
    
    if (type) {
      query = query.eq('type', type)
    }
    
    // 分页
    const { data: notifications, error, count } = await query
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Get notifications error:', error)
      return errorResponse('获取通知失败', 500)
    }
    
    // 获取未读数量
    const { count: unreadCount } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', decoded.userId)
      .eq('is_read', false)
    
    // 格式化通知数据
    const formattedNotifications = notifications?.map(notification => ({
      ...notification,
      is_read: notification.user_notifications?.[0]?.is_read || false,
      read_at: notification.user_notifications?.[0]?.read_at,
      user_notifications: undefined // 清理关联数据
    })) || []
    
    return successResponse({
      notifications: formattedNotifications,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      },
      unread_count: unreadCount || 0
    })
    
  } catch (error) {
    console.error('Get notifications error:', error)
    return errorResponse('获取通知失败', 500)
  }
}

// POST - 创建新通知
export async function POST(request: NextRequest) {
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
    
    // 只有管理员和监控中心主管可以发送通知
    // R001 是管理员角色代码
    if (!['ADMIN', 'MONITOR_MANAGER', 'R001', 'admin'].includes(decoded.roleCode)) {
      console.log('[Notification] Access denied for role:', decoded.roleCode)
      return errorResponse('只有管理员可以发送通知', 403)
    }
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = createNotificationSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const {
      title,
      content,
      type,
      target_users,
      target_roles,
      priority,
      expires_at,
      action_url,
      metadata,
      send_push
    } = validationResult.data
    
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    
    // 首先确定目标用户
    let targetUserIds: string[] = []
    
    if (target_users && target_users.length > 0) {
      // 指定用户
      targetUserIds = target_users
    } else if (target_roles && target_roles.length > 0) {
      // 按角色筛选用户
      const { data: roleUsers } = await supabase
        .from('users')
        .select('id, roles!users_role_id_fkey(code)')
        .eq('status', 'active')
        .in('roles.code', target_roles)
      
      targetUserIds = roleUsers?.map(u => u.id) || []
    } else {
      // 发送给所有活跃用户
      const { data: allUsers } = await supabase
        .from('users')
        .select('id')
        .eq('status', 'active')
      
      targetUserIds = allUsers?.map(u => u.id) || []
    }
    
    if (targetUserIds.length === 0) {
      return errorResponse('没有找到目标用户', 400)
    }
    
    // 创建通知主记录（只创建一条）
    const notificationId = `N${Date.now().toString().slice(-10)}`
    const notificationData = {
      id: notificationId,
      title,
      content,
      type,
      priority,
      send_type: target_users && target_users.length > 0 ? 'user' : 
                target_roles && target_roles.length > 0 ? 'role' : 'all',
      target_users: target_users || null,
      target_roles: target_roles || null,
      related_type: metadata?.related_type || null,
      related_id: metadata?.related_id || null,
      action_url: action_url || null,
      expires_at: expires_at || null,
      metadata: metadata || {},
      created_by: decoded.userId,
      created_at: now
    }
    
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single()
      
    if (notificationError) {
      console.error('Create notification error:', notificationError)
      return errorResponse('创建通知失败', 500)
    }
    
    // 创建用户通知关联记录（多对多关系）
    const timestamp = Date.now().toString().slice(-10)
    const userNotifications = targetUserIds.map((userId, index) => ({
      id: `UN${timestamp}${index.toString().padStart(3, '0')}`,
      notification_id: notification.id,
      user_id: userId,
      is_read: false,
      read_at: null,
      created_at: now
    }))
    
    if (userNotifications.length > 0) {
      const { error: userNotificationError } = await supabase
        .from('user_notifications')
        .insert(userNotifications)
      
      if (userNotificationError) {
        console.error('Create user notifications error:', userNotificationError)
        // 不阻断主流程，只记录错误
      }
    }
    
    // 集成极光推送服务
    let pushResult = null
    if (send_push && targetUserIds.length > 0) {
      try {
        // 使用推送通知服务发送到APP
        const pushNotificationService = (await import('@/lib/push-notification.service')).default
        
        // 根据通知类型使用不同的模板或直接推送
        const pushResponse = await pushNotificationService.sendTemplateNotification(
          'SYSTEM_NOTIFICATION', // 使用系统通知模板
          {
            title,
            content,
            notificationId: notification.id,
            action_url: action_url || `/dashboard/notifications`
          },
          targetUserIds,
          {
            priority: priority as any,
            saveToDatabase: false, // 已经保存到数据库了
            sendAppPush: true,
            extras: {
              notification_type: type,
              ...metadata
            }
          }
        )
        
        pushResult = {
          success: pushResponse.success,
          message: pushResponse.message,
          targetUsers: pushResponse.targetUsers
        }
        
        console.log('[Notification] Push sent:', pushResult)
      } catch (pushError) {
        console.error('[Notification] Push error:', pushError)
        // 推送失败不影响通知创建
      }
    }
    
    return successResponse({
      notification,
      target_count: targetUserIds.length,
      push_result: pushResult,
      message: `通知已发送给 ${targetUserIds.length} 个用户${pushResult?.success ? '，推送已发送' : ''}`
    })
    
  } catch (error) {
    console.error('Create notification error:', error)
    return errorResponse('创建通知失败', 500)
  }
}