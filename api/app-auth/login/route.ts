/**
 * 移动端登录 API 接口
 * POST /api/app-auth/login
 * 专门为移动端设计，包含区域权限处理
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
  cookieName: 'app-auth-token', // 移动端专用cookie
  defaultExpiry: 7 * 24 * 60 * 60, // 移动端默认7天
  rememberMeExpiry: 30 * 24 * 60 * 60, // 记住我30天
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
  areaId: string | null,
  expiresIn: number
): string {
  return jwt.sign(
    {
      userId,
      username,
      roleId,
      roleCode,
      areaId,
      platform: 'mobile', // 标记为移动端token
      iat: Math.floor(Date.now() / 1000),
    },
    SESSION_CONFIG.tokenSecret,
    { expiresIn }
  )
}

/**
 * 获取用户管理的区域
 */
async function getUserArea(supabase: any, userId: string, roleId: string): Promise<{
  areaId: string | null;
  areaName: string | null;
  areaCode: string | null;
}> {
  let areaId = null;
  let areaName = null;
  let areaCode = null;

  try {
    switch (roleId) {
      case 'R006': // 河道维护员主管
        const { data: supervisorArea } = await supabase
          .from('river_management_areas')
          .select('id, name, code')
          .eq('supervisor_id', userId)
          .single();
        
        if (supervisorArea) {
          areaId = supervisorArea.id;
          areaName = supervisorArea.name;
          areaCode = supervisorArea.code;
          console.log(`[MobileLogin] 主管 ${userId} 管理区域: ${areaName}(${areaId})`);
        }
        break;

      case 'R003': // 河道维护员
      case 'R004': // 河道巡检员
        const { data: workerTeam } = await supabase
          .from('maintenance_teams')
          .select(`
            area_id,
            river_management_areas!inner(
              id,
              name,
              code
            )
          `)
          .eq('worker_id', userId)
          .eq('status', 'active')
          .single();
        
        if (workerTeam && workerTeam.river_management_areas) {
          areaId = workerTeam.river_management_areas.id;
          areaName = workerTeam.river_management_areas.name;
          areaCode = workerTeam.river_management_areas.code;
          console.log(`[MobileLogin] 员工 ${userId} 所属区域: ${areaName}(${areaId})`);
        }
        break;

      default:
        // R001, R002, R005 等角色不需要区域限制
        console.log(`[MobileLogin] 角色 ${roleId} 不需要区域限制`);
        break;
    }
  } catch (error) {
    console.error('[MobileLogin] 获取用户区域失败:', error);
  }

  return { areaId, areaName, areaCode };
}

/**
 * 获取移动端用户权限
 */
function getMobilePermissions(roleId: string): string[] {
  // 移动端权限简化版 - 使用角色ID
  const mobilePermissions: Record<string, string[]> = {
    'R001': ['all'], // 系统管理员 - 全部权限
    'R002': ['workorder.manage', 'alarm.manage', 'analytics.view'], // 监控中心主管
    'R003': ['workorder.process', 'workorder.complete'], // 河道维护员
    'R004': ['workorder.patrol', 'mobile.report', 'mobile.checkin'], // 河道巡检员
    'R005': ['analytics.view', 'dashboard.view'], // 领导看板用户
    'R006': ['workorder.manage', 'area.manage', 'team.manage'], // 河道维护员主管
  };

  return mobilePermissions[roleId] || [];
}

