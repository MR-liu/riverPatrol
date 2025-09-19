import { Image } from 'expo-image';

/**
 * 图片缓存管理服务
 */
class ImageCacheService {
  /**
   * 清除所有图片缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      await Image.clearDiskCache();
      await Image.clearMemoryCache();
      console.log('图片缓存已清除');
      return Promise.resolve();
    } catch (error) {
      console.error('清除图片缓存失败:', error);
      throw error;
    }
  }

  /**
   * 获取缓存大小（仅估算）
   */
  async getCacheSize(): Promise<string> {
    // expo-image 不提供获取缓存大小的API
    // 这里返回一个占位文本
    return '计算中...';
  }

  /**
   * 预加载图片列表
   * @param urls 图片URL数组
   */
  async preloadImages(urls: string[]): Promise<void> {
    try {
      await Image.prefetch(urls);
      console.log(`预加载了 ${urls.length} 张图片`);
    } catch (error) {
      console.error('预加载图片失败:', error);
    }
  }
}

export default new ImageCacheService();