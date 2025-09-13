/**
 * 简单的状态检查API
 * 返回最基本的健康状态
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Smart River Monitoring System is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
}