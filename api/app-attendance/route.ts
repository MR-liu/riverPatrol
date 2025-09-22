/**
 * 移动端考勤管理 API
 * GET /api/app-attendance - 获取考勤记录
 * POST /api/app-attendance/checkin - 签到
 * POST /api/app-attendance/checkout - 签退
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

/**
 * 获取考勤记录
 */
export async function GET(request: NextRequest) {
  try {
    // 获取并验证 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    // 也支持从 Authorization header 获取 token（用于移动端）
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证 token
    let decoded: any
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const supabase = createServiceClient()

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const limit = parseInt(searchParams.get('limit') || '30')
    
    // 构建查询
    let query = supabase
      .from('user_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('checkin_time', { ascending: false })

    // 如果指定了年月，则筛选该月份的记录
    if (year && month && year !== 'undefined' && month !== 'undefined') {
      const yearNum = parseInt(year)
      const monthNum = parseInt(month)
      
      // 验证年月数据的有效性
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return errorResponse('无效的年月参数', 400)
      }
      
      const startDate = new Date(yearNum, monthNum - 1, 1)
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59)
      
      query = query
        .gte('checkin_time', startDate.toISOString())
        .lte('checkin_time', endDate.toISOString())
    } else {
      // 否则获取最近的记录
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('获取考勤记录失败:', error)
      return errorResponse('获取考勤记录失败', 500)
    }

    // 获取今日记录
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: todayRecords } = await supabase
      .from('user_checkins')
      .select('*')
      .eq('user_id', userId)
      .gte('checkin_time', today.toISOString())
      .lt('checkin_time', tomorrow.toISOString())
      .order('checkin_time', { ascending: true })

    // 计算统计数据
    const stats = calculateStats(data || [], year ? parseInt(year) : undefined, month ? parseInt(month) : undefined)
    
    // 判断当前状态 - 基于今日最后一条记录
    let currentStatus = 'checked_out'
    if (todayRecords && todayRecords.length > 0) {
      // 假设一天内签到次数是奇数表示已签到，偶数表示已签退
      currentStatus = todayRecords.length % 2 === 1 ? 'checked_in' : 'checked_out'
    }

    return successResponse({
      records: data || [],
      todayRecords: todayRecords || [],
      currentStatus,
      stats
    }, '获取考勤记录成功')

  } catch (error: any) {
    console.error('获取考勤记录失败:', error)
    return errorResponse(error.message || '获取考勤记录失败', 500)
  }
}

/**
 * 签到/签退
 */
export async function POST(request: NextRequest) {
  try {
    // 获取并验证 token
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    // 也支持从 Authorization header 获取 token（用于移动端）
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    // 验证 token
    let decoded: any
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET)
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const supabase = createServiceClient()
    
    // 解析请求体
    const body = await request.json()
    const {
      type = 'check_in', // check_in 或 check_out
      location,
      address,
      pointId,
      deviceId,
      notes
    } = body

    // 验证必填字段
    if (!location) {
      return errorResponse('位置信息为必填项', 400)
    }

    // 生成考勤ID（限制在20个字符内）
    const now = new Date()
    const timestamp = now.getTime().toString(36) // 使用36进制压缩长度
    const random = Math.random().toString(36).substr(2, 3)
    const checkinId = `CHK${timestamp}${random}`.toUpperCase().substring(0, 20)

    // 创建考勤记录
    const checkinData: any = {
      id: checkinId,
      user_id: userId,
      location,
      address,
      checkin_time: now.toISOString(),
      created_at: now.toISOString()
    }
    
    // 只有在提供了有效的pointId和deviceId时才添加（因为有外键约束）
    if (pointId) {
      checkinData.point_id = pointId
    }
    
    // device_id有外键约束，需要确保是已注册的设备ID
    // 暂时不设置device_id，除非确认是已存在的设备
    // if (deviceId) {
    //   checkinData.device_id = deviceId
    // }
    
    const { data, error } = await supabase
      .from('user_checkins')
      .insert(checkinData)
      .select()
      .single()

    if (error) {
      console.error('创建考勤记录失败:', error)
      return errorResponse('打卡失败', 500)
    }

    return successResponse(data, type === 'check_in' ? '签到成功' : '签退成功')

  } catch (error: any) {
    console.error('打卡失败:', error)
    return errorResponse(error.message || '打卡失败', 500)
  }
}

// 计算统计数据
function calculateStats(records: any[], year?: number, month?: number) {
  if (records.length === 0) {
    return {
      totalDays: 0,
      workDays: 0,
      normalDays: 0,
      lateDays: 0,
      absentDays: 0,
      leaveDays: 0,
      totalHours: 0,
      overtimeHours: 0,
      averageWorkHours: 0,
    }
  }

  // 按日期分组记录
  const dailyRecords = new Map<string, any[]>()
  
  records.forEach(record => {
    const date = new Date(record.checkin_time).toDateString()
    if (!dailyRecords.has(date)) {
      dailyRecords.set(date, [])
    }
    dailyRecords.get(date)!.push(record)
  })

  let normalDays = 0
  let lateDays = 0
  let totalHours = 0
  
  // 计算每天的工作情况
  dailyRecords.forEach((dayRecords, date) => {
    if (dayRecords.length >= 2) {
      // 假设第一条是签到，最后一条是签退
      const checkIn = new Date(dayRecords[0].checkin_time)
      const checkOut = new Date(dayRecords[dayRecords.length - 1].checkin_time)
      
      const workTime = checkOut.getTime() - checkIn.getTime()
      totalHours += workTime
      
      // 判断是否迟到（假设9点为上班时间）
      if (checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 0)) {
        lateDays++
      } else {
        normalDays++
      }
    }
  })

  const workDays = normalDays + lateDays
  const totalDays = year && month ? new Date(year, month, 0).getDate() : 30
  const absentDays = Math.max(0, totalDays - workDays)

  return {
    totalDays,
    workDays,
    normalDays,
    lateDays,
    absentDays,
    leaveDays: 0, // 需要请假表支持
    totalHours,
    overtimeHours: Math.max(0, totalHours - (workDays * 8 * 60 * 60 * 1000)),
    averageWorkHours: workDays > 0 ? totalHours / workDays : 0,
  }
}