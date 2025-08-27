/**
 * Supabase 配置常量
 * 统一管理 Supabase 的 URL 和 Key
 */

// Supabase 配置
export const SUPABASE_CONFIG = {
  // API Keys
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
} as const;

/**
 * 获取 Supabase URL
 * 必须使用环境变量
 */
export function getSupabaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL 环境变量是必需的');
  }
  return url;
}

/**
 * 获取 Supabase Anon Key
 * 优先使用环境变量，后备使用本地开发 key
 */
export function getSupabaseAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_CONFIG.ANON_KEY;
}

/**
 * 获取认证头
 * 如果提供了访问token则使用，否则使用anon key
 */
export function getAuthHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    const anonKey = getSupabaseAnonKey();
    headers['Authorization'] = `Bearer ${anonKey}`;
    headers['apikey'] = anonKey;
  }

  return headers;
}