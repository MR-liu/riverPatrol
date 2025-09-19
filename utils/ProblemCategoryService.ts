/**
 * 问题分类服务
 * 处理问题分类的获取、缓存和离线使用
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEY = 'problem_categories_cache';
const CACHE_TIMESTAMP_KEY = 'problem_categories_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存有效期

export interface ProblemCategory {
  id: string;
  name: string;
  code: string;
  parent_id?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
  children?: ProblemCategory[];
}

class ProblemCategoryService {
  private categories: ProblemCategory[] = [];
  private isInitialized = false;
  private isLoading = false;

  /**
   * 初始化服务，在应用启动时调用
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[ProblemCategory] 初始化问题分类服务...');
      
      // 先尝试从缓存加载
      await this.loadFromCache();
      
      // 检查网络状态
      const netState = await NetInfo.fetch();
      
      if (netState.isConnected) {
        // 如果有网络，尝试更新缓存
        this.refreshCategories().catch(error => {
          console.error('[ProblemCategory] 后台刷新失败:', error);
        });
      } else {
        console.log('[ProblemCategory] 离线模式，使用缓存数据');
      }
      
      this.isInitialized = true;
      console.log('[ProblemCategory] 初始化完成，加载了', this.categories.length, '个分类');
    } catch (error) {
      console.error('[ProblemCategory] 初始化失败:', error);
      // 如果缓存也失败了，使用默认分类
      this.loadDefaultCategories();
      this.isInitialized = true;
    }
  }

  /**
   * 从缓存加载分类
   */
  private async loadFromCache(): Promise<void> {
    try {
      const [cachedData, cachedTimestamp] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(CACHE_TIMESTAMP_KEY),
      ]);

      if (cachedData) {
        const categories = JSON.parse(cachedData);
        const timestamp = cachedTimestamp ? parseInt(cachedTimestamp, 10) : 0;
        
        // 检查缓存是否过期
        const now = Date.now();
        const isExpired = now - timestamp > CACHE_DURATION;
        
        if (!isExpired || categories.length > 0) {
          this.categories = categories;
          console.log('[ProblemCategory] 从缓存加载了', categories.length, '个分类');
          
          if (isExpired) {
            console.log('[ProblemCategory] 缓存已过期，将在后台刷新');
          }
        }
      } else {
        console.log('[ProblemCategory] 没有找到缓存，将加载默认分类');
        this.loadDefaultCategories();
      }
    } catch (error) {
      console.error('[ProblemCategory] 加载缓存失败:', error);
      this.loadDefaultCategories();
    }
  }

  /**
   * 加载默认分类（硬编码的备用数据）
   */
  private loadDefaultCategories(): void {
    this.categories = [
      {
        id: 'PC_001',
        name: '水质问题',
        code: 'water_quality',
        icon: 'water',
        color: '#0099FF',
        sort_order: 1,
        is_active: true,
      },
      {
        id: 'PC_002',
        name: '垃圾污染',
        code: 'garbage',
        icon: 'trash',
        color: '#FF9900',
        sort_order: 2,
        is_active: true,
      },
      {
        id: 'PC_003',
        name: '违法行为',
        code: 'violation',
        icon: 'alert',
        color: '#FF0000',
        sort_order: 3,
        is_active: true,
      },
      {
        id: 'PC_004',
        name: '设施损坏',
        code: 'facility_damage',
        icon: 'warning',
        color: '#FFCC00',
        sort_order: 4,
        is_active: true,
      },
      {
        id: 'PC_005',
        name: '生态破坏',
        code: 'ecological_damage',
        icon: 'tree',
        color: '#00CC66',
        sort_order: 5,
        is_active: true,
      },
      {
        id: 'PC_006',
        name: '安全隐患',
        code: 'safety_hazard',
        icon: 'shield',
        color: '#FF3366',
        sort_order: 6,
        is_active: true,
      },
      {
        id: 'PC_007',
        name: '其他问题',
        code: 'other',
        icon: 'info',
        color: '#999999',
        sort_order: 99,
        is_active: true,
      },
    ];
    console.log('[ProblemCategory] 加载默认分类:', this.categories.length);
  }

  /**
   * 从服务器刷新分类
   */
  async refreshCategories(): Promise<void> {
    if (this.isLoading) {
      console.log('[ProblemCategory] 已经在加载中，跳过');
      return;
    }

    this.isLoading = true;

    try {
      console.log('[ProblemCategory] 从服务器获取最新分类...');
      
      // 通过 Next.js API 获取分类
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const token = await AsyncStorage.getItem('authToken'); // 获取存储的 token
      
      const response = await fetch(`${API_URL}/api/app-problem-categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const { categories, flat_categories } = result.data;
        
        if (flat_categories && flat_categories.length > 0) {
          // 使用平铺的分类列表
          this.categories = this.buildCategoryTree(flat_categories);
          await this.saveToCache(this.categories);
          console.log('[ProblemCategory] 从服务器加载了', flat_categories.length, '个分类');
        } else if (categories && categories.length > 0) {
          // 使用已经构建好的树结构
          this.categories = categories;
          await this.saveToCache(this.categories);
          console.log('[ProblemCategory] 从服务器加载了分类树');
        } else {
          console.log('[ProblemCategory] 服务器返回空数据，保持现有分类');
        }
      } else {
        console.log('[ProblemCategory] 服务器响应格式错误，保持现有分类');
      }
    } catch (error) {
      console.error('[ProblemCategory] 从服务器获取分类失败:', error);
      // 保持现有分类不变
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 构建分类树（支持层级结构）
   */
  private buildCategoryTree(categories: ProblemCategory[]): ProblemCategory[] {
    const map = new Map<string, ProblemCategory>();
    const roots: ProblemCategory[] = [];

    // 第一遍：创建所有节点的映射
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // 第二遍：构建树结构
    categories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id && map.has(cat.parent_id)) {
        const parent = map.get(cat.parent_id)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // 排序
    roots.sort((a, b) => a.sort_order - b.sort_order);
    roots.forEach(root => {
      if (root.children) {
        root.children.sort((a, b) => a.sort_order - b.sort_order);
      }
    });

    return roots;
  }

  /**
   * 保存到缓存
   */
  private async saveToCache(categories: ProblemCategory[]): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(categories)),
        AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString()),
      ]);
      console.log('[ProblemCategory] 保存到缓存成功');
    } catch (error) {
      console.error('[ProblemCategory] 保存缓存失败:', error);
    }
  }

  /**
   * 获取所有激活的分类
   */
  getCategories(): ProblemCategory[] {
    return this.categories.filter(cat => cat.is_active);
  }

  /**
   * 获取平铺的分类列表（用于选择器）
   */
  getFlatCategories(): ProblemCategory[] {
    const flat: ProblemCategory[] = [];
    
    const flatten = (categories: ProblemCategory[], level = 0) => {
      categories.forEach(cat => {
        flat.push({
          ...cat,
          name: level > 0 ? `${'  '.repeat(level)}${cat.name}` : cat.name,
        });
        if (cat.children && cat.children.length > 0) {
          flatten(cat.children, level + 1);
        }
      });
    };
    
    flatten(this.getCategories());
    return flat;
  }

  /**
   * 根据ID获取分类
   */
  getCategoryById(id: string): ProblemCategory | undefined {
    const findInTree = (categories: ProblemCategory[]): ProblemCategory | undefined => {
      for (const cat of categories) {
        if (cat.id === id) {
          return cat;
        }
        if (cat.children) {
          const found = findInTree(cat.children);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };
    
    return findInTree(this.categories);
  }

  /**
   * 根据代码获取分类
   */
  getCategoryByCode(code: string): ProblemCategory | undefined {
    const findInTree = (categories: ProblemCategory[]): ProblemCategory | undefined => {
      for (const cat of categories) {
        if (cat.code === code) {
          return cat;
        }
        if (cat.children) {
          const found = findInTree(cat.children);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };
    
    return findInTree(this.categories);
  }

  /**
   * 清除缓存（用于调试或强制刷新）
   */
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEY),
        AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY),
      ]);
      console.log('[ProblemCategory] 缓存已清除');
    } catch (error) {
      console.error('[ProblemCategory] 清除缓存失败:', error);
    }
  }

  /**
   * 强制刷新（清除缓存并重新获取）
   */
  async forceRefresh(): Promise<void> {
    await this.clearCache();
    this.isInitialized = false;
    this.categories = [];
    await this.initialize();
  }
}

export default new ProblemCategoryService();