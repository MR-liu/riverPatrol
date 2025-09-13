/**
 * 种子数据 API - 告警数据
 * POST /api/seed/alarms
 * 用于初始化告警相关的测试数据
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
    
    // 插入告警类型数据（如果不存在）
    const alarmTypes = [
      { id: 'AT_001', name: '设备离线', code: 'device_offline', category: 'device', description: '设备离线告警' },
      { id: 'AT_002', name: '设备故障', code: 'device_fault', category: 'device', description: '设备故障告警' },
      { id: 'AT_003', name: '水位异常', code: 'water_level', category: 'environment', description: '水位异常告警' },
      { id: 'AT_004', name: '水质异常', code: 'water_quality', category: 'environment', description: '水质异常告警' },
      { id: 'AT_005', name: '垃圾漂浮', code: 'garbage', category: 'environment', description: '垃圾漂浮物告警' },
      { id: 'AT_006', name: '非法排放', code: 'illegal_discharge', category: 'violation', description: '非法排放告警' },
      { id: 'AT_007', name: '非法捕捞', code: 'illegal_fishing', category: 'violation', description: '非法捕捞告警' },
      { id: 'AT_008', name: '非法倾倒', code: 'illegal_dumping', category: 'violation', description: '非法倾倒告警' },
      { id: 'AT_009', name: '堤防损坏', code: 'embankment_damage', category: 'infrastructure', description: '堤防损坏告警' },
      { id: 'AT_010', name: '异常人员', code: 'abnormal_person', category: 'security', description: '异常人员活动告警' }
    ]
    
    for (const type of alarmTypes) {
      await supabase.from('alarm_types').upsert({
        ...type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // 插入告警级别数据（如果不存在）
    const alarmLevels = [
      { id: 'AL_001', name: '紧急', code: 'critical', priority: 1, color: '#FF0000', description: '需要立即处理的紧急告警' },
      { id: 'AL_002', name: '重要', code: 'major', priority: 2, color: '#FF9900', description: '需要尽快处理的重要告警' },
      { id: 'AL_003', name: '警告', code: 'warning', priority: 3, color: '#FFCC00', description: '需要关注的警告信息' },
      { id: 'AL_004', name: '提示', code: 'info', priority: 4, color: '#0099FF', description: '一般提示信息' }
    ]
    
    for (const level of alarmLevels) {
      await supabase.from('alarm_levels').upsert({
        ...level,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // 获取监控点
    const { data: monitoringPoints } = await supabase
      .from('monitoring_points')
      .select('id, name')
      .limit(5)
    
    if (!monitoringPoints || monitoringPoints.length === 0) {
      return errorResponse('请先初始化监控点数据', 400)
    }
    
    // 获取设备
    const { data: devices } = await supabase
      .from('devices')
      .select('id, name, point_id')
      .limit(5)
    
    // 生成测试告警数据
    const currentTime = new Date()
    const alarms = [
      {
        id: 'A000001',
        type_id: 'AT_005',
        level_id: 'AL_002',
        device_id: devices?.[0]?.id,
        point_id: monitoringPoints[0].id,
        title: '发现大量垃圾漂浮物',
        description: 'AI检测到河道内有大量垃圾漂浮物，需要及时清理',
        confidence: 0.95,
        image_url: '/images/alarm-sample-1.jpg',
        status: 'pending',
        created_at: new Date(currentTime.getTime() - 10 * 60 * 1000).toISOString()
      },
      {
        id: 'A000002',
        type_id: 'AT_006',
        level_id: 'AL_001',
        device_id: devices?.[1]?.id,
        point_id: monitoringPoints[1]?.id,
        title: '疑似非法排放',
        description: '检测到有污水排入河道，水质出现异常',
        confidence: 0.88,
        image_url: '/images/alarm-sample-2.jpg',
        status: 'pending',
        created_at: new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString()
      },
      {
        id: 'A000003',
        type_id: 'AT_003',
        level_id: 'AL_003',
        device_id: devices?.[2]?.id,
        point_id: monitoringPoints[2]?.id,
        title: '水位超过警戒线',
        description: '当前水位已超过警戒线10厘米，请密切关注',
        confidence: 1.0,
        status: 'confirmed',
        confirmed_by: decoded.userId,
        confirmed_at: new Date(currentTime.getTime() - 60 * 60 * 1000).toISOString(),
        created_at: new Date(currentTime.getTime() - 90 * 60 * 1000).toISOString()
      },
      {
        id: 'A000004',
        type_id: 'AT_001',
        level_id: 'AL_004',
        device_id: devices?.[3]?.id,
        point_id: monitoringPoints[3]?.id,
        title: '设备离线通知',
        description: '监控设备已离线超过5分钟',
        confidence: 1.0,
        status: 'processing',
        confirmed_by: decoded.userId,
        confirmed_at: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(currentTime.getTime() - 3 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'A000005',
        type_id: 'AT_007',
        level_id: 'AL_002',
        device_id: devices?.[0]?.id,
        point_id: monitoringPoints[0]?.id,
        title: '发现非法捕捞行为',
        description: 'AI检测到有人员在禁渔期进行捕捞活动',
        confidence: 0.76,
        image_url: '/images/alarm-sample-3.jpg',
        status: 'resolved',
        confirmed_by: decoded.userId,
        confirmed_at: new Date(currentTime.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        resolved_by: decoded.userId,
        resolved_at: new Date(currentTime.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        resolution_note: '已派人员前往处理，违法人员已驱离',
        created_at: new Date(currentTime.getTime() - 6 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'A000006',
        type_id: 'AT_009',
        level_id: 'AL_001',
        point_id: monitoringPoints[1]?.id,
        title: '河堤出现裂缝',
        description: '巡检发现河堤存在明显裂缝，需要紧急修复',
        confidence: 1.0,
        status: 'pending',
        created_at: new Date(currentTime.getTime() - 15 * 60 * 1000).toISOString()
      },
      {
        id: 'A000007',
        type_id: 'AT_004',
        level_id: 'AL_002',
        device_id: devices?.[1]?.id,
        point_id: monitoringPoints[2]?.id,
        title: '水质pH值异常',
        description: '水质监测显示pH值为5.2，低于正常范围',
        confidence: 1.0,
        status: 'confirmed',
        confirmed_by: decoded.userId,
        confirmed_at: new Date(currentTime.getTime() - 45 * 60 * 1000).toISOString(),
        created_at: new Date(currentTime.getTime() - 50 * 60 * 1000).toISOString()
      },
      {
        id: 'A000008',
        type_id: 'AT_010',
        level_id: 'AL_003',
        device_id: devices?.[2]?.id,
        point_id: monitoringPoints[3]?.id,
        title: '深夜有可疑人员活动',
        description: 'AI检测到凌晨2点有多名人员在河道附近聚集',
        confidence: 0.82,
        image_url: '/images/alarm-sample-4.jpg',
        status: 'false_alarm',
        confirmed_by: decoded.userId,
        confirmed_at: new Date(currentTime.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        resolved_by: decoded.userId,
        resolved_at: new Date(currentTime.getTime() - 7 * 60 * 60 * 1000).toISOString(),
        resolution_note: '经核实为夜间施工人员',
        created_at: new Date(currentTime.getTime() - 10 * 60 * 60 * 1000).toISOString()
      }
    ]
    
    // 插入告警数据
    for (const alarm of alarms) {
      await supabase.from('alarms').upsert({
        ...alarm,
        department_id: decoded.departmentId,
        updated_at: new Date().toISOString()
      })
    }
    
    // 获取插入的数据数量
    const { count: alarmCount } = await supabase
      .from('alarms')
      .select('*', { count: 'exact', head: true })
    
    return successResponse({
      message: '告警数据初始化成功',
      data: {
        alarm_types: alarmTypes.length,
        alarm_levels: alarmLevels.length,
        alarms: alarms.length,
        total_alarms: alarmCount || 0
      }
    })
    
  } catch (error) {
    console.error('Seed alarms error:', error)
    return errorResponse('初始化告警数据失败', 500)
  }
}