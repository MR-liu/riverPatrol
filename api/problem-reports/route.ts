/**
 * 问题报告管理API
 * GET /api/problem-reports - 获取问题报告列表（R002专用）
 * POST /api/problem-reports/{id}/review - 审核问题报告
 * POST /api/problem-reports/{id}/convert - 转换为工单
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import {
  createServiceClient,
  successResponse,
  errorResponse
} from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key'

// GET - 获取问题报告列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的访问令牌', 401)
    }
    
    // 不做权限校验，只在前端控制
    // 记录访问日志
    console.log(`用户 ${decoded.userId} (角色: ${decoded.roleId}) 访问问题报告列表`)
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    
    const supabase = createServiceClient()
    
    // 构建查询
    let query = supabase
      .from('problem_reports')
      .select(`
        *,
        reporter:users!reporter_id (
          id,
          name,
          username,
          phone
        ),
        reviewer:users!reviewed_by (
          id,
          name,
          username
        ),
        workorder:workorders!workorder_id (
          id,
          title,
          status
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // 状态过滤
    if (status) {
      query = query.eq('status', status)
    }
    
    // 分页
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)
    
    const { data: reports, error, count } = await query
    
    if (error) {
      console.error('查询问题报告失败:', error)
      return errorResponse('获取问题报告失败', 500)
    }
    
    // 统计各状态数量
    const { data: stats } = await supabase
      .from('problem_reports')
      .select('status')
      .in('status', ['pending', 'verified', 'rejected', 'converted', 'resolved'])
    
    const statistics = {
      total: stats?.length || 0,
      pending: stats?.filter(r => r.status === 'pending').length || 0,
      verified: stats?.filter(r => r.status === 'verified').length || 0,
      rejected: stats?.filter(r => r.status === 'rejected').length || 0,
      converted: stats?.filter(r => r.status === 'converted').length || 0,
      resolved: stats?.filter(r => r.status === 'resolved').length || 0
    }
    
    return successResponse({
      data: reports || [],
      total: count || 0,
      page,
      limit,
      statistics
    })
    
  } catch (error) {
    console.error('Get problem reports error:', error)
    return errorResponse('获取问题报告失败', 500)
  }
}

// POST - 审核问题报告
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return errorResponse('未授权访问', 401)
    }
    
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return errorResponse('无效的访问令牌', 401)
    }
    
    // 不做权限校验，只在前端控制
    // 记录操作日志
    console.log(`用户 ${decoded.userId} (角色: ${decoded.roleId}) 执行问题报告审核操作`)
    
    const body = await request.json()
    const { reportId, action, reviewNote, workorderData } = body
    
    if (!reportId || !action) {
      return errorResponse('缺少必填参数', 400)
    }
    
    const supabase = createServiceClient()
    
    // 获取问题报告
    const { data: report, error: fetchError } = await supabase
      .from('problem_reports')
      .select('*')
      .eq('id', reportId)
      .single()
    
    if (fetchError || !report) {
      return errorResponse('问题报告不存在', 404)
    }
    
    if (report.status !== 'pending') {
      return errorResponse('该问题报告已处理', 400)
    }
    
    const now = new Date().toISOString()
    
    // 根据操作类型处理
    if (action === 'verify') {
      // 验证通过
      const { error: updateError } = await supabase
        .from('problem_reports')
        .update({
          status: 'verified',
          reviewed_by: decoded.userId,
          reviewed_at: now,
          review_note: reviewNote || '审核通过',
          updated_at: now
        })
        .eq('id', reportId)
      
      if (updateError) {
        console.error('更新问题报告失败:', updateError)
        return errorResponse('审核失败', 500)
      }
      
      // 发送通知给报告人
      await supabase.from('notification_queue').insert({
        user_id: report.reporter_id,
        type: 'report_verified',
        title: '问题报告已审核',
        content: `您提交的问题报告"${report.title}"已通过审核`,
        priority: 'normal',
        related_type: 'problem_report',
        related_id: reportId,
        created_at: now
      })
      
      return successResponse({ message: '审核通过' })
      
    } else if (action === 'reject') {
      // 拒绝
      const { error: updateError } = await supabase
        .from('problem_reports')
        .update({
          status: 'rejected',
          reviewed_by: decoded.userId,
          reviewed_at: now,
          review_note: reviewNote || '审核拒绝',
          updated_at: now
        })
        .eq('id', reportId)
      
      if (updateError) {
        console.error('更新问题报告失败:', updateError)
        return errorResponse('审核失败', 500)
      }
      
      // 发送通知给报告人
      await supabase.from('notification_queue').insert({
        user_id: report.reporter_id,
        type: 'report_rejected',
        title: '问题报告未通过审核',
        content: `您提交的问题报告"${report.title}"未通过审核。原因：${reviewNote || '不符合要求'}`,
        priority: 'normal',
        related_type: 'problem_report',
        related_id: reportId,
        created_at: now
      })
      
      return successResponse({ message: '已拒绝' })
      
    } else if (action === 'convert') {
      // 转换为工单
      if (!workorderData) {
        return errorResponse('缺少工单信息', 400)
      }
      
      // 生成工单ID
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const workorderId = `WO-${dateStr}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
      
      // 创建工单
      const { data: newWorkorder, error: createError } = await supabase
        .from('workorders')
        .insert({
          id: workorderId,
          type_id: workorderData.type_id || 'WT_009', // 问题核查
          title: report.title,
          description: report.description,
          priority: workorderData.priority || report.severity || 'normal',
          status: 'pending_dispatch', // 人工工单初始状态为待派发
          workorder_source: 'manual', // 人工工单
          area_id: workorderData.area_id,
          location: report.location || '',
          coordinates: report.coordinates || null,
          images: report.images || report.photos || null, // 使用images字段
          creator_id: decoded.userId,
          initial_reporter_id: report.reporter_id, // 记录原始报告人
          report_id: reportId, // 关联问题报告
          created_at: now,
          updated_at: now
        })
        .select()
        .single()
      
      if (createError) {
        console.error('创建工单失败:', createError)
        return errorResponse('创建工单失败', 500)
      }
      
      // 更新问题报告状态
      const { error: updateError } = await supabase
        .from('problem_reports')
        .update({
          status: 'converted',
          reviewed_by: decoded.userId,
          reviewed_at: now,
          review_note: reviewNote || '已转工单处理',
          workorder_id: workorderId,
          updated_at: now
        })
        .eq('id', reportId)
      
      if (updateError) {
        console.error('更新问题报告失败:', updateError)
        return errorResponse('更新状态失败', 500)
      }
      
      // 发送通知给报告人
      await supabase.from('notification_queue').insert({
        user_id: report.reporter_id,
        type: 'report_converted',
        title: '问题报告已转工单',
        content: `您提交的问题报告"${report.title}"已转为工单处理，工单号：${workorderId}`,
        priority: 'normal',
        related_type: 'workorder',
        related_id: workorderId,
        created_at: now
      })
      
      // 发送通知给区域管理员(R006)
      if (workorderData.area_id) {
        const { data: area } = await supabase
          .from('river_management_areas')
          .select('supervisor_id')
          .eq('id', workorderData.area_id)
          .single()
        
        if (area?.supervisor_id) {
          await supabase.from('notification_queue').insert({
            user_id: area.supervisor_id,
            type: 'workorder_pending',
            title: '新工单待派发',
            content: `新的人工工单"${report.title}"需要派发处理`,
            priority: workorderData.priority === 'urgent' ? 'urgent' : 'important',
            related_type: 'workorder',
            related_id: workorderId,
            created_at: now
          })
        }
      }
      
      return successResponse({ 
        message: '已转工单',
        workorder_id: workorderId
      })
    }
    
    return errorResponse('无效的操作', 400)
    
  } catch (error) {
    console.error('Review problem report error:', error)
    return errorResponse('审核失败', 500)
  }
}