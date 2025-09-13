/**
 * 工单创建API
 * POST /api/app-workorder-create - R004巡检员创建工单
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
 * 创建工单
 * POST /api/app-workorder-create
 * 
 * 请求体:
 * {
 *   title: string,                   // 工单标题
 *   description: string,             // 问题描述
 *   workorder_type_id: string,       // 工单类型ID
 *   priority: 'urgent'|'important'|'normal', // 优先级
 *   area_id: string,                 // 区域ID
 *   location: object,                // 位置信息 {lat, lng, address}
 *   photos: string[],                // 现场照片URLs
 *   estimated_severity: string,      // 预估严重程度
 *   notes?: string,                  // 备注
 *   device_id?: string,              // 相关设备ID（如果有）
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
    
    // 权限检查 - 只有R004巡检员可以创建工单
    if (roleId !== 'R004') {
      return errorResponse('只有巡检员可以创建工单', 403)
    }
    
    // 解析请求体
    const body = await request.json()
    const {
      title,
      description,
      workorder_type_id,
      priority = 'normal',
      area_id,
      location,
      photos = [],
      estimated_severity,
      notes,
      device_id
    } = body

    // 参数验证
    if (!title || !description || !workorder_type_id || !area_id) {
      return errorResponse('缺少必填参数', 400)
    }

    if (!photos || photos.length === 0) {
      return errorResponse('必须上传现场照片', 400)
    }

    if (!location || !location.lat || !location.lng) {
      return errorResponse('必须提供位置信息', 400)
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()
    
    // 验证工单类型是否存在
    const { data: workorderType, error: typeError } = await supabase
      .from('workorder_types')
      .select('id, name, category, default_priority')
      .eq('id', workorder_type_id)
      .single()

    if (typeError || !workorderType) {
      return errorResponse('工单类型不存在', 404)
    }

    // 验证区域是否存在并获取区域信息
    const { data: area, error: areaError } = await supabase
      .from('river_management_areas')
      .select('id, name, supervisor_id, default_team_id')
      .eq('id', area_id)
      .eq('is_active', true)
      .single()

    if (areaError || !area) {
      return errorResponse('区域不存在或已停用', 404)
    }

    // 生成工单ID
    const workorderId = `WO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 创建工单
    const { data: workorder, error: createError } = await supabase
      .from('workorders')
      .insert({
        id: workorderId,
        title,
        description,
        workorder_type_id,
        priority: priority || workorderType.default_priority || 'normal',
        status: 'pending_dispatch', // 人工工单初始状态为待分派
        workorder_source: 'manual', // 标记为人工创建
        area_id,
        location: JSON.stringify(location),
        photos: JSON.stringify(photos),
        estimated_severity,
        notes,
        device_id,
        creator_id: userId,
        initial_reporter_id: userId, // 记录最初发起人
        department_id: null, // 人工工单暂不分配部门
        created_at: now,
        updated_at: now
      })
      .select(`
        *,
        type:workorder_types(id, name, category),
        area:river_management_areas(id, name, code)
      `)
      .single()

    if (createError) {
      console.error('创建工单失败:', createError)
      return errorResponse('创建工单失败', 500)
    }

    // 记录状态历史
    await supabase
      .from('workorder_status_history')
      .insert({
        id: `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workorderId,
        old_status: null,
        new_status: 'pending_dispatch',
        changed_by: userId,
        change_reason: '巡检员创建工单',
        change_note: `问题类型: ${workorderType.name}`,
        created_at: now
      })

    // 创建通知给区域管理员
    if (area.supervisor_id) {
      const notification = {
        id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: area.supervisor_id,
        title: '新工单待分派',
        content: `巡检员发现新问题: ${title}，请及时分派处理`,
        message_type: 'workorder',
        priority: priority === 'urgent' ? 'urgent' : 'important',
        related_type: 'workorder_dispatch',
        related_id: workorderId,
        sender_id: userId,
        action_url: `/workorder-detail?id=${workorderId}`,
        action_text: '去分派',
        created_at: now
      }
      
      await supabase.from('user_messages').insert(notification)

      // 如果是紧急工单，同时加入通知队列进行推送
      if (priority === 'urgent') {
        await supabase
          .from('notification_queue')
          .insert({
            id: `NQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: area.supervisor_id,
            type: 'workorder',
            title: notification.title,
            content: notification.content,
            priority: 'urgent',
            related_type: 'workorder_dispatch',
            related_id: workorderId,
            status: 'pending',
            created_at: now
          })
      }
    }

    // 如果是紧急工单，通知监控中心主管(R002)
    if (priority === 'urgent') {
      const { data: supervisors } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', 'R002')
        .eq('status', 'active')

      if (supervisors && supervisors.length > 0) {
        const supervisorNotifications = supervisors.map(supervisor => ({
          id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${supervisor.id}`,
          user_id: supervisor.id,
          title: '紧急工单创建',
          content: `巡检员发现紧急问题: ${title}`,
          message_type: 'workorder',
          priority: 'urgent',
          related_type: 'workorder',
          related_id: workorderId,
          sender_id: userId,
          action_url: `/workorder-detail?id=${workorderId}`,
          action_text: '查看详情',
          created_at: now
        }))
        
        await supabase.from('user_messages').insert(supervisorNotifications)
      }
    }

    // 记录API活动日志
    await logApiActivity('POST', 'app-workorder-create', userId, {
      workorder_id: workorderId,
      priority,
      area_id,
      photos_count: photos.length
    })

    return successResponse({
      workorder: {
        id: workorderId,
        title,
        status: 'pending_dispatch',
        priority,
        area: area.name,
        created_at: now
      },
      next_step: '等待区域管理员分派',
      notifications_sent: true
    }, '工单创建成功')

  } catch (error) {
    console.error('[app-workorder-create] POST error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取巡检员创建的工单列表
 * GET /api/app-workorder-create
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
    
    // 权限检查 - 只有R004巡检员可以查看
    if (roleId !== 'R004') {
      return errorResponse('只有巡检员可以查看创建历史', 403)
    }
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const days = parseInt(searchParams.get('days') || '30')
    const offset = (page - 1) * limit
    
    const supabase = createServiceClient()
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    
    // 查询工单
    let query = supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types(id, name, category),
        area:river_management_areas(id, name, code),
        assignee:users!workorders_assignee_id_fkey(id, name, username)
      `, { count: 'exact' })
      .eq('initial_reporter_id', userId)
      .eq('workorder_source', 'manual')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    query = query.range(offset, offset + limit - 1)
    
    const { data: workorders, error, count } = await query
    
    if (error) {
      console.error('查询工单历史失败:', error)
      return errorResponse('查询失败', 500)
    }
    
    // 统计数据
    const { data: stats } = await supabase
      .from('workorders')
      .select('status')
      .eq('initial_reporter_id', userId)
      .eq('workorder_source', 'manual')
      .gte('created_at', startDate)
    
    const statistics = {
      total_created: stats?.length || 0,
      pending_dispatch: stats?.filter(w => w.status === 'pending_dispatch').length || 0,
      processing: stats?.filter(w => ['dispatched', 'processing'].includes(w.status)).length || 0,
      pending_confirm: stats?.filter(w => w.status === 'pending_reporter_confirm').length || 0,
      completed: stats?.filter(w => w.status === 'completed').length || 0,
      cancelled: stats?.filter(w => w.status === 'cancelled').length || 0
    }
    
    return successResponse({
      workorders: workorders || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      statistics,
      time_range: {
        days,
        start_date: startDate
      }
    }, '获取工单创建历史成功')
    
  } catch (error) {
    console.error('[app-workorder-create] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}