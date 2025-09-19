/**
 * 区域分配API
 * 将区域分配给特定的管理员
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

// 分配验证模式
const assignSchema = z.object({
  supervisor_id: z.string().min(1, '请选择负责人'),
  notes: z.string().optional()
})

// POST - 分配区域给管理员
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有系统管理员可以分配区域
    // 支持多种角色代码格式
    const allowedRoles = ['ADMIN', 'admin', 'R001']
    if (!allowedRoles.includes(decoded.roleCode) && !allowedRoles.includes(decoded.roleId)) {
      return errorResponse('只有系统管理员可以分配区域', 403)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = assignSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const supabase = createServiceClient()
    
    // 检查区域是否存在
    const { data: area } = await supabase
      .from('river_management_areas')
      .select('id, name, supervisor_id')
      .eq('id', params.id)
      .single()
    
    if (!area) {
      return errorResponse('区域不存在', 404)
    }
    
    // 检查新负责人是否存在且具有正确的角色
    const { data: newSupervisor } = await supabase
      .from('users')
      .select(`
        id,
        username,
        real_name,
        role_id,
        managed_areas,
        roles!users_role_id_fkey(
          code
        )
      `)
      .eq('id', validationResult.data.supervisor_id)
      .single()
    
    if (!newSupervisor) {
      return errorResponse('指定的用户不存在', 404)
    }
    
    // 检查用户角色是否为河道维护员主管(R006)
    if (newSupervisor.roles?.code !== 'MAINTENANCE_SUPERVISOR') {
      return errorResponse('只能将区域分配给河道维护员主管', 400)
    }
    
    // 如果区域已有负责人，从原负责人的managed_areas中移除
    if (area.supervisor_id && area.supervisor_id !== validationResult.data.supervisor_id) {
      const { data: oldSupervisor } = await supabase
        .from('users')
        .select('managed_areas')
        .eq('id', area.supervisor_id)
        .single()
      
      if (oldSupervisor) {
        const managedAreas = (oldSupervisor.managed_areas || [])
          .filter((areaId: string) => areaId !== params.id)
        
        await supabase
          .from('users')
          .update({ 
            managed_areas: managedAreas,
            updated_at: new Date().toISOString()
          })
          .eq('id', area.supervisor_id)
      }
    }
    
    // 更新区域的负责人
    const { error: updateAreaError } = await supabase
      .from('river_management_areas')
      .update({
        supervisor_id: validationResult.data.supervisor_id,
        updated_at: new Date().toISOString(),
        updated_by: decoded.userId
      })
      .eq('id', params.id)
    
    if (updateAreaError) {
      console.error('Update area supervisor error:', updateAreaError)
      return errorResponse('分配区域失败', 500)
    }
    
    // 将区域添加到新负责人的managed_areas
    const managedAreas = newSupervisor.managed_areas || []
    if (!managedAreas.includes(params.id)) {
      managedAreas.push(params.id)
      
      const { error: updateUserError } = await supabase
        .from('users')
        .update({ 
          managed_areas: managedAreas,
          updated_at: new Date().toISOString()
        })
        .eq('id', validationResult.data.supervisor_id)
      
      if (updateUserError) {
        console.error('Update user managed areas error:', updateUserError)
        return errorResponse('更新用户管辖区域失败', 500)
      }
    }
    
    // 记录分配日志
    await supabase
      .from('system_logs')
      .insert({
        user_id: decoded.userId,
        action: 'ASSIGN_AREA',
        entity_type: 'area',
        entity_id: params.id,
        details: {
          area_name: area.name,
          old_supervisor_id: area.supervisor_id,
          new_supervisor_id: validationResult.data.supervisor_id,
          new_supervisor_name: newSupervisor.real_name,
          notes: validationResult.data.notes
        },
        created_at: new Date().toISOString()
      })
    
    return successResponse({
      message: `区域 "${area.name}" 已成功分配给 ${newSupervisor.real_name}`,
      area: {
        id: params.id,
        name: area.name,
        supervisor_id: validationResult.data.supervisor_id,
        supervisor_name: newSupervisor.real_name
      }
    })
  } catch (error) {
    console.error('Assign area error:', error)
    return errorResponse('分配区域失败', 500)
  }
}