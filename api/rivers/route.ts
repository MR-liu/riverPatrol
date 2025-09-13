/**
 * 河道管理API
 * 处理河道的增删改查操作
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

// 河道创建验证模式
const createRiverSchema = z.object({
  name: z.string().min(1, '河道名称不能为空'),
  area_id: z.string().min(1, '请选择所属区域'),
  length_km: z.number().optional(),
  width_m: z.number().optional(),  // 平均宽度（米）
  start_coordinates: z.string().optional(), // 坐标字符串格式
  end_coordinates: z.string().optional(),   // 坐标字符串格式
  water_level_normal: z.number().optional(),  // 正常水位
  water_level_warning: z.number().optional(), // 警戒水位
  water_level_danger: z.number().optional(),  // 危险水位
  flow_direction: z.string().optional(),      // 流向
  maintenance_level: z.string().optional(),
  risk_assessment: z.string().optional(),     // 风险评估
  description: z.string().optional()
})

// GET - 获取河道列表
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get('area_id')
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('rivers')
      .select(`
        *,
        area:river_management_areas!rivers_area_id_fkey(
          id,
          name,
          code,
          supervisor_id
        )
      `)
      .order('created_at', { ascending: false })
    
    // 如果指定了区域ID，只返回该区域的河道
    if (areaId) {
      query = query.eq('area_id', areaId)
    }
    // 移除角色限制，允许所有登录用户查看河道列表（用于筛选）
    
    const { data: rivers, error } = await query
    
    if (error) {
      console.error('Query rivers error:', error)
      return errorResponse('获取河道列表失败', 500)
    }
    
    // 统计每条河道的摄像头数量
    const riversWithStats = await Promise.all(rivers.map(async (river) => {
      const { count: cameraCount } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('river_id', river.id)
        .eq('type_id', 'DT_001') // 假设DT_001是摄像头类型
      
      return {
        ...river,
        camera_count: cameraCount || 0
      }
    }))
    
    // 直接返回数组格式，与前端期望一致
    return successResponse(riversWithStats || [], '获取河道列表成功')
  } catch (error) {
    console.error('Get rivers error:', error)
    return errorResponse('获取河道列表失败', 500)
  }
}

// POST - 创建新河道
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const body = await request.json()
    
    // 验证输入
    const validationResult = createRiverSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const supabase = createServiceClient()
    
    // 检查区域是否存在
    const { data: area } = await supabase
      .from('river_management_areas')
      .select('id, supervisor_id')
      .eq('id', validationResult.data.area_id)
      .single()
    
    if (!area) {
      return errorResponse('指定的区域不存在', 404)
    }
    
    // 检查权限：系统管理员或该区域的负责人可以创建河道
    if (decoded.roleCode !== 'ADMIN') {
      if (decoded.roleCode !== 'MAINTENANCE_SUPERVISOR' || 
          area.supervisor_id !== decoded.userId) {
        return errorResponse('无权限在此区域创建河道', 403)
      }
    }
    
    // 生成河道ID和Code
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substr(2, 4)
    const riverId = `RIV${timestamp}${random}`.toUpperCase()
    const riverCode = `RV_${timestamp}${random}`.toUpperCase()
    
    // 处理坐标字段
    const riverData: any = {
      id: riverId,
      code: riverCode,  // 添加必需的code字段
      ...validationResult.data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // 如果提供了坐标字符串，解析为JSON格式
    if (riverData.start_coordinates) {
      try {
        const coords = riverData.start_coordinates.split(',').map((s: string) => s.trim())
        if (coords.length === 2) {
          riverData.start_coordinates = {
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1])
          }
        }
      } catch {
        // 保持原始格式
      }
    }
    
    if (riverData.end_coordinates) {
      try {
        const coords = riverData.end_coordinates.split(',').map((s: string) => s.trim())
        if (coords.length === 2) {
          riverData.end_coordinates = {
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1])
          }
        }
      } catch {
        // 保持原始格式
      }
    }
    
    const { data: newRiver, error } = await supabase
      .from('rivers')
      .insert(riverData)
      .select()
      .single()
    
    if (error) {
      console.error('Create river error:', error)
      return errorResponse('创建河道失败', 500)
    }
    
    return successResponse({
      river: newRiver,
      message: '河道创建成功'
    })
  } catch (error) {
    console.error('Create river error:', error)
    return errorResponse('创建河道失败', 500)
  }
}

// PUT - 更新河道信息
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return errorResponse('缺少河道ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取河道信息
    const { data: river } = await supabase
      .from('rivers')
      .select(`
        *,
        area:river_management_areas!rivers_area_id_fkey(
          id,
          supervisor_id
        )
      `)
      .eq('id', id)
      .single()
    
    if (!river) {
      return errorResponse('河道不存在', 404)
    }
    
    // 检查权限
    if (decoded.roleCode !== 'ADMIN') {
      if (decoded.roleCode !== 'MAINTENANCE_SUPERVISOR' || 
          river.area?.supervisor_id !== decoded.userId) {
        return errorResponse('无权限更新此河道', 403)
      }
    }
    
    // 更新河道信息
    const { data: updatedRiver, error } = await supabase
      .from('rivers')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Update river error:', error)
      return errorResponse('更新河道失败', 500)
    }
    
    return successResponse({
      river: updatedRiver,
      message: '河道更新成功'
    })
  } catch (error) {
    console.error('Update river error:', error)
    return errorResponse('更新河道失败', 500)
  }
}

// DELETE - 删除河道
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return errorResponse('缺少河道ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取河道信息
    const { data: river } = await supabase
      .from('rivers')
      .select(`
        *,
        area:river_management_areas!rivers_area_id_fkey(
          id,
          supervisor_id
        )
      `)
      .eq('id', id)
      .single()
    
    if (!river) {
      return errorResponse('河道不存在', 404)
    }
    
    // 检查权限
    if (decoded.roleCode !== 'ADMIN') {
      if (decoded.roleCode !== 'MAINTENANCE_SUPERVISOR' || 
          river.area?.supervisor_id !== decoded.userId) {
        return errorResponse('无权限删除此河道', 403)
      }
    }
    
    // 删除河道
    const { error } = await supabase
      .from('rivers')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Delete river error:', error)
      return errorResponse('删除河道失败', 500)
    }
    
    return successResponse({
      message: '河道删除成功'
    })
  } catch (error) {
    console.error('Delete river error:', error)
    return errorResponse('删除河道失败', 500)
  }
}