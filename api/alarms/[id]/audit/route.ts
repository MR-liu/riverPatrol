/**
 * 告警审核 API
 * POST /api/alarms/[id]/audit - R002监控中心主管审核告警
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

// 告警审核请求验证模式
const auditAlarmSchema = z.object({
  action: z.enum(['approve', 'reject'], { 
    required_error: '审核操作不能为空',
    invalid_type_error: '审核操作必须是 approve 或 reject'
  }),
  priority: z.enum(['urgent', 'important', 'normal']).optional(),
  note: z.string().min(1, '审核备注不能为空'),
  create_workorder: z.boolean().optional().default(false) // 是否立即创建工单
})

// POST - 审核告警
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    
    // 权限检查：系统管理员(R001)和监控中心主管(R002)可以审核告警
    const allowedRoles = ['R001', 'R002', 'ADMIN', 'MONITOR_MANAGER']
    const isAdmin = decoded.username === 'admin' || decoded.userId === 'USER_ADMIN'
    
    if (!allowedRoles.includes(decoded.roleCode) && !isAdmin) {
      return errorResponse('只有系统管理员或监控中心主管可以审核告警', 403)
    }
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = auditAlarmSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { action, priority, note, create_workorder } = validationResult.data
    const supabase = createServiceClient()
    
    // 获取告警信息
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
          code
        ),
        devices:device_id (
          id,
          name,
          code
        ),
        monitoring_points:point_id (
          id,
          name,
          code,
          river_name,
          river_id
        )
      `)
      .eq('id', alarmId)
      .single()
    
    if (alarmError || !alarm) {
      return errorResponse('告警不存在', 404)
    }
    
    // 检查告警状态
    if (alarm.status !== 'pending') {
      return errorResponse('该告警已被审核，无法重复操作', 400)
    }
    
    const now = new Date().toISOString()
    
    // 更新告警状态
    const updateData: any = {
      audit_status: action === 'approve' ? 'approved' : 'rejected',
      auditor_id: decoded.userId,
      audit_time: now,
      audit_note: note,
      status: action === 'approve' ? 'confirmed' : 'false_alarm',  // 拒绝时标记为误报
      updated_at: now
    }
    
    // 如果审核通过，设置确认信息
    if (action === 'approve') {
      updateData.confirmed_by = decoded.userId
      updateData.confirmed_at = now
      
      // 如果设置了优先级，更新优先级
      if (priority) {
        updateData.initial_priority = priority
      }
    }
    
    const { data: updatedAlarm, error: updateError } = await supabase
      .from('alarms')
      .update(updateData)
      .eq('id', alarmId)
      .select()
      .single()
    
    if (updateError) {
      console.error('Update alarm error:', updateError)
      return errorResponse('更新告警状态失败', 500)
    }
    
    let workorder = null
    
    // 如果审核通过且选择立即创建工单
    if (action === 'approve' && create_workorder) {
      // 通过河道查找对应的管理区域
      let areaId = null
      if (alarm.monitoring_points?.river_id) {
        const { data: rivers } = await supabase
          .from('rivers')
          .select('area_id')
          .eq('id', alarm.monitoring_points.river_id)
          .single()
        
        if (rivers?.area_id) {
          areaId = rivers.area_id
        }
      }
      
      // 生成工单ID
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
      
      // 创建工单 - 处理图片字段
      const workorderData: any = {
        id: workorderId,
        type_id: 'WT_001', // 默认告警处理类型
        alarm_id: alarmId,
        title: `处理${alarm.alarm_types?.name || '异常'}告警：${alarm.title}`,
        description: `${alarm.description}\n\n审核备注：${note}`,
        priority: priority || 'normal',
        status: 'pending_dispatch',
        workorder_source: alarm.source_type === 'ai' ? 'ai' : 'manual',
        initial_reporter_id: alarm.reporter_id,
        department_id: alarm.department_id,
        point_id: alarm.point_id,
        area_id: areaId,  // 使用通过河道查找到的区域ID
        location: alarm.location,
        creator_id: decoded.userId,
        source: 'alarm',
        created_at: now,
        updated_at: now
      }
      
      // 处理图片：从alarm的media_files.images复制到workorder的images字段
      if (alarm.media_files?.images && Array.isArray(alarm.media_files.images)) {
        workorderData.images = alarm.media_files.images
      } else if (alarm.image_url) {
        // 兼容旧的单个图片字段
        workorderData.images = [alarm.image_url]
      }
      
      // 处理坐标信息
      if (alarm.coordinates) {
        workorderData.coordinates = alarm.coordinates
      }
      
      const { data: newWorkorder, error: workorderError } = await supabase
        .from('workorders')
        .insert(workorderData)
        .select()
        .single()
      
      if (workorderError) {
        console.error('Create workorder error:', workorderError)
        // 工单创建失败不影响告警审核
      } else {
        workorder = newWorkorder
        
        // 更新告警状态为处理中
        await supabase
          .from('alarms')
          .update({ 
            status: 'processing',
            updated_at: now 
          })
          .eq('id', alarmId)
      }
    }
    
    return successResponse({
      alarm: updatedAlarm,
      workorder,
      message: action === 'approve' ? 
        (create_workorder ? '告警审核通过，工单已创建' : '告警审核通过') : 
        '告警已标记为误报'
    })
    
  } catch (error) {
    console.error('Audit alarm error:', error)
    return errorResponse('审核告警失败', 500)
  }
}