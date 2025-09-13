/**
 * 修改密码 API
 * POST /api/auth/change-password
 * 用户自己修改密码
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

// 修改密码验证模式
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少6位'),
  confirmPassword: z.string().min(6, '确认密码至少6位')
})

export async function POST(request: NextRequest) {
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
    const validationResult = changePasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { currentPassword, newPassword, confirmPassword } = validationResult.data
    
    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      return errorResponse('新密码和确认密码不一致', 400)
    }
    
    // 验证新旧密码不能相同
    if (currentPassword === newPassword) {
      return errorResponse('新密码不能与当前密码相同', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取用户当前密码
    const { data: user } = await supabase
      .from('users')
      .select('id, password, name')
      .eq('id', decoded.userId)
      .single()
    
    if (!user) {
      return errorResponse('用户不存在', 404)
    }
    
    // 验证当前密码是否正确
    const salt = 'smart_river_salt'
    const oldPasswordHash = crypto
      .createHash('sha256')
      .update(currentPassword + salt)
      .digest('hex')
    
    if (user.password !== oldPasswordHash) {
      return errorResponse('当前密码错误', 400)
    }
    
    // 生成新密码的哈希
    const newPasswordHash = crypto
      .createHash('sha256')
      .update(newPassword + salt)
      .digest('hex')
    
    // 更新密码
    const { error } = await supabase
      .from('users')
      .update({
        password: newPasswordHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId)
    
    if (error) {
      console.error('Change password error:', error)
      return errorResponse('修改密码失败', 500)
    }
    
    // 记录密码修改日志
    console.log(`User ${decoded.userId} (${user.name}) changed password at ${new Date().toISOString()}`)
    
    return successResponse({
      message: '密码修改成功，请使用新密码重新登录'
    })
    
  } catch (error) {
    console.error('Change password error:', error)
    return errorResponse('修改密码失败', 500)
  }
}