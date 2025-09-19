/**
 * 编辑用户 API
 * PUT /api/auth/edit-user
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

// 编辑用户验证模式
const editUserSchema = z.object({
  target_user_id: z.string().min(1, '用户ID不能为空'),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线').optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  department_id: z.string().optional().nullable(),
  role_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'locked']).optional()
})

export async function PUT(request: NextRequest) {
  try {
    // 验证用户权限
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有管理员和有用户管理权限的角色可以编辑用户
    // 支持多种角色代码格式
    const allowedRoles = ['ADMIN', 'admin', 'R001', 'MONITOR_MANAGER', 'R002']
    if (!allowedRoles.includes(decoded.roleCode) && !allowedRoles.includes(decoded.roleId)) {
      return errorResponse('无权限编辑用户', 403)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = editUserSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { target_user_id, ...updateData } = validationResult.data
    const supabase = createServiceClient()
    
    // 检查目标用户是否存在
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, role_id')
      .eq('id', target_user_id)
      .single()
    
    if (!targetUser) {
      return errorResponse('用户不存在', 404)
    }
    
    // 防止降级超级管理员
    if (targetUser.role_id === 'R001' && updateData.role_id && updateData.role_id !== 'R001') {
      // 支持多种管理员角色代码格式
      const adminRoles = ['ADMIN', 'admin', 'R001']
      if (!adminRoles.includes(decoded.roleCode) && decoded.roleId !== 'R001') {
        return errorResponse('无权限修改超级管理员角色', 403)
      }
    }
    
    // 如果要修改用户名，检查是否已存在
    if (updateData.username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', updateData.username)
        .neq('id', target_user_id)
        .single()
      
      if (existingUser) {
        return errorResponse('用户名已存在', 400)
      }
    }
    
    // 构建更新数据
    const finalUpdateData: any = {
      ...updateData,
      updated_at: new Date().toISOString()
    }
    
    // 处理空值
    if (updateData.email === null) finalUpdateData.email = null
    if (updateData.phone === null) finalUpdateData.phone = null
    if (updateData.department_id === null) finalUpdateData.department_id = null
    
    // 更新用户
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(finalUpdateData)
      .eq('id', target_user_id)
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
      console.error('Update user error:', error)
      return errorResponse('更新用户失败', 500)
    }
    
    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = updatedUser
    
    return successResponse({
      user: userWithoutPassword,
      message: '用户信息更新成功'
    })
    
  } catch (error) {
    console.error('Edit user error:', error)
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse('无效的访问令牌', 401)
    }
    return errorResponse('编辑用户失败', 500)
  }
}