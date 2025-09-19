/**
 * 获取指定区域的维护人员
 * 基于数据库真实数据，不使用任何模拟数据
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

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    // 验证JWT token
    try {
      jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的认证令牌', 401)
    }

    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const areaId = searchParams.get('area_id')
    
    if (!areaId) {
      return successResponse([], '未指定区域ID')
    }

    // 策略1: 从maintenance_teams表获取服务该区域的团队成员
    // 查找service_areas包含指定区域的团队
    const { data: teams, error: teamsError } = await supabase
      .from('maintenance_teams')
      .select('id, name, leader_id, member_count, service_areas')
      .eq('status', 'active')

    if (teamsError) {
      console.error('查询维护团队失败:', teamsError)
    }

    // 收集所有团队负责人ID（团队负责人通常也是维护人员）
    const teamLeaderIds: string[] = []
    
    if (teams && teams.length > 0) {
      teams.forEach(team => {
        // 检查service_areas是否包含目标区域
        if (team.service_areas && Array.isArray(team.service_areas)) {
          if (team.service_areas.includes(areaId)) {
            if (team.leader_id) {
              teamLeaderIds.push(team.leader_id)
            }
          }
        }
      })
    }

    // 策略2: 查找属于特定部门的维护人员
    // 根据区域查找对应的河道管理区域，获取责任部门
    const { data: areaData, error: areaError } = await supabase
      .from('river_management_areas')
      .select('responsible_dept_id')
      .eq('id', areaId)
      .single()

    let departmentId: string | null = null
    if (!areaError && areaData) {
      departmentId = areaData.responsible_dept_id
    }

    // 策略3: 直接查询角色为维护作业员(R003)的用户
    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        name,
        phone,
        email,
        status,
        department_id,
        departments!inner(
          id,
          name,
          code,
          region
        ),
        roles!inner(
          id,
          name,
          code,
          role_code
        )
      `)
      .eq('status', 'active')
      .in('roles.role_code', ['R003', 'MAINTENANCE_WORKER', 'MAINTAINER'])

    // 如果找到了负责部门，优先返回该部门的维护人员
    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }

    const { data: maintenanceWorkers, error: workersError } = await query

    if (workersError) {
      console.error('查询维护人员失败:', workersError)
      return successResponse([], '查询维护人员失败')
    }

    // 合并结果，去重
    const allWorkerIds = new Set<string>([...teamLeaderIds])
    const workers: any[] = []

    // 如果通过团队找到了负责人，获取其详细信息
    if (teamLeaderIds.length > 0) {
      const { data: teamLeaders } = await supabase
        .from('users')
        .select(`
          id,
          username,
          name,
          phone,
          email,
          status,
          department_id
        `)
        .in('id', teamLeaderIds)
        .eq('status', 'active')

      if (teamLeaders) {
        teamLeaders.forEach(leader => {
          if (!allWorkerIds.has(leader.id)) {
            allWorkerIds.add(leader.id)
            workers.push({
              ...leader,
              area_ids: [areaId],
              source: 'team_leader'
            })
          }
        })
      }
    }

    // 添加部门维护人员
    if (maintenanceWorkers && maintenanceWorkers.length > 0) {
      maintenanceWorkers.forEach(worker => {
        if (!allWorkerIds.has(worker.id)) {
          allWorkerIds.add(worker.id)
          workers.push({
            ...worker,
            area_ids: [areaId],
            source: 'department'
          })
        }
      })
    }

    // 如果还是没有找到维护人员，返回所有R003角色的用户作为备选
    if (workers.length === 0) {
      const { data: allMaintenanceWorkers } = await supabase
        .from('users')
        .select(`
          id,
          username,
          name,
          phone,
          email,
          status,
          department_id,
          roles!inner(
            id,
            name,
            code,
            role_code
          )
        `)
        .eq('status', 'active')
        .in('roles.role_code', ['R003', 'MAINTENANCE_WORKER', 'MAINTAINER'])

      if (allMaintenanceWorkers && allMaintenanceWorkers.length > 0) {
        allMaintenanceWorkers.forEach(worker => {
          workers.push({
            ...worker,
            area_ids: [],
            source: 'all_workers',
            note: '该区域暂无专属维护人员，显示所有可用维护人员'
          })
        })
      }
    }

    return successResponse({
      workers,
      total: workers.length,
      area_id: areaId
    }, '获取区域维护人员成功')
  } catch (error) {
    console.error('获取区域维护人员失败:', error)
    return errorResponse('获取区域维护人员失败', 500)
  }
}