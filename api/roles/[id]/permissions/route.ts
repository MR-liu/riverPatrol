/**
 * 角色权限管理 API 接口
 * GET /api/roles/[id]/permissions - 获取角色权限
 * PUT /api/roles/[id]/permissions - 更新角色权限
 */

import { NextRequest } from 'next/server'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  withAuth
} from '@/lib/supabase'

// GET - 获取角色权限
export const GET = withAuth({ 
  requiredPermissions: ['user.view']
})(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const roleId = params.id
    const supabase = createServiceClient()

    // 获取角色信息
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select(`
        id,
        name,
        code,
        description,
        is_system
      `)
      .eq('id', roleId)
      .single()

    if (roleError || !role) {
      return errorResponse('角色不存在', 404)
    }

    // 获取角色权限
    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permission:permissions (
          id,
          module,
          code,
          name,
          description,
          sort_order
        )
      `)
      .eq('role_id', roleId)

    if (permError) {
      console.error('Get role permissions error:', permError)
      return errorResponse('获取角色权限失败', 500)
    }

    // 获取所有权限（用于对比）
    const { data: allPermissions, error: allPermError } = await supabase
      .from('permissions')
      .select('*')
      .eq('status', 'active')
      .order('module')
      .order('sort_order')

    if (allPermError) {
      console.error('Get all permissions error:', allPermError)
      return errorResponse('获取权限列表失败', 500)
    }

    // 格式化权限数据
    const assignedPermissions = rolePermissions?.map((rp: any) => rp.permission).filter(Boolean) || []
    const assignedPermissionIds = assignedPermissions.map((p: any) => p.id)

    // 按模块分组所有权限
    const permissionsByModule = allPermissions?.reduce((acc: any, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = {
          module: perm.module,
          permissions: []
        }
      }
      acc[perm.module].permissions.push({
        ...perm,
        assigned: assignedPermissionIds.includes(perm.id)
      })
      return acc
    }, {})

    return successResponse({
      role,
      assignedPermissions,
      assignedPermissionIds,
      permissionsByModule: Object.values(permissionsByModule || {})
    })

  } catch (error) {
    console.error('Get role permissions error:', error)
    return errorResponse('获取角色权限失败', 500)
  }
})

// PUT - 更新角色权限
export const PUT = withAuth({ 
  requiredPermissions: ['user.assign_role']
})(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const roleId = params.id
    const body = await request.json()
    const { permission_ids = [] } = body

    const supabase = createServiceClient()

    // 检查角色是否存在
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name, is_system')
      .eq('id', roleId)
      .single()

    if (roleError || !role) {
      return errorResponse('角色不存在', 404)
    }

    // 验证权限ID是否有效
    if (permission_ids.length > 0) {
      const { data: validPermissions, error: validError } = await supabase
        .from('permissions')
        .select('id')
        .in('id', permission_ids)
        .eq('status', 'active')

      if (validError) {
        console.error('Validate permissions error:', validError)
        return errorResponse('验证权限失败', 500)
      }

      const validIds = validPermissions?.map(p => p.id) || []
      const invalidIds = permission_ids.filter((id: string) => !validIds.includes(id))

      if (invalidIds.length > 0) {
        return errorResponse(`无效的权限ID: ${invalidIds.join(', ')}`, 400)
      }
    }

    // 开始事务性操作
    // 1. 删除现有权限
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)

    if (deleteError) {
      console.error('Delete existing permissions error:', deleteError)
      return errorResponse('删除现有权限失败', 500)
    }

    // 2. 添加新权限
    if (permission_ids.length > 0) {
      const rolePermissions = permission_ids.map((permission_id: string) => ({
        role_id: roleId,
        permission_id,
        created_at: new Date().toISOString()
      }))

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions)

      if (insertError) {
        console.error('Insert new permissions error:', insertError)
        return errorResponse('分配权限失败', 500)
      }
    }

    // 3. 获取更新后的权限列表
    const { data: updatedPermissions, error: fetchError } = await supabase
      .from('role_permissions')
      .select(`
        permission:permissions (
          id,
          module,
          code,
          name,
          description
        )
      `)
      .eq('role_id', roleId)

    if (fetchError) {
      console.error('Fetch updated permissions error:', fetchError)
      return errorResponse('获取更新后的权限失败', 500)
    }

    const formattedPermissions = updatedPermissions?.map((rp: any) => rp.permission).filter(Boolean) || []

    return successResponse({
      role_id: roleId,
      role_name: role.name,
      permissions: formattedPermissions,
      permission_count: formattedPermissions.length
    }, '角色权限更新成功')

  } catch (error) {
    console.error('Update role permissions error:', error)
    return errorResponse('更新角色权限失败', 500)
  }
})