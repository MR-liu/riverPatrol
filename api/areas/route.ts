/**
 * 区域管理API
 * 处理区域的增删改查操作
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { z } from 'zod'
import { AREA_PERMISSIONS } from '@/lib/permissions/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// 区域创建验证模式
const createAreaSchema = z.object({
  name: z.string().min(1, '区域名称不能为空'),
  code: z.string().min(1, '区域编码不能为空'),
  supervisor_id: z.string().optional(),
  monitoring_point_ids: z.array(z.string()).optional(),
  device_ids: z.array(z.string()).optional(),
  boundary_coordinates: z.any().optional(),
  center_coordinates: z.any().optional(),
  area_type: z.string().optional(),
  risk_level: z.string().optional(),
  maintenance_schedule: z.any().optional(),
  special_requirements: z.string().optional()
})

// 权限检查辅助函数
async function checkPermission(token: string, permission: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const supabase = createServiceClient()
    
    // 获取用户的权限
    const { data: userPermissions } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', decoded.roleId)
    
    if (!userPermissions) return false
    
    // 获取权限代码
    const permissionIds = userPermissions.map(p => p.permission_id)
    const { data: permissions } = await supabase
      .from('permissions')
      .select('code')
      .in('id', permissionIds)
    
    return permissions?.some(p => p.code === permission) || false
  } catch {
    return false
  }
}

// GET - 获取区域列表
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const supabase = createServiceClient()
    
    // 对于查看区域列表，所有登录用户都可以（用于筛选功能）
    // 只有在编辑时才需要特定权限
    
    // 查询区域数据
    let query = supabase
      .from('river_management_areas')
      .select(`
        *,
        supervisor:users!river_management_areas_supervisor_id_fkey(
          id,
          username,
          name,
          role_id
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    // 移除角色限制，允许所有用户查看所有区域（用于筛选）
    
    const { data: areas, error } = await query
    
    if (error) {
      console.error('Query areas error:', error)
      return errorResponse('获取区域列表失败', 500)
    }
    
    // 统计每个区域的河道和设备数量
    const areasWithStats = await Promise.all(areas.map(async (area) => {
      // 获取河道数量
      const { count: riverCount } = await supabase
        .from('rivers')
        .select('*', { count: 'exact', head: true })
        .eq('area_id', area.id)
      
      // 获取设备数量（通过device_ids）
      const deviceCount = area.device_ids?.length || 0
      
      return {
        ...area,
        river_count: riverCount || 0,
        device_count: deviceCount,
        manager_name: area.supervisor?.name || '未分配'
      }
    }))
    
    // 直接返回数组格式，与前端期望一致
    return successResponse(areasWithStats || [], '获取区域列表成功')
  } catch (error) {
    console.error('Get areas error:', error)
    return errorResponse('获取区域列表失败', 500)
  }
}

// POST - 创建新区域
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有系统管理员可以创建区域
    if (decoded.roleCode !== 'ADMIN') {
      return errorResponse('只有系统管理员可以创建区域', 403)
    }
    
    const body = await request.json()
    
    // 验证输入
    const validationResult = createAreaSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const supabase = createServiceClient()
    
    // 检查区域编码是否已存在
    const { data: existingArea } = await supabase
      .from('river_management_areas')
      .select('id')
      .eq('code', validationResult.data.code)
      .single()
    
    if (existingArea) {
      return errorResponse('区域编码已存在', 400)
    }
    
    // 生成区域ID（限制在20个字符内）
    const timestamp = Date.now().toString().slice(-6) // 取时间戳后6位
    const random = Math.random().toString(36).substr(2, 4) // 4位随机字符
    const areaId = `AREA${timestamp}${random}`.toUpperCase() // 总长度：4+6+4=14个字符
    
    // 创建区域
    const areaData = {
      id: areaId,
      ...validationResult.data,
      monitoring_point_ids: validationResult.data.monitoring_point_ids || [],
      device_ids: validationResult.data.device_ids || [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: newArea, error } = await supabase
      .from('river_management_areas')
      .insert(areaData)
      .select()
      .single()
    
    if (error) {
      console.error('Create area error:', error)
      return errorResponse('创建区域失败', 500)
    }
    
    // 如果指定了负责人，更新用户的管辖区域
    if (validationResult.data.supervisor_id) {
      // 获取负责人当前的管辖区域
      const { data: supervisor } = await supabase
        .from('users')
        .select('managed_areas')
        .eq('id', validationResult.data.supervisor_id)
        .single()
      
      if (supervisor) {
        const managedAreas = supervisor.managed_areas || []
        managedAreas.push(newArea.id)
        
        await supabase
          .from('users')
          .update({ 
            managed_areas: managedAreas,
            updated_at: new Date().toISOString()
          })
          .eq('id', validationResult.data.supervisor_id)
      }
    }
    
    return successResponse({
      area: newArea,
      message: '区域创建成功'
    })
  } catch (error) {
    console.error('Create area error:', error)
    return errorResponse('创建区域失败', 500)
  }
}

// PUT - 更新区域信息
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return errorResponse('缺少区域ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 检查权限：系统管理员可以更新任何区域，区域管理员只能更新自己的区域
    if (decoded.roleCode === 'MAINTENANCE_SUPERVISOR') {
      const { data: area } = await supabase
        .from('river_management_areas')
        .select('supervisor_id')
        .eq('id', id)
        .single()
      
      if (!area || area.supervisor_id !== decoded.userId) {
        return errorResponse('无权限更新此区域', 403)
      }
    } else if (decoded.roleCode !== 'ADMIN') {
      return errorResponse('无权限更新区域', 403)
    }
    
    // 如果更新了负责人，需要更新相关用户的managed_areas
    if (updateData.supervisor_id) {
      // 获取原负责人
      const { data: oldArea } = await supabase
        .from('river_management_areas')
        .select('supervisor_id')
        .eq('id', id)
        .single()
      
      if (oldArea && oldArea.supervisor_id !== updateData.supervisor_id) {
        // 从原负责人的managed_areas中移除
        if (oldArea.supervisor_id) {
          const { data: oldSupervisor } = await supabase
            .from('users')
            .select('managed_areas')
            .eq('id', oldArea.supervisor_id)
            .single()
          
          if (oldSupervisor) {
            const managedAreas = (oldSupervisor.managed_areas || [])
              .filter((areaId: string) => areaId !== id)
            
            await supabase
              .from('users')
              .update({ managed_areas: managedAreas })
              .eq('id', oldArea.supervisor_id)
          }
        }
        
        // 添加到新负责人的managed_areas
        const { data: newSupervisor } = await supabase
          .from('users')
          .select('managed_areas')
          .eq('id', updateData.supervisor_id)
          .single()
        
        if (newSupervisor) {
          const managedAreas = newSupervisor.managed_areas || []
          if (!managedAreas.includes(id)) {
            managedAreas.push(id)
            
            await supabase
              .from('users')
              .update({ managed_areas: managedAreas })
              .eq('id', updateData.supervisor_id)
          }
        }
      }
    }
    
    // 更新区域信息
    const { data: updatedArea, error } = await supabase
      .from('river_management_areas')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Update area error:', error)
      return errorResponse('更新区域失败', 500)
    }
    
    return successResponse({
      area: updatedArea,
      message: '区域更新成功'
    })
  } catch (error) {
    console.error('Update area error:', error)
    return errorResponse('更新区域失败', 500)
  }
}

// DELETE - 删除区域
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // 只有系统管理员可以删除区域
    if (decoded.roleCode !== 'ADMIN') {
      return errorResponse('只有系统管理员可以删除区域', 403)
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return errorResponse('缺少区域ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取区域信息
    const { data: area } = await supabase
      .from('river_management_areas')
      .select('supervisor_id')
      .eq('id', id)
      .single()
    
    if (!area) {
      return errorResponse('区域不存在', 404)
    }
    
    // 软删除：设置is_active为false
    const { error } = await supabase
      .from('river_management_areas')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (error) {
      console.error('Delete area error:', error)
      return errorResponse('删除区域失败', 500)
    }
    
    // 从负责人的managed_areas中移除
    if (area.supervisor_id) {
      const { data: supervisor } = await supabase
        .from('users')
        .select('managed_areas')
        .eq('id', area.supervisor_id)
        .single()
      
      if (supervisor) {
        const managedAreas = (supervisor.managed_areas || [])
          .filter((areaId: string) => areaId !== id)
        
        await supabase
          .from('users')
          .update({ managed_areas: managedAreas })
          .eq('id', area.supervisor_id)
      }
    }
    
    return successResponse({
      message: '区域删除成功'
    })
  } catch (error) {
    console.error('Delete area error:', error)
    return errorResponse('删除区域失败', 500)
  }
}