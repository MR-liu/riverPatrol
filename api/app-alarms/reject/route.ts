/**
 * 退回告警 API
 * POST /api/app-alarms/reject
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

export async function POST(request: NextRequest) {
  try {
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
    
    // 权限检查 - 只有监控中心主管(R002)和系统管理员(R001)能退回告警
    if (!['R001', 'R002'].includes(roleId)) {
      return errorResponse('无权退回告警', 403)
    }
    
    const body = await request.json()
    const { alarmId, reason } = body
    
    if (!alarmId || !reason) {
      return errorResponse('告警ID和退回原因必填', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取告警信息
    const { data: alarm, error: alarmError } = await supabase
      .from('alarms')
      .select('*')
      .eq('id', alarmId)
      .single()
    
    if (alarmError || !alarm) {
      return errorResponse('告警不存在', 404)
    }
    
    if (alarm.status !== 'pending') {
      return errorResponse('告警已处理', 400)
    }
    
    // 更新告警状态 - 使用 resolution_note 字段存储退回原因
    const { error: updateError } = await supabase
      .from('alarms')
      .update({
        status: 'false_alarm',  // 使用 false_alarm 状态表示退回
        resolved_by: userId,  // 使用 resolved_by 存储操作人
        resolved_at: new Date().toISOString(),
        resolution_note: `退回原因: ${reason}`,  // 使用 resolution_note 存储退回原因
        updated_at: new Date().toISOString()
      })
      .eq('id', alarmId)
    
    if (updateError) {
      console.error('退回告警失败:', updateError)
      return errorResponse('退回告警失败', 500)
    }
    
    // 记录活动
    logApiActivity('app_alarm_reject', userId, {
      alarm_id: alarmId,
      reason,
      role_id: roleId
    })
    
    return successResponse({
      alarm: { 
        id: alarmId, 
        status: 'false_alarm', 
        reason,
        resolved_by: userId,
        resolved_at: new Date().toISOString()
      }
    }, '告警已退回')
    
  } catch (error) {
    console.error('Reject alarm error:', error)
    return errorResponse('退回告警失败', 500)
  }
}