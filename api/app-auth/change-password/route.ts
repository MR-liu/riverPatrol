/**
 * 移动端修改密码 API
 * POST /api/app-auth/change-password
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { z } from 'zod'
import { 
  createServiceClient, 
  successResponse, 
  errorResponse,
  validateRequestBody 
} from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const COOKIE_NAME = 'app-auth-token'

// 密码验证规则
const passwordSchema = z.object({
  old_password: z.string().min(1, '请输入原密码'),
  new_password: z.string()
    .min(6, '新密码至少6个字符')
    .max(50, '新密码最多50个字符'),
  confirm_password: z.string()
})

/**
 * 密码哈希函数
 */
function hashPassword(password: string): string {
  const salt = 'smart_river_salt'
  return crypto.createHash('sha256').update(password + salt).digest('hex')
}

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
      passwordSchema.refine(
        (data) => data.new_password === data.confirm_password,
        {
          message: '两次输入的新密码不一致',
          path: ['confirm_password'],
        }
      ).refine(
        (data) => data.old_password !== data.new_password,
        {
          message: '新密码不能与原密码相同',
          path: ['new_password'],
        }
      )
    )

    if (validationError) {
      return errorResponse(validationError, 400)
    }

    const supabase = createServiceClient()

    // 验证原密码
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password, status')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return errorResponse('用户不存在', 404)
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return errorResponse('账号已被禁用，无法修改密码', 403)
    }

    // 验证原密码
    const oldPasswordHash = hashPassword(input.old_password)
    if (user.password !== oldPasswordHash) {
      return errorResponse('原密码错误', 400)
    }

    // 更新密码
    const newPasswordHash = hashPassword(input.new_password)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: newPasswordHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Update password error:', updateError)
      return errorResponse('密码修改失败', 500)
    }

    // 记录密码修改日志
    await supabase
      .from('user_activity_logs')
      .insert({
        user_id: userId,
        action: 'change_password',
        details: {
          platform: 'mobile',
          timestamp: new Date().toISOString()
        },
        ip_address: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        created_at: new Date().toISOString()
      })

    return successResponse(
      { message: '密码修改成功，请重新登录' },
      '密码修改成功'
    )

  } catch (error) {
    console.error('Change password error:', error)
    return errorResponse('密码修改失败', 500)
  }
}