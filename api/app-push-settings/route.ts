/**
 * APP推送偏好设置API
 * GET /api/app-push-settings - 获取推送设置
 * PUT /api/app-push-settings - 更新推送设置
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

// 推送设置验证模式
const pushSettingsSchema = z.object({
  enable_push: z.boolean().optional(),
  alarm_push: z.boolean().optional(),
  workorder_push: z.boolean().optional(),
  system_push: z.boolean().optional(),
  quiet_hours: z.object({
    enabled: z.boolean(),
    start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '时间格式错误'),
    end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '时间格式错误')
  }).optional(),
  priority_filter: z.array(z.enum(['urgent', 'high', 'normal', 'low'])).optional()
})

// GET - 获取推送设置
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
    
    const supabase = createServiceClient()
    
    // 获取用户的推送设置
    const { data: settings, error } = await supabase
      .from('user_push_settings')
      .select('*')
      .eq('user_id', decoded.userId)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 表示没有找到记录
      console.error('Get push settings error:', error)
      return errorResponse('获取推送设置失败', 500)
    }
    
    // 如果没有设置，返回默认设置
    const defaultSettings = {
      enable_push: true,
      alarm_push: true,
      workorder_push: true,
      system_push: true,
      quiet_hours: {
        enabled: false,
        start_time: '22:00',
        end_time: '08:00'
      },
      priority_filter: ['urgent', 'high', 'normal']
    }
    
    return successResponse(settings || defaultSettings)
    
  } catch (error) {
    console.error('Get push settings error:', error)
    return errorResponse('获取推送设置失败', 500)
  }
}

// PUT - 更新推送设置
export async function PUT(request: NextRequest) {
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
    const validationResult = pushSettingsSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const settings = validationResult.data
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    
    // 检查是否已存在设置记录
    const { data: existingSettings } = await supabase
      .from('user_push_settings')
      .select('id')
      .eq('user_id', decoded.userId)
      .single()
    
    let result
    
    if (existingSettings) {
      // 更新现有设置
      const { data: updated, error: updateError } = await supabase
        .from('user_push_settings')
        .update({
          ...settings,
          updated_at: now
        })
        .eq('user_id', decoded.userId)
        .select()
        .single()
      
      if (updateError) {
        console.error('Update push settings error:', updateError)
        return errorResponse('更新推送设置失败', 500)
      }
      
      result = updated
    } else {
      // 创建新设置记录
      const settingsId = `PS${Date.now().toString().slice(-9)}`
      
      const { data: created, error: createError } = await supabase
        .from('user_push_settings')
        .insert({
          id: settingsId,
          user_id: decoded.userId,
          ...settings,
          created_at: now,
          updated_at: now
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Create push settings error:', createError)
        return errorResponse('创建推送设置失败', 500)
      }
      
      result = created
    }
    
    // 如果禁用了推送，停用所有设备
    if (settings.enable_push === false) {
      await supabase
        .from('mobile_devices')
        .update({ is_active: false })
        .eq('user_id', decoded.userId)
    } else if (settings.enable_push === true) {
      // 如果启用推送，激活当前设备
      await supabase
        .from('mobile_devices')
        .update({ is_active: true })
        .eq('user_id', decoded.userId)
    }
    
    return successResponse({
      settings: result,
      message: '推送设置已更新'
    })
    
  } catch (error) {
    console.error('Update push settings error:', error)
    return errorResponse('更新推送设置失败', 500)
  }
}