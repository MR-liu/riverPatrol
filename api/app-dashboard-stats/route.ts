/**
 * 移动端仪表板统计 API
 * GET /api/app-dashboard-stats
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: NextRequest) {
  try {
    // 获取并验证 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    // 也支持从 Authorization header 获取 token（用于移动端）
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证 token
    let decoded: any
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const supabase = createServiceClient()

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7')

    // 计算日期范围
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 1. 获取工单统计
    const { data: workorders, error: woError } = await supabase
      .from('workorders')
      .select('id, status, created_at, completed_at, assignee_id, priority')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (woError) {
      console.error('获取工单数据失败:', woError)
      return errorResponse('获取工单数据失败', 500)
    }

    // 2. 获取用户相关工单（如果需要）
    const userWorkorders = workorders?.filter(wo => wo.assignee_id === userId) || []

    // 3. 计算统计数据
    const stats = {
      overview: {
        total_workorders: workorders?.length || 0,
        pending_count: workorders?.filter(wo => wo.status === 'pending').length || 0,
        processing_count: workorders?.filter(wo => wo.status === 'processing').length || 0,
        completed_count: workorders?.filter(wo => wo.status === 'completed').length || 0,
        completion_rate: workorders?.length > 0 
          ? Math.round((workorders.filter(wo => wo.status === 'completed').length / workorders.length) * 100)
          : 0
      },
      today_stats: {
        new_workorders: workorders?.filter(wo => {
          const createdAt = new Date(wo.created_at)
          const today = new Date()
          return createdAt.toDateString() === today.toDateString()
        }).length || 0,
        completed_workorders: workorders?.filter(wo => {
          if (!wo.completed_at) return false
          const completedAt = new Date(wo.completed_at)
          const today = new Date()
          return completedAt.toDateString() === today.toDateString()
        }).length || 0
      },
      user_workload: {
        assigned_count: userWorkorders.filter(wo => wo.status === 'assigned').length,
        processing_count: userWorkorders.filter(wo => wo.status === 'processing').length,
        today_completed: userWorkorders.filter(wo => {
          if (!wo.completed_at) return false
          const completedAt = new Date(wo.completed_at)
          const today = new Date()
          return completedAt.toDateString() === today.toDateString()
        }).length
      },
      performance_metrics: {
        // 计算准时率：已完成工单中按时完成的比例
        on_time_rate: (() => {
          const completedWorkorders = workorders?.filter(wo => wo.status === 'completed') || [];
          if (completedWorkorders.length === 0) return 100; // 没有完成的工单时默认100%
          
          // 计算按时完成的工单数（在expected_complete_at之前完成的）
          const onTimeCount = completedWorkorders.filter(wo => {
            if (!wo.completed_at || !wo.expected_complete_at) return false;
            return new Date(wo.completed_at) <= new Date(wo.expected_complete_at);
          }).length;
          
          return Math.round((onTimeCount / completedWorkorders.length) * 100);
        })(),
        // 计算平均完成时间（小时）
        avg_completion_time: (() => {
          const completedWorkorders = workorders?.filter(wo => 
            wo.status === 'completed' && wo.completed_at && wo.created_at
          ) || [];
          
          if (completedWorkorders.length === 0) return 0;
          
          const totalHours = completedWorkorders.reduce((sum, wo) => {
            const created = new Date(wo.created_at);
            const completed = new Date(wo.completed_at);
            const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0);
          
          return Math.round((totalHours / completedWorkorders.length) * 10) / 10; // 保留1位小数
        })(),
        urgent_workorders: workorders?.filter(wo => wo.priority === 'urgent').length || 0
      },
      trend_data: {
        // 最近7天的趋势数据
        dates: [],
        new_counts: [],
        completed_counts: []
      }
    }

    // 4. 计算趋势数据
    const trendDates = []
    const newCounts = []
    const completedCounts = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      trendDates.push(dateStr)
      newCounts.push(
        workorders?.filter(wo => 
          wo.created_at.startsWith(dateStr)
        ).length || 0
      )
      completedCounts.push(
        workorders?.filter(wo => 
          wo.completed_at && wo.completed_at.startsWith(dateStr)
        ).length || 0
      )
    }
    
    stats.trend_data = {
      dates: trendDates,
      new_counts: newCounts,
      completed_counts: completedCounts
    }

    // 5. 获取告警统计（如果需要）
    const { data: alarms, error: alarmError } = await supabase
      .from('alarms')
      .select('id, status, level')
      .eq('status', 'pending')

    if (!alarmError && alarms) {
      stats.overview['pending_alarms'] = alarms.length
      stats.overview['critical_alarms'] = alarms.filter(a => a.level === 'critical').length
    }

    return successResponse(stats, '获取统计数据成功')

  } catch (error) {
    console.error('Dashboard stats error:', error)
    return errorResponse('获取统计数据失败', 500)
  }
}