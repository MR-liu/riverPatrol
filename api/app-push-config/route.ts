/**
 * 推送配置API
 * GET /api/app-push-config - 获取用户推送配置
 * PUT /api/app-push-config - 更新用户推送配置
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'
import { z } from 'zod'

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

// 推送配置验证
const pushConfigSchema = z.object({
  enable_alarm_push: z.boolean().optional(),
  enable_workorder_push: z.boolean().optional(),
  enable_notification_push: z.boolean().optional(),
  enable_inspection_push: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quiet_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  min_priority: z.enum(['low', 'normal', 'high', 'urgent']).optional()
})

/**
 * 获取用户推送配置
 * GET /api/app-push-config
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
    
    // 获取用户推送配置
    const { data: config, error } = await supabase
      .from('push_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('查询推送配置失败:', error)
      return errorResponse('查询失败', 500)
    }

    // 如果没有配置，返回默认配置
    const defaultConfig = {
      id: null,
      user_id: userId,
      enable_alarm_push: true,
      enable_workorder_push: true,
      enable_notification_push: true,
      enable_inspection_push: true,
      quiet_hours_start: null,
      quiet_hours_end: null,
      min_priority: 'normal',
      created_at: null,
      updated_at: null
    }

    return successResponse({
      config: config || defaultConfig,
      is_default: !config
    }, '获取推送配置成功')

  } catch (error) {
    console.error('[app-push-config] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 更新用户推送配置
 * PUT /api/app-push-config
 */
export async function PUT(request: NextRequest) {
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
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = pushConfigSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }

    const configData = validationResult.data
    const supabase = createServiceClient()
    
    // 检查是否已有配置
    const { data: existingConfig } = await supabase
      .from('push_configs')
      .select('id')
      .eq('user_id', userId)
      .single()

    let result
    const now = new Date().toISOString()

    if (existingConfig) {
      // 更新现有配置
      const { data: updated, error: updateError } = await supabase
        .from('push_configs')
        .update({
          ...configData,
          updated_at: now
        })
        .eq('id', existingConfig.id)
        .select()
        .single()

      if (updateError) {
        console.error('更新推送配置失败:', updateError)
        return errorResponse('更新失败', 500)
      }

      result = updated
    } else {
      // 创建新配置
      const configId = `PC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { data: created, error: createError } = await supabase
        .from('push_configs')
        .insert({
          id: configId,
          user_id: userId,
          ...configData,
          created_at: now,
          updated_at: now
        })
        .select()
        .single()

      if (createError) {
        console.error('创建推送配置失败:', createError)
        return errorResponse('创建失败', 500)
      }

      result = created
    }

    return successResponse({
      config: result,
      message: existingConfig ? '推送配置已更新' : '推送配置已创建'
    }, '操作成功')

  } catch (error) {
    console.error('[app-push-config] PUT error:', error)
    return errorResponse('服务器错误', 500)
  }
}