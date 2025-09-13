/**
 * 区域管理API (R006专用)
 * GET /api/app-area-management - 获取管理区域信息
 * PUT /api/app-area-management - 更新区域信息
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
 * 获取区域管理信息 (R006专用)
 * GET /api/app-area-management
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
    
    // 只有R006区域管理员可以访问
    if (roleId !== 'R006') {
      return errorResponse('无权限访问', 403)
    }

    const supabase = createServiceClient()
    
    // 查询用户管理的区域信息
    const { data: areas, error: areasError } = await supabase
      .from('river_management_areas')
      .select(`
        *,
        rivers:rivers(
          id,
          name,
          code,
          river_type,
          length_km,
          width_m,
          water_level_normal,
          water_level_warning,
          water_level_danger,
          is_active
        ),
        team_members:maintenance_teams(
          id,
          worker_id,
          position,
          specialties,
          max_concurrent_orders,
          current_workload,
          is_available,
          is_emergency_responder,
          performance_score,
          worker:users!maintenance_teams_worker_id_fkey(id, name, username, phone)
        )
      `)
      .eq('supervisor_id', userId)
      .eq('is_active', true)

    if (areasError) {
      console.error('查询区域信息失败:', areasError)
      return errorResponse('查询区域信息失败', 500)
    }

    if (!areas || areas.length === 0) {
      return errorResponse('未找到管理的区域', 404)
    }

    // 统计区域内的设备和工单信息
    const areaIds = areas.map(area => area.id)
    
    // 查询区域内的设备统计
    const { data: deviceStats } = await supabase
      .from('devices')
      .select('area_id, status')
      .in('area_id', areaIds)
    
    // 查询区域内的工单统计
    const { data: workorderStats } = await supabase
      .from('workorders')
      .select('area_id, status')
      .in('area_id', areaIds)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // 最近30天
    
    // 聚合统计数据
    const enrichedAreas = areas.map(area => {
      // 设备统计
      const areaDevices = (deviceStats || []).filter(d => d.area_id === area.id)
      const deviceSummary = {
        total: areaDevices.length,
        online: areaDevices.filter(d => d.status === 'online').length,
        offline: areaDevices.filter(d => d.status === 'offline').length,
        fault: areaDevices.filter(d => d.status === 'fault').length
      }

      // 工单统计
      const areaWorkorders = (workorderStats || []).filter(w => w.area_id === area.id)
      const workorderSummary = {
        total: areaWorkorders.length,
        pending: areaWorkorders.filter(w => w.status === 'pending' || w.status === 'pending_dispatch').length,
        processing: areaWorkorders.filter(w => w.status === 'dispatched' || w.status === 'processing').length,
        pending_review: areaWorkorders.filter(w => w.status === 'pending_review').length,
        completed: areaWorkorders.filter(w => w.status === 'completed').length
      }

      // 团队统计
      const teamSummary = {
        total_members: area.team_members?.length || 0,
        available_members: area.team_members?.filter(m => m.is_available).length || 0,
        emergency_responders: area.team_members?.filter(m => m.is_emergency_responder).length || 0,
        current_total_workload: area.team_members?.reduce((sum, m) => sum + (m.current_workload || 0), 0) || 0,
        max_total_capacity: area.team_members?.reduce((sum, m) => sum + (m.max_concurrent_orders || 0), 0) || 0
      }

      return {
        ...area,
        device_summary: deviceSummary,
        workorder_summary: workorderSummary,
        team_summary: teamSummary,
        utilization_rate: teamSummary.max_total_capacity > 0 
          ? Math.round((teamSummary.current_total_workload / teamSummary.max_total_capacity) * 100) 
          : 0
      }
    })

    return successResponse({
      areas: enrichedAreas,
      total_areas: enrichedAreas.length,
      summary: {
        total_devices: enrichedAreas.reduce((sum, area) => sum + area.device_summary.total, 0),
        online_devices: enrichedAreas.reduce((sum, area) => sum + area.device_summary.online, 0),
        total_workorders: enrichedAreas.reduce((sum, area) => sum + area.workorder_summary.total, 0),
        pending_workorders: enrichedAreas.reduce((sum, area) => sum + area.workorder_summary.pending, 0),
        total_members: enrichedAreas.reduce((sum, area) => sum + area.team_summary.total_members, 0),
        available_members: enrichedAreas.reduce((sum, area) => sum + area.team_summary.available_members, 0)
      }
    }, '获取区域管理信息成功')

  } catch (error) {
    console.error('[app-area-management] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}