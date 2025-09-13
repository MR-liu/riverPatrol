/**
 * 告警转工单 API
 * POST /api/alarms/[id]/convert-to-workorder - 将告警转换为工单
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

// POST - 将告警转换为工单
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 14 requires awaiting params
    const { id: alarmId } = await params
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
    
    // 验证用户角色权限
    // R001(系统管理员)、R002(监控中心主管)和R006(河道维护员主管)可以创建工单
    if (!['ADMIN', 'MONITOR_MANAGER', 'MAINTENANCE_SUPERVISOR'].includes(decoded.roleCode)) {
      return errorResponse('无权限创建工单', 403)
    }
    
    const body = await request.json()
    const {
      type_id = 'WT_001', // 默认告警处理类型
      priority = 'normal',
      assignee_id,
      area_id, // R006可以指定区域
      description,
      expected_complete_at
    } = body
    
    const supabase = createServiceClient()
    
    // 获取告警详情
    const { data: alarm, error: alarmError } = await supabase
      .from('alarms')
      .select(`
        *,
        alarm_types:type_id (
          id,
          name,
          code
        ),
        alarm_levels:level_id (
          id,
          name,
          code,
          priority
        ),
        monitoring_points:point_id (
          id,
          name,
          code,
          river_name,
          longitude,
          latitude
        )
      `)
      .eq('id', alarmId)
      .single()
    
    if (alarmError || !alarm) {
      return errorResponse('告警不存在', 404)
    }
    
    // R006只能处理自己负责区域的告警
    // ADMIN可以处理所有告警
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      const { data: supervisorAreas } = await supabase
        .from('river_management_areas')
        .select('id, monitoring_point_ids')
        .eq('supervisor_id', decoded.userId)
      
      const pointIds = supervisorAreas?.flatMap(area => area.monitoring_point_ids || []) || []
      if (!pointIds.includes(alarm.point_id)) {
        return errorResponse('只能处理负责区域内的告警', 403)
      }
    }
    
    // 检查是否已经创建过工单
    const { data: existingWorkorder } = await supabase
      .from('workorders')
      .select('id')
      .eq('alarm_id', alarmId)
      .single()
    
    if (existingWorkorder) {
      return errorResponse('该告警已创建工单', 400)
    }
    
    // 生成工单ID (WO-YYYYMMDD-XXXXX格式)
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
    
    // 根据告警级别设置工单优先级
    let workorderPriority = priority
    if (alarm.alarm_levels?.priority <= 2) {
      workorderPriority = 'urgent'
    } else if (alarm.alarm_levels?.priority === 3) {
      workorderPriority = 'important'
    }
    
    // 如果是R006创建工单，自动设置区域ID
    let workorderAreaId = area_id
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR' && !workorderAreaId) {
      const { data: supervisorArea } = await supabase
        .from('river_management_areas')
        .select('id')
        .eq('supervisor_id', decoded.userId)
        .single()
      
      workorderAreaId = supervisorArea?.id
    }
    
    // 创建工单
    const { data: newWorkorder, error: workorderError } = await supabase
      .from('workorders')
      .insert({
        id: workorderId,
        type_id,
        alarm_id: alarmId,
        title: `[告警处理] ${alarm.title}`,
        description: description || `告警信息：${alarm.description}\n\n告警类型：${alarm.alarm_types?.name}\n告警级别：${alarm.alarm_levels?.name}\n告警位置：${alarm.monitoring_points?.name}`,
        priority: workorderPriority,
        status: assignee_id ? 'assigned' : 'pending',
        department_id: alarm.department_id,
        point_id: alarm.point_id,
        area_id: workorderAreaId,
        location: alarm.monitoring_points?.name,
        coordinates: {
          longitude: alarm.monitoring_points?.longitude,
          latitude: alarm.monitoring_points?.latitude
        },
        creator_id: decoded.userId,
        // 只有在assignee_id有值且不为空字符串时才设置，否则设为null
        assignee_id: assignee_id && assignee_id !== '' ? assignee_id : null,
        // R006创建的工单默认由自己负责
        supervisor_id: decoded.roleCode === 'MAINTENANCE_SUPERVISOR' ? decoded.userId : null,
        source: 'alarm',
        expected_complete_at: expected_complete_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 默认24小时
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_at: assignee_id ? new Date().toISOString() : null
      })
      .select()
      .single()
    
    if (workorderError) {
      console.error('Create workorder error:', workorderError)
      return errorResponse('创建工单失败', 500)
    }
    
    // 更新告警状态为处理中
    await supabase
      .from('alarms')
      .update({
        status: 'processing',
        confirmed_by: decoded.userId,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', alarmId)
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'alarm_management',
      action: 'convert_to_workorder',
      target_type: 'alarm',
      target_id: params.id,
      target_name: alarm.title,
      request_data: { workorder_id: workorderId },
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    return successResponse({
      workorder: newWorkorder,
      message: '工单创建成功'
    })
    
  } catch (error) {
    console.error('Convert alarm to workorder error:', error)
    return errorResponse('创建工单失败', 500)
  }
}