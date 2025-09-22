/**
 * 工单分配 API
 * PUT /api/workorders/[id]/assign - 分配工单给处理人
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

// PUT - 分配工单
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workorderId } = await params
    
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
    const { assignee_id, note } = body
    
    if (!assignee_id) {
      return errorResponse('请选择处理人员', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取工单信息
    const { data: workorder, error: fetchError } = await supabase
      .from('workorders')
      .select('*, area:area_id(id)')
      .eq('id', workorderId)
      .single()
    
    if (fetchError || !workorder) {
      return errorResponse('工单不存在', 404)
    }
    
    // 检查工单状态
    if (!['pending', 'assigned'].includes(workorder.status)) {
      return errorResponse('该工单状态不允许重新分配', 400)
    }
    
    // 权限控制：超级管理员不设限，区域管理员只能分配自己区域的工单
    const isAdmin = decoded.userId === 'USER_ADMIN' || 
                    decoded.username === 'admin' || 
                    ['ADMIN', 'admin', 'R001'].includes(decoded.roleCode)
    
    if (!isAdmin) {
      // 权限检查
      // R002(MONITOR_MANAGER) 可以分配所有工单
      // R006(MAINTENANCE_SUPERVISOR) 只能分配自己负责区域的工单
      if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR' || decoded.roleCode === 'R006') {
        // 检查是否是该区域的主管
        const { data: supervisorArea } = await supabase
          .from('river_management_areas')
          .select('id')
          .eq('supervisor_id', decoded.userId)
          .eq('id', workorder.area_id)
          .single()
        
        if (!supervisorArea) {
          return errorResponse('只能分配自己负责区域的工单', 403)
        }
      } else if (!['MONITOR_MANAGER', 'monitor_manager', 'R002'].includes(decoded.roleCode)) {
        return errorResponse('无权限分配工单', 403)
      }
    }
    // 超级管理员可以分配所有工单
    
    // 验证被分配人存在
    const { data: assignee, error: assigneeError } = await supabase
      .from('users')
      .select('id, name, status')
      .eq('id', assignee_id)
      .single()
    
    if (assigneeError || !assignee) {
      return errorResponse('处理人员不存在', 400)
    }
    
    if (assignee.status !== 'active') {
      return errorResponse('处理人员账号未激活', 400)
    }
    
    // 更新工单
    const updateData: any = {
      assignee_id,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // 如果是R006分配的，设置supervisor_id
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      updateData.supervisor_id = decoded.userId
    }
    
    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update(updateData)
      .eq('id', workorderId)
      .select(`
        *,
        assignee:assignee_id (
          id,
          name,
          phone
        )
      `)
      .single()
    
    if (updateError) {
      console.error('Update workorder error:', updateError)
      return errorResponse('分配工单失败', 500)
    }
    
    // 记录分配历史
    await supabase.from('workorder_status_history').insert({
      workorder_id: workorderId,
      from_status: workorder.status,
      to_status: 'assigned',
      changed_by: decoded.userId,
      change_note: note || `分配给 ${assignee.name}`,
      created_at: new Date().toISOString()
    })
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'workorder_management',
      action: 'assign',
      target_type: 'workorder',
      target_id: workorderId,
      target_name: workorder.title,
      request_data: { assignee_id, assignee_name: assignee.name },
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    // 发送通知给被分配人
    await supabase.from('notification_queue').insert({
      user_id: assignee_id,
      type: 'workorder_assigned',
      title: '新工单分配',
      content: `您有新的工单需要处理：${workorder.title}`,
      priority: workorder.priority,
      related_type: 'workorder',
      related_id: workorderId,
      created_at: new Date().toISOString()
    })
    
    // 发送推送通知给被分配的维护员
    try {
      const { sendWorkOrderPush } = await import('@/lib/push-notification.service')
      
      // 检查被分配人是否有注册设备
      const { data: devices } = await supabase
        .from('mobile_devices')
        .select('user_id')
        .eq('user_id', assignee_id)
        .eq('is_active', true)
      
      if (devices && devices.length > 0) {
        // 获取工单详细信息用于推送
        const { data: workorderDetail } = await supabase
          .from('workorders')
          .select(`
            *,
            monitoring_points:point_id (
              name,
              river_name
            ),
            workorder_types:type_id (
              name
            )
          `)
          .eq('id', workorderId)
          .single()
        
        const pushData = {
          id: workorderId,
          type: workorderDetail?.workorder_types?.name || '工单处理',
          location: workorderDetail?.monitoring_points?.name || workorder.location || '未知位置',
          priority: workorder.priority,
          deadline: workorder.expected_complete_at,
          assignedBy: decoded.username,
          description: workorder.description || workorder.title
        }
        
        await sendWorkOrderPush(pushData, [assignee_id])
        
        console.log(`[WorkOrder Assign Push] 已推送给被分配人: ${assignee_id}`)
      } else {
        console.log(`[WorkOrder Assign Push] 被分配人 ${assignee_id} 未注册设备，跳过推送`)
      }
    } catch (pushError) {
      // 推送失败不影响工单分配
      console.error('工单分配推送通知失败:', pushError)
    }
    
    return successResponse({
      workorder: updatedWorkorder,
      message: '工单分配成功'
    })
    
  } catch (error) {
    console.error('Assign workorder error:', error)
    return errorResponse('分配工单失败', 500)
  }
}