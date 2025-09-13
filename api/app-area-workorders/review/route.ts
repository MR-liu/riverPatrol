/**
 * 区域工单审核API (R006专用)
 * POST /api/app-area-workorders/review
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
 * 区域主管审核工单
 * POST /api/app-area-workorders/review
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
    
    // 只有R006区域管理员可以审核
    if (roleId !== 'R006') {
      return errorResponse('无权限执行此操作', 403)
    }

    // 解析请求体
    const body = await request.json()
    const {
      workorder_id,
      action, // 'approve' | 'reject' | 'return'
      review_note = '',
      quality_rating = null, // 1-5分
      required_improvements = [] // 需要改进的地方
    } = body

    if (!workorder_id || !action) {
      return errorResponse('参数不完整', 400)
    }

    if (!['approve', 'reject', 'return'].includes(action)) {
      return errorResponse('审核动作参数错误', 400)
    }

    const supabase = createServiceClient()
    
    // 1. 验证工单是否在管理范围内
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        area:river_management_areas!inner(id, name, supervisor_id),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        results:workorder_results(
          id,
          process_method,
          process_result,
          before_photos,
          after_photos,
          need_followup,
          submitted_at
        )
      `)
      .eq('id', workorder_id)
      .single()

    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    if (workorder.area?.supervisor_id !== userId) {
      return errorResponse('无权限审核此工单', 403)
    }

    if (workorder.status !== 'pending_review') {
      return errorResponse(`工单状态为${workorder.status}，无法审核`, 400)
    }

    // 2. 根据不同动作更新工单状态
    let newStatus: string
    let updateData: any = {
      area_reviewer_id: userId,
      area_reviewed_at: new Date().toISOString(),
      area_review_note: review_note,
      updated_at: new Date().toISOString()
    }

    switch (action) {
      case 'approve':
        // 区域审核通过，根据工单来源决定下一步
        if (workorder.workorder_source === 'manual') {
          // 人工工单 -> 待发起人确认
          newStatus = 'pending_reporter_confirm'
        } else {
          // AI工单 -> 待最终审核(R002)
          newStatus = 'pending_final_review'
        }
        break

      case 'reject':
        // 审核拒绝，退回给处理人重新处理
        newStatus = 'dispatched'
        // 减少处理人的工作负载
        if (workorder.assignee_id) {
          await supabase
            .from('maintenance_teams')
            .update({
              current_workload: Math.max(0, (workorder.assignee?.current_workload || 1) - 1)
            })
            .eq('worker_id', workorder.assignee_id)
        }
        break

      case 'return':
        // 打回重新分配
        newStatus = 'pending_dispatch'
        updateData.assignee_id = null
        updateData.dispatched_at = null
        // 减少原处理人的工作负载
        if (workorder.assignee_id) {
          await supabase
            .from('maintenance_teams')
            .update({
              current_workload: Math.max(0, (workorder.assignee?.current_workload || 1) - 1)
            })
            .eq('worker_id', workorder.assignee_id)
        }
        break
    }

    updateData.status = newStatus

    // 3. 更新工单
    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update(updateData)
      .eq('id', workorder_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('更新工单失败:', updateError)
      return errorResponse('审核失败', 500)
    }

    // 4. 记录审核详情
    await supabase
      .from('workorder_reviews')
      .insert({
        id: `WR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorder_id,
        reviewer_id: userId,
        review_level: 'area_review',
        review_action: action,
        review_note: review_note,
        quality_rating: quality_rating,
        issues_found: JSON.stringify(required_improvements),
        review_started_at: new Date().toISOString(),
        review_completed_at: new Date().toISOString()
      })

    // 5. 记录状态变更历史
    await supabase
      .from('workorder_status_history')
      .insert({
        id: `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorder_id,
        old_status: 'pending_review',
        new_status: newStatus,
        changed_by: userId,
        change_reason: `区域主管审核: ${action}`,
        change_note: review_note,
        created_at: new Date().toISOString()
      })

    // 6. 如果审核通过且有质量评分，创建质量评估记录
    if (action === 'approve' && quality_rating) {
      await supabase
        .from('workorder_quality_assessments')
        .insert({
          id: `WQA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workorder_id: workorder_id,
          supervisor_rating: quality_rating,
          supervisor_feedback: review_note,
          assessed_at: new Date().toISOString(),
          assessed_by: userId
        })
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-area-workorders/review', userId, {
      workorder_id,
      action,
      quality_rating
    })

    const actionMessages = {
      'approve': '审核通过',
      'reject': '审核拒绝，已退回处理人',
      'return': '已打回重新分配'
    }

    return successResponse({
      workorder: updatedWorkorder,
      review_action: action,
      review_time: new Date().toISOString(),
      next_status: newStatus,
      quality_rating: quality_rating
    }, actionMessages[action as keyof typeof actionMessages])

  } catch (error) {
    console.error('[app-area-workorders/review] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}