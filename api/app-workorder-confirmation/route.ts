/**
 * 人工工单确认API
 * POST /api/app-workorder-confirmation
 * GET /api/app-workorder-confirmation - 获取待确认工单列表
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
 * R004发起人现场确认工单
 * POST /api/app-workorder-confirmation
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
    
    // 只有R004河道巡检员可以确认人工工单
    if (roleId !== 'R004') {
      return errorResponse('无权限执行此操作', 403)
    }

    // 解析请求体
    const body = await request.json()
    const {
      workorder_id,
      confirm_result, // 'confirmed' | 'rejected'
      site_photos = [], // 现场确认照片
      note = '', // 确认备注
      location_info // GPS位置信息
    } = body

    if (!workorder_id || !confirm_result) {
      return errorResponse('参数不完整', 400)
    }

    if (!['confirmed', 'rejected'].includes(confirm_result)) {
      return errorResponse('确认结果参数错误', 400)
    }

    const supabase = createServiceClient()
    
    // 1. 验证工单是否存在且为人工工单，且状态为待确认
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        initial_reporter_id,
        workorder_source,
        status
      `)
      .eq('id', workorder_id)
      .single()

    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    // 验证是否为人工工单
    if (workorder.workorder_source !== 'manual') {
      return errorResponse('只能确认人工工单', 400)
    }

    // 验证是否为原始发起人
    if (workorder.initial_reporter_id !== userId) {
      return errorResponse('只有原始发起人可以确认工单', 403)
    }

    // 验证工单状态
    if (workorder.status !== 'pending_reporter_confirm') {
      return errorResponse(`工单当前状态为${workorder.status}，无法确认`, 400)
    }

    // 2. 更新工单状态和确认信息
    let newStatus: string
    if (confirm_result === 'confirmed') {
      newStatus = 'completed' // 确认通过，工单完成
    } else {
      newStatus = 'confirmed_failed' // 确认失败，需要重新处理
    }

    const { data: updatedWorkorder, error: updateError } = await supabase
      .from('workorders')
      .update({
        status: newStatus,
        reporter_confirmed_at: new Date().toISOString(),
        reporter_confirm_result: confirm_result,
        reporter_confirm_note: note,
        updated_at: new Date().toISOString()
      })
      .eq('id', workorder_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('更新工单状态失败:', updateError)
      return errorResponse('更新工单状态失败', 500)
    }

    // 3. 记录确认详情到专门的表
    const { error: confirmError } = await supabase
      .from('workorder_reporter_confirmations')
      .insert({
        id: `WRC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorder_id,
        reporter_id: userId,
        confirm_action: confirm_result,
        confirm_note: note,
        site_photos: JSON.stringify(site_photos),
        confirm_time: new Date().toISOString(),
        is_timeout_intervention: false
      })

    if (confirmError) {
      console.error('记录确认详情失败:', confirmError)
      // 不返回错误，因为主要操作已成功
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
        change_reason: `发起人现场确认: ${confirm_result === 'confirmed' ? '确认通过' : '确认失败'}`,
        change_note: note,
        created_at: new Date().toISOString()
      })

    if (historyError) {
      console.error('记录状态历史失败:', historyError)
    }

    // 5. 如果确认失败，需要重新分派工单
    if (confirm_result === 'rejected') {
      // 将状态改为待重新分派
      await supabase
        .from('workorders')
        .update({
          status: 'pending_dispatch',
          updated_at: new Date().toISOString()
        })
        .eq('id', workorder_id)
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-workorder-confirmation', userId, {
      workorder_id,
      confirm_result,
      location: location_info
    })

    return successResponse({
      workorder: updatedWorkorder,
      confirm_result: confirm_result,
      confirm_time: new Date().toISOString(),
      next_status: newStatus
    }, `工单${confirm_result === 'confirmed' ? '确认完成' : '确认失败，已退回重新处理'}`)

  } catch (error) {
    console.error('[app-workorder-confirmation] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取待确认的工单列表 (R004专用)
 * GET /api/app-workorder-confirmation
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
    
    // 只有R004河道巡检员可以查看
    if (roleId !== 'R004') {
      return errorResponse('无权限访问', 403)
    }

    const supabase = createServiceClient()
    
    // 查询用户发起的待确认工单
    const { data: workorders, error } = await supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types!inner(id, name, category),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        area:river_management_areas(id, name, code),
        results:workorder_results(
          id,
          process_method,
          process_result,
          before_photos,
          after_photos,
          submitted_at,
          processor:users!workorder_results_processor_id_fkey(name, username)
        )
      `)
      .eq('initial_reporter_id', userId)
      .eq('workorder_source', 'manual')
      .eq('status', 'pending_reporter_confirm')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询待确认工单失败:', error)
      return errorResponse('查询失败', 500)
    }

    return successResponse({
      workorders: workorders || [],
      total: workorders?.length || 0
    }, '获取待确认工单列表成功')

  } catch (error) {
    console.error('[app-workorder-confirmation] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}