export async function POST(request: NextRequest) {
  try {
    // 验证请求体
    const { data: input, error: validationError } = await validateRequestBody(
      request,
      UserSchemas.login.extend({
        remember_me: z.boolean().optional().default(true), // 移动端默认记住
        device_info: z.object({
          platform: z.string().optional(),
          model: z.string().optional(),
          version: z.string().optional(),
        }).optional()
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
      logApiActivity('mobile_login_failed', 'anonymous', {
        username: input.username,
        reason: 'user_not_found',
        platform: 'mobile'
      })
      return errorResponse('用户名或密码错误', 401)
    }

    // 2. 检查是否允许移动端登录
    // 支持移动端的角色ID列表
    const allowedMobileRoleIds = ['R001', 'R002', 'R003', 'R004', 'R005', 'R006'];
    // 支持移动端的角色代码列表
    const allowedMobileRoleCodes = ['ADMIN', 'MONITOR_MANAGER', 'MAINTAINER', 'INSPECTOR', 'LEADERSHIP_VIEWER', 'MAINTENANCE_SUPERVISOR'];
    
    const userRoleId = user.role_id;
    const userRoleCode = user.role?.code;
    
    console.log('[MobileLogin] 用户角色检查:', {
      username: user.username,
      role_id: userRoleId,
      role_code: userRoleCode
    });
    
    // 检查角色ID或角色代码是否允许
    if (!allowedMobileRoleIds.includes(userRoleId) && !allowedMobileRoleCodes.includes(userRoleCode)) {
      console.error('[MobileLogin] 角色不支持移动端登录:', { roleId: userRoleId, roleCode: userRoleCode });
      return errorResponse(`您的角色不支持移动端登录`, 403)
    }

    // 3. 检查账号状态
    if (user.status === 'suspended') {
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

    // 4. 验证密码
    const hashedPassword = hashPassword(input.password)
    if (user.password !== hashedPassword) {
      // 更新登录失败次数
      const newAttempts = (user.login_attempts || 0) + 1
      const updateData: any = {
        login_attempts: newAttempts,
        last_login_attempt: new Date().toISOString()
      }

      if (newAttempts >= 5) {
        updateData.status = 'suspended'
      }

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      logApiActivity('mobile_login_failed', user.id, {
        username: input.username,
        reason: 'invalid_password',
        attempts: newAttempts,
        platform: 'mobile'
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

    // 5. 获取用户管理的区域
    const { areaId, areaName, areaCode } = await getUserArea(
      supabase, 
      user.id, 
      user.role_id  // 使用role_id而不是role.code
    );

    // 6. 获取移动端权限
    const mobilePermissions = getMobilePermissions(user.role_id);  // 使用role_id

    // 7. 生成会话 Token
    const expiresIn = input.remember_me 
      ? SESSION_CONFIG.rememberMeExpiry 
      : SESSION_CONFIG.defaultExpiry
    
    const token = generateToken(
      user.id,
      user.username,
      user.role_id,
      user.role_id,  // 使用role_id代替role.code，因为我们的权限系统基于role_id
      areaId,
      expiresIn
    )

    // 8. 更新用户登录信息
    await supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_platform: 'mobile',
        login_attempts: 0,
        last_login_attempt: null
      })
      .eq('id', user.id)

    // 9. 记录设备信息（如果提供）
    if (input.device_info) {
      await supabase
        .from('user_login_devices')
        .upsert({
          user_id: user.id,
          platform: input.device_info.platform || 'unknown',
          device_model: input.device_info.model || 'unknown',
          app_version: input.device_info.version || 'unknown',
          last_login_at: new Date().toISOString()
        })
    }

    // 10. 设置 Cookie（可选，移动端主要使用token）
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

    // 11. 记录登录日志
    logApiActivity('mobile_login_success', user.id, {
      username: user.username,
      role_id: user.role_id,
      role_code: user.role?.code,
      area_id: areaId,
      remember_me: input.remember_me,
      platform: 'mobile',
      device_info: input.device_info
    })

    // 12. 返回用户信息
    const responseData = {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role_id: user.role_id,
        role: {
          id: user.role.id,
          name: user.role.name,
          code: user.role.code,
        },
        department_id: user.department_id,
        department: user.department,
        // 区域信息
        area_id: areaId,
        area_name: areaName,
        area_code: areaCode,
        // 移动端权限
        permissions: mobilePermissions,
        // 其他信息
        last_login_at: user.last_login_at,
        platform: 'mobile'
      },
      token,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
    }

    return successResponse(responseData, '登录成功')

  } catch (error) {
    console.error('Mobile login error:', error)
    return errorResponse('登录失败，请稍后重试', 500)
  }
}