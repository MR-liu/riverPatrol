/**
 * APP推送发送API
 * POST /api/app-push-send
 * 用于发送推送通知给指定用户
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { z } from 'zod'
import pushNotificationService from '@/lib/push-notification.service'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// 推送请求验证
const pushSendSchema = z.object({
  // 目标用户
  target_user_ids: z.array(z.string()).optional(),
  target_role_ids: z.array(z.string()).optional(),
  target_all: z.boolean().optional(),
  
  // 推送内容
  template_code: z.string().optional(), // 使用模板
  template_data: z.record(z.any()).optional(), // 模板数据
  
  // 或直接提供内容
  title: z.string().optional(),
  content: z.string().optional(),
  
  // 推送选项
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  platform: z.enum(['all', 'ios', 'android']).default('all'),
  extras: z.record(z.any()).optional(),
  
  // 行为选项
  save_to_database: z.boolean().default(true),
  send_app_push: z.boolean().default(true)
})

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
    
    // 只有管理员和监控中心主管可以发送推送
    // 支持角色ID和角色代码
    const adminRoles = ['R001', 'R002', 'ADMIN', 'MONITOR_MANAGER']
    if (!adminRoles.includes(decoded.roleCode) && !adminRoles.includes(decoded.roleId)) {
      console.log('[Push] Access denied for role:', decoded.roleCode, decoded.roleId)
      return errorResponse('只有管理员可以发送推送通知', 403)
    }
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = pushSendSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const data = validationResult.data
    
    // 确定目标用户
    let targetUserIds: string[] = []
    
    if (data.target_user_ids && data.target_user_ids.length > 0) {
      // 指定用户
      targetUserIds = data.target_user_ids
    } else if (data.target_role_ids && data.target_role_ids.length > 0) {
      // 按角色获取用户
      const { createServiceClient } = await import('@/lib/supabase')
      const supabase = createServiceClient()
      
      const { data: roleUsers } = await supabase
        .from('users')
        .select('id')
        .in('role_id', data.target_role_ids)
        .eq('status', 'active')
      
      targetUserIds = roleUsers?.map(u => u.id) || []
    } else if (data.target_all) {
      // 所有用户
      const { createServiceClient } = await import('@/lib/supabase')
      const supabase = createServiceClient()
      
      const { data: allUsers } = await supabase
        .from('users')
        .select('id')
        .eq('status', 'active')
      
      targetUserIds = allUsers?.map(u => u.id) || []
    } else {
      return errorResponse('请指定推送目标', 400)
    }
    
    if (targetUserIds.length === 0) {
      return errorResponse('未找到目标用户', 400)
    }
    
    // 发送推送
    let result
    
    if (data.template_code) {
      // 使用模板发送
      result = await pushNotificationService.sendTemplateNotification(
        data.template_code,
        data.template_data || {},
        targetUserIds,
        {
          platform: data.platform,
          priority: data.priority,
          extras: data.extras,
          saveToDatabase: data.save_to_database,
          sendAppPush: data.send_app_push
        }
      )
    } else if (data.title && data.content) {
      // 直接发送自定义内容
      const { createServiceClient } = await import('@/lib/supabase')
      const supabase = createServiceClient()
      
      // 保存到数据库
      if (data.save_to_database) {
        const timestamp = Date.now().toString().slice(-10)
        const notifications = targetUserIds.map((userId, index) => ({
          id: `N${timestamp}${index.toString().padStart(3, '0')}`,
          user_id: userId,
          title: data.title,
          content: data.content,
          type: 'system',
          priority: data.priority,
          metadata: data.extras,
          created_at: new Date().toISOString()
        }))
        
        await supabase
          .from('notifications')
          .insert(notifications)
        
        // 创建用户关联（使用新的user_notifications表）
        const readTimestamp = Date.now().toString().slice(-10)
        const userNotifications = notifications.map((n, index) => ({
          id: `UN${readTimestamp}${index.toString().padStart(3, '0')}`,
          notification_id: n.id,
          user_id: n.user_id,
          is_read: false,
          read_at: null,
          created_at: new Date().toISOString()
        }))
        
        await supabase
          .from('user_notifications')
          .insert(userNotifications)
      }
      
      // 发送APP推送
      if (data.send_app_push) {
        const { default: jpushService } = await import('@/lib/jpush/service')
        
        // 获取设备信息
        const { data: devices } = await supabase
          .from('mobile_devices')
          .select('*')
          .in('user_id', targetUserIds)
          .eq('is_active', true)
        
        if (devices && devices.length > 0) {
          const jpushIds = devices
            .map(d => d.jpush_registration_id || d.device_token)
            .filter(Boolean)
          
          if (jpushIds.length > 0) {
            await jpushService.sendToDevices(jpushIds, {
              title: data.title!,
              content: data.content!,
              extras: data.extras
            })
          }
        }
      }
      
      result = {
        success: true,
        message: `推送发送成功，目标用户 ${targetUserIds.length} 人`,
        targetUsers: targetUserIds.length
      }
    } else {
      return errorResponse('请提供推送内容或模板', 400)
    }
    
    // 记录操作日志
    console.log(`[Push] User ${decoded.username} sent push to ${targetUserIds.length} users`)
    
    return successResponse(result)
    
  } catch (error) {
    console.error('Send push error:', error)
    return errorResponse('发送推送失败', 500)
  }
}