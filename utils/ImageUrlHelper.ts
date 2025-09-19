/**
 * 图片URL处理助手
 * 用于处理CDN图片URL在某些环境下无法访问的问题
 */

class ImageUrlHelper {
  private useProxy: boolean = false;
  private apiUrl: string = '';

  constructor() {
    // 从环境变量获取API URL
    this.apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.12:3000';
    
    // 默认不使用代理，直接使用CDN URL
    this.useProxy = false;
    console.log('图片加载模式：直接使用CDN URL');
  }

  /**
   * 检查是否需要使用代理
   */
  private async checkIfProxyNeeded() {
    try {
      // 尝试访问CDN测试图片
      const testUrl = 'https://cdn.chengyishi.com/favicon.ico';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

      await fetch(testUrl, { 
        signal: controller.signal,
        method: 'HEAD' 
      });
      
      clearTimeout(timeoutId);
      this.useProxy = false;
      console.log('CDN直连可用');
    } catch (error) {
      this.useProxy = true;
      console.log('CDN直连不可用，将使用代理');
    }
  }

  /**
   * 处理图片URL
   * @param url 原始图片URL
   * @returns 处理后的URL
   */
  processImageUrl(url: string): string {
    if (!url) return '';

    // 直接返回原始URL，不做任何处理
    // CDN的HTTPS图片应该直接加载
    return url;
  }

  /**
   * 批量处理图片URL
   * @param urls URL数组
   * @returns 处理后的URL数组
   */
  processImageUrls(urls: string[]): string[] {
    return urls.map(url => this.processImageUrl(url));
  }

  /**
   * 强制启用代理模式
   */
  enableProxy() {
    this.useProxy = true;
    console.log('已启用图片代理模式');
  }

  /**
   * 禁用代理模式
   */
  disableProxy() {
    this.useProxy = false;
    console.log('已禁用图片代理模式');
  }

  /**
   * 获取代理状态
   */
  isProxyEnabled(): boolean {
    return this.useProxy;
  }
}

export default new ImageUrlHelper();