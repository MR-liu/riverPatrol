/**
 * 部门管理 API 接口
 * GET /api/departments - 获取部门列表
 */

import { NextRequest } from 'next/server'
import {
  createServiceClient,
  successResponse,
  errorResponse,
  withAuth
} from '@/lib/supabase'

// GET - 获取部门列表
export const GET = withAuth({ 
  requiredPermissions: ['user.view']
})(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient()
    
    // 手动解析参数
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const parent_id = searchParams.get('parent_id')
    
    // 构建查询 - 简化查询，避免复杂的自引用
    let query = supabase
      .from('departments')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('level', { ascending: true })
    
    // 应用过滤
    if (status) {
      query = query.eq('status', status)
    }
    if (parent_id) {
      query = query.eq('parent_id', parent_id)
    }
    
    const { data: departments, error } = await query
    
    if (error) {
      console.error('Get departments error:', error)
      // 如果表不存在，返回空数组而不是错误
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return successResponse({
          departments: [],
          tree: []
        })
      }
      return errorResponse('获取部门列表失败', 500)
    }
    
    // 构建树形结构（如果需要）
    const buildTree = (items: any[], parentId: string | null = null): any[] => {
      if (!items || items.length === 0) return []
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }))
    }
    
    return successResponse({
      departments: departments || [],
      tree: buildTree(departments || [])
    })
    
  } catch (error) {
    console.error('Get departments error:', error)
    return errorResponse('获取部门列表失败', 500)
  }
})

// POST - 创建部门
export const POST = withAuth({ 
  requiredPermissions: ['user.manage']
})(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { name, code, parent_id, description, sort_order = 0 } = body
    
    // 验证必填字段
    if (!name || !code) {
      return errorResponse('缺少必填字段', 400)
    }
    
    const supabase = createServiceClient()
    
    // 检查部门代码是否已存在
    const { data: existing } = await supabase
      .from('departments')
      .select('id')
      .eq('code', code)
      .single()
    
    if (existing) {
      return errorResponse('部门代码已存在', 400)
    }
    
    // 计算层级
    let level = 1
    if (parent_id) {
      const { data: parent } = await supabase
        .from('departments')
        .select('level')
        .eq('id', parent_id)
        .single()
      
      if (parent) {
        level = parent.level + 1
      }
    }
    
    // 生成部门ID
    const { data: lastDept } = await supabase
      .from('departments')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single()
    
    const lastId = lastDept?.id || 'DEPT000'
    const nextNumber = parseInt(lastId.substring(4)) + 1
    const id = `DEPT${nextNumber.toString().padStart(3, '0')}`
    
    // 创建部门
    const { data: department, error } = await supabase
      .from('departments')
      .insert({
        id,
        name,
        code,
        parent_id,
        level,
        description,
        sort_order,
        status: 'active'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Create department error:', error)
      return errorResponse('创建部门失败', 500)
    }
    
    return successResponse(department, '部门创建成功')
    
  } catch (error) {
    console.error('Create department error:', error)
    return errorResponse('创建部门失败', 500)
  }
})

// PUT - 更新部门
export const PUT = withAuth({ 
  requiredPermissions: ['user.manage']
})(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { id, name, description, sort_order, status } = body
    
    if (!id) {
      return errorResponse('缺少部门ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 构建更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (sort_order !== undefined) updateData.sort_order = sort_order
    if (status !== undefined) updateData.status = status
    
    // 更新部门
    const { data: department, error } = await supabase
      .from('departments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Update department error:', error)
      return errorResponse('更新部门失败', 500)
    }
    
    return successResponse(department, '部门更新成功')
    
  } catch (error) {
    console.error('Update department error:', error)
    return errorResponse('更新部门失败', 500)
  }
})

// DELETE - 删除部门
export const DELETE = withAuth({ 
  requiredPermissions: ['user.manage']
})(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return errorResponse('缺少部门ID', 400)
    }
    
    const supabase = createServiceClient()
    
    // 检查是否有子部门
    const { data: children } = await supabase
      .from('departments')
      .select('id')
      .eq('parent_id', id)
      .limit(1)
    
    if (children && children.length > 0) {
      return errorResponse('该部门下有子部门，无法删除', 400)
    }
    
    // 检查是否有用户
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('department_id', id)
      .limit(1)
    
    if (users && users.length > 0) {
      return errorResponse('该部门下有用户，无法删除', 400)
    }
    
    // 删除部门
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Delete department error:', error)
      return errorResponse('删除部门失败', 500)
    }
    
    return successResponse(null, '部门删除成功')
    
  } catch (error) {
    console.error('Delete department error:', error)
    return errorResponse('删除部门失败', 500)
  }
})