/**
 * 区域工单管理API (R006专用)
 * GET /api/app-area-workorders - 获取区域内工单
 * POST /api/app-area-workorders/assign - 分配工单
 * POST /api/app-area-workorders/review - 审核工单
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse, logApiActivity } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

interface JWTPayload {
  userId: string;
  username: string;
  roleId: string;
  roleCode: string;
  areaId?: string;
  platform?: string;
  iat?: number;
  exp?: number;
}

/**
 * 获取区域内工单 (R006专用)
 * GET /api/app-area-workorders
 */
export async function GET(request: NextRequest) {
  try {
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const roleId = decoded.roleId
    
    // 只有R006区域管理员可以访问
    if (roleId !== 'R006') {
      return errorResponse('无权限访问', 403)
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = createServiceClient()
    
    // 首先获取用户管理的区域ID列表
    const { data: areas, error: areasError } = await supabase
      .from('river_management_areas')
      .select('id')
      .eq('supervisor_id', userId)
      .eq('is_active', true)

    if (areasError || !areas || areas.length === 0) {
      return errorResponse('未找到管理的区域', 404)
    }

    const areaIds = areas.map(area => area.id)
    
    // 构建查询
    let query = supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types!inner(id, name, category),
        creator:users!workorders_creator_id_fkey(id, name, username),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        initial_reporter:users!workorders_initial_reporter_id_fkey(id, name, username, phone),
        area:river_management_areas(id, name, code),
        results:workorder_results(
          id,
          process_method,
          process_result,
          before_photos,
          after_photos,
          need_followup,
          submitted_at,
          processor:users!workorder_results_processor_id_fkey(name, username)
        )
      `, { count: 'exact' })
      .in('area_id', areaIds)
      .order('created_at', { ascending: false })

    // 应用过滤条件
    if (status) {
      if (status === 'pending_all') {
        query = query.in('status', ['pending', 'pending_dispatch'])
      } else if (status === 'active') {
        query = query.in('status', ['pending_dispatch', 'dispatched', 'processing'])
      } else if (status === 'review') {
        query = query.in('status', ['pending_review', 'pending_final_review', 'pending_reporter_confirm'])
      } else {
        query = query.eq('status', status)
      }
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    // 分页
    query = query.range(offset, offset + limit - 1)

    const { data: workorders, error, count } = await query

    if (error) {
      console.error('查询区域工单失败:', error)
      return errorResponse('查询失败', 500)
    }

    // 获取团队成员信息，用于分配工单
    const { data: teamMembers } = await supabase
      .from('maintenance_teams')
      .select(`
        worker_id,
        position,
        current_workload,
        max_concurrent_orders,
        is_available,
        is_emergency_responder,
        performance_score,
        worker:users!maintenance_teams_worker_id_fkey(id, name, username, phone, role_id)
      `)
      .in('area_id', areaIds)
      .eq('is_available', true)
      .order('performance_score', { ascending: false })

    return successResponse({
      workorders: workorders || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      available_assignees: teamMembers || [],
      area_summary: {
        managed_areas: areas.length,
        area_ids: areaIds
      }
    }, '获取区域工单成功')

  } catch (error) {
    console.error('[app-area-workorders] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 分配工单 (R006专用)
 * POST /api/app-area-workorders/assign
 */
export async function POST(request: NextRequest) {
  try {
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const roleId = decoded.roleId
    
    // 只有R006区域管理员可以分配工单
    if (roleId !== 'R006') {
      return errorResponse('无权限执行此操作', 403)
    }

    // 解析请求体
    const body = await request.json()
    const {
      workorder_id,
      assignee_id,
      note = '',
      estimated_hours = null
    } = body

    if (!workorder_id || !assignee_id) {
      return errorResponse('参数不完整', 400)
    }

    const supabase = createServiceClient()
    
    // 1. 验证工单是否在管理范围内
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        area:river_management_areas!inner(id, name, supervisor_id)
      `)
      .eq('id', workorder_id)
      .single()

    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    if (workorder.area?.supervisor_id !== userId) {
      return errorResponse('无权限管理此工单', 403)
    }

    if (!['pending', 'pending_dispatch'].includes(workorder.status)) {
      return errorResponse(`工单状态为${workorder.status}，无法分配`, 400)
    }

    // 2. 验证被分配人是否在团队中
    const { data: teamMember, error: teamError } = await supabase
      .from('maintenance_teams')
      .select(`
        *,
        worker:users!maintenance_teams_worker_id_fkey(id, name, username, role_id, status)
      `)
      .eq('worker_id', assignee_id)
      .eq('area_id', workorder.area_id)
      .single()

    if (teamError || !teamMember) {
      return errorResponse('被分配人不在此区域团队中', 400)
    }

    if (!teamMember.is_available) {
      return errorResponse('被分配人当前不可用', 400)
    }

    if (teamMember.worker?.role_id !== 'R003') {
      return errorResponse('只能分配给河道维护员(R003)', 400)
    }

    // 3. 检查工作负载
    if (teamMember.current_workload >= teamMember.max_concurrent_orders) {
      return errorResponse('被分配人工作负载已满', 400)
    }

    // 4. 更新工单状态
    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update({
        status: 'dispatched',
        assignee_id: assignee_id,
        dispatcher_id: userId,
        dispatched_at: new Date().toISOString(),
        estimated_complete_at: estimated_hours 
          ? new Date(Date.now() + estimated_hours * 60 * 60 * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workorder_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('更新工单失败:', updateError)
      return errorResponse('分配工单失败', 500)
    }

    // 5. 更新团队成员工作负载
    await supabase
      .from('maintenance_teams')
      .update({
        current_workload: teamMember.current_workload + 1
      })
      .eq('worker_id', assignee_id)
      .eq('area_id', workorder.area_id)

    // 6. 记录状态变更历史
    await supabase
      .from('workorder_status_history')
      .insert({
        id: `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorder_id,
        old_status: workorder.status,
        new_status: 'dispatched',
        changed_by: userId,
        change_reason: '区域主管分配工单',
        change_note: note,
        created_at: new Date().toISOString()
      })

    // 记录API活动日志
    await logApiActivity('POST', 'app-area-workorders/assign', userId, {
      workorder_id,
      assignee_id,
      estimated_hours
    })

    return successResponse({
      workorder: updatedWorkorder,
      assignee: teamMember.worker,
      assigned_at: new Date().toISOString()
    }, '工单分配成功')

  } catch (error) {
    console.error('[app-area-workorders] assign error:', error)
    return errorResponse('服务器错误', 500)
  }
}