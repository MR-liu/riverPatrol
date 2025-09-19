/**
 * 设备管理API（主要是摄像头）
 * 处理设备的增删改查操作
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

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// 设备创建验证模式
const createDeviceSchema = z.object({
  name: z.string().min(1, '设备名称不能为空'),
  type_id: z.string().min(1, '请选择设备类型'),
  river_id: z.string().min(1, '请选择所属河道'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  ip_address: z.string().regex(/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/, 'IP地址格式不正确').optional().or(z.literal('')),
  port: z.number().optional(),
  rtsp_url: z.string().optional(),
  gis_coordinates: z.any().optional(), // 坐标可以是字符串或对象
  altitude: z.number().optional(),
  azimuth: z.number().optional(),
  tilt_angle: z.number().optional(),
  zoom_level: z.number().optional(),
  ptz_support: z.boolean().optional(),
  night_vision: z.boolean().optional(),
  network_config: z.any().optional(),
  stream_urls: z.any().optional(),
  install_date: z.string().optional(),
  warranty_date: z.string().optional()
  // devices表中没有description字段
})

// GET - 获取设备列表
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const { searchParams } = new URL(request.url)
    const riverId = searchParams.get('river_id')
    const areaId = searchParams.get('area_id')
    const typeId = searchParams.get('type_id')
    const status = searchParams.get('status')
    
    const supabase = createServiceClient()
    
    // 构建查询 - 修正monitoring_points关联
    let query = supabase
      .from('devices')
      .select(`
        *,
        type:device_types(
          id,
          name,
          code,
          category
        ),
        point:monitoring_points!devices_point_id_fkey(
          id,
          name,
          river_id,
          longitude,
          latitude,
          gis_coordinates,
          river:rivers(
            id,
            name,
            area:river_management_areas!fk_rivers_area(
              id,
              name,
              code
            )
          )
        )
      `)
      .order('created_at', { ascending: false })
    
    // 暂时获取所有设备，稍后按river_id过滤
    // 因为监控点查询有问题，我们先获取所有设备，然后在结果中过滤
    
    // 按区域筛选
    if (areaId) {
      // 先获取区域下的所有河道
      const { data: rivers } = await supabase
        .from('rivers')
        .select('id')
        .eq('area_id', areaId)
      
      if (rivers && rivers.length > 0) {
        const riverIds = rivers.map(r => r.id)
        // 获取这些河道的所有监控点
        const { data: points } = await supabase
          .from('monitoring_points')
          .select('id')
          .in('river_id', riverIds)
        
        if (points && points.length > 0) {
          const pointIds = points.map(p => p.id)
          query = query.in('point_id', pointIds)
        }
      }
    }
    
    // 按设备类型筛选
    if (typeId) {
      query = query.eq('type_id', typeId)
    }
    
    // 按状态筛选
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: devices, error } = await query
    
    if (error) {
      console.error('Query devices error:', error)
      // 如果是表不存在的错误，返回空数组而不是错误
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.log('Devices table not found in database, returning empty array')
        return successResponse({
          devices: [],
          stats: {
            total: 0,
            online: 0,
            offline: 0,
            fault: 0,
            maintenance: 0
          },
          total: 0
        })
      }
      return errorResponse('获取设备列表失败', 500)
    }
    
    // 使用真实数据
    let devicesData = devices || []
    
    // 如果指定了river_id，在内存中过滤设备
    if (riverId && devicesData.length > 0) {
      devicesData = devicesData.filter(device => device.point?.river_id === riverId)
    }
    
    // 如果没有数据，记录日志
    if (devicesData.length === 0) {
      console.log('No devices found in database')
    }
    
    // 统计信息
    const stats = {
      total: devicesData.length,
      online: devicesData.filter(d => d.status === 'online').length,
      offline: devicesData.filter(d => d.status === 'offline').length,
      fault: devicesData.filter(d => d.status === 'fault').length,
      maintenance: devicesData.filter(d => d.status === 'maintenance').length
    }
    
    console.log(`Returning ${devicesData.length} devices from database`)
    
    return successResponse({
      devices: devicesData,
      stats,
      total: devicesData.length
    })
  } catch (error) {
    console.error('Get devices error:', error)
    return errorResponse('获取设备列表失败', 500)
  }
}

// POST - 创建新设备
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
    const validationResult = createDeviceSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const supabase = createServiceClient()
    
    // 检查河道是否存在
    const { data: river } = await supabase
      .from('rivers')
      .select('id, area_id')
      .eq('id', validationResult.data.river_id)
      .single()
    
    if (!river) {
      return errorResponse('指定的河道不存在', 404)
    }
    
    // 检查权限：系统管理员或设备管理权限
    // 支持多种管理员角色代码格式
    const adminRoles = ['ADMIN', 'admin', 'R001']
    if (!adminRoles.includes(decoded.roleCode) && !adminRoles.includes(decoded.roleId)) {
      // TODO: 检查具体的设备管理权限
      const hasPermission = await checkDeviceManagePermission(decoded.userId, river.area_id)
      if (!hasPermission) {
        return errorResponse('无权限在此河道添加设备', 403)
      }
    }
    
    // 生成设备ID和编码
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substr(2, 4)
    const deviceId = `DEV${timestamp}${random}`.toUpperCase()
    const deviceCode = `CAM_${timestamp}${random}`.toUpperCase()
    
    // 先创建或获取监控点
    let pointId = body.point_id
    if (!pointId) {
      // 如果没有指定监控点，创建新的监控点
      const pointData: any = {
        id: `MP_${timestamp}${random}`.toUpperCase(),
        code: `MP_${timestamp}${random}`.toUpperCase(), // 添加必需的code字段
        name: `${validationResult.data.name}_监控点`,
        river_id: validationResult.data.river_id,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      // 处理坐标 - 设置默认值或从输入解析
      let longitude = 121.4737 // 默认经度（上海）
      let latitude = 31.2304   // 默认纬度（上海）
      
      if (body.gis_coordinates) {
        if (typeof body.gis_coordinates === 'string') {
          try {
            const coords = body.gis_coordinates.split(',').map((s: string) => s.trim())
            if (coords.length === 2) {
              const parsedLng = parseFloat(coords[0])
              const parsedLat = parseFloat(coords[1])
              if (!isNaN(parsedLng) && !isNaN(parsedLat)) {
                longitude = parsedLng
                latitude = parsedLat
              }
            }
          } catch {
            // 使用默认值
          }
        } else if (typeof body.gis_coordinates === 'object' && body.gis_coordinates.longitude && body.gis_coordinates.latitude) {
          const parsedLng = parseFloat(body.gis_coordinates.longitude)
          const parsedLat = parseFloat(body.gis_coordinates.latitude)
          if (!isNaN(parsedLng) && !isNaN(parsedLat)) {
            longitude = parsedLng
            latitude = parsedLat
          }
        }
      }
      
      // 设置坐标字段（这些是必需的）
      pointData.longitude = longitude
      pointData.latitude = latitude
      pointData.gis_coordinates = {
        longitude: longitude,
        latitude: latitude
      }
      
      const { data: newPoint, error: pointError } = await supabase
        .from('monitoring_points')
        .insert(pointData)
        .select()
        .single()
      
      if (pointError) {
        console.error('Create monitoring point error:', pointError)
        return errorResponse('创建监控点失败', 500)
      }
      
      pointId = newPoint.id
    }
    
    // 处理设备数据
    const deviceData: any = {
      id: deviceId,
      code: deviceCode,
      ...validationResult.data,
      point_id: pointId,
      status: 'offline', // 新设备默认离线状态
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // 处理坐标字段
    if (deviceData.gis_coordinates && typeof deviceData.gis_coordinates === 'string') {
      try {
        const coords = deviceData.gis_coordinates.split(',').map((s: string) => s.trim())
        if (coords.length === 2) {
          deviceData.gis_coordinates = {
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1])
          }
        }
      } catch {
        // 保持原始格式
      }
    }
    
    // 移除不需要的字段
    delete deviceData.river_id
    
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert(deviceData)
      .select()
      .single()
    
    if (error) {
      console.error('Create device error:', error)
      return errorResponse('创建设备失败', 500)
    }
    
    return successResponse({
      device: newDevice,
      message: '设备创建成功'
    })
  } catch (error) {
    console.error('Create device error:', error)
    return errorResponse('创建设备失败', 500)
  }
}

// PUT - 更新设备信息
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
      return errorResponse('缺少设备ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取设备信息
    const { data: device } = await supabase
      .from('devices')
      .select(`
        *,
        point:monitoring_points!devices_point_id_fkey(
          id,
          river_id,
          river:rivers(
            id,
            area_id
          )
        )
      `)
      .eq('id', id)
      .single()
    
    if (!device) {
      return errorResponse('设备不存在', 404)
    }
    
    // 检查权限
    const adminRoles = ['ADMIN', 'admin', 'R001']
    if (!adminRoles.includes(decoded.roleCode) && !adminRoles.includes(decoded.roleId)) {
      const hasPermission = await checkDeviceManagePermission(
        decoded.userId, 
        device.point?.river?.area_id
      )
      if (!hasPermission) {
        return errorResponse('无权限更新此设备', 403)
      }
    }
    
    // 处理坐标字段
    if (updateData.gis_coordinates && typeof updateData.gis_coordinates === 'string') {
      try {
        const coords = updateData.gis_coordinates.split(',').map((s: string) => s.trim())
        if (coords.length === 2) {
          updateData.gis_coordinates = {
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1])
          }
        }
      } catch {
        // 保持原始格式
      }
    }
    
    // 更新设备信息
    const { data: updatedDevice, error } = await supabase
      .from('devices')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Update device error:', error)
      return errorResponse('更新设备失败', 500)
    }
    
    return successResponse({
      device: updatedDevice,
      message: '设备更新成功'
    })
  } catch (error) {
    console.error('Update device error:', error)
    return errorResponse('更新设备失败', 500)
  }
}

// DELETE - 删除设备
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
      return errorResponse('缺少设备ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取设备信息
    const { data: device } = await supabase
      .from('devices')
      .select(`
        *,
        point:monitoring_points!devices_point_id_fkey(
          id,
          river_id,
          river:rivers(
            id,
            area_id
          )
        )
      `)
      .eq('id', id)
      .single()
    
    if (!device) {
      return errorResponse('设备不存在', 404)
    }
    
    // 检查权限：只有管理员可以删除设备
    if (decoded.roleCode !== 'R001') {
      return errorResponse('只有管理员可以删除设备', 403)
    }
    
    // 检查是否有关联的告警
    const { count: alarmCount } = await supabase
      .from('alarms')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', id)
    
    if (alarmCount && alarmCount > 0) {
      return errorResponse('该设备有关联的告警记录，无法删除', 400)
    }
    
    // 删除设备
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Delete device error:', error)
      return errorResponse('删除设备失败', 500)
    }
    
    return successResponse({
      message: '设备删除成功'
    })
  } catch (error) {
    console.error('Delete device error:', error)
    return errorResponse('删除设备失败', 500)
  }
}

// 检查设备管理权限
async function checkDeviceManagePermission(userId: string, areaId: string): Promise<boolean> {
  // TODO: 实现具体的权限检查逻辑
  // 检查用户是否有 device_management.* 权限
  // 或者是否是该区域的负责人
  const supabase = createServiceClient()
  
  // 检查是否是区域负责人
  const { data: area } = await supabase
    .from('river_management_areas')
    .select('supervisor_id')
    .eq('id', areaId)
    .single()
  
  if (area && area.supervisor_id === userId) {
    return true
  }
  
  // 检查是否有设备管理权限
  const { data: permissions } = await supabase
    .from('user_permissions_view')
    .select('permission_code')
    .eq('user_id', userId)
    .like('permission_code', 'device_management.%')
  
  return permissions && permissions.length > 0
}