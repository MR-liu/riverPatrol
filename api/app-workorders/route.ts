/**
 * 移动端工单列表 API
 * GET /api/app-workorders
 * POST /api/app-workorders (创建工单)
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { createServiceClient, successResponse, errorResponse, logApiActivity } from '@/lib/supabase'

const COOKIE_NAME = 'app-auth-token'  // 使用移动端专用 cookie
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

interface JWTPayload {
  userId: string;
  username: string;
  roleId: string;
  roleCode: string;
  areaId?: string;
  platform?: string;
  iat?: number;
  exp?: number;
}

/**
 * 获取工单列表
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
    let decoded: JWTPayload
    try {
      decoded = jwt.verify(finalToken, JWT_SECRET) as JWTPayload
    } catch (error) {
      console.error('[app-workorders] Token验证失败:', error)
      return errorResponse('会话无效或已过期', 401)
    }

    const userId = decoded.userId
    const roleId = decoded.roleId  // 使用 roleId 而不是 roleCode
    const areaId = decoded.areaId
    const supabase = createServiceClient()
    
    console.log('[app-workorders] 用户信息:', {
      userId,
      roleId,
      areaId
    })

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const assigneeIdParam = searchParams.get('assignee_id')
    const departmentIdParam = searchParams.get('department_id')
    const areaIdParam = searchParams.get('area_id')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // 构建查询 - 使用正确的外键关系
    let query = supabase
      .from('workorders')
      .select(`
        *,
        type:workorder_types!inner(id, name, category),
        creator:users!workorders_creator_id_fkey(id, name, username),
        assignee:users!workorders_assignee_id_fkey(id, name, username),
        area:river_management_areas(id, name, code),
        department:departments(id, name, code)
      `, { count: 'exact' })

    // 根据角色应用数据权限过滤
    switch (roleId) {
      case 'R001': // 系统管理员 - 查看所有
      case 'R002': // 监控中心主管 - 查看所有
      case 'R005': // 领导看板用户 - 查看所有
        // 不添加任何过滤
        break

      case 'R003': // 河道维护员 - 只看分配给自己的
        query = query.eq('assignee_id', userId)
        break

      case 'R004': // 河道巡检员 - 只看自己创建的和分配给自己的
        query = query.or(`creator_id.eq.${userId},assignee_id.eq.${userId}`)
        break

      case 'R006': // 河道维护员主管 - 只看自己管理区域的
        if (areaId) {
          query = query.eq('area_id', areaId)
        }
        break

      default:
        // 默认只能看自己相关的
        query = query.or(`creator_id.eq.${userId},assignee_id.eq.${userId}`)
        break
    }

    // 应用额外的筛选条件
    if (status && status !== 'all') {
      // 转换中文状态到英文
      const statusMap: { [key: string]: string } = {
        '待分配': 'pending',
        '已分配': 'assigned', 
        '待接收': 'accepted',
        '处理中': 'processing',
        '已完成': 'completed',
        '待审核': 'pending_review',
        '已取消': 'cancelled'
      }
      const englishStatus = statusMap[status] || status
      query = query.eq('status', englishStatus)
    }
    
    if (assigneeIdParam) {
      query = query.eq('assignee_id', assigneeIdParam)
    }
    
    if (departmentIdParam) {
      query = query.eq('department_id', departmentIdParam)
    }
    
    if (areaIdParam) {
      query = query.eq('area_id', areaIdParam)
    }

    // 搜索功能
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`)
    }

    // 排序和分页
    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('获取工单失败:', error)
      return errorResponse('获取工单失败', 500)
    }

    // 格式化工单数据 - 适配移动端需要的格式
    const formattedWorkOrders = data?.map(wo => ({
      id: wo.id,
      title: wo.title,
      description: wo.description,
      type: wo.type?.category || wo.type?.name || wo.type_id,  // 使用分类或名称作为type
      typeName: wo.type?.name,
      status: wo.status,
      priority: wo.priority === 'urgent' ? '紧急' : 
                wo.priority === 'important' ? '重要' :
                wo.priority === 'normal' ? '普通' : '低',
      location: wo.location || '未知位置',
      time: formatTime(wo.created_at),  // 格式化时间
      createdAt: wo.created_at,
      
      // 人员信息
      creator: wo.creator ? {
        id: wo.creator.id,
        name: wo.creator.name,
        username: wo.creator.username
      } : null,
      assignee: wo.assignee ? {
        id: wo.assignee.id,
        name: wo.assignee.name,
        username: wo.assignee.username
      } : null,
      
      // 区域和部门信息
      area: wo.area ? {
        id: wo.area.id,
        name: wo.area.name,
        code: wo.area.code
      } : null,
      department: wo.department ? {
        id: wo.department.id,
        name: wo.department.name,
        code: wo.department.code
      } : null,
      
      // 时间信息
      assignedAt: wo.assigned_at,
      startedAt: wo.started_at,
      completedAt: wo.completed_at,
      expectedCompleteAt: wo.expected_complete_at,
      
      // 其他信息
      source: wo.source,
      isResubmit: wo.is_resubmit,
      estimatedCost: wo.estimated_cost,
      slaStatus: wo.sla_status
    })) || []

    // 记录 API 活动
    logApiActivity('app_workorders_list', userId, {
      role_id: roleId,
      area_id: areaId,
      filters: {
        status,
        assignee_id: assigneeIdParam,
        department_id: departmentIdParam,
        search
      },
      results_count: formattedWorkOrders.length,
      page,
      limit
    })

    return successResponse({
      items: formattedWorkOrders,
      pagination: {
        page,
        limit,
        total: count || formattedWorkOrders.length,
        totalPages: Math.ceil((count || formattedWorkOrders.length) / limit)
      }
    }, '获取工单列表成功')

  } catch (error) {
    console.error('Get workorders error:', error)
    return errorResponse('获取工单失败', 500)
  }
}

/**
 * 创建工单
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
      title,
      description,
      type_id,
      priority = 'normal',
      location,
      coordinates,
      alarm_id,
      report_id,
      department_id,
      images,
      videos
    } = body

    // 验证必填字段
    if (!title || !type_id) {
      return errorResponse('标题和类型为必填项', 400)
    }

    // 生成工单ID
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const workOrderId = `WO_${dateStr}_${random}`

    // 创建工单
    const { data, error } = await supabase
      .from('workorders')
      .insert({
        id: workOrderId,
        title,
        description,
        type_id,
        priority,
        status: 'pending',
        sla_status: 'active',
        location,
        coordinates,
        alarm_id,
        report_id,
        department_id,
        creator_id: userId,
        source: 'mobile_app',
        images,
        videos,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('创建工单失败:', error)
      return errorResponse('创建工单失败', 500)
    }

    // 记录工单状态历史
    await supabase
      .from('workorder_status_history')
      .insert({
        id: `WSH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        workorder_id: workOrderId,
        old_status: null,
        new_status: 'pending',
        changed_by: userId,
        change_reason: '创建工单',
        created_at: now.toISOString()
      })

    return successResponse(data, '工单创建成功')

  } catch (error) {
    console.error('Create workorder error:', error)
    return errorResponse('创建工单失败', 500)
  }
}

// 时间格式化辅助函数
function formatTime(dateString: string): string {
  if (!dateString) return '未知时间'
  
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  // 超过7天显示具体日期
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  
  if (year === now.getFullYear()) {
    return `${month}-${day} ${hour}:${minute}`
  } else {
    return `${year}-${month}-${day}`
  }
}