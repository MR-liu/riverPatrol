/**
 * 重置密码 API
 * POST /api/auth/reset-password
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { z } from 'zod'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// 重置密码验证模式
const resetPasswordSchema = z.object({
  target_user_id: z.string().min(1, '用户ID不能为空'),
  new_password: z.string().min(6, '密码至少6位').optional()
})

export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有管理员和有用户管理权限的角色可以重置密码
    if (decoded.roleCode !== 'ADMIN' && decoded.roleCode !== 'MONITOR_MANAGER') {
      return errorResponse('无权限重置密码', 403)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { target_user_id, new_password } = validationResult.data
    const supabase = createServiceClient()
    
    // 检查目标用户是否存在
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, name, username')
      .eq('id', target_user_id)
      .single()
    
    if (!targetUser) {
      return errorResponse('用户不存在', 404)
    }
    
    // 设置新密码（默认为 "password" 或用户指定的密码）
    const password = new_password || 'password'
    // 使用 SHA256 + salt 加密密码
    const salt = 'smart_river_salt'
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex')
    
    // 更新密码
    const { error } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', target_user_id)
    
    if (error) {
      console.error('Reset password error:', error)
      return errorResponse('重置密码失败', 500)
    }
    
    return successResponse({
      message: `用户 ${targetUser.name} 的密码已重置为: ${password}`
    })
    
  } catch (error) {
    console.error('Reset password error:', error)
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse('无效的访问令牌', 401)
    }
    return errorResponse('重置密码失败', 500)
  }
}