/**
 * 批量通知操作API
 * POST /api/app-notifications/batch - 批量标记已读/归档/删除
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
 * 批量操作通知
 * POST /api/app-notifications/batch
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

    const userId = decoded.userId
    
    // 解析请求体
    const body = await request.json()
    const {
      notification_ids = [], // 具体的通知ID列表
      action, // 'mark_read' | 'mark_unread' | 'archive' | 'unarchive' | 'delete'
      filter = {} // 批量操作的过滤条件
    } = body

    if (!action) {
      return errorResponse('操作类型不能为空', 400)
    }

    if (!['mark_read', 'mark_unread', 'archive', 'unarchive', 'delete'].includes(action)) {
      return errorResponse('操作类型无效', 400)
    }

    const supabase = createServiceClient()
    
    // 构建查询条件
    let query = supabase
      .from('user_messages')
      .select('id')
      .eq('user_id', userId)

    // 如果提供了具体的通知ID，优先使用
    if (notification_ids.length > 0) {
      query = query.in('id', notification_ids)
    } else {
      // 否则使用过滤条件
      if (filter.message_type) {
        query = query.eq('message_type', filter.message_type)
      }
      if (filter.is_read !== undefined) {
        query = query.eq('is_read', filter.is_read)
      }
      if (filter.is_archived !== undefined) {
        query = query.eq('is_archived', filter.is_archived)
      }
      if (filter.priority) {
        query = query.eq('priority', filter.priority)
      }
      if (filter.date_from) {
        query = query.gte('created_at', filter.date_from)
      }
      if (filter.date_to) {
        query = query.lte('created_at', filter.date_to)
      }
    }

    // 获取符合条件的通知
    const { data: targetNotifications, error: queryError } = await query

    if (queryError) {
      console.error('查询通知失败:', queryError)
      return errorResponse('查询失败', 500)
    }

    if (!targetNotifications || targetNotifications.length === 0) {
      return successResponse({ affected_count: 0 }, '没有找到符合条件的通知')
    }

    const targetIds = targetNotifications.map(n => n.id)
    let updateData: any = {}
    let operationResult: any

    // 根据操作类型执行相应的批量操作
    switch (action) {
      case 'mark_read':
        updateData = {
          is_read: true,
          read_at: new Date().toISOString()
        }
        break

      case 'mark_unread':
        updateData = {
          is_read: false,
          read_at: null
        }
        break

      case 'archive':
        updateData = {
          is_archived: true,
          archived_at: new Date().toISOString()
        }
        break

      case 'unarchive':
        updateData = {
          is_archived: false,
          archived_at: null
        }
        break

      case 'delete':
        // 删除操作
        const { error: deleteError } = await supabase
          .from('user_messages')
          .delete()
          .eq('user_id', userId)
          .in('id', targetIds)

        if (deleteError) {
          console.error('批量删除通知失败:', deleteError)
          return errorResponse('删除失败', 500)
        }

        operationResult = { deleted_count: targetIds.length }
        break
    }

    // 执行更新操作（除了删除）
    if (action !== 'delete') {
      const { error: updateError } = await supabase
        .from('user_messages')
        .update(updateData)
        .eq('user_id', userId)
        .in('id', targetIds)

      if (updateError) {
        console.error('批量更新通知失败:', updateError)
        return errorResponse('更新失败', 500)
      }

      operationResult = { updated_count: targetIds.length }
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-notifications/batch', userId, {
      action,
      affected_count: targetIds.length,
      used_filter: notification_ids.length === 0,
      filter: notification_ids.length === 0 ? filter : undefined
    })

    const actionMessages = {
      'mark_read': '批量标记为已读',
      'mark_unread': '批量标记为未读',
      'archive': '批量归档',
      'unarchive': '批量取消归档',
      'delete': '批量删除'
    }

    return successResponse({
      ...operationResult,
      action,
      affected_ids: targetIds
    }, `${actionMessages[action as keyof typeof actionMessages]}成功，处理了 ${targetIds.length} 条通知`)

  } catch (error) {
    console.error('[app-notifications/batch] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}