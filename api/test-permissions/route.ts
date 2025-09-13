/**
 * 测试不同角色权限的API
 * 用于验证权限系统是否正常工作
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'
import { ROLE_PERMISSIONS_MAP, ROLES, ROLE_INFO } from '@/lib/permissions/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// GET - 获取所有角色的权限配置
export async function GET(request: NextRequest) {
  try {
    const rolePermissions = Object.entries(ROLE_PERMISSIONS_MAP).map(([roleCode, permissions]) => ({
      code: roleCode,
      name: ROLE_INFO[roleCode as keyof typeof ROLE_INFO]?.name || roleCode,
      description: ROLE_INFO[roleCode as keyof typeof ROLE_INFO]?.description || '',
      permissionCount: permissions.length,
      permissions: permissions
    }))

    return successResponse({
      roles: rolePermissions,
      totalRoles: rolePermissions.length,
      summary: {
        admin: ROLE_PERMISSIONS_MAP[ROLES.ADMIN].length,
        monitorManager: ROLE_PERMISSIONS_MAP[ROLES.MONITOR_MANAGER].length,
        maintainer: ROLE_PERMISSIONS_MAP[ROLES.MAINTAINER].length,
        inspector: ROLE_PERMISSIONS_MAP[ROLES.INSPECTOR].length,
        leadershipViewer: ROLE_PERMISSIONS_MAP[ROLES.LEADERSHIP_VIEWER].length,
        maintenanceSupervisor: ROLE_PERMISSIONS_MAP[ROLES.MAINTENANCE_SUPERVISOR].length
      }
    })
  } catch (error) {
    console.error('Get role permissions error:', error)
    return errorResponse('获取角色权限失败', 500)
  }
}

// POST - 测试特定角色的权限
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roleCode, testPermission } = body

    if (!roleCode) {
      return errorResponse('缺少角色代码', 400)
    }

    const permissions = ROLE_PERMISSIONS_MAP[roleCode as keyof typeof ROLE_PERMISSIONS_MAP]
    if (!permissions) {
      return errorResponse('无效的角色代码', 400)
    }

    const roleInfo = ROLE_INFO[roleCode as keyof typeof ROLE_INFO]
    
    let hasPermission = false
    if (testPermission) {
      hasPermission = permissions.includes(testPermission)
    }

    return successResponse({
      role: {
        code: roleCode,
        name: roleInfo?.name || roleCode,
        description: roleInfo?.description || ''
      },
      permissions: permissions,
      permissionCount: permissions.length,
      testResult: testPermission ? {
        permission: testPermission,
        hasPermission
      } : null,
      menuAccess: {
        dashboard: permissions.includes('dashboard.view'),
        alarms: permissions.includes('alarm.view'),
        workorders: permissions.includes('workorder.view'),
        gis: permissions.includes('gis.view'),
        analytics: permissions.includes('analytics.view'),
        regions: permissions.includes('area.view'),
        users: permissions.includes('user.view'),
        system: permissions.includes('system.config')
      }
    })
  } catch (error) {
    console.error('Test role permissions error:', error)
    return errorResponse('测试角色权限失败', 500)
  }
}