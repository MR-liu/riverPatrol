/**
 * APP端文件上传API
 * POST /api/app-upload - 上传单个文件
 * POST /api/app-upload?multiple=true - 上传多个文件
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { successResponse, errorResponse } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const UPLOAD_BASE_URL = 'https://u.chengyishi.com'

interface JWTPayload {
  userId: string;
  username: string;
  roleId: string;
  roleCode: string;
  areaId?: string;
  platform?: string;
  iat?: number;
  exp?: number;
}

/**
 * 上传文件到成衣市CDN
 * POST /api/app-upload
 */
export async function POST(request: NextRequest) {
  try {
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    // 检查是否是多文件上传
    const searchParams = request.nextUrl.searchParams
    const isMultiple = searchParams.get('multiple') === 'true'
    
    // 获取表单数据
    const formData = await request.formData()
    
    if (isMultiple) {
      // 多文件上传
      const files = formData.getAll('files')
      
      if (files.length === 0) {
        return errorResponse('没有找到要上传的文件', 400)
      }

      // 限制最多10个文件
      if (files.length > 10) {
        return errorResponse('一次最多上传10个文件', 400)
      }

      // 创建新的FormData用于转发
      const uploadFormData = new FormData()
      for (const file of files) {
        if (file instanceof File) {
          // 验证文件大小（50MB限制）
          if (file.size > 50 * 1024 * 1024) {
            return errorResponse(`文件 ${file.name} 超过50MB限制`, 400)
          }
          uploadFormData.append('files', file)
        }
      }

      // 转发到上传服务
      const uploadResponse = await fetch(`${UPLOAD_BASE_URL}/upload/multiple`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: uploadFormData
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload service error:', errorText)
        return errorResponse('上传服务错误', uploadResponse.status)
      }

      const result = await uploadResponse.json()
      
      if (result.success) {
        // 记录上传日志（可选）
        console.log(`[app-upload] User ${decoded.userId} uploaded ${result.data.succeeded.length} files`)
        
        return successResponse({
          files: result.data.succeeded,
          failed: result.data.failed,
          count: result.data.succeeded.length
        }, result.message)
      } else {
        return errorResponse(result.message || '上传失败', 400)
      }
      
    } else {
      // 单文件上传
      const file = formData.get('file')
      
      if (!file || !(file instanceof File)) {
        return errorResponse('没有找到要上传的文件', 400)
      }

      // 验证文件大小（10MB限制）
      if (file.size > 10 * 1024 * 1024) {
        return errorResponse('文件大小不能超过10MB', 400)
      }

      // 验证文件类型
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'application/pdf'
      ]
      
      if (!allowedTypes.includes(file.type)) {
        return errorResponse('不支持的文件类型', 400)
      }

      // 创建FormData用于转发
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      // 转发到上传服务
      const uploadResponse = await fetch(`${UPLOAD_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: uploadFormData
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload service error:', errorText)
        return errorResponse('上传服务错误', uploadResponse.status)
      }

      const result = await uploadResponse.json()
      
      if (result.success) {
        // 记录上传日志（可选）
        console.log(`[app-upload] User ${decoded.userId} uploaded file: ${result.data.originalName}`)
        
        return successResponse({
          url: result.data.url,
          path: result.data.path,
          size: result.data.size,
          mimetype: result.data.mimetype,
          originalName: result.data.originalName
        }, '文件上传成功')
      } else {
        return errorResponse(result.message || '上传失败', 400)
      }
    }
    
  } catch (error) {
    console.error('[app-upload] Error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取上传配置信息
 * GET /api/app-upload
 */
export async function GET(request: NextRequest) {
  try {
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    const finalToken = token || headerToken
    
    if (!finalToken) {
      return errorResponse('未登录或会话已过期', 401)
    }

    try {
      jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      return errorResponse('会话无效或已过期', 401)
    }

    // 返回上传配置
    return successResponse({
      config: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxVideoSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        allowedVideoTypes: ['video/mp4', 'video/webm'],
        allowedDocumentTypes: ['application/pdf'],
        uploadUrl: '/api/app-upload',
        multipleUploadUrl: '/api/app-upload?multiple=true'
      }
    }, '获取上传配置成功')
    
  } catch (error) {
    console.error('[app-upload] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}