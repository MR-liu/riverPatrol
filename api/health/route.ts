/**
 * 健康检查API
 * 用于监控系统运行状态
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const startTime = Date.now()
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      api: 'operational',
      database: 'checking...'
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    },
    responseTime: 0
  }

  try {
    // 检查数据库连接
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single()
    
    if (error) {
      health.services.database = 'degraded'
      health.status = 'degraded'
    } else {
      health.services.database = 'operational'
    }
  } catch (error) {
    console.error('Database health check failed:', error)
    health.services.database = 'unavailable'
    health.status = 'unhealthy'
  }

  // 计算响应时间
  health.responseTime = Date.now() - startTime

  // 根据服务状态设置HTTP状态码
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}

// HEAD 请求用于简单的健康检查
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}