/**
 * 告警管理 API
 * GET /api/alarms - 获取告警列表
 * POST /api/alarms - 创建新告警
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

// GET - 获取告警列表
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status') || null
    const level = searchParams.get('level') || null
    const type = searchParams.get('type') || null
    const startDate = searchParams.get('startDate') || null
    const endDate = searchParams.get('endDate') || null
    const areaId = searchParams.get('area_id') || null
    const search = searchParams.get('search') || null
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('alarms')
      .select(`
        *,
        alarm_types:type_id (
          id,
          name,
          code,
          category
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
          river_name,
          longitude,
          latitude
        ),
        confirmed_user:confirmed_by (
          id,
          name
        ),
        resolved_user:resolved_by (
          id,
          name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // 根据角色过滤数据
    // R002(监控中心主管) 可以看所有告警
    // R006(河道维护员主管) 只能看自己负责区域的告警
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      // 获取用户负责的区域
      const { data: supervisorAreas } = await supabase
        .from('river_management_areas')
        .select('monitoring_point_ids')
        .eq('supervisor_id', decoded.userId)
      
      if (supervisorAreas && supervisorAreas.length > 0) {
        // 提取所有监控点ID
        const pointIds = supervisorAreas.flatMap(area => area.monitoring_point_ids || [])
        if (pointIds.length > 0) {
          query = query.in('point_id', pointIds)
        }
      }
    }
    
    // 应用状态过滤条件
    if (status) {
      query = query.eq('status', status)
    }
    
    if (level) {
      query = query.eq('level_id', level)
    }
    
    if (type) {
      query = query.eq('type_id', type)
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    
    // 搜索过滤
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    // 区域过滤
    if (areaId) {
      // 获取区域对应的监控点
      const { data: areaData } = await supabase
        .from('river_management_areas')
        .select('monitoring_point_ids')
        .eq('id', areaId)
        .single()
      
      if (areaData?.monitoring_point_ids && areaData.monitoring_point_ids.length > 0) {
        query = query.in('point_id', areaData.monitoring_point_ids)
      } else {
        // 如果区域没有监控点，返回空结果
        return successResponse([], '操作成功')
      }
    }
    
    // 分页必须在所有过滤条件之后
    query = query.range((page - 1) * limit, page * limit - 1)
    
    const { data: alarms, error, count } = await query
    
    if (error) {
      console.error('Query alarms error:', error)
      return errorResponse('获取告警列表失败', 500)
    }
    
    // 直接返回数组格式，不要嵌套
    return successResponse(alarms || [], '操作成功')
    
  } catch (error) {
    console.error('Get alarms error:', error)
    return errorResponse('获取告警列表失败', 500)
  }
}

// POST - 创建新告警
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
    const {
      type_id,
      level_id,
      device_id,
      point_id,
      title,
      description,
      confidence,
      image_url,
      video_url,
      coordinates
    } = body
    
    // 验证必填字段
    if (!type_id || !level_id || !point_id || !title) {
      return errorResponse('缺少必填字段', 400)
    }
    
    const supabase = createServiceClient()
    
    // 生成告警ID
    const { data: lastAlarm } = await supabase
      .from('alarms')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single()
    
    const lastId = lastAlarm?.id || 'A000000'
    const nextNumber = parseInt(lastId.substring(1)) + 1
    const alarmId = `A${nextNumber.toString().padStart(6, '0')}`
    
    // 创建告警
    const { data: newAlarm, error } = await supabase
      .from('alarms')
      .insert({
        id: alarmId,
        type_id,
        level_id,
        device_id,
        point_id,
        title,
        description,
        confidence: confidence || 1.0,
        image_url,
        video_url,
        coordinates,
        status: 'pending',
        department_id: decoded.departmentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
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
        )
      `)
      .single()
    
    if (error) {
      console.error('Create alarm error:', error)
      return errorResponse('创建告警失败', 500)
    }
    
    return successResponse({
      alarm: newAlarm,
      message: '告警创建成功'
    })
    
  } catch (error) {
    console.error('Create alarm error:', error)
    return errorResponse('创建告警失败', 500)
  }
}