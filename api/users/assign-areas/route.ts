/**
 * 用户区域分配 API
 * POST /api/users/assign-areas - 为用户分配管理区域
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

// POST - 分配用户管理区域
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
    
    // 只有管理员可以分配区域 - 支持多种角色代码格式
    if (!['ADMIN', 'admin', 'R001'].includes(decoded.roleCode) && 
        decoded.username !== 'admin') {
      return errorResponse('无权限执行此操作', 403)
    }
    
    const body = await request.json()
    const { user_id, area_ids } = body
    
    if (!user_id) {
      return errorResponse('用户ID不能为空', 400)
    }
    
    if (!Array.isArray(area_ids)) {
      return errorResponse('区域ID列表格式错误', 400)
    }
    
    const supabase = createServiceClient()
    let transferredWorkordersCount = 0
    
    // 验证用户存在且为可分配区域的角色
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, role_id')
      .eq('id', user_id)
      .single()
    
    if (userError || !user) {
      return errorResponse('用户不存在', 404)
    }
    
    // 支持的角色：R003(河道维护员), R004(河道巡检员), R006(维护员主管)
    if (!['R003', 'R004', 'R006'].includes(user.role_id)) {
      return errorResponse('只能为河道维护员、河道巡检员或维护员主管分配区域', 400)
    }
    
    // 验证所有区域ID都存在
    if (area_ids.length > 0) {
      const { data: areas, error: areasError } = await supabase
        .from('river_management_areas')
        .select('id')
        .in('id', area_ids)
      
      if (areasError || areas.length !== area_ids.length) {
        return errorResponse('部分区域不存在', 400)
      }
    }
    
    // 根据角色不同处理区域分配
    if (user.role_id === 'R006') {
      // 区域管理员：更新 river_management_areas.supervisor_id 并创建/更新团队
      
      // 删除用户现有的区域分配
      await supabase
        .from('river_management_areas')
        .update({ supervisor_id: null })
        .eq('supervisor_id', user_id)
      
      // 从团队成员表中删除该用户
      await supabase
        .from('team_members')
        .delete()
        .eq('user_id', user_id)
      
      // 为每个新区域分配管理员并创建团队
      for (const area_id of area_ids) {
        // 获取或创建该区域的团队
        const { data: area } = await supabase
          .from('river_management_areas')
          .select('id, name, code, maintenance_team_id')
          .eq('id', area_id)
          .single()
        
        if (!area) continue
        
        let team_id = area.maintenance_team_id
        
        // 如果区域没有团队，先尝试查找或创建
        if (!team_id) {
          // 先检查是否已存在该区域的团队
          const { data: existingTeam } = await supabase
            .from('maintenance_teams')
            .select('id')
            .eq('area_id', area_id)
            .single()
          
          if (existingTeam) {
            team_id = existingTeam.id
          } else {
            // 生成唯一的团队编码，使用时间戳和随机数确保唯一性
            const timestamp = Date.now().toString()
            const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
            const teamCode = `TEAM_${area.code}_${timestamp.slice(-6)}_${randomStr}`
            team_id = `MT${timestamp.slice(-8)}${randomStr}`
            
            const { error: createTeamError } = await supabase
            .from('maintenance_teams')
            .insert({
              id: team_id,
              name: `${area.name}维护团队`,
              code: teamCode,
              leader_id: user_id,
              area_id: area_id, // 直接使用 area_id 字段
              service_areas: [area_id], // 保留 service_areas 以备后用
              member_count: 1,
              status: 'active'
            })
          
            if (createTeamError) {
              console.error('创建团队失败:', createTeamError)
              continue // 跳过这个区域
            }
            
            // 更新区域的团队ID
            await supabase
              .from('river_management_areas')
              .update({ 
                maintenance_team_id: team_id,
                supervisor_id: user_id
              })
              .eq('id', area_id)
          }
        } else {
          // 更新现有团队的负责人
          await supabase
            .from('maintenance_teams')
            .update({ leader_id: user_id })
            .eq('id', team_id)
          
          // 更新区域的主管
          await supabase
            .from('river_management_areas')
            .update({ supervisor_id: user_id })
            .eq('id', area_id)
        }
        
        // 添加到团队成员表
        const memberId = `TM${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
        await supabase
          .from('team_members')
          .insert({
            id: memberId,
            team_id: team_id,
            user_id: user_id,
            position: '区域管理员',
            role_type: 'manager',
            is_leader: true,
            assigned_by: decoded.userId
          })
      }
    } else {
      // R003(河道维护员) 和 R004(河道巡检员)：使用 team_members 表
      
      // 先处理工单转移 - 将该用户未完成的工单转移给原区域主管
      const { data: currentAssignments } = await supabase
        .from('team_members')
        .select(`
          team_id,
          team:maintenance_teams!inner(
            id,
            area_id,
            area:river_management_areas!maintenance_teams_area_id_fkey(
              id,
              name,
              supervisor_id
            )
          )
        `)
        .eq('user_id', user_id)

      if (currentAssignments && currentAssignments.length > 0) {
        // 获取该用户未完成的工单
        const { data: pendingWorkorders } = await supabase
          .from('workorders')
          .select('id, title, area_id')
          .eq('assignee_id', user_id)
          .in('status', ['assigned', 'processing'])

        if (pendingWorkorders && pendingWorkorders.length > 0) {
          // 按区域分组工单
          const workordersByArea = pendingWorkorders.reduce((acc, wo) => {
            if (!acc[wo.area_id]) acc[wo.area_id] = []
            acc[wo.area_id].push(wo)
            return acc
          }, {} as Record<string, typeof pendingWorkorders>)

          // 为每个区域转移工单给对应的主管
          for (const assignment of currentAssignments) {
            const areaId = assignment.team?.area?.id
            const supervisorId = assignment.team?.area?.supervisor_id
            const areaWorkorders = workordersByArea[areaId] || []
            if (areaWorkorders.length > 0 && supervisorId) {
                // 先获取原描述
                for (const wo of areaWorkorders) {
                const newDescription = wo.description 
                  ? `${wo.description}\n\n[系统转移] 原处理人员区域调整，工单已转移给区域主管重新分配。`
                  : '[系统转移] 原处理人员区域调整，工单已转移给区域主管重新分配。'
                
                // 转移工单给区域主管
                const { error: transferError } = await supabase
                  .from('workorders')
                  .update({
                    assignee_id: supervisorId,
                    status: 'assigned',
                    assigned_at: new Date().toISOString(),
                    description: newDescription
                  })
                  .eq('id', wo.id)
                
                if (!transferError) {
                  transferredWorkordersCount++
                } else {
                  console.error('转移工单失败:', transferError)
                }
              }

              // 记录工单状态历史
              const historyRecords = areaWorkorders.map(wo => ({
                workorder_id: wo.id,
                status: 'assigned',
                changed_by: decoded.userId,
                changed_at: new Date().toISOString(),
                note: `工单因原处理人区域调整自动转移给区域主管 ${supervisorId}`
              }))

              await supabase
                .from('workorder_status_history')
                .insert(historyRecords)
            }
          }
        }
      }
      
      // 从团队成员表中删除该用户
      await supabase
        .from('team_members')
        .delete()
        .eq('user_id', user_id)
      
      // 分配新的区域 - 将用户添加到对应区域的团队
      if (area_ids.length > 0) {
        // 获取各个区域的团队信息
        const { data: areas } = await supabase
          .from('river_management_areas')
          .select('id, maintenance_team_id, name, code')
          .in('id', area_ids)
        
        for (const area of areas || []) {
          let team_id = area.maintenance_team_id
          
          // 如果区域没有团队，先尝试查找或创建
          if (!team_id) {
            // 先检查是否已存在该区域的团队
            const { data: existingTeam } = await supabase
              .from('maintenance_teams')
              .select('id')
              .eq('area_id', area.id)
              .single()
            
            if (existingTeam) {
              team_id = existingTeam.id
            } else {
              // 生成唯一的团队编码，使用时间戳和随机数确保唯一性
              const timestamp = Date.now().toString()
              const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
              const teamCode = `TEAM_${area.code}_${timestamp.slice(-6)}_${randomStr}`
              team_id = `MT${timestamp.slice(-8)}${randomStr}`
              
              const { error: createTeamError } = await supabase
              .from('maintenance_teams')
              .insert({
                id: team_id,
                name: `${area.name}维护团队`,
                code: teamCode,
                area_id: area.id, // 直接使用 area_id 字段
                service_areas: [area.id], // 保留 service_areas 以备后用
                member_count: 0,
                status: 'active'
              })
            
              if (createTeamError) {
                console.error('创建团队失败:', createTeamError)
                continue // 跳过这个区域
              }
              
              // 更新区域的团队ID
              await supabase
                .from('river_management_areas')
                .update({ maintenance_team_id: team_id })
                .eq('id', area.id)
            }
          }
          
          // 添加用户到团队成员表
          const memberId = `TM${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
          const { error: assignError } = await supabase
            .from('team_members')
            .insert({
              id: memberId,
              team_id: team_id,
              user_id: user_id,
              position: user.role_id === 'R003' ? '河道维护员' : '河道巡检员',
              role_type: user.role_id === 'R003' ? 'maintainer' : 'inspector',
              is_leader: false,
              specialties: user.role_id === 'R003' ? ['设备维护', '现场清理'] : ['日常巡查', '问题上报'],
              max_concurrent_orders: 3,
              current_workload: 0,
              is_available: true,
              is_emergency_responder: false,
              assigned_by: decoded.userId
            })
          
          if (assignError) {
            console.error('分配区域失败:', assignError)
            return errorResponse('分配区域失败', 500)
          }
        }
      }
    }
    
    // 记录操作日志
    await supabase.from('operation_logs').insert({
      user_id: decoded.userId,
      username: decoded.username,
      module: 'user_management',
      action: 'assign_areas',
      target_type: 'user',
      target_id: user_id,
      target_name: user.name,
      request_data: { area_ids },
      status: 'success',
      created_at: new Date().toISOString()
    })
    
    return successResponse({
      message: '区域分配成功',
      assigned_areas: area_ids.length,
      transferred_workorders: transferredWorkordersCount
    })
    
  } catch (error) {
    console.error('分配用户区域失败:', error)
    return errorResponse('分配用户区域失败', 500)
  }
}

// GET - 获取用户的区域分配
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
    
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')
    
    if (!userId) {
      return errorResponse('用户ID不能为空', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取用户角色
    const { data: user } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', userId)
      .single()
    
    if (!user) {
      return errorResponse('用户不存在', 404)
    }
    
    let areas = []
    
    if (user.role_id === 'R006') {
      // 区域管理员：从 river_management_areas.supervisor_id 获取
      const { data, error } = await supabase
        .from('river_management_areas')
        .select('id, name, code')
        .eq('supervisor_id', userId)
      
      if (error) {
        console.error('获取用户区域分配失败:', error)
        return errorResponse('获取用户区域分配失败', 500)
      }
      
      areas = data || []
    } else if (['R003', 'R004'].includes(user.role_id)) {
      // R003(河道维护员) 和 R004(河道巡检员)：从 team_members 表获取
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          team:maintenance_teams!inner(
            area:river_management_areas!maintenance_teams_area_id_fkey(
              id, 
              name, 
              code
            )
          )
        `)
        .eq('user_id', userId)
      
      if (error) {
        console.error('获取用户区域分配失败:', error)
        return errorResponse('获取用户区域分配失败', 500)
      }
      
      // 转换数据格式
      areas = (data || []).map(item => item.team?.area).filter(Boolean)
    }
    
    return successResponse({
      areas: areas
    })
    
  } catch (error) {
    console.error('获取用户区域分配失败:', error)
    return errorResponse('获取用户区域分配失败', 500)
  }
}