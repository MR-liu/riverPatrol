/**
 * 工单状态历史查询API
 * GET /api/app-workorder-history/[workorder_id] - 获取特定工单的状态历史
 * GET /api/app-workorder-history - 获取用户相关的工单历史统计
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
 * 获取工单历史统计
 * GET /api/app-workorder-history
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
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30') // 默认30天
    const includeStats = searchParams.get('include_stats') !== 'false' // 默认包含统计
    
    const supabase = createServiceClient()
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    
    // 根据角色构建工单查询条件
    let workorderQuery = supabase
      .from('workorders')
      .select(`
        id,
        title,
        status,
        priority,
        workorder_source,
        created_at,
        completed_at,
        area_id,
        creator_id,
        assignee_id,
        initial_reporter_id
      `)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })

    // 基于角色的数据权限过滤
    switch (roleId) {
      case 'R001': // 系统管理员
      case 'R002': // 监控中心主管
      case 'R005': // 领导看板用户
        // 可以查看所有工单
        break

      case 'R003': // 河道维护员
        // 只能看分配给自己的工单
        workorderQuery = workorderQuery.eq('assignee_id', userId)
        break

      case 'R004': // 河道巡检员
        // 可以看自己创建的工单
        workorderQuery = workorderQuery.eq('initial_reporter_id', userId)
        break

      case 'R006': // 区域管理员
        // 查看管理区域内的工单
        const { data: areas } = await supabase
          .from('river_management_areas')
          .select('id')
          .eq('supervisor_id', userId)
          .eq('is_active', true)
        
        if (areas && areas.length > 0) {
          const areaIds = areas.map(a => a.id)
          workorderQuery = workorderQuery.in('area_id', areaIds)
        } else {
          // 如果没有管理区域，返回空结果
          return successResponse({
            workorders: [],
            statistics: { total: 0 },
            time_range: { days, start_date: startDate }
          }, '暂无管理区域数据')
        }
        break

      default:
        return errorResponse('角色权限不足', 403)
    }

    // 获取工单列表
    const { data: workorders, error: workorderError } = await workorderQuery
    
    if (workorderError) {
      console.error('查询工单历史失败:', workorderError)
      return errorResponse('查询失败', 500)
    }

    let statistics: any = {}
    
    if (includeStats && workorders) {
      // 计算统计数据
      const workorderIds = workorders.map(w => w.id)
      
      // 获取这些工单的状态变更历史
      const { data: statusHistory } = await supabase
        .from('workorder_status_history')
        .select(`
          *,
          user:users!workorder_status_history_changed_by_fkey(name, username)
        `)
        .in('workorder_id', workorderIds)
        .order('created_at', { ascending: false })
      
      // 基础统计
      statistics = {
        total_workorders: workorders.length,
        by_status: {
          pending: workorders.filter(w => w.status === 'pending').length,
          pending_dispatch: workorders.filter(w => w.status === 'pending_dispatch').length,
          dispatched: workorders.filter(w => w.status === 'dispatched').length,
          processing: workorders.filter(w => w.status === 'processing').length,
          pending_review: workorders.filter(w => w.status === 'pending_review').length,
          pending_final_review: workorders.filter(w => w.status === 'pending_final_review').length,
          pending_reporter_confirm: workorders.filter(w => w.status === 'pending_reporter_confirm').length,
          completed: workorders.filter(w => w.status === 'completed').length,
          cancelled: workorders.filter(w => w.status === 'cancelled').length
        },
        by_priority: {
          urgent: workorders.filter(w => w.priority === 'urgent').length,
          important: workorders.filter(w => w.priority === 'important').length,
          normal: workorders.filter(w => w.priority === 'normal').length
        },
        by_source: {
          ai: workorders.filter(w => w.workorder_source === 'ai').length,
          manual: workorders.filter(w => w.workorder_source === 'manual').length
        },
        completion_rate: workorders.length > 0 
          ? Math.round((workorders.filter(w => w.status === 'completed').length / workorders.length) * 100)
          : 0
      }

      // 计算平均处理时间（已完成的工单）
      const completedWorkorders = workorders.filter(w => w.status === 'completed' && w.completed_at)
      if (completedWorkorders.length > 0) {
        const totalProcessingTime = completedWorkorders.reduce((sum, w) => {
          const processingTime = new Date(w.completed_at!).getTime() - new Date(w.created_at).getTime()
          return sum + processingTime
        }, 0)
        
        statistics.avg_processing_hours = Math.round((totalProcessingTime / completedWorkorders.length) / (1000 * 60 * 60))
      }

      // 最近活动统计
      if (statusHistory && statusHistory.length > 0) {
        const recentActivities = statusHistory.slice(0, 10)
        statistics.recent_activities = recentActivities.map(activity => ({
          workorder_id: activity.workorder_id,
          old_status: activity.old_status,
          new_status: activity.new_status,
          changed_by: activity.user?.name || '系统',
          change_reason: activity.change_reason,
          created_at: activity.created_at
        }))
      }

      // 状态流转分析
      const statusTransitions: { [key: string]: number } = {}
      statusHistory?.forEach(h => {
        const transition = `${h.old_status} → ${h.new_status}`
        statusTransitions[transition] = (statusTransitions[transition] || 0) + 1
      })
      
      statistics.common_transitions = Object.entries(statusTransitions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([transition, count]) => ({ transition, count }))
    }

    // 记录API活动日志
    await logApiActivity('GET', 'app-workorder-history', userId, { 
      days, 
      workorder_count: workorders?.length || 0 
    })

    return successResponse({
      workorders: workorders || [],
      statistics,
      time_range: {
        days,
        start_date: startDate,
        end_date: new Date().toISOString()
      },
      user_context: {
        role_id: roleId,
        can_view_all: ['R001', 'R002', 'R005'].includes(roleId)
      }
    }, `获取 ${days} 天内工单历史成功`)

  } catch (error) {
    console.error('[app-workorder-history] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}