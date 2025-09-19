/**
 * 工单处理结果提交API
 * POST /api/app-workorder-process - R003维护员提交处理结果
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
 * 提交工单处理结果
 * POST /api/app-workorder-process
 * 
 * 请求体:
 * {
 *   workorder_id: string,
 *   process_method: string,         // 处理方法
 *   process_result: string,          // 处理结果描述
 *   before_photos: string[],         // 处理前照片URLs
 *   after_photos: string[],          // 处理后照片URLs
 *   need_followup: boolean,          // 是否需要后续跟进
 *   followup_reason?: string,        // 需要跟进的原因
 *   materials_used?: object,         // 使用的材料清单
 *   estimated_completion?: string    // 预计完成时间(如需跟进)
 * }
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
    
    // 权限检查 - 只有R003维护员可以提交处理结果
    if (roleId !== 'R003') {
      return errorResponse('只有维护员可以提交处理结果', 403)
    }
    
    // 解析请求体
    const body = await request.json()
    const {
      workorder_id,
      process_method,
      process_result,
      before_photos = [],
      after_photos = [],
      need_followup = false,
      followup_reason,
      materials_used,
      estimated_completion
    } = body

    // 参数验证
    if (!workorder_id || !process_method || !process_result) {
      return errorResponse('缺少必填参数', 400)
    }

    if (!after_photos || after_photos.length === 0) {
      return errorResponse('必须上传处理后照片', 400)
    }

    if (need_followup && !followup_reason) {
      return errorResponse('需要跟进时必须填写原因', 400)
    }

    const supabase = createServiceClient()
    
    // 获取工单信息并验证
    const { data: workorder, error: workorderError } = await supabase
      .from('workorders')
      .select(`
        *,
        area:river_management_areas(id, name, supervisor_id)
      `)
      .eq('id', workorder_id)
      .single()

    if (workorderError || !workorder) {
      return errorResponse('工单不存在', 404)
    }

    // 验证工单是否分配给当前用户
    if (workorder.assignee_id !== userId) {
      return errorResponse('只能处理分配给自己的工单', 403)
    }

    // 验证工单状态 - 只有processing状态的工单可以提交结果
    if (workorder.status !== 'processing') {
      return errorResponse(`工单状态不正确，当前状态: ${workorder.status}`, 400)
    }

    // 开始事务处理
    const now = new Date().toISOString()
    
    // 1. 创建处理结果记录 - ID限制在20字符内
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substr(2, 5).toUpperCase()
    const resultId = `WR_${timestamp}_${random}` // 总长度: 3 + 6 + 1 + 5 = 15
    
    const { data: result, error: resultError } = await supabase
      .from('workorder_results')
      .insert({
        id: resultId,
        workorder_id,
        result_type: need_followup ? 'partial' : 'completed',
        description: `处理方法: ${process_method}\n处理结果: ${process_result}`,
        before_images: before_photos || [], // JSONB字段，直接传数组
        after_images: after_photos || [],   // JSONB字段，直接传数组
        materials_used: materials_used || null, // JSONB字段
        time_spent: null, // 可以后续添加耗时记录
        created_at: now,
        updated_at: now
      })
      .select()
      .single()

    if (resultError) {
      console.error('创建处理结果失败:', resultError)
      return errorResponse('提交处理结果失败', 500)
    }

    // 2. 确定下一个状态
    let newStatus: string
    let statusChangeReason: string
    
    if (workorder.workorder_source === 'ai') {
      // AI工单：需要区域管理员审核
      newStatus = 'pending_review'
      statusChangeReason = '处理完成，待区域管理员审核'
    } else {
      // 人工工单：需要发起人确认
      newStatus = 'pending_reporter_confirm'
      statusChangeReason = '处理完成，待发起人确认'
    }

    // 3. 更新工单状态
    const { error: updateError } = await supabase
      .from('workorders')
      .update({
        status: newStatus,
        processing_result_id: resultId,
        updated_at: now
      })
      .eq('id', workorder_id)

    if (updateError) {
      console.error('更新工单状态失败:', updateError)
      return errorResponse('更新工单状态失败', 500)
    }

    // 4. 记录状态变更历史
    const historyId = `WSH_${Date.now().toString().slice(-8)}` // 长度: 4 + 8 = 12
    await supabase
      .from('workorder_status_history')
      .insert({
        id: historyId,
        workorder_id,
        from_status: workorder.status,  // 使用正确的字段名
        to_status: newStatus,            // 使用正确的字段名
        changed_by: userId,
        change_reason: statusChangeReason + ` - 处理方法: ${process_method}`,
        created_at: now
      })

    // 5. 创建通知
    const notifications = []
    
    if (workorder.workorder_source === 'ai') {
      // 通知区域管理员审核
      if (workorder.area?.supervisor_id) {
        notifications.push({
          id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: workorder.area.supervisor_id,
          title: '工单待审核',
          content: `工单 ${workorder.title} 已处理完成，请及时审核`,
          message_type: 'workorder',
          priority: 'important',
          related_type: 'workorder_review',
          related_id: workorder_id,
          sender_id: userId,
          action_url: `/workorder-detail?id=${workorder_id}`,
          action_text: '去审核',
          created_at: now
        })
      }
    } else {
      // 通知发起人确认
      if (workorder.initial_reporter_id) {
        notifications.push({
          id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: workorder.initial_reporter_id,
          title: '工单待确认',
          content: `您发起的工单 ${workorder.title} 已处理完成，请前往现场确认`,
          message_type: 'workorder',
          priority: 'urgent',
          related_type: 'workorder_confirmation',
          related_id: workorder_id,
          sender_id: userId,
          action_url: `/workorder-detail?id=${workorder_id}`,
          action_text: '去确认',
          created_at: now
        })
      }
    }

    if (notifications.length > 0) {
      await supabase.from('user_messages').insert(notifications)
    }

    // 6. 如果需要跟进，创建跟进任务
    if (need_followup) {
      await supabase
        .from('workorder_followup_tasks')
        .insert({
          id: `WFT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workorder_id,
          reason: followup_reason,
          estimated_date: estimated_completion,
          status: 'pending',
          created_by: userId,
          created_at: now
        })
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-workorder-process', userId, {
      workorder_id,
      need_followup,
      photos_count: {
        before: before_photos.length,
        after: after_photos.length
      }
    })

    return successResponse({
      result: {
        id: resultId,
        workorder_id,
        process_method,
        process_result,
        need_followup,
        submitted_at: now
      },
      workorder: {
        id: workorder_id,
        new_status: newStatus,
        next_step: workorder.workorder_source === 'ai' 
          ? '等待区域管理员审核'
          : '等待发起人现场确认'
      },
      notifications_sent: notifications.length
    }, '处理结果提交成功')

  } catch (error) {
    console.error('[app-workorder-process] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取维护员的处理历史
 * GET /api/app-workorder-process
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
    
    // 权限检查 - 只有R003维护员可以查看
    if (roleId !== 'R003') {
      return errorResponse('只有维护员可以查看处理历史', 403)
    }
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // 可选：筛选特定状态的结果
    const offset = (page - 1) * limit
    
    const supabase = createServiceClient()
    
    // 查询处理结果
    let query = supabase
      .from('workorder_results')
      .select(`
        *,
        workorder:workorders!inner(
          id,
          title,
          status,
          priority,
          workorder_source,
          area:river_management_areas(name, code)
        )
      `, { count: 'exact' })
      .eq('processor_id', userId)
      .order('submitted_at', { ascending: false })
    
    if (status) {
      query = query.eq('workorder.status', status)
    }
    
    query = query.range(offset, offset + limit - 1)
    
    const { data: results, error, count } = await query
    
    if (error) {
      console.error('查询处理历史失败:', error)
      return errorResponse('查询失败', 500)
    }
    
    // 统计数据
    const { data: stats } = await supabase
      .from('workorder_results')
      .select('need_followup')
      .eq('processor_id', userId)
    
    const statistics = {
      total_processed: stats?.length || 0,
      need_followup: stats?.filter(r => r.need_followup).length || 0,
      completed: stats?.filter(r => !r.need_followup).length || 0
    }
    
    return successResponse({
      results: results || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      statistics
    }, '获取处理历史成功')
    
  } catch (error) {
    console.error('[app-workorder-process] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}