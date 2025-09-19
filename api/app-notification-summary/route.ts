/**
 * 通知汇总API
 * GET /api/app-notification-summary
 * 获取用户通知汇总信息，包括未读数量、最新通知等
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

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
 * 获取通知汇总
 * GET /api/app-notification-summary
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
    const supabase = createServiceClient()
    
    // 获取未读消息统计
    const { data: unreadMessages, error: unreadError } = await supabase
      .from('user_messages')
      .select('message_type, priority')
      .eq('user_id', userId)
      .eq('is_read', false)
      .eq('is_archived', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    if (unreadError) {
      console.error('查询未读消息失败:', unreadError)
      return errorResponse('查询失败', 500)
    }

    // 统计各类型未读数
    const unreadCount = {
      total: unreadMessages?.length || 0,
      workorder: 0,
      alarm: 0,
      system: 0,
      urgent: 0,
      important: 0,
      normal: 0
    }

    unreadMessages?.forEach(msg => {
      // 按类型统计
      if (msg.message_type === 'workorder') unreadCount.workorder++
      else if (msg.message_type === 'alarm') unreadCount.alarm++
      else if (msg.message_type === 'system') unreadCount.system++
      
      // 按优先级统计
      if (msg.priority === 'urgent') unreadCount.urgent++
      else if (msg.priority === 'important') unreadCount.important++
      else if (msg.priority === 'normal') unreadCount.normal++
    })

    // 获取最新的5条通知
    const { data: latestNotifications } = await supabase
      .from('user_messages')
      .select(`
        id,
        title,
        content,
        message_type,
        priority,
        created_at,
        is_read,
        related_type,
        related_id
      `)
      .eq('user_id', userId)
      .eq('is_archived', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    // 获取今日通知数量
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const { count: todayCount } = await supabase
      .from('user_messages')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())

    // 获取未处理工单数量
    const { count: pendingWorkorders } = await supabase
      .from('workorders')
      .select('id', { count: 'exact' })
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])

    // 获取未确认告警数量（如果用户有权限）
    let pendingAlarms = 0
    if (['R001', 'R002', 'R006'].includes(decoded.roleId)) {
      const { count } = await supabase
        .from('alarms')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')
      
      pendingAlarms = count || 0
    }

    // 获取用户推送配置
    const { data: pushConfig } = await supabase
      .from('push_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    // 获取设备注册状态
    const { data: devices } = await supabase
      .from('mobile_devices')
      .select('id, device_type, jpush_registration_id, push_channel, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    const hasPushEnabled = devices && devices.length > 0 && 
                          devices.some(d => d.jpush_registration_id || d.push_token)

    return successResponse({
      unread_count: unreadCount,
      latest_notifications: latestNotifications || [],
      today_count: todayCount || 0,
      pending_workorders: pendingWorkorders || 0,
      pending_alarms: pendingAlarms,
      push_config: pushConfig || {
        enable_alarm_push: true,
        enable_workorder_push: true,
        enable_notification_push: true,
        enable_inspection_push: true
      },
      push_enabled: hasPushEnabled,
      devices_count: devices?.length || 0,
      server_time: new Date().toISOString()
    }, '获取通知汇总成功')

  } catch (error) {
    console.error('[app-notification-summary] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}