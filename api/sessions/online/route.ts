/**
 * 获取在线会话 API
 * GET /api/sessions/online
 * 获取当前在线的用户会话列表
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
    const requestType = searchParams.get('type')
    
    // 如果是请求工作时长，所有登录用户都可以访问
    if (requestType === 'worktime') {
      const supabase = createServiceClient()
      
      // 获取今日的开始时间
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()
      
      // 获取用户今日的所有会话
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('created_at, last_activity')
        .eq('user_id', decoded.userId)
        .gte('created_at', todayStr)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('获取会话失败:', error)
        return successResponse({ todayWorkTime: 0 })
      }
      
      // 计算总工作时长（分钟）
      let totalMinutes = 0
      if (sessions && sessions.length > 0) {
        sessions.forEach(session => {
          const start = new Date(session.created_at).getTime()
          const end = session.last_activity ? new Date(session.last_activity).getTime() : Date.now()
          const minutes = Math.floor((end - start) / 1000 / 60)
          totalMinutes += minutes
        })
      }
      
      // 如果没有会话记录，创建一个新的
      if (!sessions || sessions.length === 0) {
        await supabase
          .from('user_sessions')
          .insert({
            user_id: decoded.userId,
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '0.0.0.0',
            user_agent: request.headers.get('user-agent') || 'Unknown',
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
          })
      } else {
        // 更新最后一个会话的活动时间
        const lastSession = sessions[sessions.length - 1]
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('user_id', decoded.userId)
          .eq('created_at', lastSession.created_at)
      }
      
      return successResponse({ 
        success: true,
        todayWorkTime: totalMinutes 
      })
    }
    
    // 只有管理员角色可以查看所有在线会话
    // 支持多种角色代码格式
    const allowedRoles = ['ADMIN', 'admin', 'R001', 'MONITOR_MANAGER', 'R002']
    if (!allowedRoles.includes(decoded.roleCode) && !allowedRoles.includes(decoded.roleId)) {
      return errorResponse('无权限查看在线会话', 403)
    }
    
    const supabase = createServiceClient()
    
    // 获取sessions表中活跃的会话
    // 假设活跃会话是最近30分钟内有活动的
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select(`
        id,
        user_id,
        ip_address,
        user_agent,
        created_at,
        last_activity,
        users:user_id (
          id,
          username,
          name,
          email,
          roles:role_id (
            id,
            name,
            code
          ),
          departments:department_id (
            id,
            name
          )
        )
      `)
      .eq('is_active', true)
      .gte('last_activity', thirtyMinutesAgo)
      .order('last_activity', { ascending: false })
    
    if (error) {
      // 如果user_sessions表不存在，返回空数组
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.log('User sessions table not found, returning empty array')
        return successResponse({
          data: [],
          total: 0,
          message: '会话表尚未创建'
        })
      }
      console.error('Get online sessions error:', error)
      return errorResponse('获取在线会话失败', 500)
    }
    
    // 格式化会话数据
    const formattedSessions = (sessions || []).map(session => ({
      id: session.id,
      userId: session.user_id,
      userName: session.users?.name || '未知用户',
      userRole: session.users?.roles?.name || '未分配角色',
      department: session.users?.departments?.name || '未分配部门',
      ipAddress: session.ip_address || '未知',
      userAgent: session.user_agent || '未知',
      loginTime: session.created_at,
      lastActivity: session.last_activity,
      duration: calculateDuration(session.created_at, session.last_activity)
    }))
    
    return successResponse({
      data: formattedSessions,
      total: formattedSessions.length
    })
    
  } catch (error) {
    console.error('Get online sessions error:', error)
    return errorResponse('获取在线会话失败', 500)
  }
}

// 计算会话持续时间
function calculateDuration(start: string, end: string): string {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  const duration = endTime - startTime
  
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}