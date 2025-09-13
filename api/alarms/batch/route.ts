/**
 * 批量操作告警 API
 * POST /api/alarms/batch - 批量处理告警
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

// POST - 批量处理告警
export async function POST(request: NextRequest) {
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
    
    const body = await request.json()
    const { alarm_ids, action, note } = body
    
    // 验证参数
    if (!alarm_ids || !Array.isArray(alarm_ids) || alarm_ids.length === 0) {
      return errorResponse('请选择要处理的告警', 400)
    }
    
    if (alarm_ids.length > 100) {
      return errorResponse('批量处理最多支持100条告警', 400)
    }
    
    const validActions = ['confirm', 'resolve', 'false_alarm', 'ignore']
    if (!validActions.includes(action)) {
      return errorResponse('无效的操作类型', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取所有待处理的告警
    const { data: alarms, error: fetchError } = await supabase
      .from('alarms')
      .select('id, status, title')
      .in('id', alarm_ids)
    
    if (fetchError || !alarms || alarms.length === 0) {
      return errorResponse('未找到有效的告警', 404)
    }
    
    // 根据操作类型构建更新数据
    let updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    const timestamp = new Date().toISOString()
    
    switch (action) {
      case 'confirm':
        updateData.status = 'confirmed'
        updateData.confirmed_by = decoded.userId
        updateData.confirmed_at = timestamp
        break
        
      case 'resolve':
        updateData.status = 'resolved'
        updateData.resolved_by = decoded.userId
        updateData.resolved_at = timestamp
        updateData.resolution_note = note || '批量处理完成'
        break
        
      case 'false_alarm':
        updateData.status = 'false_alarm'
        updateData.resolved_by = decoded.userId
        updateData.resolved_at = timestamp
        updateData.resolution_note = note || '批量标记为误报'
        break
        
      case 'ignore':
        updateData.status = 'ignored'
        updateData.resolved_by = decoded.userId
        updateData.resolved_at = timestamp
        updateData.resolution_note = note || '批量忽略'
        break
    }
    
    // 根据操作类型过滤可处理的告警
    let validAlarmIds = alarm_ids
    if (action === 'confirm') {
      // 只能确认待处理的告警
      validAlarmIds = alarms
        .filter(a => a.status === 'pending')
        .map(a => a.id)
    } else if (action === 'resolve') {
      // 只能解决已确认或处理中的告警
      validAlarmIds = alarms
        .filter(a => ['confirmed', 'processing'].includes(a.status))
        .map(a => a.id)
    }
    
    if (validAlarmIds.length === 0) {
      return errorResponse('没有符合条件的告警可以处理', 400)
    }
    
    // 批量更新告警
    const { data: updatedAlarms, error: updateError } = await supabase
      .from('alarms')
      .update(updateData)
      .in('id', validAlarmIds)
      .select()
    
    if (updateError) {
      console.error('Batch update alarms error:', updateError)
      return errorResponse('批量处理告警失败', 500)
    }
    
    // 记录批量操作日志
    const logEntries = validAlarmIds.map(alarmId => {
      const alarm = alarms.find(a => a.id === alarmId)
      return {
        user_id: decoded.userId,
        username: decoded.username,
        module: 'alarm_management',
        action: `batch_${action}`,
        target_type: 'alarm',
        target_id: alarmId,
        target_name: alarm?.title || alarmId,
        status: 'success',
        created_at: new Date().toISOString()
      }
    })
    
    await supabase.from('operation_logs').insert(logEntries)
    
    return successResponse({
      processed: validAlarmIds.length,
      skipped: alarm_ids.length - validAlarmIds.length,
      alarms: updatedAlarms,
      message: `成功处理 ${validAlarmIds.length} 条告警`
    })
    
  } catch (error) {
    console.error('Batch process alarms error:', error)
    return errorResponse('批量处理告警失败', 500)
  }
}