/**
 * 角色管理 API 接口
 * GET /api/roles - 获取角色列表
 * POST /api/roles - 创建角色
 * PUT /api/roles - 更新角色
 * DELETE /api/roles - 删除角色
 */

import { NextRequest } from 'next/server'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  withAuth
} from '@/lib/supabase'

// GET - 获取角色列表
export const GET = withAuth({ 
  requiredPermissions: ['user.view']
})(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient()
    
    // 手动解析参数，因为辅助函数不存在或签名不匹配
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const offset = (page - 1) * pageSize
    const limit = pageSize
    
    const sortBy = searchParams.get('sortBy') || 'sort_order'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    
    // 获取过滤参数
    const filters: Record<string, any> = {}
    const status = searchParams.get('status')
    const is_system = searchParams.get('is_system')
    if (status) filters.status = status
    if (is_system) filters.is_system = is_system

    // 构建查询
    let query = supabase
      .from('roles')
      .select(`
        *,
        role_permissions (
          permission:permissions (
            id,
            module,
            code,
            name,
            description
          )
        )
      `, { count: 'exact' })

    // 应用过滤
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.is_system !== undefined) {
      query = query.eq('is_system', filters.is_system === 'true')
    }

    // 应用排序
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // 应用分页
    query = query.range(offset, offset + limit - 1)

    const { data: roles, error, count } = await query

    if (error) {
      console.error('Get roles error:', error)
      return errorResponse('获取角色列表失败', 500)
    }

    // 格式化权限数据
    const formattedRoles = roles?.map(role => ({
      ...role,
      permissions: role.role_permissions?.map((rp: any) => rp.permission).filter(Boolean) || []
    }))

    return successResponse({
      roles: formattedRoles,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })

  } catch (error) {
    console.error('Get roles error:', error)
    return errorResponse('获取角色列表失败', 500)
  }
})

// POST - 创建角色
export const POST = withAuth({ 
  requiredPermissions: ['user.assign_role']
})(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { name, code, description, permission_ids = [], sort_order = 0 } = body

    // 验证必填字段
    if (!name || !code) {
      return errorResponse('缺少必填字段', 400)
    }

    const supabase = createServiceClient()

    // 检查角色代码是否已存在
    const { data: existing } = await supabase
      .from('roles')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return errorResponse('角色代码已存在', 400)
    }

    // 生成角色ID
    const { data: lastRole } = await supabase
      .from('roles')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single()

    const lastId = lastRole?.id || 'R000'
    const nextNumber = parseInt(lastId.substring(1)) + 1
    const id = `R${nextNumber.toString().padStart(3, '0')}`

    // 创建角色
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        id,
        name,
        code,
        description,
        sort_order,
        is_system: false,
        status: 'active'
      })
      .select()
      .single()

    if (roleError) {
      console.error('Create role error:', roleError)
      return errorResponse('创建角色失败', 500)
    }

    // 分配权限
    if (permission_ids.length > 0) {
      const rolePermissions = permission_ids.map((permission_id: string) => ({
        role_id: id,
        permission_id
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions)

      if (permError) {
        console.error('Assign permissions error:', permError)
        // 回滚：删除创建的角色
        await supabase.from('roles').delete().eq('id', id)
        return errorResponse('分配权限失败', 500)
      }
    }

    // 获取完整的角色信息
    const { data: fullRole } = await supabase
      .from('roles')
      .select(`
        *,
        role_permissions (
          permission:permissions (
            id,
            module,
            code,
            name
          )
        )
      `)
      .eq('id', id)
      .single()

    return successResponse(fullRole, '角色创建成功')

  } catch (error) {
    console.error('Create role error:', error)
    return errorResponse('创建角色失败', 500)
  }
})

// PUT - 更新角色
export const PUT = withAuth({ 
  requiredPermissions: ['user.assign_role']
})(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { id, name, description, sort_order, status, permission_ids } = body

    if (!id) {
      return errorResponse('缺少角色ID', 400)
    }

    const supabase = createServiceClient()

    // 检查是否为系统角色
    const { data: existingRole } = await supabase
      .from('roles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (!existingRole) {
      return errorResponse('角色不存在', 404)
    }

    if (existingRole.is_system && status === 'inactive') {
      return errorResponse('系统角色不能被禁用', 400)
    }

    // 构建更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (sort_order !== undefined) updateData.sort_order = sort_order
    if (status !== undefined) updateData.status = status

    // 更新角色基本信息
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (roleError) {
      console.error('Update role error:', roleError)
      return errorResponse('更新角色失败', 500)
    }

    // 更新权限（如果提供了）
    if (permission_ids !== undefined) {
      // 删除现有权限
      await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', id)

      // 添加新权限
      if (permission_ids.length > 0) {
        const rolePermissions = permission_ids.map((permission_id: string) => ({
          role_id: id,
          permission_id
        }))

        const { error: permError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions)

        if (permError) {
          console.error('Update permissions error:', permError)
          return errorResponse('更新权限失败', 500)
        }
      }
    }

    // 获取更新后的完整信息
    const { data: fullRole } = await supabase
      .from('roles')
      .select(`
        *,
        role_permissions (
          permission:permissions (
            id,
            module,
            code,
            name
          )
        )
      `)
      .eq('id', id)
      .single()

    return successResponse(fullRole, '角色更新成功')

  } catch (error) {
    console.error('Update role error:', error)
    return errorResponse('更新角色失败', 500)
  }
})

// DELETE - 删除角色
export const DELETE = withAuth({ 
  requiredPermissions: ['user.assign_role']
})(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return errorResponse('缺少角色ID', 400)
    }

    const supabase = createServiceClient()

    // 检查是否为系统角色
    const { data: role } = await supabase
      .from('roles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (!role) {
      return errorResponse('角色不存在', 404)
    }

    if (role.is_system) {
      return errorResponse('系统角色不能被删除', 400)
    }

    // 检查是否有用户使用此角色
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', id)
      .limit(1)

    if (users && users.length > 0) {
      return errorResponse('角色正在被使用，无法删除', 400)
    }

    // 删除角色权限关联
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', id)

    // 删除角色
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete role error:', error)
      return errorResponse('删除角色失败', 500)
    }

    return successResponse(null, '角色删除成功')

  } catch (error) {
    console.error('Delete role error:', error)
    return errorResponse('删除角色失败', 500)
  }
})