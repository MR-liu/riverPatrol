/**
 * 种子数据 API - 设备数据
 * POST /api/seed/devices
 * 用于初始化设备相关的测试数据
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
    
    // 只有管理员可以执行种子数据
    if (decoded.roleCode !== 'ADMIN') {
      return errorResponse('只有管理员可以执行此操作', 403)
    }
    
    const supabase = createServiceClient()
    
    // 插入设备类型数据
    const deviceTypes = [
      { id: 'DT_001', name: '摄像头', code: 'camera', category: 'monitoring', heartbeat_interval: 60, description: '监控摄像头设备', status: 'active' },
      { id: 'DT_002', name: '水质监测仪', code: 'water_quality', category: 'sensor', heartbeat_interval: 300, description: '水质监测传感器', status: 'active' },
      { id: 'DT_003', name: '水位计', code: 'water_level', category: 'sensor', heartbeat_interval: 300, description: '水位监测传感器', status: 'active' }
    ]
    
    for (const type of deviceTypes) {
      await supabase.from('device_types').upsert({
        ...type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // 插入监控点数据
    const monitoringPoints = [
      { id: 'MP001', name: '张家浜1号监控点', code: 'MP_ZJB_001', river_name: '张家浜', river_section: '上游段', longitude: 121.5234, latitude: 31.2456, address: '浦东新区张家浜路1号', status: 'active' },
      { id: 'MP002', name: '张家浜2号监控点', code: 'MP_ZJB_002', river_name: '张家浜', river_section: '中游段', longitude: 121.5345, latitude: 31.2567, address: '浦东新区张家浜路2号', status: 'active' },
      { id: 'MP003', name: '张家浜3号监控点', code: 'MP_ZJB_003', river_name: '张家浜', river_section: '下游段', longitude: 121.5456, latitude: 31.2678, address: '浦东新区张家浜路3号', status: 'active' },
      { id: 'MP004', name: '川杨河1号监控点', code: 'MP_CYH_001', river_name: '川杨河', river_section: '上游段', longitude: 121.5567, latitude: 31.2789, address: '浦东新区川杨河路1号', status: 'active' },
      { id: 'MP005', name: '川杨河2号监控点', code: 'MP_CYH_002', river_name: '川杨河', river_section: '中游段', longitude: 121.5678, latitude: 31.2890, address: '浦东新区川杨河路2号', status: 'active' }
    ]
    
    for (const point of monitoringPoints) {
      await supabase.from('monitoring_points').upsert({
        ...point,
        gis_coordinates: {
          type: 'Point',
          coordinates: [point.longitude, point.latitude]
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // 插入设备数据
    const devices = [
      {
        id: 'DEV001',
        name: '张家浜1号监控',
        code: 'CAM_ZJB_001',
        type_id: 'DT_001',
        point_id: 'MP001',
        brand: '海康威视',
        model: 'DS-2CD2T85FWD-I8',
        serial_number: 'SN001',
        ip_address: '192.168.1.101',
        port: 554,
        rtsp_url: 'rtsp://192.168.1.101:554/stream',
        status: 'online',
        install_date: '2023-06-15',
        gis_coordinates: { longitude: 121.5234, latitude: 31.2456 },
        ptz_support: true,
        night_vision: true
      },
      {
        id: 'DEV002',
        name: '张家浜2号监控',
        code: 'CAM_ZJB_002',
        type_id: 'DT_001',
        point_id: 'MP002',
        brand: '海康威视',
        model: 'DS-2CD2T85FWD-I8',
        serial_number: 'SN002',
        ip_address: '192.168.1.102',
        port: 554,
        rtsp_url: 'rtsp://192.168.1.102:554/stream',
        status: 'online',
        install_date: '2023-06-15',
        gis_coordinates: { longitude: 121.5345, latitude: 31.2567 },
        ptz_support: true,
        night_vision: true
      },
      {
        id: 'DEV003',
        name: '张家浜3号监控',
        code: 'CAM_ZJB_003',
        type_id: 'DT_001',
        point_id: 'MP003',
        brand: '海康威视',
        model: 'DS-2CD2T85FWD-I8',
        serial_number: 'SN003',
        ip_address: '192.168.1.103',
        port: 554,
        rtsp_url: 'rtsp://192.168.1.103:554/stream',
        status: 'offline',
        install_date: '2023-06-15',
        gis_coordinates: { longitude: 121.5456, latitude: 31.2678 },
        ptz_support: true,
        night_vision: true
      },
      {
        id: 'DEV004',
        name: '川杨河1号监控',
        code: 'CAM_CYH_001',
        type_id: 'DT_001',
        point_id: 'MP004',
        brand: '大华',
        model: 'DH-IPC-HFW5442E-ZE',
        serial_number: 'SN004',
        ip_address: '192.168.1.104',
        port: 554,
        rtsp_url: 'rtsp://192.168.1.104:554/stream',
        status: 'online',
        install_date: '2023-07-20',
        gis_coordinates: { longitude: 121.5567, latitude: 31.2789 },
        ptz_support: true,
        night_vision: true
      },
      {
        id: 'DEV005',
        name: '川杨河2号监控',
        code: 'CAM_CYH_002',
        type_id: 'DT_001',
        point_id: 'MP005',
        brand: '大华',
        model: 'DH-IPC-HFW5442E-ZE',
        serial_number: 'SN005',
        ip_address: '192.168.1.105',
        port: 554,
        rtsp_url: 'rtsp://192.168.1.105:554/stream',
        status: 'online',
        install_date: '2023-07-20',
        gis_coordinates: { longitude: 121.5678, latitude: 31.2890 },
        ptz_support: true,
        night_vision: true
      }
    ]
    
    for (const device of devices) {
      await supabase.from('devices').upsert({
        ...device,
        last_heartbeat: device.status === 'online' ? new Date().toISOString() : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // 获取插入的数据数量
    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
    
    const { count: pointCount } = await supabase
      .from('monitoring_points')
      .select('*', { count: 'exact', head: true })
    
    return successResponse({
      message: '设备数据初始化成功',
      data: {
        devices: deviceCount || 0,
        monitoring_points: pointCount || 0,
        device_types: deviceTypes.length
      }
    })
    
  } catch (error) {
    console.error('Seed devices error:', error)
    return errorResponse('初始化设备数据失败', 500)
  }
}