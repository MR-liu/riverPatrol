/**
 * 移动端更新用户资料 API
 * POST /api/app-auth/update-profile
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { 
  createServiceClient, 
  successResponse, 
  errorResponse,
  validateRequestBody 
} from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const COOKIE_NAME = 'app-auth-token'

// 用户资料验证规则
const profileSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多50个字符').optional(),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号码')
    .optional(),
  email: z.string().email('请输入有效的邮箱地址').optional(),
  avatar: z.string().url('请输入有效的头像URL').optional(),
})

export async function POST(request: NextRequest) {
  try {
    // 获取并验证 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证 token
    let decoded: any
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId

    // 验证请求体
    const { data: input, error: validationError } = await validateRequestBody(
      request,
      profileSchema
    )

    if (validationError) {
      return errorResponse(validationError, 400)
    }

    // 至少要有一个字段需要更新
    if (Object.keys(input).length === 0) {
      return errorResponse('请提供要更新的信息', 400)
    }

    const supabase = createServiceClient()

    // 检查用户是否存在
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, status')
      .eq('id', userId)
      .single()

    if (userError || !existingUser) {
      return errorResponse('用户不存在', 404)
    }

    // 检查用户状态
    if (existingUser.status !== 'active') {
      return errorResponse('账号已被禁用，无法更新资料', 403)
    }

    // 如果要更新手机号，检查是否已被使用
    if (input.phone) {
      const { data: phoneCheck } = await supabase
        .from('users')
        .select('id')
        .eq('phone', input.phone)
        .neq('id', userId)
        .single()

      if (phoneCheck) {
        return errorResponse('该手机号已被使用', 400)
      }
    }

    // 如果要更新邮箱，检查是否已被使用
    if (input.email) {
      const { data: emailCheck } = await supabase
        .from('users')
        .select('id')
        .eq('email', input.email)
        .neq('id', userId)
        .single()

      if (emailCheck) {
        return errorResponse('该邮箱已被使用', 400)
      }
    }

    // 更新用户资料
    const updateData = {
      ...input,
      updated_at: new Date().toISOString()
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select(`
        id,
        username,
        name,
        phone,
        email,
        avatar,
        role_id,
        department_id,
        status,
        last_login_at,
        role:roles!inner(
          id,
          name,
          code
        ),
        department:departments(
          id,
          name,
          code
        )
      `)
      .single()

    if (updateError) {
      console.error('Update profile error:', updateError)
      return errorResponse('更新资料失败', 500)
    }

    // 记录更新日志
    await supabase
      .from('user_activity_logs')
      .insert({
        user_id: userId,
        action: 'update_profile',
        details: {
          platform: 'mobile',
          updated_fields: Object.keys(input),
          timestamp: new Date().toISOString()
        },
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        created_at: new Date().toISOString()
      })

    // 获取区域信息（如果需要）
    let areaInfo = {}
    if (updatedUser.role.code === 'R006') {
      const { data: areaData } = await supabase
        .from('river_management_areas')
        .select('id, name, code')
        .eq('supervisor_id', userId)
        .single()
      
      if (areaData) {
        areaInfo = {
          area_id: areaData.id,
          area_name: areaData.name,
          area_code: areaData.code,
        }
      }
    }

    return successResponse({
      user: {
        ...updatedUser,
        ...areaInfo,
        platform: 'mobile'
      }
    }, '资料更新成功')

  } catch (error) {
    console.error('Update profile error:', error)
    return errorResponse('更新资料失败', 500)
  }
}