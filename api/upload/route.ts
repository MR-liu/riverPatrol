/**
 * Web端文件上传API
 * POST /api/upload - 上传单个文件
 * POST /api/upload?multiple=true - 上传多个文件
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { successResponse, errorResponse } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'
const UPLOAD_BASE_URL = 'https://u.chengyishi.com'

/**
 * 上传文件到成衣市CDN
 * POST /api/upload
 */
export async function POST(request: NextRequest) {
  try {
    // Token验证 - Web端使用auth-token
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

      // 限制最多20个文件
      if (files.length > 20) {
        return errorResponse('一次最多上传20个文件', 400)
      }

      // 创建新的FormData用于转发
      const uploadFormData = new FormData()
      for (const file of files) {
        if (file instanceof File) {
          // 验证文件大小（100MB限制）
          if (file.size > 100 * 1024 * 1024) {
            return errorResponse(`文件 ${file.name} 超过100MB限制`, 400)
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
        // 记录上传日志
        console.log(`[upload] User ${decoded.username} uploaded ${result.data.succeeded.length} files`)
        
        // 保存文件记录到数据库（可选）
        // await saveFileRecords(result.data.succeeded, decoded.userId)
        
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

      // 验证文件大小（50MB限制）
      if (file.size > 50 * 1024 * 1024) {
        return errorResponse('文件大小不能超过50MB', 400)
      }

      // 验证文件类型
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-rar-compressed'
      ]
      
      const fileType = file.type.toLowerCase()
      const isAllowed = allowedTypes.includes(fileType) || 
                       fileType.startsWith('image/') || 
                       fileType.startsWith('video/')
      
      if (!isAllowed) {
        return errorResponse(`不支持的文件类型: ${file.type}`, 400)
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
        // 记录上传日志
        console.log(`[upload] User ${decoded.username} uploaded file: ${result.data.originalName}`)
        
        // 保存文件记录到数据库（可选）
        // await saveFileRecord(result.data, decoded.userId)
        
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
    console.error('[upload] Error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 获取上传配置信息
 * GET /api/upload
 */
export async function GET(request: NextRequest) {
  try {
    // Token验证
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }

    try {
      jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的访问令牌', 401)
    }

    // 返回上传配置
    return successResponse({
      config: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxVideoSize: 100 * 1024 * 1024, // 100MB
        maxFiles: 20,
        allowedImageTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/svg+xml'
        ],
        allowedVideoTypes: [
          'video/mp4',
          'video/webm',
          'video/ogg'
        ],
        allowedDocumentTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        uploadUrl: '/api/upload',
        multipleUploadUrl: '/api/upload?multiple=true',
        cdnBaseUrl: 'https://cdn.chengyishi.com/riverpatrol/'
      }
    }, '获取上传配置成功')
    
  } catch (error) {
    console.error('[upload] GET error:', error)
    return errorResponse('服务器错误', 500)
  }
}

/**
 * 删除文件（可选功能）
 * DELETE /api/upload
 */
export async function DELETE(request: NextRequest) {
  try {
    // Token验证
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

    const body = await request.json()
    const { url, path } = body

    if (!url && !path) {
      return errorResponse('缺少文件路径参数', 400)
    }

    // 这里可以添加删除文件的逻辑
    // 例如：标记数据库中的文件为已删除
    // 注意：CDN上的文件可能需要单独的删除策略

    return successResponse({
      deleted: true,
      url: url || path
    }, '文件删除成功')
    
  } catch (error) {
    console.error('[upload] DELETE error:', error)
    return errorResponse('服务器错误', 500)
  }
}