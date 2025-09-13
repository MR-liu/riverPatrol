/**
 * 工单超时介入API (R006专用)
 * POST /api/app-workorder-timeout-intervention
 * GET /api/app-workorder-timeout-intervention - 获取超时工单列表
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
 * R006超时介入确认工单
 * POST /api/app-workorder-timeout-intervention
 */
export async function POST(request: NextRequest) {
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
    const areaId = decoded.areaId
    
    // 只有R006区域管理员可以超时介入
    if (roleId !== 'R006') {
      return errorResponse('无权限执行此操作', 403)
    }

    // 解析请求体
    const body = await request.json()
    const {
      workorder_id,
      intervention_result, // 'completed' | 'rejected'
      note = '', // 介入说明
      timeout_reason = '发起人超时未确认' // 超时原因
    } = body

    if (!workorder_id || !intervention_result) {
      return errorResponse('参数不完整', 400)
    }

    if (!['completed', 'rejected'].includes(intervention_result)) {
      return errorResponse('介入结果参数错误', 400)
    }

    const supabase = createServiceClient()
    
    // 1. 验证工单是否存在且在管辖区域内
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        area:river_management_areas!inner(id, name, supervisor_id)
      `)
      .eq('id', workorder_id)
      .single()

    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    // 验证区域权限
    if (workorder.area?.supervisor_id !== userId) {
      return errorResponse('无权限管理此区域的工单', 403)
    }

    // 验证工单状态是否为待确认
    if (workorder.status !== 'pending_reporter_confirm') {
      return errorResponse(`工单当前状态为${workorder.status}，无法介入`, 400)
    }

    // 验证是否确实超时（这里可以加入时间判断逻辑）
    const timeoutThreshold = 24 * 60 * 60 * 1000; // 24小时超时
    const lastUpdateTime = new Date(workorder.updated_at || workorder.created_at).getTime();
    const now = Date.now();
    
    if (now - lastUpdateTime < timeoutThreshold) {
      return errorResponse('工单尚未超时，无需介入', 400)
    }

    // 2. 更新工单状态
    let newStatus: string
    if (intervention_result === 'completed') {
      newStatus = 'completed' // 介入确认完成
    } else {
      newStatus = 'confirmed_failed' // 介入确认失败，退回
    }

    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update({
        status: newStatus,
        timeout_intervener_id: userId,
        timeout_intervened_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workorder_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('更新工单状态失败:', updateError)
      return errorResponse('更新工单状态失败', 500)
    }

    // 3. 记录介入确认到专门的表
    const { error: confirmError } = await supabase
      .from('workorder_reporter_confirmations')
      .insert({
        id: `WRC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorder_id,
        reporter_id: workorder.initial_reporter_id, // 原始发起人
        confirm_action: intervention_result,
        confirm_note: note,
        confirm_time: new Date().toISOString(),
        is_timeout_intervention: true,
        intervener_id: userId
      })

    if (confirmError) {
      console.error('记录介入确认详情失败:', confirmError)
    }

    // 4. 记录状态变更历史
    const { error: historyError } = await supabase
      .from('workorder_status_history')
      .insert({
        id: `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorder_id,
        old_status: 'pending_reporter_confirm',
        new_status: newStatus,
        changed_by: userId,
        change_reason: `超时介入: ${timeout_reason}`,
        change_note: note,
        created_at: new Date().toISOString()
      })

    if (historyError) {
      console.error('记录状态历史失败:', historyError)
    }

    // 5. 如果介入后确认失败，需要重新分派工单
    if (intervention_result === 'rejected') {
      await supabase
        .from('workorders')
        .update({
          status: 'pending_dispatch',
          updated_at: new Date().toISOString()
        })
        .eq('id', workorder_id)
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-workorder-timeout-intervention', userId, {
      workorder_id,
      intervention_result,
      timeout_reason
    })

    return successResponse({
      workorder: updatedWorkorder,
      intervention_result: intervention_result,
      intervention_time: new Date().toISOString(),
      next_status: newStatus
    }, `超时工单介入${intervention_result === 'completed' ? '确认完成' : '确认失败，已退回重新处理'}`)

  } catch (error) {
    console.error('[app-workorder-timeout-intervention] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取超时待处理的工单列表 (R006专用)
 * GET /api/app-workorder-timeout-intervention
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
    
    // 只有R006区域管理员可以查看
    if (roleId !== 'R006') {
      return errorResponse('无权限访问', 403)
    }

    const supabase = createServiceClient()
    
    // 计算超时时间阈值（24小时前）
    const timeoutThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    // 查询管辖区域内的超时工单
    const { data: workorders, error } = await supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types!inner(id, name, category),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        initial_reporter:users!workorders_initial_reporter_id_fkey(id, name, username, phone),
        area:river_management_areas!inner(id, name, code, supervisor_id),
        results:workorder_results(
          id,
          process_method,
          process_result,
          before_photos,
          after_photos,
          submitted_at
        )
      `)
      .eq('area.supervisor_id', userId) // 只查询自己管辖的区域
      .eq('workorder_source', 'manual') // 只有人工工单需要确认
      .eq('status', 'pending_reporter_confirm') // 待确认状态
      .lt('updated_at', timeoutThreshold) // 超时的工单
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询超时工单失败:', error)
      return errorResponse('查询失败', 500)
    }

    // 计算每个工单的超时时长
    const workordersWithTimeout = (workorders || []).map(workorder => {
      const lastUpdateTime = new Date(workorder.updated_at || workorder.created_at).getTime()
      const timeoutHours = Math.floor((Date.now() - lastUpdateTime) / (1000 * 60 * 60))
      
      return {
        ...workorder,
        timeout_hours: timeoutHours,
        timeout_severity: timeoutHours > 48 ? 'critical' : timeoutHours > 24 ? 'high' : 'normal'
      }
    })

    return successResponse({
      workorders: workordersWithTimeout,
      total: workordersWithTimeout.length,
      timeout_threshold: '24小时'
    }, '获取超时工单列表成功')

  } catch (error) {
    console.error('[app-workorder-timeout-intervention] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}