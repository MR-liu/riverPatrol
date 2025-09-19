/**
 * 维护团队管理 API
 * GET /api/maintenance-teams - 获取维护团队列表
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

// GET - 获取维护团队列表
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const supabase = createServiceClient()
    
    // 获取维护团队数据 - 包含区域信息和团队成员
    const { data: teams, error } = await supabase
      .from('maintenance_teams')
      .select(`
        *,
        leader:users!maintenance_teams_leader_id_fkey(
          id,
          name,
          username,
          role_id
        ),
        department:departments!maintenance_teams_department_id_fkey(
          id,
          name,
          code
        ),
        area:river_management_areas!maintenance_teams_area_id_fkey(
          id,
          name,
          code
        ),
        members:team_members(
          id,
          position,
          role_type,
          is_leader,
          user:users!team_members_user_id_fkey(
            id,
            name,
            username,
            role_id
          )
        )
      `)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Query maintenance teams error:', error)
      // 如果查询失败，尝试简单查询
      const { data: simpleTeams, error: simpleError } = await supabase
        .from('maintenance_teams')
        .select('*')
      
      if (simpleError) {
        console.error('Simple query error:', simpleError)
        return errorResponse('获取维护团队列表失败', 500)
      }
      
      return successResponse(simpleTeams || [], '获取维护团队列表成功（简化数据）')
    }
    
    // 计算每个团队的实际成员数
    const teamsWithCount = teams?.map(team => ({
      ...team,
      member_count: team.members?.length || 0
    }))
    
    return successResponse(teamsWithCount || [], '获取维护团队列表成功')
  } catch (error) {
    console.error('Get maintenance teams error:', error)
    return errorResponse('获取维护团队列表失败', 500)
  }
}