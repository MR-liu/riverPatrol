/**
 * AI系统告警生成接口
 * POST /api/ai/alarms - AI系统创建告警
 * 
 * 该接口专门为AI系统设计，用于自动创建告警
 * 需要通过API Key认证而非用户Token
 */

import { NextRequest } from 'next/server'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { z } from 'zod'

// API密钥验证（应该从环境变量获取）
const AI_API_KEY = process.env.AI_API_KEY || 'ai-system-secret-key-2025'

// 请求数据验证模式
const aiAlarmSchema = z.object({
  // 基本信息
  device_code: z.string().min(1, '设备编码不能为空'), // 摄像头编码
  alarm_type: z.enum([
    'water_pollution',    // 水质污染
    'garbage_floating',   // 垃圾漂浮
    'illegal_fishing',    // 违法钓鱼
    'illegal_discharge',  // 违法排放
    'riverbank_damage',   // 河岸损坏
    'water_level_abnormal', // 水位异常
    'other'              // 其他
  ]),
  
  // 告警级别（对应数据库的priority_level枚举）
  level: z.enum(['urgent', 'high', 'normal', 'low']),
  
  // 告警详情
  title: z.string().min(1, '告警标题不能为空'),
  description: z.string().min(1, '告警描述不能为空'),
  
  // AI识别信息
  confidence: z.number().min(0).max(1).default(0.95), // 置信度 0-1
  detected_objects: z.array(z.object({
    type: z.string(),      // 检测到的对象类型
    count: z.number(),     // 数量
    confidence: z.number() // 单个对象置信度
  })).optional(),
  
  // 媒体文件（至少需要一个）
  image_url: z.string().url().optional(),     // 告警截图URL（单个，兼容旧版）
  images: z.array(z.string().url()).optional(), // 告警截图URL数组（多个）
  video_url: z.string().url().optional(),     // 告警视频URL
  videos: z.array(z.string().url()).optional(), // 告警视频URL数组（多个）
  image_base64: z.string().optional(),        // Base64编码的图片（单个）
  images_base64: z.array(z.string()).optional(), // Base64编码的图片数组（多个）
  
  // 位置信息（可选，如果不提供则从设备信息获取）
  coordinates: z.object({
    longitude: z.number(),
    latitude: z.number()
  }).optional(),
  
  // 时间戳
  detected_at: z.string().datetime().optional(), // ISO 8601格式
  
  // 附加元数据
  metadata: z.record(z.any()).optional()
})

