/**
 * 监控点管理 API
 * GET /api/monitoring-points - 获取监控点列表
 * POST /api/monitoring-points - 创建新监控点
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

// GET - 获取监控点列表
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const search = searchParams.get('search') || null
    const riverId = searchParams.get('riverId') || null
    const region = searchParams.get('region') || null
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('monitoring_points')
      .select(`
        *,
        rivers:river_id (
          id,
          name,
          code
        ),
        departments:department_id (
          id,
          name
        ),
        devices!point_id (
          id,
          name,
          status,
          type_id
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // 应用过滤条件
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,river_name.ilike.%${search}%`)
    }
    
    if (riverId) {
      query = query.eq('river_id', riverId)
    }
    
    if (region) {
      query = query.eq('region', region)
    }
    
    // 分页
    query = query.range((page - 1) * limit, page * limit - 1)
    
    const { data: points, error, count } = await query
    
    if (error) {
      console.error('Query monitoring points error:', error)
      // 如果是关系查询错误，尝试简化查询
      if (error.code === '42703' || error.message?.includes('does not exist')) {
        console.log('Trying simplified query without devices relation')
        
        // 重新构建简化的查询
        let simpleQuery = supabase
          .from('monitoring_points')
          .select(`
            *,
            rivers:river_id (
              id,
              name,
              code
            ),
            departments:department_id (
              id,
              name
            )
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
        
        // 应用相同的过滤条件
        if (search) {
          simpleQuery = simpleQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%,river_name.ilike.%${search}%`)
        }
        if (riverId) {
          simpleQuery = simpleQuery.eq('river_id', riverId)
        }
        if (region) {
          simpleQuery = simpleQuery.eq('region', region)
        }
        
        // 分页
        simpleQuery = simpleQuery.range((page - 1) * limit, page * limit - 1)
        
        const { data: simplePoints, error: simpleError, count: simpleCount } = await simpleQuery
        
        if (simpleError) {
          console.error('Simple query also failed:', simpleError)
          return errorResponse('获取监控点列表失败', 500)
        }
        
        // 格式化返回数据（没有设备统计）
        const formattedPoints = (simplePoints || []).map(point => ({
          ...point,
          deviceCount: 0,
          onlineDevices: 0,
          offlineDevices: 0
        }))
        
        return successResponse({
          data: formattedPoints,
          total: simpleCount || 0,
          page,
          limit
        }, '操作成功')
      }
      
      return errorResponse('获取监控点列表失败', 500)
    }
    
    // 格式化返回数据，添加设备统计
    const formattedPoints = (points || []).map(point => ({
      ...point,
      deviceCount: point.devices?.length || 0,
      onlineDevices: point.devices?.filter((d: any) => d.status === 'online').length || 0,
      offlineDevices: point.devices?.filter((d: any) => d.status === 'offline').length || 0,
      // 不返回详细的devices数组以减少数据量
      devices: undefined
    }))
    
    return successResponse({
      data: formattedPoints,
      total: count || 0,
      page,
      limit
    }, '操作成功')
    
  } catch (error) {
    console.error('Get monitoring points error:', error)
    return errorResponse('获取监控点列表失败', 500)
  }
}

// POST - 创建新监控点
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
    
    // 只有管理员和主管可以创建监控点
    if (decoded.roleCode !== 'ADMIN' && decoded.roleCode !== 'MONITOR_MANAGER') {
      return errorResponse('无权限创建监控点', 403)
    }
    
    const body = await request.json()
    const {
      name,
      code,
      river_name,
      river_section,
      longitude,
      latitude,
      address,
      river_id,
      region,
      installation_height,
      monitoring_range,
      monitoring_angle,
      description
    } = body
    
    // 验证必填字段
    if (!name || !code || !longitude || !latitude) {
      return errorResponse('缺少必填字段', 400)
    }
    
    const supabase = createServiceClient()
    
    // 检查编码是否已存在
    const { data: existingPoint } = await supabase
      .from('monitoring_points')
      .select('id')
      .eq('code', code)
      .single()
    
    if (existingPoint) {
      return errorResponse('监控点编码已存在', 400)
    }
    
    // 生成监控点ID
    const { data: lastPoint } = await supabase
      .from('monitoring_points')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single()
    
    const lastId = lastPoint?.id || 'MP000000'
    const nextNumber = parseInt(lastId.substring(2)) + 1
    const pointId = `MP${nextNumber.toString().padStart(6, '0')}`
    
    // 创建监控点
    const { data: newPoint, error } = await supabase
      .from('monitoring_points')
      .insert({
        id: pointId,
        name,
        code,
        river_name,
        river_section,
        longitude,
        latitude,
        address,
        department_id: decoded.departmentId,
        river_id,
        region,
        gis_coordinates: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        installation_height,
        monitoring_range,
        monitoring_angle,
        description,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        rivers:river_id (
          id,
          name,
          code
        ),
        departments:department_id (
          id,
          name
        )
      `)
      .single()
    
    if (error) {
      console.error('Create monitoring point error:', error)
      return errorResponse('创建监控点失败', 500)
    }
    
    return successResponse({
      point: newPoint,
      message: '监控点创建成功'
    })
    
  } catch (error) {
    console.error('Create monitoring point error:', error)
    return errorResponse('创建监控点失败', 500)
  }
}