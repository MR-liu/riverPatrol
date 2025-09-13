/**
 * 单个区域管理API
 * 处理特定区域的详细操作
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { AREA_PERMISSIONS } from '@/lib/permissions/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// GET - 获取区域详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const supabase = createServiceClient()
    
    // 获取区域详情
    const { data: area, error } = await supabase
      .from('river_management_areas')
      .select(`
        *,
        supervisor:users!river_management_areas_supervisor_id_fkey(
          id,
          username,
          real_name,
          role_id,
          phone,
          email
        )
      `)
      .eq('id', params.id)
      .single()
    
    if (error || !area) {
      return errorResponse('区域不存在', 404)
    }
    
    // 检查权限：系统管理员或该区域的负责人可以查看
    if (decoded.roleCode !== 'ADMIN' && 
        decoded.roleCode !== 'MAINTENANCE_SUPERVISOR') {
      return errorResponse('无权限查看此区域', 403)
    }
    
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR' && 
        area.supervisor_id !== decoded.userId) {
      return errorResponse('无权限查看此区域', 403)
    }
    
    // 获取区域下的河道
    const { data: rivers } = await supabase
      .from('rivers')
      .select('*')
      .eq('area_id', params.id)
      .order('created_at', { ascending: false })
    
    // 获取区域下的团队成员
    const { data: teamMembers } = await supabase
      .from('area_team_members')
      .select(`
        *,
        member:users!area_team_members_user_id_fkey(
          id,
          username,
          real_name,
          role_id,
          phone,
          email,
          roles!users_role_id_fkey(
            id,
            code,
            name
          )
        )
      `)
      .eq('area_id', params.id)
      .eq('is_active', true)
    
    // 获取区域统计数据
    const { data: stats } = await supabase
      .from('area_statistics')
      .select('*')
      .eq('area_id', params.id)
      .order('date', { ascending: false })
      .limit(1)
      .single()
    
    // 获取设备信息
    let devices = []
    if (area.device_ids && area.device_ids.length > 0) {
      const { data: deviceData } = await supabase
        .from('devices')
        .select('*')
        .in('id', area.device_ids)
      
      devices = deviceData || []
    }
    
    // 获取监控点信息
    let monitoringPoints = []
    if (area.monitoring_point_ids && area.monitoring_point_ids.length > 0) {
      const { data: pointData } = await supabase
        .from('monitoring_points')
        .select('*')
        .in('id', area.monitoring_point_ids)
      
      monitoringPoints = pointData || []
    }
    
    return successResponse({
      area: {
        ...area,
        rivers: rivers || [],
        team_members: teamMembers || [],
        statistics: stats,
        devices,
        monitoring_points: monitoringPoints,
        river_count: rivers?.length || 0,
        team_member_count: teamMembers?.length || 0,
        device_count: devices.length,
        monitoring_point_count: monitoringPoints.length
      }
    })
  } catch (error) {
    console.error('Get area detail error:', error)
    return errorResponse('获取区域详情失败', 500)
  }
}

// PUT - 更新区域信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有系统管理员可以更新区域
    if (decoded.roleCode !== 'ADMIN') {
      return errorResponse('只有系统管理员可以更新区域', 403)
    }
    
    const body = await request.json()
    const supabase = createServiceClient()
    
    // 检查区域是否存在
    const { data: existingArea, error: checkError } = await supabase
      .from('river_management_areas')
      .select('id')
      .eq('id', params.id)
      .single()
    
    if (checkError || !existingArea) {
      return errorResponse('区域不存在', 404)
    }
    
    // 如果修改了编码，检查新编码是否已存在
    if (body.code) {
      const { data: codeCheck } = await supabase
        .from('river_management_areas')
        .select('id')
        .eq('code', body.code)
        .neq('id', params.id)
        .single()
      
      if (codeCheck) {
        return errorResponse('区域编码已存在', 400)
      }
    }
    
    // 准备更新数据
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    // 只更新提供的字段
    if (body.name !== undefined) updateData.name = body.name
    if (body.code !== undefined) updateData.code = body.code
    if (body.supervisor_id !== undefined) updateData.supervisor_id = body.supervisor_id
    if (body.area_type !== undefined) updateData.area_type = body.area_type
    if (body.risk_level !== undefined) updateData.risk_level = body.risk_level
    if (body.special_requirements !== undefined) updateData.special_requirements = body.special_requirements
    if (body.boundary_coordinates !== undefined) updateData.boundary_coordinates = body.boundary_coordinates
    if (body.center_coordinates !== undefined) updateData.center_coordinates = body.center_coordinates
    
    // 更新区域
    const { data: updatedArea, error: updateError } = await supabase
      .from('river_management_areas')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Update area error:', updateError)
      return errorResponse('更新区域失败', 500)
    }
    
    return successResponse({
      area: updatedArea
    }, '区域更新成功')
  } catch (error) {
    console.error('Update area error:', error)
    return errorResponse('更新区域失败', 500)
  }
}