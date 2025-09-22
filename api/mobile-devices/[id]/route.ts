/**
 * 单个设备管理API
 * DELETE /api/mobile-devices/[id] - 删除设备
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value || cookieStore.get('app-auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的访问令牌', 401)
    }
    
    const deviceId = params.id
    const supabase = createServiceClient()
    
    // 检查设备是否存在
    const { data: device, error: fetchError } = await supabase
      .from('mobile_devices')
      .select('*')
      .eq('id', deviceId)
      .single()
    
    if (fetchError || !device) {
      return errorResponse('设备不存在', 404)
    }
    
    // 检查权限：只有管理员或设备所有者可以删除
    if (decoded.roleCode !== 'R001' && decoded.roleCode !== 'admin' && device.user_id !== decoded.userId) {
      return errorResponse('无权删除此设备', 403)
    }
    
    // 清除极光推送设置
    if (device.jpush_registration_id) {
      try {
        const { default: jpushService } = await import('@/lib/jpush/service')
        await jpushService.clearAlias(device.jpush_registration_id)
        await jpushService.clearTags(device.jpush_registration_id)
      } catch (jpushError) {
        console.error('Clear JPush settings error:', jpushError)
      }
    }
    
    // 删除设备
    const { error: deleteError } = await supabase
      .from('mobile_devices')
      .delete()
      .eq('id', deviceId)
    
    if (deleteError) {
      console.error('Delete device error:', deleteError)
      return errorResponse('删除设备失败', 500)
    }
    
    console.log(`[Device Delete] User ${decoded.username} deleted device ${deviceId}`)
    
    return successResponse({
      message: '设备删除成功',
      device_id: deviceId
    })
    
  } catch (error) {
    console.error('Delete device error:', error)
    return errorResponse('删除设备失败', 500)
  }
}