/**
 * APP设备注册API
 * POST /api/app-device-register
 * 用于APP注册设备信息和推送token
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

// 设备注册请求验证
const deviceRegisterSchema = z.object({
  jpush_registration_id: z.string().min(1, '极光推送注册ID不能为空'),
  device_type: z.enum(['iOS', 'Android'], {
    invalid_type_error: '设备类型必须是 iOS 或 Android'
  }),
  device_model: z.string().optional(),
  os_version: z.string().optional(),
  app_version: z.string().optional()
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
    const validationResult = deviceRegisterSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const {
      jpush_registration_id,
      device_type,
      device_model,
      os_version,
      app_version
    } = validationResult.data
    
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    
    // 检查设备是否已存在
    const { data: existingDevice } = await supabase
      .from('mobile_devices')
      .select('*')
      .eq('jpush_registration_id', jpush_registration_id)
      .single()
    
    let device
    
    if (existingDevice) {
      // 更新现有设备
      const { data: updatedDevice, error: updateError } = await supabase
        .from('mobile_devices')
        .update({
          user_id: decoded.userId,
          device_type,
          device_model: device_model || existingDevice.device_model,
          os_version: os_version || existingDevice.os_version,
          app_version: app_version || existingDevice.app_version,
          is_active: true,
          last_active: now,
          updated_at: now
        })
        .eq('id', existingDevice.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('Update device error:', updateError)
        return errorResponse('更新设备信息失败', 500)
      }
      
      device = updatedDevice
      
      // 停用该用户其他同类型设备
      await supabase
        .from('mobile_devices')
        .update({ is_active: false })
        .eq('user_id', decoded.userId)
        .eq('device_type', device_type)
        .neq('id', device.id)
    } else {
      // 创建新设备记录
      const deviceId = `DEV${Date.now().toString().slice(-7)}`
      
      const { data: newDevice, error: createError } = await supabase
        .from('mobile_devices')
        .insert({
          id: deviceId,
          user_id: decoded.userId,
          device_type,
          device_model,
          os_version,
          app_version,
          jpush_registration_id,
          device_token: jpush_registration_id, // 设备令牌字段
          is_active: true,
          last_active: now,
          created_at: now,
          updated_at: now
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Create device error:', createError)
        return errorResponse('注册设备失败', 500)
      }
      
      device = newDevice
      
      // 停用该用户其他同类型设备
      await supabase
        .from('mobile_devices')
        .update({ is_active: false })
        .eq('user_id', decoded.userId)
        .eq('device_type', device_type)
        .neq('id', device.id)
    }
    
    // 设置极光推送别名（使用用户ID）
    try {
      const { default: jpushService } = await import('@/lib/jpush/service')
      await jpushService.setAlias(jpush_registration_id, decoded.userId)
      
      // 设置标签（角色、部门等）
      const tags = []
      if (decoded.roleCode) {
        tags.push(`role_${decoded.roleCode}`)
      }
      if (decoded.departmentId) {
        tags.push(`dept_${decoded.departmentId}`)
      }
      
      if (tags.length > 0) {
        await jpushService.setTags(jpush_registration_id, tags)
      }
    } catch (jpushError) {
      console.error('Set JPush alias/tags error:', jpushError)
      // 不影响主流程
    }
    
    // 记录操作日志
    console.log(`[Device Register] User ${decoded.username} registered device ${device.id} (${device_type})`)
    
    return successResponse({
      device_id: device.id,
      user_id: decoded.userId,
      is_active: true,
      created_at: device.created_at,
      message: existingDevice ? '设备信息更新成功' : '设备注册成功'
    })
  } catch (error) {
    console.error('Device register error:', error)
    return errorResponse('设备注册失败', 500)
  }
}