/**
 * 工单详情和状态更新 API
 * GET /api/app-workorders/[id] - 获取工单详情
 * PUT /api/app-workorders/[id] - 更新工单状态
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
 * 获取工单详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workorderId = params.id
    
    // 验证token
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

    const supabase = createServiceClient()
    
    // 获取工单详情
    const { data: workorder, error } = await supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types!inner(id, name, category),
        creator:users!workorders_creator_id_fkey(id, name, username),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        supervisor:users!workorders_supervisor_id_fkey(id, name, username),
        reviewer:users!workorders_reviewer_id_fkey(id, name, username),
        area:river_management_areas(id, name, code),
        department:departments(id, name, code),
        status_history:workorder_status_history(
          id,
          old_status,
          new_status,
          changed_by,
          change_reason,
          created_at,
          user:users!workorder_status_history_changed_by_fkey(name, username)
        ),
        results:workorder_results(
          id,
          process_method,
          process_result,
          before_photos,
          after_photos,
          need_followup,
          followup_reason,
          created_at
        )
      `)
      .eq('id', workorderId)
      .single()

    if (error || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    // 权限检查
    const userId = decoded.userId
    const roleId = decoded.roleId
    const areaId = decoded.areaId
    
    // 根据角色检查访问权限
    let hasAccess = false
    switch (roleId) {
      case 'R001': // 系统管理员
      case 'R002': // 监控中心主管
      case 'R005': // 领导看板用户
        hasAccess = true
        break
      case 'R003': // 河道维护员 - 只能看分配给自己的
        hasAccess = workorder.assignee_id === userId
        break
      case 'R004': // 河道巡检员 - 只能看自己创建的或分配给自己的
        hasAccess = workorder.creator_id === userId || workorder.assignee_id === userId
        break
      case 'R006': // 河道维护员主管 - 只能看自己区域的
        hasAccess = areaId ? workorder.area_id === areaId : false
        break
      default:
        hasAccess = false
    }
    
    if (!hasAccess) {
      return errorResponse('无权查看此工单', 403)
    }

    // 记录活动
    logApiActivity('app_workorder_detail', userId, {
      workorder_id: workorderId,
      role_id: roleId
    })

    return successResponse(workorder, '获取工单详情成功')
    
  } catch (error) {
    console.error('Get workorder detail error:', error)
    return errorResponse('获取工单详情失败', 500)
  }
}

/**
 * 更新工单状态
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workorderId = params.id
    
    // 验证token
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
    const areaId = decoded.areaId
    
    // 解析请求体
    const body = await request.json()
    const { action, note, attachments, processResult } = body
    
    console.log('[app-workorders] 收到更新请求:', {
      workorderId,
      action,
      userId,
      roleId,
      areaId
    })
    
    const supabase = createServiceClient()
    
    // 获取当前工单状态
    const { data: currentWorkorder, error: fetchError } = await supabase
      .from('workorders')
      .select('*, area:river_management_areas(id)')
      .eq('id', workorderId)
      .single()
      
    if (fetchError || !currentWorkorder) {
      return errorResponse('工单不存在', 404)
    }
    
    // 权限检查 - 根据不同操作检查权限
    let hasPermission = false
    let newStatus = currentWorkorder.status
    let updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    switch (action) {
      case 'assign': // 分配工单 - pending → assigned
        if (['R001', 'R002', 'R006'].includes(roleId)) {
          // R006只能分配自己区域的工单
          if (roleId === 'R006' && areaId !== currentWorkorder.area_id) {
            return errorResponse('只能分配自己管理区域的工单', 403)
          }
          if (currentWorkorder.status !== 'pending') {
            return errorResponse('只能分配待分配状态的工单', 400)
          }
          hasPermission = true
          newStatus = 'assigned'
          updateData.assignee_id = body.assigneeId
          updateData.assigned_at = new Date().toISOString()
        }
        break
        
      case 'start': // 开始处理 - assigned/dispatched → processing
        if (currentWorkorder.assignee_id === userId) {
          // 允许 pending, assigned, dispatched 状态的工单开始处理
          if (!['pending', 'assigned', 'dispatched'].includes(currentWorkorder.status)) {
            return errorResponse('工单状态不允许开始处理', 400)
          }
          hasPermission = true
          newStatus = 'processing'
          updateData.started_at = new Date().toISOString()
        }
        break
        
      case 'submit_result': // 提交处理结果 - processing → pending_review
        if (currentWorkorder.assignee_id === userId) {
          if (currentWorkorder.status !== 'processing') {
            return errorResponse('只能在处理中状态提交结果', 400)
          }
          hasPermission = true
          newStatus = 'pending_review'
          updateData.completed_at = new Date().toISOString()
          
          // 创建工单处理结果记录
          if (attachments || processResult) {
            const resultId = `WR_${Date.now().toString().slice(-10)}_${Math.random().toString(36).substr(2, 5)}`
            const resultData = {
              id: resultId,
              workorder_id: workorderId,
              result_type: '现场处理',
              after_images: attachments || [],
              description: processResult || note || '处理完成',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            // 插入处理结果
            const { error: resultError } = await supabase
              .from('workorder_results')
              .insert(resultData)
            
            if (resultError) {
              console.error('创建处理结果记录失败:', resultError)
              // 不影响主流程，继续更新工单状态
            }
          }
        }
        break
        
      case 'approve': // 审核通过 - 根据工单来源决定下一状态
        if (['R001', 'R002', 'R006'].includes(roleId)) {
          // R006只能审核自己区域的工单
          if (roleId === 'R006' && areaId !== currentWorkorder.area_id) {
            return errorResponse('只能审核自己管理区域的工单', 403)
          }
          if (currentWorkorder.status !== 'pending_review') {
            return errorResponse('只能审核待审核状态的工单', 400)
          }
          hasPermission = true
          
          // 判断是人工工单还是AI工单
          // 人工工单：有creator_id且不是系统用户
          // AI工单：无creator_id或creator_id为系统用户
          const isManualWorkorder = currentWorkorder.creator_id && 
                                   currentWorkorder.creator_id !== 'SYSTEM' && 
                                   currentWorkorder.creator_id !== 'AI_SYSTEM'
          
          if (isManualWorkorder) {
            // 人工工单 → 待发起人确认
            newStatus = 'pending_reporter_confirm'
          } else {
            // AI工单 → 待最终审批
            newStatus = 'pending_final_review'
          }
          
          updateData.reviewer_id = userId
          updateData.reviewed_at = new Date().toISOString()
        }
        break
        
      case 'reject': // 审核拒绝(打回) - pending_review → processing
        if (['R001', 'R002', 'R006'].includes(roleId)) {
          // R006只能审核自己区域的工单
          if (roleId === 'R006' && areaId !== currentWorkorder.area_id) {
            return errorResponse('只能审核自己管理区域的工单', 403)
          }
          if (currentWorkorder.status !== 'pending_review') {
            return errorResponse('只能拒绝待审核状态的工单', 400)
          }
          hasPermission = true
          newStatus = 'processing' // 打回到处理中状态，要求返工
          updateData.completed_at = null // 清除完成时间
          updateData.reviewer_id = userId
          updateData.reviewed_at = new Date().toISOString()
        }
        break
        
      case 'reporter_confirm': // 发起人确认 - pending_reporter_confirm → completed
        if (currentWorkorder.creator_id === userId) {
          if (currentWorkorder.status !== 'pending_reporter_confirm') {
            return errorResponse('只能确认待发起人确认状态的工单', 400)
          }
          hasPermission = true
          newStatus = 'completed'
          updateData.confirmed_at = new Date().toISOString()
        }
        break
        
      case 'reporter_reject': // 发起人拒绝 - pending_reporter_confirm → processing
        if (currentWorkorder.creator_id === userId) {
          if (currentWorkorder.status !== 'pending_reporter_confirm') {
            return errorResponse('只能拒绝待发起人确认状态的工单', 400)
          }
          hasPermission = true
          newStatus = 'processing' // 打回要求返工
          updateData.completed_at = null
        }
        break
        
      case 'final_approve': // 最终审批通过 - pending_final_review → completed
        if (['R001', 'R002'].includes(roleId)) { // 只有系统管理员和监控中心主管可以最终审批
          if (currentWorkorder.status !== 'pending_final_review') {
            return errorResponse('只能审批待最终审批状态的工单', 400)
          }
          hasPermission = true
          newStatus = 'completed'
          updateData.final_reviewer_id = userId
          updateData.final_reviewed_at = new Date().toISOString()
        }
        break
        
      case 'final_reject': // 最终审批拒绝 - pending_final_review → processing
        if (['R001', 'R002'].includes(roleId)) {
          if (currentWorkorder.status !== 'pending_final_review') {
            return errorResponse('只能拒绝待最终审批状态的工单', 400)
          }
          hasPermission = true
          newStatus = 'processing' // 打回要求返工
          updateData.completed_at = null
          updateData.final_reviewer_id = userId
          updateData.final_reviewed_at = new Date().toISOString()
        }
        break
        
      case 'cancel': // 取消工单 - any → cancelled
        if (['R001', 'R002', 'R006'].includes(roleId)) {
          if (roleId === 'R006' && areaId !== currentWorkorder.area_id) {
            return errorResponse('只能取消自己管理区域的工单', 403)
          }
          hasPermission = true
          newStatus = 'cancelled'
        }
        break
        
      default:
        console.log('[app-workorders] 无效的操作:', action)
        return errorResponse(`无效的操作: ${action}`, 400)
    }
    
    if (!hasPermission) {
      return errorResponse('无权执行此操作', 403)
    }
    
    // 更新工单状态
    updateData.status = newStatus
    
    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update(updateData)
      .eq('id', workorderId)
      .select()
      .single()
      
    if (updateError) {
      console.error('Update workorder error:', updateError)
      return errorResponse('更新工单失败', 500)
    }
    
    // 记录状态变更历史
    const historyId = `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await supabase
      .from('workorder_status_history')
      .insert({
        id: historyId,
        workorder_id: workorderId,
        old_status: currentWorkorder.status,
        new_status: newStatus,
        changed_by: userId,
        change_reason: note || `执行操作: ${action}`,
        attachments: attachments,
        created_at: new Date().toISOString()
      })
    
    // 记录活动
    logApiActivity('app_workorder_update', userId, {
      workorder_id: workorderId,
      action,
      old_status: currentWorkorder.status,
      new_status: newStatus,
      role_id: roleId
    })
    
    return successResponse({
      workorder: updatedWorkorder,
      oldStatus: currentWorkorder.status,
      newStatus: newStatus,
      action: action
    }, '工单状态更新成功')
    
  } catch (error) {
    console.error('Update workorder error:', error)
    return errorResponse('更新工单失败', 500)
  }
}