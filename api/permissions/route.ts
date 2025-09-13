/**
 * 权限管理 API 接口
 * GET /api/permissions - 获取权限列表
 * POST /api/permissions - 创建权限
 * PUT /api/permissions - 更新权限
 * DELETE /api/permissions - 删除权限
 */

import { NextRequest } from 'next/server'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  withAuth
} from '@/lib/supabase'

// GET - 获取权限列表
export const GET = withAuth({ 
  requiredPermissions: ['user.view']
})(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient()
    
    // 手动解析参数
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const offset = (page - 1) * pageSize
    const limit = pageSize
    
    const sortBy = searchParams.get('sortBy') || 'sort_order'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    
    // 获取过滤参数
    const filters: Record<string, any> = {}
    const module = searchParams.get('module')
    const status = searchParams.get('status')
    if (module) filters.module = module
    if (status) filters.status = status

    // 构建查询
    let query = supabase
      .from('permissions')
      .select('*', { count: 'exact' })

    // 应用过滤
    if (filters.module) {
      query = query.eq('module', filters.module)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    // 应用排序
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // 应用分页
    query = query.range(offset, offset + limit - 1)

    const { data: permissions, error, count } = await query

    if (error) {
      console.error('Get permissions error:', error)
      return errorResponse('获取权限列表失败', 500)
    }

    // 按模块分组
    const groupedPermissions = permissions?.reduce((acc: any, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = []
      }
      acc[perm.module].push(perm)
      return acc
    }, {})

    return successResponse({
      permissions,
      groupedPermissions,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })

  } catch (error) {
    console.error('Get permissions error:', error)
    return errorResponse('获取权限列表失败', 500)
  }
})

// POST - 创建权限
export const POST = withAuth({ 
  requiredPermissions: ['system.config']
})(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { module, code, name, description, sort_order = 0 } = body

    // 验证必填字段
    if (!module || !code || !name) {
      return errorResponse('缺少必填字段', 400)
    }

    const supabase = createServiceClient()

    // 检查权限代码是否已存在
    const { data: existing } = await supabase
      .from('permissions')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return errorResponse('权限代码已存在', 400)
    }

    // 生成权限ID
    const { data: lastPermission } = await supabase
      .from('permissions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single()

    const lastId = lastPermission?.id || 'P000'
    const nextNumber = parseInt(lastId.substring(1)) + 1
    const id = `P${nextNumber.toString().padStart(3, '0')}`

    // 创建权限
    const { data: permission, error } = await supabase
      .from('permissions')
      .insert({
        id,
        module,
        code,
        name,
        description,
        sort_order,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Create permission error:', error)
      return errorResponse('创建权限失败', 500)
    }

    return successResponse(permission, '权限创建成功')

  } catch (error) {
    console.error('Create permission error:', error)
    return errorResponse('创建权限失败', 500)
  }
})

// PUT - 更新权限
export const PUT = withAuth({ 
  requiredPermissions: ['system.config']
})(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { id, name, description, sort_order, status } = body

    if (!id) {
      return errorResponse('缺少权限ID', 400)
    }

    const supabase = createServiceClient()

    // 构建更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (sort_order !== undefined) updateData.sort_order = sort_order
    if (status !== undefined) updateData.status = status

    // 更新权限
    const { data: permission, error } = await supabase
      .from('permissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update permission error:', error)
      return errorResponse('更新权限失败', 500)
    }

    if (!permission) {
      return errorResponse('权限不存在', 404)
    }

    return successResponse(permission, '权限更新成功')

  } catch (error) {
    console.error('Update permission error:', error)
    return errorResponse('更新权限失败', 500)
  }
})

// DELETE - 删除权限
export const DELETE = withAuth({ 
  requiredPermissions: ['system.config']
})(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return errorResponse('缺少权限ID', 400)
    }

    const supabase = createServiceClient()

    // 检查权限是否被使用
    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('permission_id', id)
      .limit(1)

    if (rolePermissions && rolePermissions.length > 0) {
      return errorResponse('权限正在被使用，无法删除', 400)
    }

    // 删除权限
    const { error } = await supabase
      .from('permissions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete permission error:', error)
      return errorResponse('删除权限失败', 500)
    }

    return successResponse(null, '权限删除成功')

  } catch (error) {
    console.error('Delete permission error:', error)
    return errorResponse('删除权限失败', 500)
  }
})