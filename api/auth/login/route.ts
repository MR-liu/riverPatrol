/**
 * 登录 API 接口
 * POST /api/auth/login
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { z } from 'zod'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  validateRequestBody,
  UserSchemas,
  logApiActivity
} from '@/lib/supabase'

// 会话配置
const SESSION_CONFIG = {
  tokenSecret: process.env.JWT_SECRET || 'default-secret-key',
  cookieName: 'auth-token',
  defaultExpiry: 24 * 60 * 60, // 24小时
  rememberMeExpiry: 7 * 24 * 60 * 60, // 7天
}

/**
 * 密码哈希函数
 */
function hashPassword(password: string): string {
  const salt = 'smart_river_salt'
  return crypto.createHash('sha256').update(password + salt).digest('hex')
}

/**
 * 生成 JWT Token
 */
function generateToken(
  userId: string,
  username: string,
  roleId: string,
  roleCode: string,
  expiresIn: number
): string {
  return jwt.sign(
    {
      userId,
      username,
      roleId,
      roleCode,
      iat: Math.floor(Date.now() / 1000),
    },
    SESSION_CONFIG.tokenSecret,
    { expiresIn }
  )
}

export async function POST(request: NextRequest) {
  try {
    // 验证请求体
    const { data: input, error: validationError } = await validateRequestBody(
      request,
      UserSchemas.login.extend({
        remember_me: z.boolean().optional().default(false)
      })
    )

    if (validationError) {
      return errorResponse(validationError, 400)
    }

    const supabase = createServiceClient()

    // 1. 查询用户
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        password,
        name,
        phone,
        email,
        avatar,
        role_id,
        department_id,
        area_id,
        status,
        login_attempts,
        last_login_attempt,
        role:roles!inner(
          id,
          name,
          code,
          description
        ),
        department:departments(
          id,
          name,
          code
        )
      `)
      .eq('username', input.username)
      .single()

    if (userError || !user) {
      logApiActivity('login_failed', 'anonymous', {
        username: input.username,
        reason: 'user_not_found'
      })
      return errorResponse('用户名或密码错误', 401)
    }

    // 2. 检查账号状态
    if (user.status === 'suspended') {
      // 检查是否因为登录失败次数过多被锁定
      if (user.login_attempts >= 5) {
        const lastAttempt = user.last_login_attempt 
          ? new Date(user.last_login_attempt) 
          : new Date()
        const lockTime = 30 * 60 * 1000 // 30分钟
        const now = new Date()
        
        if (now.getTime() - lastAttempt.getTime() < lockTime) {
          const remainingMinutes = Math.ceil(
            (lockTime - (now.getTime() - lastAttempt.getTime())) / 60000
          )
          return errorResponse(
            `账号已被锁定，请${remainingMinutes}分钟后重试`,
            403
          )
        } else {
          // 解锁账号
          await supabase
            .from('users')
            .update({
              status: 'active',
              login_attempts: 0
            })
            .eq('id', user.id)
        }
      } else {
        return errorResponse('账号已被禁用，请联系管理员', 403)
      }
    }

    if (user.status === 'inactive') {
      return errorResponse('账号未激活，请联系管理员', 403)
    }

    // 3. 验证密码
    const hashedPassword = hashPassword(input.password)
    if (user.password !== hashedPassword) {
      // 更新登录失败次数
      const newAttempts = (user.login_attempts || 0) + 1
      const updateData: any = {
        login_attempts: newAttempts,
        last_login_attempt: new Date().toISOString()
      }

      // 如果失败次数达到5次，锁定账号
      if (newAttempts >= 5) {
        updateData.status = 'suspended'
      }

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      logApiActivity('login_failed', user.id, {
        username: input.username,
        reason: 'invalid_password',
        attempts: newAttempts
      })

      if (newAttempts >= 5) {
        return errorResponse('登录失败次数过多，账号已被锁定30分钟', 403)
      } else {
        return errorResponse(
          `用户名或密码错误，还有${5 - newAttempts}次尝试机会`,
          401
        )
      }
    }

    // 4. 获取用户权限
    const { data: permissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permission:permissions(
          id,
          module,
          code,
          name
        )
      `)
      .eq('role_id', user.role_id)

    const userPermissions = permissions?.map(p => p.permission?.code).filter(Boolean) || []

    // 5. 生成会话 Token
    const expiresIn = input.remember_me 
      ? SESSION_CONFIG.rememberMeExpiry 
      : SESSION_CONFIG.defaultExpiry
    
    const token = generateToken(
      user.id,
      user.username,
      user.role_id,
      user.role.code,
      expiresIn
    )

    // 6. 更新用户登录信息
    await supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        login_attempts: 0,
        last_login_attempt: null
      })
      .eq('id', user.id)

    // 7. 设置 Cookie
    const cookieStore = await cookies()
    cookieStore.set({
      name: SESSION_CONFIG.cookieName,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/'
    })

    // 8. 记录登录日志
    logApiActivity('login_success', user.id, {
      username: user.username,
      role: user.role.code,
      remember_me: input.remember_me
    })

    // 8.5 根据用户角色查询管理的区域
    let userAreaId = user.area_id; // 先尝试从用户表获取（如果有的话）
    
    // 对于需要区域权限的角色，查找其管理或所属的区域
    const roleCode = user.role.code;
    if (roleCode === 'MAINTENANCE_SUPERVISOR' || roleCode === 'INSPECTOR' || roleCode === 'MAINTAINER') {
      // 河道维护员主管 - 从river_management_areas表查找
      if (roleCode === 'MAINTENANCE_SUPERVISOR') {
        const { data: areaData } = await supabase
          .from('river_management_areas')
          .select('id, name')
          .eq('supervisor_id', user.id)
          .single();
        
        if (areaData) {
          userAreaId = areaData.id;
          console.log(`[Login] Found area ${areaData.name}(${userAreaId}) for supervisor ${user.name}`);
        }
      }
      
      // 河道维护员/巡检员 - 从maintenance_teams表查找
      if ((roleCode === 'MAINTAINER' || roleCode === 'INSPECTOR') && !userAreaId) {
        const { data: teamData } = await supabase
          .from('maintenance_teams')
          .select('area_id')
          .eq('worker_id', user.id)
          .single();
        
        if (teamData) {
          userAreaId = teamData.area_id;
          const roleType = roleCode === 'MAINTAINER' ? 'maintainer' : 'inspector';
          console.log(`[Login] Found area ${userAreaId} for ${roleType} ${user.name}`);
        }
      }
    }
    
    // 9. 返回用户信息
    const responseData = {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role_id: user.role_id,
        role: user.role,
        department_id: user.department_id,
        department: user.department,
        area_id: userAreaId,
        permissions: userPermissions,
        last_login_at: user.last_login_at
      },
      token,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
    }

    return successResponse(responseData, '登录成功')

  } catch (error) {
    console.error('Login error:', error)
    return errorResponse('登录失败，请稍后重试', 500)
  }
}