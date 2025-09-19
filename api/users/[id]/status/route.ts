/**
 * 用户状态管理 API
 * PUT /api/users/[id]/status - 激活/停用用户
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

// 状态更新请求验证模式
const statusUpdateSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    required_error: '状态不能为空',
    invalid_type_error: '状态必须是 active 或 inactive'
  }),
  reason: z.string().optional() // 状态变更原因
})

// PUT - 更新用户状态
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    
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
    
    // 只有管理员和监控中心主管可以管理用户状态
    if (!['ADMIN', 'MONITOR_MANAGER'].includes(decoded.roleCode)) {
      return errorResponse('只有管理员可以管理用户状态', 403)
    }
    
    // 防止用户停用自己
    if (userId === decoded.userId) {
      return errorResponse('不能修改自己的账户状态', 400)
    }
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = statusUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { status, reason } = validationResult.data
    const supabase = createServiceClient()
    
    // 检查用户是否存在
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        name,
        status,
        roles!users_role_id_fkey(
          id,
          code,
          name
        )
      `)
      .eq('id', userId)
      .single()
    
    if (userError || !existingUser) {
      return errorResponse('用户不存在', 404)
    }
    
    if (existingUser.status === status) {
      return errorResponse(`用户已经是${status === 'active' ? '激活' : '停用'}状态`, 400)
    }
    
    // 防止停用系统管理员
    if (status === 'inactive' && existingUser.roles?.code === 'ADMIN') {
      return errorResponse('不能停用系统管理员账户', 400)
    }
    
    const now = new Date().toISOString()
    
    // 更新用户状态
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        status: status,
        updated_at: now
      })
      .eq('id', userId)
      .select(`
        id,
        username,
        name,
        phone,
        email,
        role_id,
        department_id,
        status,
        created_at,
        updated_at,
        roles!users_role_id_fkey(
          id,
          code,
          name,
          description
        ),
        departments!users_department_id_fkey(
          id,
          name,
          code
        )
      `)
      .single()
    
    if (updateError) {
      console.error('Update user status error:', updateError)
      return errorResponse('更新用户状态失败', 500)
    }
    
    // 如果停用用户，需要清除其相关的会话
    if (status === 'inactive') {
      // 清除用户的活跃会话
      await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)
      
      // 从维护团队中移除（如果是维护作业员）
      if (existingUser.roles?.code === 'MAINTENANCE_WORKER') {
        await supabase
          .from('maintenance_teams')
          .delete()
          .eq('worker_id', userId)
      }
    }
    
    // 记录状态变更历史
    const historyData = {
      user_id: userId,
      action_type: 'status_change',
      operator_id: decoded.userId,
      operator_name: decoded.name || decoded.username,
      old_status: existingUser.status,
      new_status: status,
      reason: reason || `${status === 'active' ? '激活' : '停用'}用户`,
      created_at: now
    }
    
    await supabase
      .from('user_status_histories')
      .insert(historyData)
    
    return successResponse({
      user: updatedUser,
      message: `用户已${status === 'active' ? '激活' : '停用'}`
    })
    
  } catch (error) {
    console.error('Update user status error:', error)
    return errorResponse('更新用户状态失败', 500)
  }
}