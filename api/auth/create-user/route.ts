/**
 * 创建用户 API
 * POST /api/auth/create-user
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

// 创建用户验证模式
const createUserSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  name: z.string().min(1, '姓名不能为空'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  role_id: z.string().min(1, '角色不能为空'),
  password: z.string().optional()
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
    
    // 只有管理员和有用户管理权限的角色可以创建用户
    // 支持多种角色代码格式
    const allowedRoles = ['ADMIN', 'admin', 'R001', 'MONITOR_MANAGER', 'R002']
    if (!allowedRoles.includes(decoded.roleCode) && !allowedRoles.includes(decoded.roleId)) {
      return errorResponse('无权限创建用户', 403)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = createUserSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const userData = validationResult.data
    const supabase = createServiceClient()
    
    // 检查用户名是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', userData.username)
      .single()
    
    if (existingUser) {
      return errorResponse('用户名已存在', 400)
    }
    
    // 生成用户ID - 使用时间戳和随机数确保唯一性
    const timestamp = Date.now().toString()
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
    const userId = `U_${timestamp.slice(-8)}_${randomStr}`
    
    // 设置密码（默认为 "password" 或用户指定的密码）
    const password = userData.password || 'password'
    // 使用 SHA256 + salt 加密密码
    const salt = 'smart_river_salt'
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password + salt)
      .digest('hex')
    
    // 创建用户
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        username: userData.username,
        password: hashedPassword,
        name: userData.name,
        email: userData.email || null,
        phone: userData.phone || null,
        department_id: userData.department_id || null,
        role_id: userData.role_id,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
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
      console.error('Create user error:', error)
      return errorResponse('创建用户失败', 500)
    }
    
    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = newUser
    
    return successResponse({
      user: userWithoutPassword,
      message: `用户 ${userData.name} 创建成功，初始密码为: ${password}`
    })
    
  } catch (error) {
    console.error('Create user error:', error)
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse('无效的访问令牌', 401)
    }
    return errorResponse('创建用户失败', 500)
  }
}