/**
 * 移动端告警列表 API
 * GET /api/app-alarms - 获取告警列表
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
 * 获取告警列表
 */
export async function GET(request: NextRequest) {
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
    const areaId = decoded.areaId
    
    // 权限检查 - 只有监控中心主管(R002)和系统管理员(R001)能查看告警
    if (!['R001', 'R002'].includes(roleId)) {
      return errorResponse('无权查看告警列表', 403)
    }
    
    const supabase = createServiceClient()
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending' // pending, confirmed, rejected
    const type = searchParams.get('type') // ai, manual
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    // 构建查询 - 先简化查询，不包含关联表
    let query = supabase
      .from('alarms')
      .select('*', { count: 'exact' })
    
    // 状态筛选
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    // 类型筛选
    if (type) {
      query = query.eq('type', type)
    }
    
    // 排序和分页
    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    
    const { data: alarms, error, count } = await query
    
    if (error) {
      console.error('获取告警列表失败:', error)
      return errorResponse('获取告警列表失败', 500)
    }
    
    // 格式化数据
    const formattedAlarms = alarms?.map(alarm => ({
      id: alarm.id,
      title: alarm.title,
      description: alarm.description,
      type: alarm.type, // ai 或 manual
      severity: alarm.severity, // high, medium, low
      status: alarm.status, // pending, confirmed, rejected
      location: alarm.location,
      coordinates: alarm.coordinates,
      detectedAt: alarm.detected_at,
      areaId: alarm.area_id,
      images: alarm.images,
      videos: alarm.videos,
      confirmedBy: alarm.confirmed_by,
      confirmedAt: alarm.confirmed_at,
      rejectedBy: alarm.rejected_by,
      rejectedAt: alarm.rejected_at,
      rejectReason: alarm.reject_reason,
      createdAt: alarm.created_at
    })) || []
    
    // 记录活动
    logApiActivity('app_alarms_list', userId, {
      role_id: roleId,
      filters: { status, type },
      results_count: formattedAlarms.length
    })
    
    return successResponse({
      items: formattedAlarms,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }, '获取告警列表成功')
    
  } catch (error) {
    console.error('Get alarms error:', error)
    return errorResponse('获取告警失败', 500)
  }
}