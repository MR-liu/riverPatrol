/**
 * Cookie调试接口
 * GET /api/debug/cookie
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // 获取所有cookie
    const allCookies = cookieStore.getAll()
    
    // 特别查看auth-token
    const authToken = cookieStore.get('auth-token')
    
    let tokenInfo = null
    let tokenError = null
    
    if (authToken?.value) {
      try {
        const decoded = jwt.verify(authToken.value, JWT_SECRET)
        tokenInfo = {
          valid: true,
          decoded,
          raw: authToken.value.substring(0, 50) + '...'
        }
      } catch (error: any) {
        tokenError = {
          valid: false,
          error: error.message,
          raw: authToken.value.substring(0, 50) + '...'
        }
      }
    }
    
    // 检查请求头中的cookie
    const cookieHeader = request.headers.get('cookie')
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        cookieHeader,
        allCookies: allCookies.map(c => ({
          name: c.name,
          value: c.value.substring(0, 50) + '...',
          ...c
        })),
        authToken: authToken ? {
          exists: true,
          ...tokenInfo,
          ...tokenError
        } : {
          exists: false
        },
        timestamp: new Date().toISOString()
      }
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}