/**
 * APP推送测试API
 * POST /api/app-push-test
 * 发送测试推送到指定设备，用于调试
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

// 测试推送请求验证
const testPushSchema = z.object({
  registration_id: z.string().optional(), // 极光注册ID，可选（默认发送给当前用户）
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  template_code: z.string().optional(), // 模板代码
  extras: z.record(z.any()).optional() // 额外数据
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
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = testPushSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const {
      registration_id,
      title,
      content,
      template_code,
      extras
    } = validationResult.data
    
    const supabase = createServiceClient()
    
    // 获取目标设备
    let targetRegistrationIds: string[] = []
    
    if (registration_id) {
      // 使用指定的设备
      targetRegistrationIds = [registration_id]
    } else {
      // 获取当前用户的所有活跃设备
      const { data: devices } = await supabase
        .from('mobile_devices')
        .select('jpush_registration_id, device_token')
        .eq('user_id', decoded.userId)
        .eq('is_active', true)
      
      if (!devices || devices.length === 0) {
        return errorResponse('未找到可用的推送设备', 404)
      }
      
      targetRegistrationIds = devices
        .map(d => d.jpush_registration_id || d.device_token)
        .filter(Boolean)
    }
    
    if (targetRegistrationIds.length === 0) {
      return errorResponse('没有有效的推送目标', 400)
    }
    
    // 发送测试推送
    let pushResult
    
    try {
      if (template_code) {
        // 使用模板发送
        const { default: pushNotificationService } = await import('@/lib/push-notification.service')
        
        const templateData = {
          title,
          content,
          ...extras,
          test_mode: true,
          test_time: new Date().toISOString()
        }
        
        pushResult = await pushNotificationService.sendTemplateNotification(
          template_code,
          templateData,
          [decoded.userId], // 只发送给当前用户
          {
            priority: 'high',
            saveToDatabase: false, // 测试推送不保存到数据库
            sendAppPush: true,
            extras: {
              test_push: true,
              ...extras
            }
          }
        )
      } else {
        // 直接发送自定义推送
        const { default: jpushService } = await import('@/lib/jpush/service')
        
        const pushMessage = {
          title,
          content,
          extras: {
            test_push: true,
            template_code: 'TEST_PUSH',
            timestamp: new Date().toISOString(),
            ...extras
          }
        }
        
        pushResult = await jpushService.sendToDevices(
          targetRegistrationIds,
          pushMessage
        )
      }
      
      // 记录测试推送历史
      const testId = `TEST${Date.now().toString().slice(-8)}`
      
      await supabase
        .from('push_test_history')
        .insert({
          id: testId,
          user_id: decoded.userId,
          registration_ids: targetRegistrationIds,
          title,
          content,
          template_code,
          extras,
          status: pushResult?.success ? 'success' : 'failed',
          response: pushResult,
          created_at: new Date().toISOString()
        })
      
      if (pushResult?.success) {
        return successResponse({
          message: '测试推送发送成功',
          targets: targetRegistrationIds.length,
          push_result: pushResult,
          test_id: testId
        })
      } else {
        return errorResponse('测试推送发送失败', 500)
      }
      
    } catch (pushError) {
      console.error('Send test push error:', pushError)
      
      // 记录失败
      await supabase
        .from('push_test_history')
        .insert({
          id: `TEST${Date.now().toString().slice(-8)}`,
          user_id: decoded.userId,
          registration_ids: targetRegistrationIds,
          title,
          content,
          template_code,
          extras,
          status: 'failed',
          error_message: pushError instanceof Error ? pushError.message : '未知错误',
          created_at: new Date().toISOString()
        })
      
      return errorResponse('测试推送发送失败: ' + (pushError instanceof Error ? pushError.message : '未知错误'), 500)
    }
    
  } catch (error) {
    console.error('Test push error:', error)
    return errorResponse('测试推送失败', 500)
  }
}