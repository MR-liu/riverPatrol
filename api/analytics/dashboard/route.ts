/**
 * 数据统计分析 API
 * GET /api/analytics/dashboard - 获取仪表板统计数据
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

// GET - 获取仪表板统计数据
export async function GET(request: NextRequest) {
  try {
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
    
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('range') || '7d' // 7d, 30d, 90d
    const departmentId = searchParams.get('department')
    const areaId = searchParams.get('area')
    
    const supabase = createServiceClient()
    const now = new Date()
    
    // 计算时间范围
    let startDate: Date
    switch (timeRange) {
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
    }
    
    // 根据用户角色限制数据访问
    let dataFilter = {}
    if (decoded.roleCode === 'AREA_SUPERVISOR') {
      // 区域主管只能看到自己管辖区域的数据
      const { data: supervisorAreas } = await supabase
        .from('river_management_areas')
        .select('id')
        .eq('supervisor_id', decoded.userId)
      
      if (supervisorAreas && supervisorAreas.length > 0) {
        dataFilter = { area_ids: supervisorAreas.map(a => a.id) }
      } else {
        // 如果没有管辖区域，返回空数据
        dataFilter = { area_ids: [] }
      }
    } else if (decoded.roleCode === 'MAINTENANCE_WORKER') {
      // 维护作业员只能看到分配给自己的工单相关数据
      dataFilter = { worker_id: decoded.userId }
    }
    
    // 并行查询各种统计数据
    const [
      alarmStats,
      workorderStats,
      userStats,
      deviceStats,
      performanceStats,
      trendData,
      areaStats,
      riverStats,
      monthlyStats
    ] = await Promise.all([
      getAlarmStatistics(supabase, startDate, dataFilter),
      getWorkorderStatistics(supabase, startDate, dataFilter),
      getUserStatistics(supabase, startDate, dataFilter),
      getDeviceStatistics(supabase, dataFilter),
      getPerformanceStatistics(supabase, startDate, dataFilter),
      getTrendData(supabase, startDate, timeRange, dataFilter),
      getAreaStatistics(supabase, startDate, dataFilter),
      getRiverStatistics(supabase, startDate, dataFilter),
      getMonthlyComparison(supabase, dataFilter)
    ])
    
    return successResponse({
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      alarms: alarmStats,
      workorders: workorderStats,
      users: userStats,
      devices: deviceStats,
      performance: performanceStats,
      trends: trendData,
      areas: areaStats,
      rivers: riverStats,
      monthly: monthlyStats
    })
    
  } catch (error) {
    console.error('Get dashboard analytics error:', error)
    return errorResponse('获取统计数据失败', 500)
  }
}

// 告警统计
async function getAlarmStatistics(supabase: any, startDate: Date, filter: any) {
  let query = supabase
    .from('alarms')
    .select('id, status, level_id, source_type, created_at, point_id, alarm_levels(code)')
    .gte('created_at', startDate.toISOString())
  
  // 应用过滤条件
  if (filter.area_ids) {
    const { data: pointsInAreas } = await supabase
      .from('monitoring_points')
      .select('id')
      .in('area_id', filter.area_ids)
    
    if (pointsInAreas && pointsInAreas.length > 0) {
      query = query.in('point_id', pointsInAreas.map(p => p.id))
    } else {
      // 没有监控点，返回空结果
      return {
        total: 0,
        by_status: {},
        by_level: {},
        by_source: {},
        recent: []
      }
    }
  }
  
  const { data: alarms } = await query
  
  if (!alarms) return { total: 0, by_status: {}, by_level: {}, by_source: {}, recent: [] }
  
  const stats = {
    total: alarms.length,
    by_status: alarms.reduce((acc, alarm) => {
      acc[alarm.status] = (acc[alarm.status] || 0) + 1
      return acc
    }, {}),
    by_level: alarms.reduce((acc, alarm) => {
      const levelCode = alarm.alarm_levels?.code || alarm.level_id || 'unknown'
      acc[levelCode] = (acc[levelCode] || 0) + 1
      return acc
    }, {}),
    by_source: alarms.reduce((acc, alarm) => {
      acc[alarm.source_type] = (acc[alarm.source_type] || 0) + 1
      return acc
    }, {}),
    recent: alarms.slice(0, 10)
  }
  
  return stats
}

// 工单统计
async function getWorkorderStatistics(supabase: any, startDate: Date, filter: any) {
  let query = supabase
    .from('workorders')
    .select('id, status, priority, workorder_source, created_at, assignee_id, estimated_hours, actual_hours')
    .gte('created_at', startDate.toISOString())
  
  // 应用过滤条件
  if (filter.worker_id) {
    query = query.eq('assignee_id', filter.worker_id)
  } else if (filter.area_ids) {
    query = query.in('area_id', filter.area_ids)
  }
  
  const { data: workorders } = await query
  
  if (!workorders) return { 
    total: 0, 
    by_status: {}, 
    by_priority: {}, 
    completion_rate: 0,
    avg_completion_time: 0,
    efficiency_metrics: {}
  }
  
  const completedOrders = workorders.filter(w => w.status === 'completed')
  const totalHoursEstimated = workorders.reduce((sum, w) => sum + (w.estimated_hours || 0), 0)
  const totalHoursActual = completedOrders.reduce((sum, w) => sum + (w.actual_hours || 0), 0)
  
  const stats = {
    total: workorders.length,
    by_status: workorders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    }, {}),
    by_priority: workorders.reduce((acc, order) => {
      acc[order.priority] = (acc[order.priority] || 0) + 1
      return acc
    }, {}),
    completion_rate: workorders.length > 0 ? (completedOrders.length / workorders.length * 100) : 0,
    avg_completion_time: completedOrders.length > 0 ? totalHoursActual / completedOrders.length : 0,
    efficiency_metrics: {
      estimated_hours: totalHoursEstimated,
      actual_hours: totalHoursActual,
      efficiency_ratio: totalHoursEstimated > 0 ? (totalHoursEstimated / totalHoursActual) : 0
    }
  }
  
  return stats
}

// 用户统计
async function getUserStatistics(supabase: any, startDate: Date, filter: any) {
  const { data: users } = await supabase
    .from('users')
    .select('id, status, role_id, last_login_at, created_at, roles(code)')
    .gte('created_at', startDate.toISOString())
  
  if (!users) return { total: 0, active: 0, by_role: {}, recent_logins: 0 }
  
  const recentLogins = users.filter(u => 
    u.last_login_at && new Date(u.last_login_at) >= startDate
  ).length
  
  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    by_role: users.reduce((acc, user) => {
      const roleCode = user.roles?.code || 'UNKNOWN'
      acc[roleCode] = (acc[roleCode] || 0) + 1
      return acc
    }, {}),
    recent_logins: recentLogins
  }
  
  return stats
}

// 设备统计
async function getDeviceStatistics(supabase: any, filter: any) {
  let query = supabase
    .from('devices')
    .select('id, status, type_id, last_heartbeat, point_id')
  
  // 应用过滤条件
  if (filter.area_ids) {
    const { data: pointsInAreas } = await supabase
      .from('monitoring_points')
      .select('id')
      .in('area_id', filter.area_ids)
    
    if (pointsInAreas && pointsInAreas.length > 0) {
      query = query.in('point_id', pointsInAreas.map(p => p.id))
    }
  }
  
  const { data: devices } = await query
  
  if (!devices) return { total: 0, online: 0, offline: 0, by_type: {}, health_rate: 0 }
  
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  
  const onlineDevices = devices.filter(d => 
    d.last_heartbeat && new Date(d.last_heartbeat) >= fiveMinutesAgo
  )
  
  const stats = {
    total: devices.length,
    online: onlineDevices.length,
    offline: devices.length - onlineDevices.length,
    by_type: devices.reduce((acc, device) => {
      acc[device.type_id] = (acc[device.type_id] || 0) + 1
      return acc
    }, {}),
    health_rate: devices.length > 0 ? (onlineDevices.length / devices.length * 100) : 0
  }
  
  return stats
}

// 性能统计
async function getPerformanceStatistics(supabase: any, startDate: Date, filter: any) {
  // 告警响应时间统计
  let alarmQuery = supabase
    .from('alarms')
    .select('created_at, confirmed_at, resolved_at')
    .gte('created_at', startDate.toISOString())
    .not('confirmed_at', 'is', null)
  
  const { data: alarms } = await alarmQuery
  
  const responseTimeStats = alarms?.map(alarm => {
    const created = new Date(alarm.created_at)
    const confirmed = new Date(alarm.confirmed_at)
    return (confirmed.getTime() - created.getTime()) / (1000 * 60) // 分钟
  }) || []
  
  const avgResponseTime = responseTimeStats.length > 0 
    ? responseTimeStats.reduce((sum, time) => sum + time, 0) / responseTimeStats.length
    : 0
  
  return {
    alarm_response_time: {
      average: avgResponseTime,
      median: responseTimeStats.length > 0 ? responseTimeStats.sort()[Math.floor(responseTimeStats.length / 2)] : 0
    },
    system_health: {
      uptime: 99.5, // 这里可以从系统监控获取真实数据
      api_response_time: 120, // ms
      error_rate: 0.1 // %
    }
  }
}

// 趋势数据
async function getTrendData(supabase: any, startDate: Date, timeRange: string, filter: any) {
  const days = timeRange === '90d' ? 90 : timeRange === '30d' ? 30 : 7
  const intervals = Math.min(days, 30) // 最多30个数据点
  const intervalMs = Math.floor((new Date().getTime() - startDate.getTime()) / intervals)
  
  const trendData = []
  
  for (let i = 0; i < intervals; i++) {
    const periodStart = new Date(startDate.getTime() + i * intervalMs)
    const periodEnd = new Date(startDate.getTime() + (i + 1) * intervalMs)
    
    // 查询这个时间段的告警数
    let alarmQuery = supabase
      .from('alarms')
      .select('id', { count: 'exact' })
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
    
    // 查询这个时间段的工单数
    let workorderQuery = supabase
      .from('workorders')
      .select('id', { count: 'exact' })
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
    
    const [alarmResult, workorderResult] = await Promise.all([alarmQuery, workorderQuery])
    
    trendData.push({
      date: periodStart.toISOString().split('T')[0],
      alarms: alarmResult.count || 0,
      workorders: workorderResult.count || 0
    })
  }
  
  return trendData
}

// 区域统计
async function getAreaStatistics(supabase: any, startDate: Date, filter: any) {
  // 获取所有区域
  const { data: areas } = await supabase
    .from('river_management_areas')
    .select('id, name, code')
  
  if (!areas) return []
  
  const areaStats = []
  
  for (const area of areas) {
    // 统计每个区域的告警和工单
    const { data: alarms } = await supabase
      .from('alarms')
      .select('id')
      .eq('area_id', area.id)
      .gte('created_at', startDate.toISOString())
    
    const { data: workorders } = await supabase
      .from('workorders')
      .select('id, status')
      .eq('area_id', area.id)
      .gte('created_at', startDate.toISOString())
    
    const completedWorkorders = workorders?.filter(w => w.status === 'completed') || []
    
    areaStats.push({
      id: area.id,
      name: area.name,
      code: area.code,
      alarms: alarms?.length || 0,
      workorders: workorders?.length || 0,
      completed: completedWorkorders.length,
      completion_rate: workorders?.length > 0 
        ? (completedWorkorders.length / workorders.length * 100).toFixed(1)
        : 0
    })
  }
  
  return areaStats
}

// 河道统计
async function getRiverStatistics(supabase: any, startDate: Date, filter: any) {
  // 获取所有河道
  const { data: rivers } = await supabase
    .from('rivers')
    .select('id, name, code, area_id')
  
  if (!rivers) return []
  
  const riverStats = []
  
  for (const river of rivers) {
    // 获取河道的监控点
    const { data: points } = await supabase
      .from('monitoring_points')
      .select('id')
      .eq('river_id', river.id)
    
    const pointIds = points?.map(p => p.id) || []
    
    // 统计告警
    let alarmCount = 0
    if (pointIds.length > 0) {
      const { data: alarms } = await supabase
        .from('alarms')
        .select('id')
        .in('point_id', pointIds)
        .gte('created_at', startDate.toISOString())
      
      alarmCount = alarms?.length || 0
    }
    
    // 统计工单
    const { data: workorders } = await supabase
      .from('workorders')
      .select('id')
      .eq('river_id', river.id)
      .gte('created_at', startDate.toISOString())
    
    riverStats.push({
      id: river.id,
      name: river.name,
      code: river.code,
      area_id: river.area_id,
      monitoring_points: pointIds.length,
      alarms: alarmCount,
      workorders: workorders?.length || 0
    })
  }
  
  // 按告警数排序
  return riverStats.sort((a, b) => b.alarms - a.alarms)
}

// 月度对比统计
async function getMonthlyComparison(supabase: any, filter: any) {
  const months = []
  const now = new Date()
  
  // 获取过去6个月的数据
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    
    // 统计当月告警
    const { data: alarms } = await supabase
      .from('alarms')
      .select('id')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
    
    // 统计当月工单
    const { data: workorders } = await supabase
      .from('workorders')
      .select('id, status')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
    
    const completedWorkorders = workorders?.filter(w => w.status === 'completed') || []
    
    months.push({
      month: monthStart.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' }),
      alarms: alarms?.length || 0,
      workorders: workorders?.length || 0,
      completed: completedWorkorders.length,
      completion_rate: workorders?.length > 0
        ? Math.round((completedWorkorders.length / workorders.length) * 100)
        : 0
    })
  }
  
  return months
}