// POST - AI系统创建告警
export async function POST(request: NextRequest) {
  try {
    // 验证API密钥
    const apiKey = request.headers.get('X-AI-API-Key')
    if (!apiKey || apiKey !== AI_API_KEY) {
      return errorResponse('无效的API密钥', 401)
    }
    
    const body = await request.json()
    
    // 验证请求数据
    const validationResult = aiAlarmSchema.safeParse(body)
    if (!validationResult.success) {
      return errorResponse(
        validationResult.error.errors[0].message,
        400
      )
    }
    
    const data = validationResult.data
    
    // 验证至少有一个媒体文件
    const hasMedia = data.image_url || data.images?.length || 
                     data.video_url || data.videos?.length ||
                     data.image_base64 || data.images_base64?.length
    
    if (!hasMedia) {
      return errorResponse('至少需要提供一个图片或视频', 400)
    }
    
    const supabase = createServiceClient()
    
    // 1. 根据设备编码查找设备信息
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select(`
        id,
        name,
        point_id,
        monitoring_points!inner (
          id,
          name,
          river_name,
          longitude,
          latitude,
          river_id,
          department_id
        )
      `)
      .eq('code', data.device_code)
      .single()
    
    if (deviceError || !device) {
      return errorResponse(`设备编码 ${data.device_code} 不存在`, 404)
    }
    
    // 2. 获取告警类型ID
    const alarmTypeMap: Record<string, string> = {
      'water_pollution': 'AT_001',
      'garbage_floating': 'AT_002',
      'illegal_fishing': 'AT_003',
      'illegal_discharge': 'AT_004',
      'riverbank_damage': 'AT_005',
      'water_level_abnormal': 'AT_006',
      'other': 'AT_999'
    }
    
    const type_id = alarmTypeMap[data.alarm_type]
    
    // 3. 获取告警级别ID
    const alarmLevelMap: Record<string, string> = {
      'urgent': 'AL_001',
      'high': 'AL_002',
      'normal': 'AL_003',
      'low': 'AL_004'
    }
    
    const level_id = alarmLevelMap[data.level]
    
    // 4. 处理图片（整合单个和多个图片）
    let allImages: string[] = []
    
    // 收集所有图片URL
    if (data.image_url) {
      allImages.push(data.image_url)
    }
    if (data.images && data.images.length > 0) {
      allImages.push(...data.images)
    }
    
    // 处理Base64图片（如果有）
    if (data.image_base64) {
      // TODO: 实现Base64图片上传到存储服务
      allImages.push('https://placeholder.com/ai-alarm-image-1.jpg')
    }
    if (data.images_base64 && data.images_base64.length > 0) {
      // TODO: 实现批量Base64图片上传到存储服务
      data.images_base64.forEach((_, index) => {
        allImages.push(`https://placeholder.com/ai-alarm-image-${index + 2}.jpg`)
      })
    }
    
    // 处理视频URL
    let allVideos: string[] = []
    if (data.video_url) {
      allVideos.push(data.video_url)
    }
    if (data.videos && data.videos.length > 0) {
      allVideos.push(...data.videos)
    }
    
    // 主图片URL（用于兼容旧字段）
    const mainImageUrl = allImages[0] || null
    const mainVideoUrl = allVideos[0] || null
    
    // 5. 生成告警ID
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2, 7).toUpperCase()
    const alarmId = `ALM_${timestamp.slice(-8)}_${random}`
    
    // 6. 使用设备位置或提供的坐标
    const coordinates = data.coordinates || {
      longitude: device.monitoring_points.longitude,
      latitude: device.monitoring_points.latitude
    }
    
    // 7. 创建告警记录
    const alarmData: any = {
      id: alarmId,
      type_id,
      level_id,
      device_id: device.id,
      point_id: device.point_id,
      title: data.title,
      description: data.description,
      confidence: data.confidence,
      image_url: mainImageUrl, // 主图片URL（兼容旧字段）
      video_url: mainVideoUrl, // 主视频URL（兼容旧字段）
      coordinates,
      status: 'pending',
      source_type: 'ai', // 标记为AI告警
      department_id: device.monitoring_points.department_id,
      region_code: device.monitoring_points.river_id,
      initial_priority: data.level as any,
      created_at: data.detected_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // 如果有多个图片或视频，存储到额外的字段或JSON字段中
    // 注意：这里需要根据数据库实际结构来调整
    if (allImages.length > 0 || allVideos.length > 0) {
      alarmData.media_files = {
        images: allImages,
        videos: allVideos,
        total_images: allImages.length,
        total_videos: allVideos.length
      }
    }
    
    const { data: newAlarm, error: alarmError } = await supabase
      .from('alarms')
      .insert(alarmData)
      .select(`
        *,
        alarm_types:type_id (
          id,
          name,
          code
        ),
        alarm_levels:level_id (
          id,
          name,
          code,
          level
        ),
        devices:device_id (
          id,
          name,
          code
        ),
        monitoring_points:point_id (
          id,
          name,
          river_name
        )
      `)
      .single()
    
    if (alarmError) {
      console.error('Create AI alarm error:', alarmError)
      return errorResponse('创建告警失败', 500)
    }
    
    // 8. 记录AI检测详情（可选）
    // TODO: 如果需要存储AI检测详情，可以创建 alarm_ai_details 表
    // if (data.detected_objects && data.detected_objects.length > 0) {
    //   await supabase
    //     .from('alarm_ai_details')
    //     .insert({
    //       alarm_id: alarmId,
    //       detected_objects: data.detected_objects,
    //       metadata: data.metadata || {},
    //       created_at: new Date().toISOString()
    //     })
    // }
    
    // 9. 自动创建工单（针对紧急和高级别告警）
    let workorderId = null
    if (data.level === 'urgent' || data.level === 'high') {
      // 生成工单ID
      const today = new Date()
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
      
      const { data: lastWorkorder } = await supabase
        .from('workorders')
        .select('id')
        .like('id', `WO-${dateStr}-%`)
        .order('id', { ascending: false })
        .limit(1)
        .single()
      
      let nextNumber = 1
      if (lastWorkorder) {
        const lastNumber = parseInt(lastWorkorder.id.split('-')[2])
        nextNumber = lastNumber + 1
      }
      
      workorderId = `WO-${dateStr}-${nextNumber.toString().padStart(5, '0')}`
      
      // 根据监测点查找对应的区域
      const { data: areas } = await supabase
        .from('river_management_areas')
        .select('id, supervisor_id, maintenance_worker_ids, monitoring_point_ids')
      
      const relevantArea = areas?.find(area => 
        area.monitoring_point_ids?.includes(device.point_id)
      )
      
      // 创建工单
      const { data: newWorkorder, error: workorderError } = await supabase
        .from('workorders')
        .insert({
          id: workorderId,
          type_id: 'WT_001', // 默认告警处理类型
          alarm_id: alarmId,
          title: `[AI告警] ${data.title}`,
          description: `AI系统检测到异常\n置信度：${(data.confidence * 100).toFixed(1)}%\n\n${data.description}\n\n位置：${device.monitoring_points.name}`,
          priority: data.level === 'urgent' ? 'urgent' : 'important',
          status: 'pending',
          department_id: device.monitoring_points.department_id,
          point_id: device.point_id,
          area_id: relevantArea?.id,
          location: device.monitoring_points.name,
          coordinates,
          images: allImages,
          creator_id: 'AI_SYSTEM', // AI系统创建
          source: 'alarm',
          workorder_source: 'ai',
          expected_complete_at: new Date(Date.now() + 
            (data.level === 'urgent' ? 4 : 24) * 60 * 60 * 1000
          ).toISOString(), // 紧急4小时，其他24小时
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (!workorderError) {
        // 更新告警状态为处理中
        await supabase
          .from('alarms')
          .update({
            status: 'processing',
            confirmed_by: 'AI_SYSTEM',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', alarmId)
        
        // 发送推送通知给区域负责人
        if (relevantArea) {
          try {
            const { sendWorkOrderPush } = await import('@/lib/push-notification.service')
            
            let targetUserIds: string[] = []
            
            // 添加区域主管
            if (relevantArea.supervisor_id) {
              targetUserIds.push(relevantArea.supervisor_id)
            }
            
            // 添加区域维护员
            if (relevantArea.maintenance_worker_ids && Array.isArray(relevantArea.maintenance_worker_ids)) {
              targetUserIds = [...targetUserIds, ...relevantArea.maintenance_worker_ids]
            }
            
            // 去重
            targetUserIds = [...new Set(targetUserIds)]
            
            // 检查哪些用户有注册设备
            if (targetUserIds.length > 0) {
              const { data: devices } = await supabase
                .from('mobile_devices')
                .select('user_id')
                .in('user_id', targetUserIds)
                .eq('is_active', true)
              
              const usersWithDevices = [...new Set(devices?.map(d => d.user_id) || [])]
              
              if (usersWithDevices.length > 0) {
                await sendWorkOrderPush({
                  id: workorderId,
                  type: 'AI告警处理',
                  location: device.monitoring_points.name,
                  priority: data.level === 'urgent' ? 'urgent' : 'important',
                  deadline: newWorkorder.expected_complete_at
                }, usersWithDevices)
                
                console.log(`[AI WorkOrder Push] 已推送给 ${usersWithDevices.length} 个区域负责人`)
              }
            }
          } catch (pushError) {
            console.error('AI工单推送失败:', pushError)
          }
        }
      }
    }
    
    // 10. 创建通知（通知监控中心主管R002）
    const { data: monitorManagers } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', 'R002')
      .eq('status', 'active')
    
    if (monitorManagers && monitorManagers.length > 0) {
      const notifications = monitorManagers.map(user => ({
        id: `NOTIF_${Date.now()}_${user.id.slice(-4)}`,
        user_id: user.id,
        title: `新的AI告警：${data.title}`,
        content: `${device.monitoring_points.river_name} - ${device.name} 检测到异常，置信度：${(data.confidence * 100).toFixed(1)}%${workorderId ? '\n已自动创建工单: ' + workorderId : ''}`,
        type: 'alarm',
        priority: data.level === 'urgent' ? 'high' : 'normal',
        related_type: 'alarm',
        related_id: alarmId,
        created_at: new Date().toISOString()
      }))
      
      await supabase.from('notifications').insert(notifications)
      
      // 发送推送通知给监控中心主管
      try {
        const { sendAlarmPush } = await import('@/lib/push-notification.service')
        
        // 检查监控中心主管是否有注册设备
        const { data: devices } = await supabase
          .from('mobile_devices')
          .select('user_id')
          .in('user_id', monitorManagers.map(u => u.id))
          .eq('is_active', true)
        
        const usersWithDevices = [...new Set(devices?.map(d => d.user_id) || [])]
        
        if (usersWithDevices.length > 0) {
          await sendAlarmPush({
            id: alarmId,
            type: data.alarm_type,
            location: device.monitoring_points.name,
            time: data.detected_at || new Date().toISOString(),
            description: data.description,
            level: data.level
          }, usersWithDevices)
          
          console.log(`[AI Alarm Push] 已推送给 ${usersWithDevices.length} 个监控中心主管`)
        }
      } catch (pushError) {
        console.error('AI告警推送失败:', pushError)
      }
    }
    
    return successResponse({
      alarm_id: alarmId,
      workorder_id: workorderId,
      status: 'success',
      message: workorderId ? '告警创建成功，已自动生成工单' : '告警创建成功',
      data: newAlarm
    })
    
  } catch (error) {
    console.error('AI alarm creation error:', error)
    return errorResponse('创建告警失败', 500)
  }
}

// GET - 查询AI告警状态（可选）
export async function GET(request: NextRequest) {
  try {
    // 验证API密钥
    const apiKey = request.headers.get('X-AI-API-Key')
    if (!apiKey || apiKey !== AI_API_KEY) {
      return errorResponse('无效的API密钥', 401)
    }
    
    const { searchParams } = new URL(request.url)
    const alarmId = searchParams.get('alarm_id')
    const deviceCode = searchParams.get('device_code')
    const startTime = searchParams.get('start_time')
    const endTime = searchParams.get('end_time')
    
    const supabase = createServiceClient()
    
    let query = supabase
      .from('alarms')
      .select(`
        id,
        title,
        description,
        status,
        confidence,
        created_at,
        devices:device_id (
          code,
          name
        ),
        alarm_types:type_id (
          code,
          name
        ),
        alarm_levels:level_id (
          code,
          name
        )
      `)
      .eq('source_type', 'ai')
      .order('created_at', { ascending: false })
    
    if (alarmId) {
      query = query.eq('id', alarmId)
    }
    
    if (deviceCode) {
      const { data: device } = await supabase
        .from('devices')
        .select('id')
        .eq('code', deviceCode)
        .single()
      
      if (device) {
        query = query.eq('device_id', device.id)
      }
    }
    
    if (startTime) {
      query = query.gte('created_at', startTime)
    }
    
    if (endTime) {
      query = query.lte('created_at', endTime)
    }
    
    query = query.limit(100)
    
    const { data: alarms, error } = await query
    
    if (error) {
      console.error('Query AI alarms error:', error)
      return errorResponse('查询告警失败', 500)
    }
    
    return successResponse({
      total: alarms?.length || 0,
      alarms: alarms || []
    })
    
  } catch (error) {
    console.error('Query AI alarms error:', error)
    return errorResponse('查询告警失败', 500)
  }
}