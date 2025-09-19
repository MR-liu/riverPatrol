import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

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
      return errorResponse('无效的认证令牌', 401)
    }

    const supabase = createServiceClient()
    
    // 获取当前日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // 1. 今日告警统计
    const { data: todayAlarms, error: todayAlarmsError } = await supabase
      .from('alarms')
      .select('id')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())

    const { data: yesterdayAlarms, error: yesterdayAlarmsError } = await supabase
      .from('alarms')
      .select('id')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    const todayAlarmCount = todayAlarms?.length || 0
    const yesterdayAlarmCount = yesterdayAlarms?.length || 0
    const alarmChange = yesterdayAlarmCount > 0 
      ? ((todayAlarmCount - yesterdayAlarmCount) / yesterdayAlarmCount * 100).toFixed(1)
      : '0'

    // 2. 处理中工单统计
    const { data: processingWorkorders, error: processingError } = await supabase
      .from('workorders')
      .select('id')
      .in('status', ['processing', 'pending_review', 'reviewing'])

    const { data: yesterdayProcessing, error: yesterdayProcessingError } = await supabase
      .from('workorder_status_history')
      .select('workorder_id')
      .in('to_status', ['processing', 'pending_review', 'reviewing'])
      .lt('created_at', today.toISOString())

    const processingCount = processingWorkorders?.length || 0
    const yesterdayProcessingCount = yesterdayProcessing?.length || 0
    const processingChange = yesterdayProcessingCount > 0
      ? ((processingCount - yesterdayProcessingCount) / yesterdayProcessingCount * 100).toFixed(1)
      : '0'

    // 3. 设备状态统计
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('status')

    const totalDevices = devices?.length || 0
    const onlineDevices = devices?.filter(d => d.status === 'online').length || 0
    const deviceOnlineRate = totalDevices > 0 
      ? (onlineDevices / totalDevices * 100).toFixed(1)
      : '0'

    // 4. 活跃用户统计（最近30分钟内有活动）
    const thirtyMinutesAgo = new Date()
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)

    const { data: activeSessions, error: sessionsError } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('last_activity', thirtyMinutesAgo.toISOString())
      .eq('is_active', true)

    const activeUsers = activeSessions?.length || 0

    // 5. 最新告警列表
    const { data: recentAlarms, error: recentAlarmsError } = await supabase
      .from('alarms')
      .select(`
        id,
        type_id,
        alarm_type:alarm_types(name),
        location,
        severity,
        status,
        created_at,
        point:monitoring_points(name),
        river:rivers(name)
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    // 6. 系统状态（这部分可能需要其他监控服务提供）
    const systemStatus = [
      { name: "AI算法服务", status: "online", cpu: 45, memory: 62 },
      { name: "视频流服务", status: "online", cpu: 38, memory: 55 },
      { name: "数据库服务", status: "online", cpu: 28, memory: 45 },
      { name: "消息推送服务", status: "online", cpu: 22, memory: 40 }
    ]

    // 格式化返回数据
    const stats = [
      {
        title: "今日告警",
        value: todayAlarmCount.toString(),
        change: `${Number(alarmChange) >= 0 ? '+' : ''}${alarmChange}%`,
        trend: Number(alarmChange) >= 0 ? "up" : "down",
        description: Number(alarmChange) >= 0 ? "较昨日增加" : "较昨日减少"
      },
      {
        title: "处理中工单",
        value: processingCount.toString(),
        change: `${Number(processingChange) >= 0 ? '+' : ''}${processingChange}%`,
        trend: Number(processingChange) >= 0 ? "up" : "down",
        description: Number(processingChange) >= 0 ? "较昨日增加" : "较昨日减少"
      },
      {
        title: "在线设备",
        value: onlineDevices.toString(),
        unit: `/${totalDevices}`,
        percentage: Number(deviceOnlineRate),
        description: "设备在线率"
      },
      {
        title: "活跃用户",
        value: activeUsers.toString(),
        change: "+0%", // 需要历史数据对比
        trend: "up",
        description: "当前在线"
      }
    ]

    // 格式化告警数据
    const formattedAlarms = recentAlarms?.map(alarm => {
      // 计算时间差
      const createdAt = new Date(alarm.created_at)
      const now = new Date()
      const diffMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000)
      
      let timeAgo = ''
      if (diffMinutes < 1) {
        timeAgo = '刚刚'
      } else if (diffMinutes < 60) {
        timeAgo = `${diffMinutes}分钟前`
      } else if (diffMinutes < 1440) {
        timeAgo = `${Math.floor(diffMinutes / 60)}小时前`
      } else {
        timeAgo = `${Math.floor(diffMinutes / 1440)}天前`
      }

      // 映射告警级别
      const levelMap: Record<string, string> = {
        'critical': '紧急',
        'high': '重要',
        'medium': '一般',
        'low': '低'
      }

      // 映射告警状态
      const statusMap: Record<string, string> = {
        'pending': '待处理',
        'confirmed': '已确认',
        'processing': '处理中',
        'resolved': '已处理',
        'false_alarm': '误报',
        'ignored': '已忽略'
      }

      return {
        id: alarm.id,
        type: alarm.alarm_type?.name || '未知类型',
        location: alarm.location || `${alarm.river?.name || ''} ${alarm.point?.name || ''}`.trim() || '未知位置',
        time: timeAgo,
        level: levelMap[alarm.severity] || '一般',
        status: statusMap[alarm.status] || '待处理',
        rawStatus: alarm.status
      }
    }) || []

    return successResponse({
      stats,
      recentAlarms: formattedAlarms,
      systemStatus
    })
    
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return errorResponse(
      error instanceof Error ? error.message : '获取统计数据失败',
      500
    )
  }
}