/**
 * 工单操作 API
 * POST /api/workorders/[id]/actions - 工单状态流转操作
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

// 工单操作请求验证模式
const workorderActionSchema = z.object({
  action: z.enum([
    'reject',           // R003区域主管拒绝工单
    'accept',           // R003区域主管接受工单
    'dispatch',         // R003区域主管派发给R004
    'start_processing', // R004开始处理
    'submit_review',    // R004提交审核
    'approve_review',   // R003审核通过
    'reject_review',    // R003审核退回
    'final_approve',    // R001最终审批通过
    'final_reject',     // R001最终审批拒绝
    'reporter_confirm', // 发起人确认满意
    'reporter_reject',  // 发起人确认不满意
    'close'             // 关闭工单
  ], { 
    required_error: '操作类型不能为空',
    invalid_type_error: '无效的操作类型'
  }),
  assignee_id: z.string().optional(), // 分配给的用户ID（仅dispatch时需要）
  note: z.string().min(1, '操作备注不能为空'),
  estimated_hours: z.number().optional(), // 预计工时（仅start_processing时可选）
  actual_hours: z.number().optional(), // 实际工时（仅submit_review时可选）
  resolution: z.string().optional(), // 处理结果说明（仅submit_review时需要）
  attachments: z.array(z.string()).optional() // 附件URL列表
})

// 工单状态转换规则
const statusTransitions = {
  'pending_dispatch': ['reject', 'accept', 'dispatch'],
  'dispatched': ['start_processing'],
  'processing': ['submit_review'],
  'pending_review': ['approve_review', 'reject_review'],
  'pending_final_review': ['final_approve', 'final_reject'],
  'pending_reporter_confirm': ['reporter_confirm', 'reporter_reject'], // 发起人确认
  'confirmed_failed': ['dispatch'], // 确认失败后可重新派发
  'completed': [], // 已完成的工单不能再操作
  'rejected': [] // 已拒绝的工单不能再操作
}

// 角色权限检查 - 支持多种角色代码格式
const rolePermissions = {
  'reject': ['AREA_SUPERVISOR', 'R006', 'MAINTENANCE_SUPERVISOR', 'ADMIN', 'R001'], // R006区域管理员 + R001系统管理员
  'accept': ['AREA_SUPERVISOR', 'R006', 'MAINTENANCE_SUPERVISOR', 'ADMIN', 'R001'], // R006区域管理员 + R001系统管理员
  'dispatch': ['AREA_SUPERVISOR', 'R006', 'MAINTENANCE_SUPERVISOR', 'ADMIN', 'R001'], // R006区域管理员 + R001系统管理员
  'start_processing': ['MAINTENANCE_WORKER', 'R003', 'MAINTAINER'], // R003维护作业员
  'submit_review': ['MAINTENANCE_WORKER', 'R003', 'MAINTAINER'], // R003维护作业员
  'approve_review': ['AREA_SUPERVISOR', 'R006', 'MAINTENANCE_SUPERVISOR', 'ADMIN', 'R001'], // R006区域管理员 + R001系统管理员
  'reject_review': ['AREA_SUPERVISOR', 'R006', 'MAINTENANCE_SUPERVISOR', 'ADMIN', 'R001'], // R006区域管理员 + R001系统管理员
  'final_approve': ['ADMIN', 'R001', 'MONITOR_MANAGER', 'R002'], // R001管理员或R002监控中心主管
  'final_reject': ['ADMIN', 'R001', 'MONITOR_MANAGER', 'R002'], // R001管理员或R002监控中心主管
  'reporter_confirm': ['ADMIN', 'R001', 'INSPECTOR', 'R004'], // 发起人或管理员可以确认
  'reporter_reject': ['ADMIN', 'R001', 'INSPECTOR', 'R004'], // 发起人或管理员可以拒绝
  'close': ['ADMIN', 'R001', 'MONITOR_MANAGER', 'R002', 'AREA_SUPERVISOR', 'R006', 'MAINTENANCE_SUPERVISOR'] // 多角色
}

// 状态转换映射
const statusMapping = {
  'reject': 'rejected',
  'accept': 'pending_dispatch',
  'dispatch': 'dispatched',
  'start_processing': 'processing',
  'submit_review': 'pending_review',
  'approve_review': 'pending_final_review',
  'reject_review': 'processing', // 退回到处理中
  'final_approve': 'completed',
  'final_reject': 'rejected',
  'reporter_confirm': 'completed',
  'reporter_reject': 'confirmed_failed',
  'close': 'completed'
}

// POST - 执行工单操作
export async function POST(
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
    
    // 验证请求数据
    const validationResult = workorderActionSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const { 
      action, 
      assignee_id, 
      note, 
      estimated_hours, 
      actual_hours, 
      resolution,
      attachments 
    } = validationResult.data
    
    // 检查操作权限 - 同时检查roleCode和roleId
    const allowedRoles = rolePermissions[action]
    const userRole = decoded.roleCode || decoded.roleId || ''
    
    // 特殊处理：发起人确认操作
    if (action === 'reporter_confirm' || action === 'reporter_reject') {
      // 稍后会在获取工单后检查是否是发起人
    } else if (!allowedRoles.includes(userRole)) {
      // 如果roleCode不匹配，尝试用roleId再检查一次
      if (decoded.roleId && !allowedRoles.includes(decoded.roleId)) {
        console.log(`权限检查失败: 用户角色=${userRole}, 允许的角色=${allowedRoles.join(',')}`)
        return errorResponse(`您没有权限执行此操作`, 403)
      }
    }
    
    const supabase = createServiceClient()
    
    // 获取工单信息
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        workorder_types:type_id (
          id,
          name,
          code
        ),
        creator:creator_id (
          id,
          name,
          username
        ),
        assignee:assignee_id (
          id,
          name,
          username
        ),
        alarms:alarm_id (
          id,
          title,
          status
        )
      `)
      .eq('id', workorderId)
      .single()
    
    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }
    
    // 发起人确认权限检查
    if (action === 'reporter_confirm' || action === 'reporter_reject') {
      const isReporter = workorder.initial_reporter_id === decoded.userId
      const isAdmin = decoded.roleCode === 'R001' || 
                      decoded.roleCode === 'ADMIN' || 
                      decoded.username === 'admin' ||
                      decoded.userId === 'USER001' ||
                      decoded.userId === 'USER_ADMIN'
      
      if (!isReporter && !isAdmin) {
        return errorResponse('只有工单发起人或管理员可以确认处理结果', 403)
      }
    }
    
    // 区域权限检查 - R006区域管理员只能操作自己管理区域的工单
    if (['R006', 'AREA_SUPERVISOR', 'MAINTENANCE_SUPERVISOR'].includes(userRole)) {
      // 需要验证用户是否管理该工单所属区域
      if (workorder.area_id && decoded.areaId && workorder.area_id !== decoded.areaId) {
        console.log(`区域权限检查失败: 工单区域=${workorder.area_id}, 用户管理区域=${decoded.areaId}`)
        return errorResponse('您只能操作自己管理区域的工单', 403)
      }
    }
    
    // 检查状态转换是否有效
    const currentStatus = workorder.status
    const allowedActions = statusTransitions[currentStatus] || []
    
    // 超级管理员特殊权限：可以在任何状态下关闭工单
    const isAdmin = decoded.roleCode === 'R001' || 
                    decoded.roleCode === 'ADMIN' || 
                    decoded.username === 'admin' ||
                    decoded.userId === 'USER001' ||
                    decoded.userId === 'USER_ADMIN'
    
    if (!allowedActions.includes(action)) {
      // 如果是管理员执行关闭操作，允许
      if (isAdmin && action === 'close') {
        // 允许管理员在任何状态下关闭工单
      } else {
        return errorResponse(
          `工单当前状态（${currentStatus}）不允许执行此操作（${action}）`, 
          400
        )
      }
    }
    
    // 特殊验证
    if (action === 'dispatch' && !assignee_id) {
      return errorResponse('派发工单时必须指定处理人', 400)
    }
    
    if (action === 'submit_review' && !resolution) {
      return errorResponse('提交审核时必须填写处理结果', 400)
    }
    
    // 检查分配的用户是否存在且角色正确（仅dispatch时）
    if (action === 'dispatch') {
      const { data: assignee, error: assigneeError } = await supabase
        .from('users')
        .select(`
          id, 
          name, 
          username,
          status,
          roles!inner(
            id,
            name,
            code,
            role_code
          )
        `)
        .eq('id', assignee_id)
        .eq('status', 'active')
        .single()
      
      if (assigneeError || !assignee) {
        console.error('查询指定用户失败:', assigneeError)
        return errorResponse('指定的处理人不存在或已停用', 400)
      }
      
      // 检查是否是维护作业员角色（支持多种角色代码格式）
      const maintenanceWorkerRoles = ['MAINTENANCE_WORKER', 'R003', 'MAINTAINER']
      const assigneeRoleCode = assignee.roles?.role_code || assignee.roles?.code || ''
      
      if (!maintenanceWorkerRoles.includes(assigneeRoleCode)) {
        console.log(`角色检查失败: 用户=${assignee.name}, 角色=${assigneeRoleCode}, 需要=${maintenanceWorkerRoles.join(',')}`)
        return errorResponse('只能将工单分配给维护作业员（R003）', 400)
      }
    }
    
    const now = new Date().toISOString()
    const newStatus = statusMapping[action]
    
    // 构建更新数据
    const updateData: any = {
      status: newStatus,
      updated_at: now
    }
    
    // 根据操作类型设置相应字段
    switch (action) {
      case 'reject':
        updateData.rejected_by = decoded.userId
        updateData.rejected_at = now
        updateData.reject_reason = note
        break
        
      case 'accept':
        updateData.accepted_by = decoded.userId
        updateData.accepted_at = now
        updateData.accept_note = note
        break
        
      case 'dispatch':
        updateData.assignee_id = assignee_id
        updateData.dispatcher_id = decoded.userId
        updateData.dispatched_at = now
        updateData.dispatch_note = note
        break
        
      case 'start_processing':
        updateData.started_at = now
        updateData.start_note = note
        if (estimated_hours) {
          updateData.estimated_hours = estimated_hours
        }
        break
        
      case 'submit_review':
        updateData.resolution = resolution
        updateData.submit_note = note
        if (actual_hours) {
          updateData.actual_hours = actual_hours
        }
        
        // 创建或更新工单处理结果记录
        if (resolution || attachments?.length > 0) {
          // 先检查是否已存在处理结果
          const { data: existingResult } = await supabase
            .from('workorder_results')
            .select('id')
            .eq('workorder_id', workorderId)
            .single()
          
          const resultData = {
            workorder_id: workorderId,
            result_type: '现场处理',
            before_images: workorder.images || [], // 使用工单原始图片作为处理前图片
            after_images: attachments || [],
            description: resolution || note || '处理完成',
            time_spent: actual_hours ? actual_hours * 60 : null, // 转换为分钟
            updated_at: now
          }
          
          if (existingResult) {
            // 更新现有记录
            await supabase
              .from('workorder_results')
              .update(resultData)
              .eq('id', existingResult.id)
          } else {
            // 创建新记录
            const resultId = `WR_${Date.now().toString().slice(-10)}_${Math.random().toString(36).substring(2, 7)}`
            await supabase
              .from('workorder_results')
              .insert({
                id: resultId,
                ...resultData,
                created_at: now
              })
          }
        }
        break
        
      case 'approve_review':
        updateData.reviewer_id = decoded.userId
        updateData.reviewed_at = now
        updateData.review_note = note
        updateData.review_result = 'approved'
        break
        
      case 'reject_review':
        updateData.reviewer_id = decoded.userId
        updateData.reviewed_at = now
        updateData.review_note = note
        updateData.review_result = 'rejected'
        break
        
      case 'final_approve':
        updateData.final_approved_by = decoded.userId
        updateData.final_approved_at = now
        updateData.final_note = note
        updateData.completed_at = now
        break
        
      case 'final_reject':
        updateData.rejected_by = decoded.userId
        updateData.rejected_at = now
        updateData.final_note = note
        break
        
      case 'reporter_confirm':
        updateData.reporter_confirmed_at = now
        updateData.reporter_confirm_note = note
        updateData.reporter_confirm_result = 'confirmed'
        updateData.completed_at = now
        break
        
      case 'reporter_reject':
        updateData.reporter_confirmed_at = now
        updateData.reporter_confirm_note = note
        updateData.reporter_confirm_result = 'rejected'
        break
        
      case 'close':
        updateData.completed_at = now
        updateData.final_note = note
        break
    }
    
    // 更新工单
    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update(updateData)
      .eq('id', workorderId)
      .select()
      .single()
    
    if (updateError) {
      console.error('Update workorder error:', updateError)
      return errorResponse('更新工单状态失败', 500)
    }
    
    // 记录操作历史
    const historyData = {
      workorder_id: workorderId,
      action_type: action,
      operator_id: decoded.userId,
      operator_name: decoded.name || decoded.username,
      operator_role: decoded.roleCode,
      old_status: currentStatus,
      new_status: newStatus,
      note: note,
      assignee_id: assignee_id || null,
      estimated_hours: estimated_hours || null,
      actual_hours: actual_hours || null,
      resolution: resolution || null,
      attachments: attachments || [],
      created_at: now
    }
    
    await supabase
      .from('workorder_histories')
      .insert(historyData)
    
    // 如果工单关联了告警，同步更新告警状态
    if (workorder.alarm_id && ['final_approve', 'close'].includes(action)) {
      await supabase
        .from('alarms')
        .update({ 
          status: 'resolved',
          resolved_by: decoded.userId,
          resolved_at: now,
          updated_at: now
        })
        .eq('id', workorder.alarm_id)
    }
    
    // 构建响应消息
    const actionMessages = {
      'reject': '工单已拒绝',
      'accept': '工单已接受',
      'dispatch': '工单已派发',
      'start_processing': '开始处理工单',
      'submit_review': '工单已提交审核',
      'approve_review': '审核通过，已提交最终审批',
      'reject_review': '审核退回，请重新处理',
      'final_approve': '最终审批通过，工单已完成',
      'final_reject': '最终审批拒绝',
      'reporter_confirm': '发起人确认满意，工单已完成',
      'reporter_reject': '发起人确认不满意，需重新处理',
      'close': '工单已关闭'
    }
    
    return successResponse({
      workorder: updatedWorkorder,
      message: actionMessages[action] || '操作完成'
    })
    
  } catch (error) {
    console.error('Workorder action error:', error)
    return errorResponse('工单操作失败', 500)
  }
}