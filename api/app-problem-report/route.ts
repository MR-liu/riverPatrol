import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, successResponse, errorResponse } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

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
 * 创建问题上报
 * POST /api/app-problem-report
 */
export async function POST(request: NextRequest) {
  try {
    // 验证token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('未授权', 401);
    }

    const token = authHeader.substring(7);
    let payload: JWTPayload;
    
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return errorResponse('无效的token', 401);
    }

    const supabase = createServiceClient();
    
    // 获取请求数据
    const body = await request.json();
    const {
      title,
      description,
      category,
      selectedItems,
      location,
      priority,
      photos,
      reporterInfo
    } = body;

    // 验证必填字段
    if (!description || !category) {
      return errorResponse('缺少必填字段', 400);
    }

    // 生成报告ID (限制在20个字符以内)
    const timestamp = Date.now().toString().slice(-6); // 取时间戳后6位
    const random = Math.random().toString(36).substr(2, 5).toUpperCase(); // 取5位随机字符
    const reportId = `PR_${timestamp}_${random}`; // 总长度: 3 + 6 + 1 + 5 = 15

    // 构建问题报告数据
    const reportData = {
      id: reportId,
      title: title || `问题上报 - ${new Date().toLocaleDateString('zh-CN')}`,
      description: description,
      category_ids: selectedItems || [category],
      images: photos || [],
      location: location?.address || '未知位置',
      coordinates: location?.coordinates || null,
      reporter_id: payload.userId,
      status: 'pending',
      severity: priority === '紧急' ? 'high' : 'medium',
      anonymous: false,
      verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 插入问题报告
    const { data: report, error: reportError } = await supabase
      .from('problem_reports')
      .insert(reportData)
      .select()
      .single();

    if (reportError) {
      console.error('创建问题报告失败:', reportError);
      return errorResponse('创建问题报告失败: ' + reportError.message, 500);
    }

    // 创建通知给监控中心主管(R002)
    try {
      // 查找所有监控中心主管
      const { data: supervisors, error: supervisorError } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', 'R002')
        .eq('status', 'active'); // 使用status字段，不是is_active

      if (!supervisorError && supervisors && supervisors.length > 0) {
        // 为每个主管创建通知
        const notifications = supervisors.map((supervisor, index) => ({
          id: `NF_${Date.now().toString().slice(-8)}${index}`,
          user_id: supervisor.id,
          type: 'problem_report',
          title: '新的问题上报',
          content: `有新的问题上报需要确认: ${reportData.title}`, // 使用content而不是message
          priority: reportData.severity === 'high' ? 'urgent' : 'normal',
          related_type: 'problem_report',
          related_id: reportId,
          metadata: {  // 使用metadata字段存储额外信息
            report_id: reportId,
            severity: reportData.severity,
            category: category
          },
          is_read: false,
          created_at: new Date().toISOString()
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    } catch (notifError) {
      console.error('创建通知失败:', notifError);
      // 继续执行，不影响主流程
    }

    // 记录操作日志
    try {
      await supabase
        .from('workorder_history')
        .insert({
          id: `WH_${Date.now().toString().slice(-10)}`,
          workorder_id: reportId,
          action_type: 'report_created',
          action_by: payload.userId,
          action_role: payload.roleId,
          comment: `创建问题上报: ${description}`,
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('记录日志失败:', logError);
      // 继续执行，不影响主流程
    }

    return successResponse({
      report: report,
      message: '问题上报成功，等待监控中心确认'
    });

  } catch (error) {
    console.error('创建问题报告错误:', error);
    return errorResponse(
      error instanceof Error ? error.message : '服务器错误',
      500
    );
  }
}

/**
 * 获取问题报告列表
 * GET /api/app-problem-report
 */
export async function GET(request: NextRequest) {
  try {
    // 验证token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('未授权', 401);
    }

    const token = authHeader.substring(7);
    let payload: JWTPayload;
    
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return errorResponse('无效的token', 401);
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    
    // 构建查询
    let query = supabase
      .from('problem_reports')
      .select(`
        *,
        reporter:users!problem_reports_reporter_id_fkey(
          id, username, name
        )
      `)
      .order('created_at', { ascending: false });

    // 根据用户角色过滤
    if (payload.roleId === 'R002') {
      // 监控中心主管可以看到所有待确认的报告
      const status = searchParams.get('status');
      if (status) {
        query = query.eq('status', status);
      }
    } else {
      // 普通用户只能看到自己的报告
      query = query.eq('reporter_id', payload.userId);
    }

    // 分页
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    query = query.range(from, to);

    const { data: reports, error, count } = await query;

    if (error) {
      console.error('获取问题报告失败:', error);
      return errorResponse('获取问题报告失败: ' + error.message, 500);
    }

    return successResponse({
      reports: reports || [],
      total: count || 0,
      page,
      pageSize
    });

  } catch (error) {
    console.error('获取问题报告错误:', error);
    return errorResponse(
      error instanceof Error ? error.message : '服务器错误',
      500
    );
  }
}