/**
 * 工单详情和操作 API
 * GET /api/workorders/[id] - 获取工单详情
 * PUT /api/workorders/[id] - 更新工单状态
 * DELETE /api/workorders/[id] - 删除工单
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

// GET - 获取工单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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
    
    const supabase = createServiceClient()
    
    // 获取工单详情
    const { data: workorder, error } = await supabase
      .from('workorders')
      .select(`
        *,
        workorder_types:type_id (
          id,
          name,
          code,
          category,
          sla_hours,
          description
        ),
        alarms:alarm_id (
          id,
          title,
          status,
          type_id,
          level_id
        ),
        problem_reports:report_id (
          id,
          title,
          status,
          category_ids
        ),
        monitoring_points:point_id (
          id,
          name,
          code,
          river_name,
          river_section,
          longitude,
          latitude,
          address
        ),
        departments:department_id (
          id,
          name,
          code
        ),
        areas:area_id (
          id,
          name,
          code,
          supervisor_id
        ),
        creator:creator_id (
          id,
          name,
          username,
          phone
        ),
        assignee:assignee_id (
          id,
          name,
          username,
          phone,
          role_id
        ),
        supervisor:supervisor_id (
          id,
          name,
          username,
          phone
        ),
        reviewer:reviewer_id (
          id,
          name,
          username,
          phone
        ),
        workorder_results (
          id,
          before_photos,
          after_photos,
          process_method,
          process_result,
          process_duration,
          need_followup,
          followup_reason,
          submitted_at,
          reviewed_at,
          review_status,
          review_note
        ),
        workorder_status_history (
          id,
          from_status,
          to_status,
          changed_by,
          change_note,
          created_at
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Get workorder detail error:', error)
      if (error.code === 'PGRST116') {
        return errorResponse('工单不存在', 404)
      }
      return errorResponse('获取工单详情失败', 500)
    }
    
    // 权限控制：超级管理员不设限，区域管理员只能查看自己区域的工单
    const isAdmin = decoded.userId === 'USER_ADMIN' || 
                    decoded.username === 'admin' || 
                    ['ADMIN', 'admin', 'R001'].includes(decoded.roleCode)
    
    if (!isAdmin) {
      // 权限检查
      // R006只能查看自己负责区域的工单
      if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR' || decoded.roleCode === 'R006') {
        const { data: supervisorArea } = await supabase
          .from('river_management_areas')
          .select('id')
          .eq('supervisor_id', decoded.userId)
          .eq('id', workorder.area_id)
          .single()
        
        if (!supervisorArea && workorder.supervisor_id !== decoded.userId) {
          return errorResponse('无权限查看此工单', 403)
        }
      } else if (!['MONITOR_MANAGER', 'monitor_manager', 'R002'].includes(decoded.roleCode)) {
        return errorResponse('无权限查看工单详情', 403)
      }
    }
    // 超级管理员可以查看所有工单详情
    
    return successResponse({
      workorder
    })
    
  } catch (error) {
    console.error('Get workorder detail error:', error)
    return errorResponse('获取工单详情失败', 500)
  }
}

// PUT - 更新工单状态
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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
    const { action, note, result_data } = body
    
    // 验证操作类型
    const validActions = ['start', 'submit_result', 'approve', 'reject', 'cancel']
    if (!validActions.includes(action)) {
      return errorResponse('无效的操作类型', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取当前工单状态
    const { data: currentWorkorder, error: fetchError } = await supabase
      .from('workorders')
      .select('*, area:area_id(id, supervisor_id)')
      .eq('id', id)
      .single()
    
    if (fetchError || !currentWorkorder) {
      return errorResponse('工单不存在', 404)
    }
    
    // 权限控制：超级管理员不设限，区域管理员只能操作自己区域的工单
    const isAdmin = decoded.userId === 'USER_ADMIN' || 
                    decoded.username === 'admin' || 
                    ['ADMIN', 'admin', 'R001'].includes(decoded.roleCode)
    
    if (!isAdmin) {
      // 权限检查
      let canUpdate = false
      
      if (['MONITOR_MANAGER', 'monitor_manager', 'R002'].includes(decoded.roleCode)) {
        canUpdate = true
      } else if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR' || decoded.roleCode === 'R006') {
        // R006可以更新自己负责区域的工单
        if (currentWorkorder.area?.supervisor_id === decoded.userId || 
            currentWorkorder.supervisor_id === decoded.userId) {
          canUpdate = true
        }
      }
      
      if (!canUpdate) {
        return errorResponse('无权限更新此工单', 403)
      }
    }
    // 超级管理员可以更新所有工单
    
    // 构建更新数据
    let updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    let fromStatus = currentWorkorder.status
    let toStatus = currentWorkorder.status
    
    switch (action) {
      case 'start':
        if (currentWorkorder.status !== 'assigned') {
          return errorResponse('只能开始已分配的工单', 400)
        }
        updateData.status = 'processing'
        updateData.started_at = new Date().toISOString()
        toStatus = 'processing'
        break
        
      case 'submit_result':
        if (currentWorkorder.status !== 'processing') {
          return errorResponse('只能提交处理中的工单结果', 400)
        }
        
        // 创建工单结果记录
        if (result_data) {
          const { data: workorderResult, error: resultError } = await supabase
            .from('workorder_results')
            .insert({
              workorder_id: id,
              processor_id: currentWorkorder.assignee_id || decoded.userId,
              ...result_data,
              submitted_at: new Date().toISOString()
            })
            .select()
            .single()
          
          if (resultError) {
            console.error('Create workorder result error:', resultError)
            return errorResponse('提交工单结果失败', 500)
          }
        }
        
        updateData.status = 'pending_review'
        toStatus = 'pending_review'
        break
        
      case 'approve':
        if (currentWorkorder.status !== 'pending_review') {
          return errorResponse('只能审核待审核的工单', 400)
        }
        updateData.status = 'completed'
        updateData.completed_at = new Date().toISOString()
        updateData.reviewer_id = decoded.userId
        updateData.reviewed_at = new Date().toISOString()
        toStatus = 'completed'
        break
        
      case 'reject':
        if (currentWorkorder.status !== 'pending_review') {
          return errorResponse('只能拒绝待审核的工单', 400)
        }
        if (!note) {
          return errorResponse('拒绝工单必须提供理由', 400)
        }
        updateData.status = 'processing'
        updateData.is_resubmit = true
        toStatus = 'processing'
        break
        
      case 'cancel':
        if (['completed', 'cancelled'].includes(currentWorkorder.status)) {
          return errorResponse('不能取消已完成或已取消的工单', 400)
        }
        updateData.status = 'cancelled'
        toStatus = 'cancelled'
        break
    }
    
    // 更新工单
    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Update workorder error:', updateError)
      return errorResponse('更新工单失败', 500)
    }
    
    // 记录状态变更历史
    await supabase.from('workorder_status_history').insert({
      workorder_id: id,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: decoded.userId,
      change_note: note || `执行操作: ${action}`,
      created_at: new Date().toISOString()
    })
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'workorder_management',
      action: action,
      target_type: 'workorder',
      target_id: id,
      target_name: currentWorkorder.title,
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    // 如果工单完成且来源于告警，更新告警状态
    if (toStatus === 'completed' && currentWorkorder.alarm_id) {
      await supabase
        .from('alarms')
        .update({
          status: 'resolved',
          resolved_by: decoded.userId,
          resolved_at: new Date().toISOString(),
          resolution_note: '通过工单处理完成',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentWorkorder.alarm_id)
    }
    
    return successResponse({
      workorder: updatedWorkorder,
      message: '工单状态更新成功'
    })
    
  } catch (error) {
    console.error('Update workorder error:', error)
    return errorResponse('更新工单失败', 500)
  }
}

// DELETE - 删除工单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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
    
    // 权限控制：只有超级管理员可以删除工单
    const isAdmin = decoded.userId === 'USER_ADMIN' || 
                    decoded.username === 'admin' || 
                    ['ADMIN', 'admin', 'R001'].includes(decoded.roleCode)
    
    if (!isAdmin) {
      return errorResponse('无权限删除工单', 403)
    }
    
    const supabase = createServiceClient()
    
    // 检查工单是否存在
    const { data: workorder, error: fetchError } = await supabase
      .from('workorders')
      .select('id, title, status')
      .eq('id', id)
      .single()
    
    if (fetchError || !workorder) {
      return errorResponse('工单不存在', 404)
    }
    
    // 不允许删除已完成的工单
    if (workorder.status === 'completed') {
      return errorResponse('不能删除已完成的工单', 400)
    }
    
    // 删除工单
    const { error: deleteError } = await supabase
      .from('workorders')
      .delete()
      .eq('id', id)
    
    if (deleteError) {
      console.error('Delete workorder error:', deleteError)
      return errorResponse('删除工单失败', 500)
    }
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'workorder_management',
      action: 'delete',
      target_type: 'workorder',
      target_id: id,
      target_name: workorder.title,
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    return successResponse({
      message: '工单删除成功'
    })
    
  } catch (error) {
    console.error('Delete workorder error:', error)
    return errorResponse('删除工单失败', 500)
  }
}