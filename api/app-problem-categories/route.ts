/**
 * 移动端问题分类 API
 * GET /api/app-problem-categories
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase'

const COOKIE_NAME = 'auth-token'
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

export async function GET(request: NextRequest) {
  try {
    // 获取并验证 token（可选，分类数据可以公开访问）
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    
    // 也支持从 Authorization header 获取 token（用于移动端）
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.replace('Bearer ', '')
    
    const finalToken = token || headerToken
    
    // 分类数据可以公开访问，但有 token 的话验证一下
    if (finalToken) {
      try {
        jwt.verify(finalToken, JWT_SECRET)
      } catch (error) {
        // Token 无效但不影响获取分类
        console.warn('Token validation failed, but categories are public', error)
      }
    }

    const supabase = createServiceClient()

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('include_inactive') === 'true'
    const parentId = searchParams.get('parent_id')

    // 构建查询
    let query = supabase
      .from('problem_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    // 是否包含未激活的分类
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    // 如果指定了父分类ID
    if (parentId) {
      if (parentId === 'root') {
        // 获取顶级分类
        query = query.is('parent_id', null)
      } else {
        query = query.eq('parent_id', parentId)
      }
    }

    const { data: categories, error } = await query

    if (error) {
      console.error('获取问题分类失败:', error)
      return errorResponse('获取问题分类失败', 500)
    }

    // 构建分类树结构
    const buildCategoryTree = (categories: any[]) => {
      const map = new Map()
      const roots = []

      // 第一遍：创建所有节点的映射
      categories.forEach(cat => {
        map.set(cat.id, { ...cat, children: [] })
      })

      // 第二遍：构建树结构
      categories.forEach(cat => {
        const node = map.get(cat.id)
        if (cat.parent_id && map.has(cat.parent_id)) {
          const parent = map.get(cat.parent_id)
          parent.children.push(node)
        } else if (!cat.parent_id) {
          roots.push(node)
        }
      })

      return roots
    }

    // 返回数据格式
    const responseData = {
      categories: buildCategoryTree(categories || []),
      flat_categories: categories || [], // 平铺的分类列表
      total: categories?.length || 0,
      last_updated: new Date().toISOString()
    }

    return successResponse(responseData, '获取问题分类成功')

  } catch (error) {
    console.error('Problem categories error:', error)
    return errorResponse('获取问题分类失败', 500)
  }
}