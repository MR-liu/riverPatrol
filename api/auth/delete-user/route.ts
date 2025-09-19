/**
 * 禁用用户 API
 * DELETE /api/auth/delete-user
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

// 禁用用户验证模式
const deleteUserSchema = z.object({
  target_user_id: z.string().min(1, '用户ID不能为空'),
  reason: z.string().optional()
})

export async function DELETE(request: NextRequest) {
  try {
    // 验证用户权限
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有管理员和有用户管理权限的角色可以禁用用户
    // 支持多种角色代码格式
    const allowedRoles = ['ADMIN', 'admin', 'R001', 'MONITOR_MANAGER', 'R002']
    if (!allowedRoles.includes(decoded.roleCode) && !allowedRoles.includes(decoded.roleId)) {
      return errorResponse('无权限禁用用户', 403)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = deleteUserSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { target_user_id, reason } = validationResult.data
    const supabase = createServiceClient()
    
    // 检查目标用户是否存在
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, name, status, role_id')
      .eq('id', target_user_id)
      .single()
    
    if (!targetUser) {
      return errorResponse('用户不存在', 404)
    }
    
    // 防止禁用超级管理员
    if (targetUser.role_id === 'R001') {
      return errorResponse('不能禁用超级管理员', 403)
    }
    
    if (targetUser.status === 'inactive') {
      return errorResponse('用户已经是禁用状态', 400)
    }
    
    // 禁用用户（不是真正删除，只是改变状态）
    const { error } = await supabase
      .from('users')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', target_user_id)
    
    if (error) {
      console.error('Delete user error:', error)
      return errorResponse('禁用用户失败', 500)
    }
    
    // 记录操作日志（如果需要）
    if (reason) {
      console.log(`User ${decoded.userId} disabled user ${target_user_id} with reason: ${reason}`)
    }
    
    return successResponse({
      message: `用户 ${targetUser.name} 已成功禁用`
    })
    
  } catch (error) {
    console.error('Delete user error:', error)
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse('无效的访问令牌', 401)
    }
    return errorResponse('禁用用户失败', 500)
  }
}