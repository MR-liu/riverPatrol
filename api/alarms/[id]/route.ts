/**
 * 告警详情和操作 API
 * GET /api/alarms/[id] - 获取告警详情
 * PUT /api/alarms/[id] - 更新告警状态
 * DELETE /api/alarms/[id] - 删除告警
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

// GET - 获取告警详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    
    const supabase = createServiceClient()
    
    // 获取告警详情
    const { data: alarm, error } = await supabase
      .from('alarms')
      .select(`
        *,
        alarm_types:type_id (
          id,
          name,
          code,
          category,
          description
        ),
        alarm_levels:level_id (
          id,
          name,
          code,
          priority,
          color,
          description
        ),
        devices:device_id (
          id,
          name,
          code,
          status,
          ip_address
        ),
        monitoring_points:point_id (
          id,
          name,
          code,
          river_name,
          river_section,
          longitude,
          latitude,
          address
        ),
        departments:department_id (
          id,
          name,
          code
        ),
        confirmed_user:confirmed_by (
          id,
          name,
          username,
          phone
        ),
        resolved_user:resolved_by (
          id,
          name,
          username,
          phone
        ),
        workorders (
          id,
          title,
          status,
          priority,
          created_at
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) {
      console.error('Get alarm detail error:', error)
      if (error.code === 'PGRST116') {
        return errorResponse('告警不存在', 404)
      }
      return errorResponse('获取告警详情失败', 500)
    }
    
    return successResponse({
      alarm
    })
    
  } catch (error) {
    console.error('Get alarm detail error:', error)
    return errorResponse('获取告警详情失败', 500)
  }
}

// PUT - 更新告警状态
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { action, note } = body
    
    // 验证操作类型
    const validActions = ['process', 'resolve', 'false_alarm', 'ignore']
    if (!validActions.includes(action)) {
      return errorResponse('无效的操作类型', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取当前告警状态
    const { data: currentAlarm, error: fetchError } = await supabase
      .from('alarms')
      .select('status')
      .eq('id', id)
      .single()
    
    if (fetchError || !currentAlarm) {
      return errorResponse('告警不存在', 404)
    }
    
    // 构建更新数据
    let updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    switch (action) {
        
      case 'process':
        if (!['pending', 'confirmed'].includes(currentAlarm.status)) {
          return errorResponse('告警状态不允许处理', 400)
        }
        updateData.status = 'processing'
        if (currentAlarm.status === 'pending') {
          updateData.confirmed_by = decoded.userId
          updateData.confirmed_at = new Date().toISOString()
        }
        break
        
      case 'resolve':
        if (!['confirmed', 'processing'].includes(currentAlarm.status)) {
          return errorResponse('告警状态不允许解决', 400)
        }
        updateData.status = 'resolved'
        updateData.resolved_by = decoded.userId
        updateData.resolved_at = new Date().toISOString()
        updateData.resolution_note = note || '告警已处理完成'
        break
        
      case 'false_alarm':
        // false_alarm 现在用于表示"退回"状态
        if (currentAlarm.status !== 'pending') {
          return errorResponse('只能退回待处理的告警', 400)
        }
        if (!note) {
          return errorResponse('退回告警必须提供理由', 400)
        }
        updateData.status = 'false_alarm'
        updateData.resolved_by = decoded.userId
        updateData.resolved_at = new Date().toISOString()
        updateData.resolution_note = `退回原因：${note}`
        break
        
      case 'ignore':
        updateData.status = 'ignored'
        updateData.resolved_by = decoded.userId
        updateData.resolved_at = new Date().toISOString()
        updateData.resolution_note = note || '已忽略该告警'
        break
    }
    
    // 更新告警
    const { data: updatedAlarm, error: updateError } = await supabase
      .from('alarms')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        alarm_types:type_id (
          id,
          name,
          code
        ),
        alarm_levels:level_id (
          id,
          name,
          code,
          priority,
          color
        ),
        monitoring_points:point_id (
          id,
          name,
          code,
          river_name
        ),
        confirmed_user:confirmed_by (
          id,
          name
        ),
        resolved_user:resolved_by (
          id,
          name
        )
      `)
      .single()
    
    if (updateError) {
      console.error('Update alarm error:', updateError)
      return errorResponse('更新告警失败', 500)
    }
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'alarm_management',
      action: action,
      target_type: 'alarm',
      target_id: params.id,
      target_name: updatedAlarm.title,
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    return successResponse({
      alarm: updatedAlarm,
      message: '告警状态更新成功'
    })
    
  } catch (error) {
    console.error('Update alarm error:', error)
    return errorResponse('更新告警失败', 500)
  }
}

// DELETE - 删除告警
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    
    // 只有管理员可以删除告警
    // 支持多种角色代码格式
    const allowedRoles = ['ADMIN', 'admin', 'R001']
    if (!allowedRoles.includes(decoded.roleCode) && !allowedRoles.includes(decoded.roleId)) {
      return errorResponse('无权限删除告警', 403)
    }
    
    const supabase = createServiceClient()
    
    // 检查告警是否存在
    const { data: alarm, error: fetchError } = await supabase
      .from('alarms')
      .select('id, title, status')
      .eq('id', id)
      .single()
    
    if (fetchError || !alarm) {
      return errorResponse('告警不存在', 404)
    }
    
    // 不允许删除已处理的告警
    if (alarm.status === 'resolved') {
      return errorResponse('不能删除已解决的告警', 400)
    }
    
    // 删除告警
    const { error: deleteError } = await supabase
      .from('alarms')
      .delete()
      .eq('id', id)
    
    if (deleteError) {
      console.error('Delete alarm error:', deleteError)
      return errorResponse('删除告警失败', 500)
    }
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'alarm_management',
      action: 'delete',
      target_type: 'alarm',
      target_id: params.id,
      target_name: alarm.title,
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    return successResponse({
      message: '告警删除成功'
    })
    
  } catch (error) {
    console.error('Delete alarm error:', error)
    return errorResponse('删除告警失败', 500)
  }
}