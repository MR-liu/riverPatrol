/**
 * 确认告警并转工单 API
 * POST /api/app-alarms/confirm
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
    
    // 权限检查 - 只有监控中心主管(R002)和系统管理员(R001)能确认告警
    if (!['R001', 'R002'].includes(roleId)) {
      return errorResponse('无权确认告警', 403)
    }
    
    const body = await request.json()
    const { 
      alarmId, 
      title, 
      description, 
      typeId = 'WT_001',  // 修正为正确的工单类型ID
      priority = 'normal',
      areaId,
      departmentId = 'DEPT_002'
    } = body
    
    if (!alarmId) {
      return errorResponse('告警ID必填', 400)
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
    
    // 生成工单ID
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const workOrderId = `WO_${dateStr}_${random}`
    
    // 创建工单
    const { data: workorder, error: woError } = await supabase
      .from('workorders')
      .insert({
        id: workOrderId,
        title: title || alarm.title,
        description: description || alarm.description,
        type_id: typeId,
        priority,
        status: 'pending',
        sla_status: 'active',
        location: alarm.location,
        coordinates: alarm.coordinates,
        alarm_id: alarmId,
        area_id: areaId || alarm.area_id,
        department_id: departmentId,
        creator_id: userId,
        source: alarm.type === 'ai' ? 'ai_detection' : 'manual_report',
        images: alarm.images,
        videos: alarm.videos,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single()
    
    if (woError) {
      console.error('创建工单失败:', woError)
      return errorResponse('创建工单失败', 500)
    }
    
    // 更新告警状态
    await supabase
      .from('alarms')
      .update({
        status: 'confirmed',
        confirmed_by: userId,
        confirmed_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', alarmId)
    
    // 记录工单状态历史
    await supabase
      .from('workorder_status_history')
      .insert({
        id: `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workOrderId,
        old_status: null,
        new_status: 'pending',
        changed_by: userId,
        change_reason: `告警转工单: ${alarm.title}`,
        created_at: now.toISOString()
      })
    
    // 记录活动
    logApiActivity('app_alarm_confirm', userId, {
      alarm_id: alarmId,
      workorder_id: workOrderId,
      role_id: roleId
    })
    
    return successResponse({
      alarm: { 
        id: alarmId, 
        status: 'confirmed'
      },
      workorder: workorder
    }, '告警已确认并转工单')
    
  } catch (error) {
    console.error('Confirm alarm error:', error)
    return errorResponse('确认告警失败', 500)
  }
}