/**
 * APP设备注销API
 * POST /api/app-device-unregister
 * 用户登出或卸载APP时注销设备
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

// 设备注销请求验证
const deviceUnregisterSchema = z.object({
  jpush_registration_id: z.string().optional(),
  device_id: z.string().optional()
}).refine(data => data.jpush_registration_id || data.device_id, {
  message: '请提供设备ID或极光注册ID'
})

export async function POST(request: NextRequest) {
  try {
    // 验证用户权限 - 支持cookie和Bearer token两种认证方式
    const cookieStore = await cookies()
    let token = cookieStore.get('auth-token')?.value || cookieStore.get('app-auth-token')?.value
    
    // 如果cookie中没有token，尝试从Authorization header获取
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }
    
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
    const validationResult = deviceUnregisterSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { jpush_registration_id, device_id } = validationResult.data
    
    const supabase = createServiceClient()
    
    // 查找设备
    let query = supabase
      .from('mobile_devices')
      .select('*')
      .eq('user_id', decoded.userId)
    
    if (jpush_registration_id) {
      query = query.eq('jpush_registration_id', jpush_registration_id)
    } else if (device_id) {
      query = query.eq('id', device_id)
    }
    
    const { data: device } = await query.single()
    
    if (!device) {
      return errorResponse('设备不存在或无权访问', 404)
    }
    
    // 停用设备
    const { error: updateError } = await supabase
      .from('mobile_devices')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id)
    
    if (updateError) {
      console.error('Deactivate device error:', updateError)
      return errorResponse('注销设备失败', 500)
    }
    
    // 清除极光推送别名和标签
    if (device.jpush_registration_id) {
      try {
        const { default: jpushService } = await import('@/lib/jpush/service')
        await jpushService.clearAlias(device.jpush_registration_id)
        await jpushService.clearTags(device.jpush_registration_id)
      } catch (jpushError) {
        console.error('Clear JPush alias/tags error:', jpushError)
      }
    }
    
    console.log(`[Device Unregister] User ${decoded.username} unregistered device ${device.id}`)
    
    return successResponse({
      message: '设备注销成功',
      device_id: device.id
    })
    
  } catch (error) {
    console.error('Device unregister error:', error)
    return errorResponse('设备注销失败', 500)
  }
}