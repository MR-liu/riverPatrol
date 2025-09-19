/**
 * 获取区域工作人员 API
 * GET /api/areas/[id]/workers - 获取指定区域的维护人员和巡检员
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// GET - 获取区域工作人员
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: areaId } = await params
    
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
    
    // 只有管理员、监控中心主管和区域主管可以查看
    if (!['ADMIN', 'MONITOR_MANAGER', 'MAINTENANCE_SUPERVISOR'].includes(decoded.roleCode)) {
      return errorResponse('无权限查看区域工作人员', 403)
    }
    
    const supabase = createServiceClient()
    
    // 验证区域存在
    const { data: area, error: areaError } = await supabase
      .from('river_management_areas')
      .select('id, name, supervisor_id')
      .eq('id', areaId)
      .single()
    
    if (areaError || !area) {
      return errorResponse('区域不存在', 404)
    }
    
    // 如果是区域主管，只能查看自己负责的区域
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      if (area.supervisor_id !== decoded.userId) {
        return errorResponse('只能查看自己负责的区域工作人员', 403)
      }
    }
    
    // 获取区域的维护团队
    const { data: teamMembers, error: teamError } = await supabase
      .from('maintenance_teams')
      .select(`
        id,
        position,
        specialties,
        max_concurrent_orders,
        current_workload,
        is_available,
        is_emergency_responder,
        worker:users!maintenance_teams_worker_id_fkey(
          id,
          username,
          name,
          phone,
          email,
          role_id,
          status,
          roles!users_role_id_fkey(
            id,
            code,
            name
          )
        ),
        supervisor:users!maintenance_teams_supervisor_id_fkey(
          id,
          name
        )
      `)
      .eq('area_id', areaId)
      .eq('is_available', true)
    
    if (teamError) {
      console.error('获取维护团队失败:', teamError)
      return errorResponse('获取区域工作人员失败', 500)
    }
    
    // 转换数据格式，只返回工作人员信息
    const workers = (teamMembers || []).map(team => ({
      id: team.worker.id,
      username: team.worker.username,
      name: team.worker.name,
      phone: team.worker.phone,
      email: team.worker.email,
      role_id: team.worker.role_id,
      role_name: team.worker.roles?.name,
      role_code: team.worker.roles?.code,
      status: team.worker.status,
      position: team.position,
      specialties: team.specialties,
      max_concurrent_orders: team.max_concurrent_orders,
      current_workload: team.current_workload,
      is_available: team.is_available,
      is_emergency_responder: team.is_emergency_responder,
      supervisor_name: team.supervisor?.name
    })).filter(worker => worker.status === 'active') // 只返回活跃的工作人员
    
    return successResponse({
      data: workers,
      area_info: {
        id: area.id,
        name: area.name,
        supervisor_id: area.supervisor_id
      },
      total: workers.length
    })
    
  } catch (error) {
    console.error('获取区域工作人员失败:', error)
    return errorResponse('获取区域工作人员失败', 500)
  }
}