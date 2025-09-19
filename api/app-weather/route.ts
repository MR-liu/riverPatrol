/**
 * 移动端天气查询API
 * GET /api/app-weather - 获取当前天气信息
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const COOKIE_NAME = 'auth-token' // Web端使用auth-token
const APP_COOKIE_NAME = 'app-auth-token' // 移动端使用app-auth-token
const BAIDU_MAP_AK = 'XZQtkAVwodXN1dLCsHEyQkzxALI636dk'

interface JWTPayload {
  userId: string;
  username: string;
  roleId: string;
  roleCode: string;
  areaId?: string;
  iat?: number;
  exp?: number;
}

/**
 * 获取天气信息
 * GET /api/app-weather
 */
export async function GET(request: NextRequest) {
  try {
    // Token验证（支持Web和移动端）
    const cookieStore = await cookies()
    const webToken = cookieStore.get(COOKIE_NAME)?.value
    const appToken = cookieStore.get(APP_COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const token = webToken || appToken || headerToken
    
    // 天气API可以允许未登录访问，但记录不同的日志
    let userId = 'anonymous'
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
        userId = decoded.userId
      } catch (error) {
        console.log('[Weather API] Invalid token, treating as anonymous')
      }
    }
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const city = searchParams.get('city') || '上海'
    
    // 构建百度天气API URL
    let weatherUrl = `https://api.map.baidu.com/weather/v1/?data_type=all&ak=${BAIDU_MAP_AK}`
    
    if (lat && lng) {
      // 如果提供了坐标，使用坐标查询
      weatherUrl += `&location=${lng},${lat}`
    } else if (city) {
      // 使用城市名查询
      weatherUrl += `&district_id=310000` // 默认上海
    }
    
    console.log('[Weather API] Fetching weather from Baidu:', weatherUrl)
    
    // 调用百度天气API
    const response = await fetch(weatherUrl)
    const result = await response.json()
    
    if (result.status !== 0) {
      console.error('[Weather API] Baidu API error:', result.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: '获取天气信息失败',
          message: result.message
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    // 格式化返回数据
    const weatherData = {
      success: true,
      data: {
        location: result.result.location,
        now: result.result.now,
        forecasts: result.result.forecasts || [],
        alerts: result.result.alerts || [],
        // 添加一些额外的便捷字段
        city: result.result.location.city,
        district: result.result.location.name,
        temperature: result.result.now.temp,
        weather: result.result.now.text,
        humidity: result.result.now.rh,
        wind_direction: result.result.now.wind_dir,
        wind_scale: result.result.now.wind_class,
        update_time: new Date().toISOString()
      },
      message: '获取天气信息成功'
    }
    
    // 记录API调用日志
    console.log(`[Weather API] User ${userId} fetched weather for ${result.result.location.city}`)
    
    return new Response(
      JSON.stringify(weatherData),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800' // 缓存30分钟
        }
      }
    )
    
  } catch (error) {
    console.error('[Weather API] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: '服务器错误',
        message: error instanceof Error ? error.message : '未知错误'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

/**
 * 获取天气预报
 * POST /api/app-weather - 可以提供更多参数
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { location, days = 7 } = body
    
    // 这里可以实现更复杂的天气查询逻辑
    // 例如多日预报、特定地点的天气等
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          location,
          days,
          forecast: []
        },
        message: '功能开发中'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('[Weather API] POST error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: '服务器错误'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}