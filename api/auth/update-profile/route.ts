/**
 * 更新个人资料 API
 * PUT /api/auth/update-profile
 * 用户更新自己的个人信息
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

// 更新个人资料验证模式
const updateProfileSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  email: z.string().email('邮箱格式不正确').optional().nullable(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional().nullable(),
  avatar: z.string().url('头像URL格式不正确').optional().nullable()
})

export async function PUT(request: NextRequest) {
  try {
    // 验证用户登录状态
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未登录或会话已过期', 401)
    }
    
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的访问令牌', 401)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = updateProfileSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { name, email, phone, avatar } = validationResult.data
    const supabase = createServiceClient()
    
    // 获取当前用户信息
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, username, name, email, phone')
      .eq('id', decoded.userId)
      .single()
    
    if (!currentUser) {
      return errorResponse('用户不存在', 404)
    }
    
    // 如果邮箱或手机号发生变化，检查是否已被其他用户使用
    if (email && email !== currentUser.email) {
      const { data: emailUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', decoded.userId)
        .single()
      
      if (emailUser) {
        return errorResponse('邮箱已被其他用户使用', 400)
      }
    }
    
    if (phone && phone !== currentUser.phone) {
      const { data: phoneUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .neq('id', decoded.userId)
        .single()
      
      if (phoneUser) {
        return errorResponse('手机号已被其他用户使用', 400)
      }
    }
    
    // 更新用户信息
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        avatar: avatar || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId)
      .select(`
        id,
        username,
        name,
        email,
        phone,
        avatar,
        status,
        created_at,
        updated_at,
        roles:role_id (
          id,
          name,
          code
        ),
        departments:department_id (
          id,
          name
        )
      `)
      .single()
    
    if (error) {
      console.error('Update profile error:', error)
      return errorResponse('更新个人资料失败', 500)
    }
    
    // 记录更新日志
    console.log(`User ${decoded.userId} (${currentUser.name}) updated profile at ${new Date().toISOString()}`)
    
    // 返回更新后的用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = updatedUser
    
    return successResponse({
      user: userWithoutPassword,
      message: '个人资料更新成功'
    })
    
  } catch (error) {
    console.error('Update profile error:', error)
    return errorResponse('更新个人资料失败', 500)
  }
}