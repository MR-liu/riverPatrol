/**
 * 用户角色管理 API
 * PUT /api/users/[id]/role - 分配用户角色
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

// 角色分配请求验证模式
const roleAssignmentSchema = z.object({
  role_id: z.string().min(1, '角色ID不能为空'),
  department_id: z.string().optional(),
  note: z.string().optional() // 分配说明
})

// PUT - 分配用户角色
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
    
    // 只有管理员和监控中心主管可以分配角色
    if (!['ADMIN', 'MONITOR_MANAGER'].includes(decoded.roleCode)) {
      return errorResponse('只有管理员可以分配用户角色', 403)
    }
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = roleAssignmentSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { role_id, department_id, note } = validationResult.data
    const supabase = createServiceClient()
    
    // 检查用户是否存在
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, username, name, role_id, status')
      .eq('id', userId)
      .single()
    
    if (userError || !existingUser) {
      return errorResponse('用户不存在', 404)
    }
    
    if (existingUser.status === 'inactive') {
      return errorResponse('无法为已停用用户分配角色', 400)
    }
    
    // 检查角色是否存在
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, code, name, description')
      .eq('id', role_id)
      .single()
    
    if (roleError || !role) {
      return errorResponse('指定的角色不存在', 400)
    }
    
    // 检查部门是否存在（如果指定了部门）
    if (department_id) {
      const { data: department, error: deptError } = await supabase
        .from('departments')
        .select('id')
        .eq('id', department_id)
        .single()
      
      if (deptError || !department) {
        return errorResponse('指定的部门不存在', 400)
      }
    }
    
    const now = new Date().toISOString()
    
    // 更新用户角色
    const updateData: any = {
      role_id: role_id,
      updated_at: now
    }
    
    if (department_id) {
      updateData.department_id = department_id
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
      console.error('Update user role error:', updateError)
      return errorResponse('更新用户角色失败', 500)
    }
    
    // 记录角色分配历史
    const historyData = {
      user_id: userId,
      action_type: 'role_assignment',
      operator_id: decoded.userId,
      operator_name: decoded.name || decoded.username,
      old_role_id: existingUser.role_id,
      new_role_id: role_id,
      department_id: department_id || null,
      note: note || `角色变更为：${role.name}`,
      created_at: now
    }
    
    await supabase
      .from('user_role_histories')
      .insert(historyData)
    
    return successResponse({
      user: updatedUser,
      message: `用户角色已更新为：${role.name}`
    })
    
  } catch (error) {
    console.error('Assign user role error:', error)
    return errorResponse('分配用户角色失败', 500)
  }
}