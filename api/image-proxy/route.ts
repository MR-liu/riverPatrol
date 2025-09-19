/**
 * 图片代理API
 * GET /api/image-proxy?url=xxx
 * 用于解决CDN图片在某些环境下无法访问的问题
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: '缺少图片URL参数' },
        { status: 400 }
      );
    }

    // 验证URL是否为允许的域名
    const allowedDomains = [
      'cdn.chengyishi.com',
      'chengyishi.com',
      '211.101.237.112' // CDN IP地址
    ];

    const url = new URL(imageUrl);
    const isAllowed = allowedDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: '不允许的图片域名' },
        { status: 403 }
      );
    }

    // 获取图片
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'RiverPatrol/1.0',
        'Accept': 'image/*'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `获取图片失败: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    // 返回图片，设置缓存头
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // 缓存一年
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('图片代理错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}