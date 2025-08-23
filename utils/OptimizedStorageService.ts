import AsyncStorage from '@react-native-async-storage/async-storage';

export class OptimizedStorageService {
  private static instance: OptimizedStorageService;
  private batchQueue: Map<string, any> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 500; // 500ms 批量延迟

  private constructor() {}

  static getInstance(): OptimizedStorageService {
    if (!OptimizedStorageService.instance) {
      OptimizedStorageService.instance = new OptimizedStorageService();
    }
    return OptimizedStorageService.instance;
  }

  // 批量设置数据
  async setBatch(key: string, value: any): Promise<void> {
    this.batchQueue.set(key, value);
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY) as unknown as NodeJS.Timeout;
  }

  // 立即执行批量操作
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.size === 0) return;

    const batch = Array.from(this.batchQueue.entries()).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    ]) as [string, string][];

    try {
      await AsyncStorage.multiSet(batch);
      this.batchQueue.clear();
    } catch (error) {
      console.error('Batch storage failed:', error);
      throw error;
    }
  }

  // 立即保存（不使用批量）
  async setImmediate(key: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      throw error;
    }
  }

  // 获取数据
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  // 批量获取
  async getMultiple<T extends Record<string, any>>(keys: string[]): Promise<Partial<T>> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      const result: Partial<T> = {};
      
      pairs.forEach(([key, value]) => {
        if (value !== null) {
          try {
            result[key as keyof T] = JSON.parse(value);
          } catch {
            result[key as keyof T] = value as any;
          }
        }
      });
      
      return result;
    } catch (error) {
      console.error('Failed to get multiple items:', error);
      return {};
    }
  }

  // 删除数据
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
    }
  }

  // 批量删除
  async removeMultiple(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Failed to remove multiple items:', error);
    }
  }

  // 清空所有数据
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }

  // 获取所有键
  async getAllKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys];
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }

  // 合并数据（用于部分更新）
  async merge(key: string, value: any): Promise<void> {
    try {
      const existing = await this.get(key) || {};
      const merged = { ...(existing as object), ...(value as object) } as any;
      await this.setImmediate(key, merged);
    } catch (error) {
      console.error(`Failed to merge ${key}:`, error);
      throw error;
    }
  }

  // 缓存管理
  async getCacheSize(): Promise<number> {
    try {
      const keys = await this.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  // 清理过期缓存
  async cleanExpiredCache(prefix: string, maxAge: number): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      const now = Date.now();
      const keysToRemove: string[] = [];
      
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          const data = await this.get<{ timestamp?: number }>(key);
          if (data?.timestamp && now - data.timestamp > maxAge) {
            keysToRemove.push(key);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        await this.removeMultiple(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to clean expired cache:', error);
    }
  }
}

// 导出单例实例
export const storageService = OptimizedStorageService.getInstance();