/**
 * 单个工单状态历史API
 * GET /api/app-workorder-history/[workorder_id] - 获取特定工单的详细状态历史
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
 * 获取特定工单的详细状态历史
 * GET /api/app-workorder-history/[workorder_id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workorder_id: string } }
) {
  try {
    const workorderId = params.workorder_id
    
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
    
    const supabase = createServiceClient()
    
    // 首先验证用户是否有权限查看此工单
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types!inner(id, name, category),
        creator:users!workorders_creator_id_fkey(id, name, username),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        initial_reporter:users!workorders_initial_reporter_id_fkey(id, name, username),
        area:river_management_areas(id, name, code, supervisor_id)
      `)
      .eq('id', workorderId)
      .single()

    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    // 权限检查
    const hasPermission = (() => {
      switch (roleId) {
        case 'R001': // 系统管理员
        case 'R002': // 监控中心主管
        case 'R005': // 领导看板用户
          return true

        case 'R003': // 河道维护员
          return workorder.assignee_id === userId

        case 'R004': // 河道巡检员
          return workorder.initial_reporter_id === userId || workorder.creator_id === userId

        case 'R006': // 区域管理员
          return workorder.area?.supervisor_id === userId

        default:
          return false
      }
    })()

    if (!hasPermission) {
      return errorResponse('无权限查看此工单', 403)
    }

    // 获取工单状态变更历史
    const { data: statusHistory, error: historyError } = await supabase
      .from('workorder_status_history')
      .select(`
        *,
        user:users!workorder_status_history_changed_by_fkey(id, name, username, role_id),
        role:users!workorder_status_history_changed_by_fkey(
          role:roles!users_role_id_fkey(name, code)
        )
      `)
      .eq('workorder_id', workorderId)
      .order('created_at', { ascending: true })

    if (historyError) {
      console.error('查询状态历史失败:', historyError)
      return errorResponse('查询历史失败', 500)
    }

    // 获取工单处理结果
    const { data: results } = await supabase
      .from('workorder_results')
      .select(`
        *,
        processor:users!workorder_results_processor_id_fkey(id, name, username)
      `)
      .eq('workorder_id', workorderId)
      .order('submitted_at', { ascending: true })

    // 获取审核记录
    const { data: reviews } = await supabase
      .from('workorder_reviews')
      .select(`
        *,
        reviewer:users!workorder_reviews_reviewer_id_fkey(id, name, username)
      `)
      .eq('workorder_id', workorderId)
      .order('review_started_at', { ascending: true })

    // 获取确认记录（如果是人工工单）
    let confirmations = null
    if (workorder.workorder_source === 'manual') {
      const { data: confirmData } = await supabase
        .from('workorder_reporter_confirmations')
        .select(`
          *,
          reporter:users!workorder_reporter_confirmations_reporter_id_fkey(id, name, username),
          intervener:users!workorder_reporter_confirmations_intervener_id_fkey(id, name, username)
        `)
        .eq('workorder_id', workorderId)
        .order('confirm_time', { ascending: true })
      
      confirmations = confirmData
    }

    // 构建时间线数据
    const timeline = []

    // 添加创建事件
    timeline.push({
      type: 'created',
      timestamp: workorder.created_at,
      user: workorder.creator,
      description: '工单创建',
      details: {
        title: workorder.title,
        priority: workorder.priority,
        source: workorder.workorder_source
      }
    })

    // 添加状态变更事件
    statusHistory?.forEach(history => {
      timeline.push({
        type: 'status_change',
        timestamp: history.created_at,
        user: history.user,
        role: history.role?.role,
        description: `状态变更: ${history.old_status} → ${history.new_status}`,
        details: {
          old_status: history.old_status,
          new_status: history.new_status,
          reason: history.change_reason,
          note: history.change_note
        }
      })
    })

    // 添加处理结果事件
    results?.forEach(result => {
      timeline.push({
        type: 'result_submitted',
        timestamp: result.submitted_at,
        user: result.processor,
        description: '提交处理结果',
        details: {
          method: result.process_method,
          result: result.process_result,
          need_followup: result.need_followup,
          before_photos_count: result.before_photos ? JSON.parse(result.before_photos).length : 0,
          after_photos_count: result.after_photos ? JSON.parse(result.after_photos).length : 0
        }
      })
    })

    // 添加审核事件
    reviews?.forEach(review => {
      timeline.push({
        type: 'reviewed',
        timestamp: review.review_completed_at || review.review_started_at,
        user: review.reviewer,
        description: `${review.review_level} - ${review.review_action}`,
        details: {
          level: review.review_level,
          action: review.review_action,
          note: review.review_note,
          quality_rating: review.quality_rating
        }
      })
    })

    // 添加确认事件（人工工单）
    confirmations?.forEach(confirmation => {
      timeline.push({
        type: 'confirmed',
        timestamp: confirmation.confirm_time,
        user: confirmation.is_timeout_intervention ? confirmation.intervener : confirmation.reporter,
        description: confirmation.is_timeout_intervention 
          ? `超时介入确认: ${confirmation.confirm_action}`
          : `发起人确认: ${confirmation.confirm_action}`,
        details: {
          action: confirmation.confirm_action,
          note: confirmation.confirm_note,
          is_timeout_intervention: confirmation.is_timeout_intervention,
          site_photos_count: confirmation.site_photos ? JSON.parse(confirmation.site_photos).length : 0
        }
      })
    })

    // 按时间排序时间线
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // 计算工单处理时间统计
    const timeStats = {
      total_duration: null as number | null,
      time_to_dispatch: null as number | null,
      processing_time: null as number | null,
      review_time: null as number | null
    }

    if (workorder.status === 'completed' && workorder.completed_at) {
      timeStats.total_duration = Math.floor(
        (new Date(workorder.completed_at).getTime() - new Date(workorder.created_at).getTime()) / (1000 * 60 * 60)
      )
    }

    // 计算分派时间
    const dispatchEvent = timeline.find(e => 
      e.type === 'status_change' && 
      e.details?.new_status === 'dispatched'
    )
    if (dispatchEvent) {
      timeStats.time_to_dispatch = Math.floor(
        (new Date(dispatchEvent.timestamp).getTime() - new Date(workorder.created_at).getTime()) / (1000 * 60 * 60)
      )
    }

    // 记录API活动日志
    await logApiActivity('GET', `app-workorder-history/${workorderId}`, userId)

    return successResponse({
      workorder: {
        ...workorder,
        current_status_display: getStatusDisplay(workorder.status)
      },
      timeline,
      time_statistics: timeStats,
      summary: {
        total_events: timeline.length,
        status_changes: statusHistory?.length || 0,
        results_submitted: results?.length || 0,
        reviews_completed: reviews?.length || 0,
        confirmations: confirmations?.length || 0
      }
    }, '获取工单状态历史成功')

  } catch (error) {
    console.error('[app-workorder-history/workorder_id] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取状态的中文显示名称
 */
function getStatusDisplay(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': '待处理',
    'pending_dispatch': '待分派',
    'dispatched': '已分派',
    'processing': '处理中',
    'pending_review': '待审核',
    'pending_final_review': '待最终审核',
    'pending_reporter_confirm': '待发起人确认',
    'confirmed_failed': '确认失败',
    'completed': '已完成',
    'cancelled': '已取消',
    'rejected': '已拒绝'
  }
  
  return statusMap[status] || status
}