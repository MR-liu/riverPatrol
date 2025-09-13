/**
 * 工单管理 API
 * GET /api/workorders - 获取工单列表
 * POST /api/workorders - 创建新工单
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

// GET - 获取工单列表
export async function GET(request: NextRequest) {
  try {
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
    
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status') || null
    const priority = searchParams.get('priority') || null
    const type = searchParams.get('type') || null
    const assignee = searchParams.get('assignee') || null
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('workorders')
      .select(`
        *,
        workorder_types:type_id (
          id,
          name,
          code,
          sla_hours
        ),
        alarms:alarm_id (
          id,
          title,
          status
        ),
        monitoring_points:point_id (
          id,
          name,
          code,
          river_name
        ),
        areas:area_id (
          id,
          name
        ),
        creator:creator_id (
          id,
          name
        ),
        assignee:assignee_id (
          id,
          name
        ),
        supervisor:supervisor_id (
          id,
          name
        ),
        reviewer:reviewer_id (
          id,
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    
    // 应用过滤条件
    if (status) {
      query = query.eq('status', status)
    }
    
    if (priority) {
      query = query.eq('priority', priority)
    }
    
    if (type) {
      query = query.eq('type_id', type)
    }
    
    if (assignee) {
      query = query.eq('assignee_id', assignee)
    }
    
    // 角色权限过滤
    // R001(ADMIN) 和 R002(MONITOR_MANAGER) 可以查看所有工单
    // R006(MAINTENANCE_SUPERVISOR) 只能查看自己负责区域的工单
    // R003(MAINTAINER) 和 R004(INSPECTOR) 不应该在Web端查看（他们使用移动端）
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      // 获取主管负责的区域
      const { data: supervisorAreas } = await supabase
        .from('river_management_areas')
        .select('id')
        .eq('supervisor_id', decoded.userId)
      
      const areaIds = supervisorAreas?.map(area => area.id) || []
      
      if (areaIds.length > 0) {
        // 查看自己负责区域的工单，或者自己是supervisor_id的工单
        query = query.or(`area_id.in.(${areaIds.join(',')}),supervisor_id.eq.${decoded.userId}`)
      } else {
        // 如果没有负责的区域，只能看到自己是supervisor_id的工单
        query = query.eq('supervisor_id', decoded.userId)
      }
    } else if (!['ADMIN', 'MONITOR_MANAGER'].includes(decoded.roleCode)) {
      // 其他角色不应该访问工单列表
      return errorResponse('无权限访问工单列表', 403)
    }
    
    const { data: workorders, error, count } = await query
    
    if (error) {
      console.error('Query workorders error:', error)
      return errorResponse('获取工单列表失败', 500)
    }
    
    return successResponse({
      data: workorders || [],
      total: count || 0,
      page,
      limit
    })
    
  } catch (error) {
    console.error('Get workorders error:', error)
    return errorResponse('获取工单列表失败', 500)
  }
}

// POST - 创建新工单
export async function POST(request: NextRequest) {
  try {
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
    
    const body = await request.json()
    const {
      type_id,
      alarm_id,
      report_id,
      title,
      description,
      priority,
      point_id,
      area_id,
      location,
      coordinates,
      assignee_id,
      expected_complete_at
    } = body
    
    // 验证必填字段
    if (!type_id || !title) {
      return errorResponse('缺少必填字段', 400)
    }
    
    const supabase = createServiceClient()
    
    // 生成工单ID (格式: WO-YYYYMMDD-XXXXX)
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    
    const { data: lastWorkorder } = await supabase
      .from('workorders')
      .select('id')
      .like('id', `WO-${dateStr}-%`)
      .order('id', { ascending: false })
      .limit(1)
      .single()
    
    let nextNumber = 1
    if (lastWorkorder) {
      const lastNumber = parseInt(lastWorkorder.id.split('-')[2])
      nextNumber = lastNumber + 1
    }
    
    const workorderId = `WO-${dateStr}-${nextNumber.toString().padStart(5, '0')}`
    
    // 创建工单
    const { data: newWorkorder, error } = await supabase
      .from('workorders')
      .insert({
        id: workorderId,
        type_id,
        alarm_id: alarm_id || null,
        report_id: report_id || null,
        title,
        description,
        priority: priority || 'normal',
        status: assignee_id ? 'assigned' : 'pending',
        sla_status: 'active',
        department_id: decoded.departmentId || null,
        point_id: point_id || null,
        area_id: area_id || null,
        location,
        coordinates,
        creator_id: decoded.userId,
        assignee_id: assignee_id || null,
        source: alarm_id ? 'alarm' : report_id ? 'report' : 'manual',
        assigned_at: assignee_id ? new Date().toISOString() : null,
        expected_complete_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        workorder_types:type_id (
          id,
          name,
          code
        ),
        creator:creator_id (
          id,
          name
        ),
        assignee:assignee_id (
          id,
          name
        )
      `)
      .single()
    
    if (error) {
      console.error('Create workorder error:', error)
      return errorResponse('创建工单失败', 500)
    }
    
    // 如果工单来源于告警，更新告警状态
    if (alarm_id) {
      await supabase
        .from('alarms')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', alarm_id)
    }
    
    return successResponse({
      workorder: newWorkorder,
      message: '工单创建成功'
    })
    
  } catch (error) {
    console.error('Create workorder error:', error)
    return errorResponse('创建工单失败', 500)
  }
}