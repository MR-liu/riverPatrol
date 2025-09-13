/**
 * 详细健康检查API
 * 提供更详细的系统和服务状态信息
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: Request) {
  const startTime = Date.now()
  
  // 基础健康信息
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(process.uptime()),
      formatted: formatUptime(process.uptime())
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET
    },
    services: {},
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        unit: 'MB'
      },
      cpu: {
        model: process.arch,
        cores: require('os').cpus().length
      }
    },
    checks: [],
    responseTime: 0
  }

  // 检查API服务
  health.services.api = {
    status: 'operational',
    message: 'API is responding normally'
  }
  health.checks.push({
    name: 'API Service',
    status: 'pass',
    responseTime: 1
  })

  // 检查数据库连接
  try {
    const dbStartTime = Date.now()
    const supabase = createServiceClient()
    
    // 测试基本查询
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    const dbResponseTime = Date.now() - dbStartTime
    
    if (error) {
      health.services.database = {
        status: 'degraded',
        message: `Database query failed: ${error.message}`,
        responseTime: dbResponseTime
      }
      health.status = 'degraded'
      health.checks.push({
        name: 'Database',
        status: 'warn',
        message: error.message,
        responseTime: dbResponseTime
      })
    } else {
      health.services.database = {
        status: 'operational',
        message: 'Database is accessible',
        responseTime: dbResponseTime
      }
      health.checks.push({
        name: 'Database',
        status: 'pass',
        responseTime: dbResponseTime
      })
    }
  } catch (error: any) {
    health.services.database = {
      status: 'unavailable',
      message: `Database connection failed: ${error.message}`
    }
    health.status = 'unhealthy'
    health.checks.push({
      name: 'Database',
      status: 'fail',
      message: error.message
    })
  }

  // 检查认证服务
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (token) {
      try {
        jwt.verify(token, JWT_SECRET)
        health.services.auth = {
          status: 'operational',
          message: 'Authentication service is working',
          hasValidToken: true
        }
      } catch {
        health.services.auth = {
          status: 'operational',
          message: 'Authentication service is working',
          hasValidToken: false
        }
      }
    } else {
      health.services.auth = {
        status: 'operational',
        message: 'Authentication service is working',
        hasValidToken: false
      }
    }
    health.checks.push({
      name: 'Authentication',
      status: 'pass'
    })
  } catch (error: any) {
    health.services.auth = {
      status: 'degraded',
      message: `Authentication check failed: ${error.message}`
    }
    health.checks.push({
      name: 'Authentication',
      status: 'warn',
      message: error.message
    })
  }

  // 检查关键表的数据
  if (health.services.database?.status === 'operational') {
    try {
      const supabase = createServiceClient()
      
      // 统计各表的记录数
      const tables = ['users', 'roles', 'river_management_areas', 'rivers', 'devices', 'alarms', 'workorders']
      const stats: any = {}
      
      for (const table of tables) {
        try {
          const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
          
          stats[table] = count || 0
        } catch {
          stats[table] = 'error'
        }
      }
      
      health.services.database.statistics = stats
    } catch (error) {
      console.error('Failed to get database statistics:', error)
    }
  }

  // 计算总响应时间
  health.responseTime = Date.now() - startTime

  // 设置整体健康状态
  const hasFailedChecks = health.checks.some((check: any) => check.status === 'fail')
  const hasWarnings = health.checks.some((check: any) => check.status === 'warn')
  
  if (hasFailedChecks) {
    health.status = 'unhealthy'
  } else if (hasWarnings) {
    health.status = 'degraded'
  }

  // 添加状态摘要
  health.summary = {
    healthy: health.status === 'healthy',
    message: health.status === 'healthy' ? 
      'All systems are operational' : 
      health.status === 'degraded' ? 
      'System is operational with warnings' : 
      'System is experiencing issues',
    checks: {
      total: health.checks.length,
      passed: health.checks.filter((c: any) => c.status === 'pass').length,
      warnings: health.checks.filter((c: any) => c.status === 'warn').length,
      failed: health.checks.filter((c: any) => c.status === 'fail').length
    }
  }

  // 根据服务状态设置HTTP状态码
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': health.status
    }
  })
}

// 格式化运行时间
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
  
  return parts.join(' ')
}