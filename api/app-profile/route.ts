/**
 * 移动端个人资料 API
 * GET /api/app-profile - 获取个人资料
 * PUT /api/app-profile - 更新个人资料
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

/**
 * 获取个人资料
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

    // 获取用户详细信息，包括关联的部门和角色信息
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        role:roles!inner(id, name, code, description),
        department:departments(id, name, code, description)
      `)
      .eq('id', userId)
      .single()

    if (error || !user) {
      console.error('获取用户信息失败:', error)
      return errorResponse('获取用户信息失败', 404)
    }

    // 格式化返回数据
    const profile = {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      avatar: user.avatar || '',
      roleId: user.role_id,
      roleName: user.role?.name || '',
      roleCode: user.role?.code || '',
      departmentId: user.department_id,
      departmentName: user.department?.name || '',
      status: user.status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      // 添加额外的显示字段
      employeeId: user.username, // 工号使用用户名
      position: user.role?.name || '未设置', // 职位使用角色名称
      workLocation: user.department?.name || '未设置', // 工作地点使用部门名称
      joinDate: user.created_at, // 入职日期使用创建时间
    }

    return successResponse(profile, '获取个人资料成功')

  } catch (error: any) {
    console.error('获取个人资料失败:', error)
    return errorResponse(error.message || '获取个人资料失败', 500)
  }
}

/**
 * 更新个人资料
 */
export async function PUT(request: NextRequest) {
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
      name,
      phone,
      email,
      avatar,
    } = body

    // 构建更新数据对象，只更新提供的字段
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // 只添加非空的字段
    if (name !== undefined && name !== null) {
      updateData.name = name
    }
    if (phone !== undefined && phone !== null) {
      updateData.phone = phone
    }
    if (email !== undefined && email !== null) {
      updateData.email = email
    }
    if (avatar !== undefined && avatar !== null) {
      updateData.avatar = avatar
    }

    // 更新用户信息
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select(`
        *,
        role:roles!inner(id, name, code, description),
        department:departments(id, name, code, description)
      `)
      .single()

    if (error) {
      console.error('更新用户信息失败:', error)
      return errorResponse('更新用户信息失败', 500)
    }

    // 格式化返回数据
    const profile = {
      id: data.id,
      username: data.username,
      name: data.name,
      phone: data.phone || '',
      email: data.email || '',
      avatar: data.avatar || '',
      roleId: data.role_id,
      roleName: data.role?.name || '',
      roleCode: data.role?.code || '',
      departmentId: data.department_id,
      departmentName: data.department?.name || '',
      status: data.status,
      lastLoginAt: data.last_login_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      // 添加额外的显示字段
      employeeId: data.username,
      position: data.role?.name || '未设置',
      workLocation: data.department?.name || '未设置',
      joinDate: data.created_at,
    }

    return successResponse(profile, '更新个人资料成功')

  } catch (error: any) {
    console.error('更新个人资料失败:', error)
    return errorResponse(error.message || '更新个人资料失败', 500)
  }
}

/**
 * 更新密码
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
      oldPassword,
      newPassword,
    } = body

    // 验证必填字段
    if (!oldPassword || !newPassword) {
      return errorResponse('请提供旧密码和新密码', 400)
    }

    // 验证新密码强度
    if (newPassword.length < 6) {
      return errorResponse('新密码长度至少6位', 400)
    }

    // 获取用户当前信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return errorResponse('用户不存在', 404)
    }

    // 验证旧密码（这里使用简单的SHA256，实际应该使用更安全的加密方式）
    const crypto = require('crypto')
    const oldPasswordHash = crypto.createHash('sha256').update(oldPassword).digest('hex')
    
    if (user.password !== oldPasswordHash) {
      return errorResponse('旧密码错误', 400)
    }

    // 更新密码
    const newPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex')
    
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: newPasswordHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('更新密码失败:', updateError)
      return errorResponse('更新密码失败', 500)
    }

    return successResponse(null, '密码更新成功')

  } catch (error: any) {
    console.error('更新密码失败:', error)
    return errorResponse(error.message || '更新密码失败', 500)
  }
}