import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProblemCategory {
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
}

export interface ProblemCategoriesResponse {
  version: string;
  updated_at: string;
  categories: Record<string, ProblemCategory>;
}

export interface FrontendCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  items: string[];
  backendIds?: string[]; // 对应的后端分类ID数组
}

/**
 * 问题分类服务 - 从后端获取分类数据并缓存
 */
class EnhancedProblemCategoryService {
  private static readonly CACHE_KEY = 'problem_categories_cache';
  private static readonly CACHE_VERSION_KEY = 'problem_categories_version';
  private static readonly CACHE_EXPIRY_KEY = 'problem_categories_expiry';
  private static readonly CACHE_EXPIRY_HOURS = 24; // 缓存24小时

  // 前端分类配置（与后端分类的映射关系）
  private static readonly FRONTEND_CATEGORIES: FrontendCategory[] = [
    {
      id: 'garbage',
      name: '垃圾污染',
      icon: 'delete',
      color: '#EF4444',
      items: [],
      backendIds: ['M08001', 'M07001'] // 垃圾堆积, 成片漂浮垃圾
    },
    {
      id: 'facility',
      name: '设施损毁', 
      icon: 'build',
      color: '#6B7280',
      items: [],
      backendIds: ['M03001', 'M05001', 'M06001', 'M05002'] // 护栏损坏, 平台损坏, 标牌缺失, 凉亭损坏
    },
    {
      id: 'violation',
      name: '违规行为',
      icon: 'warning', 
      color: '#F59E0B',
      items: [],
      backendIds: ['S01001', 'S01002', 'S02001'] // 违章搭建, 占绿毁绿, 工业污染
    },
    {
      id: 'water',
      name: '水质异常',
      icon: 'opacity',
      color: '#10B981', 
      items: [],
      backendIds: ['S02002', 'S02003'] // 生活污染, 农业污染
    }
  ];

  private static backendCategories: Record<string, ProblemCategory> = {};
  private static isInitialized = false;

  /**
   * 初始化分类数据
   */
  static async initialize(supabaseUrl?: string): Promise<void> {
    try {
      // 检查缓存是否有效
      const cachedData = await this.getCachedData();
      if (cachedData && this.isCacheValid()) {
        this.backendCategories = cachedData.categories;
        this.buildFrontendCategories();
        this.isInitialized = true;
        console.log('分类数据从缓存加载成功');
        return;
      }

      // 从后端获取最新数据
      await this.fetchFromBackend(supabaseUrl);
      
    } catch (error) {
      console.error('初始化分类数据失败:', error);
      // 如果网络请求失败，尝试使用缓存数据
      const cachedData = await this.getCachedData();
      if (cachedData) {
        this.backendCategories = cachedData.categories;
        this.buildFrontendCategories();
        console.log('使用缓存的分类数据');
      } else {
        // 使用默认分类
        this.useDefaultCategories();
        console.log('使用默认分类数据');
      }
      this.isInitialized = true;
    }
  }

  /**
   * 从后端获取分类数据
   */
  private static async fetchFromBackend(supabaseUrl?: string): Promise<void> {
    const baseUrl = supabaseUrl || 'http://localhost:54321'; // 默认本地开发地址
    const url = `${baseUrl}/functions/v1/get-problem-categories`;
    
    console.log('正在从后端获取分类数据:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`获取分类数据失败: ${response.status} ${response.statusText}`);
    }

    const data: ProblemCategoriesResponse = await response.json();
    
    // 缓存数据
    await this.cacheData(data);
    
    // 更新内存中的数据
    this.backendCategories = data.categories;
    this.buildFrontendCategories();
    
    console.log('分类数据获取成功, 共', Object.keys(data.categories).length, '个分类');
    this.isInitialized = true;
  }

  /**
   * 缓存数据到本地存储
   */
  private static async cacheData(data: ProblemCategoriesResponse): Promise<void> {
    try {
      const cacheData = {
        ...data,
        cached_at: new Date().toISOString()
      };
      
      await AsyncStorage.multiSet([
        [this.CACHE_KEY, JSON.stringify(cacheData)],
        [this.CACHE_VERSION_KEY, data.version],
        [this.CACHE_EXPIRY_KEY, (Date.now() + this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000).toString()]
      ]);
      
      console.log('分类数据已缓存');
    } catch (error) {
      console.warn('缓存分类数据失败:', error);
    }
  }

  /**
   * 从缓存获取数据
   */
  private static async getCachedData(): Promise<ProblemCategoriesResponse | null> {
    try {
      const cachedDataStr = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cachedDataStr) return null;
      
      return JSON.parse(cachedDataStr);
    } catch (error) {
      console.warn('读取缓存分类数据失败:', error);
      return null;
    }
  }

  /**
   * 检查缓存是否有效
   */
  private static async isCacheValid(): Promise<boolean> {
    try {
      const expiryStr = await AsyncStorage.getItem(this.CACHE_EXPIRY_KEY);
      if (!expiryStr) return false;
      
      const expiry = parseInt(expiryStr);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  /**
   * 根据后端数据构建前端分类
   */
  private static buildFrontendCategories(): void {
    for (const category of this.FRONTEND_CATEGORIES) {
      category.items = [];
      
      if (category.backendIds) {
        for (const backendId of category.backendIds) {
          const backendCategory = this.backendCategories[backendId];
          if (backendCategory) {
            category.items.push(backendCategory.name);
          }
        }
      }
    }
  }

  /**
   * 使用默认分类数据
   */
  private static useDefaultCategories(): void {
    const defaultItems = {
      'garbage': ['生活垃圾堆积', '建筑垃圾倾倒', '漂浮垃圾', '工业废料'],
      'facility': ['护栏损坏', '标识牌缺失', '照明设施故障', '桥梁损坏'],
      'violation': ['非法排污', '违规建设', '非法捕鱼', '倾倒废料'],
      'water': ['水体发黑', '异味严重', '油污漂浮', '泡沫异常']
    };

    for (const category of this.FRONTEND_CATEGORIES) {
      category.items = defaultItems[category.id as keyof typeof defaultItems] || [];
    }
  }

  /**
   * 获取前端分类列表
   */
  static getCategories(): FrontendCategory[] {
    if (!this.isInitialized) {
      console.warn('分类服务未初始化，使用默认数据');
      this.useDefaultCategories();
    }
    return [...this.FRONTEND_CATEGORIES];
  }

  /**
   * 根据ID获取分类
   */
  static getCategoryById(categoryId: string): FrontendCategory | undefined {
    return this.FRONTEND_CATEGORIES.find(cat => cat.id === categoryId);
  }

  /**
   * 获取分类的后端ID数组
   */
  static getBackendIds(categoryId: string): string[] {
    const category = this.getCategoryById(categoryId);
    return category?.backendIds || [];
  }

  /**
   * 根据后端ID获取前端分类
   */
  static getFrontendCategoryByBackendId(backendId: string): FrontendCategory | undefined {
    return this.FRONTEND_CATEGORIES.find(cat => 
      cat.backendIds?.includes(backendId)
    );
  }

  /**
   * 获取后端分类完整名称
   */
  static getCategoryFullName(backendId: string): string | null {
    const category = this.backendCategories[backendId];
    if (!category) return null;

    // 构建完整路径名称
    let fullName = category.name;
    let currentCategory = category;
    
    while (currentCategory.parent) {
      const parentCategory = this.backendCategories[currentCategory.parent];
      if (parentCategory) {
        fullName = `${parentCategory.name} > ${fullName}`;
        currentCategory = parentCategory;
      } else {
        break;
      }
    }
    
    return fullName;
  }

  /**
   * 获取指定层级的分类
   */
  static getCategoriesByLevel(level: 1 | 2 | 3): Record<string, ProblemCategory> {
    const result: Record<string, ProblemCategory> = {};
    
    for (const [id, category] of Object.entries(this.backendCategories)) {
      if (category.level === level) {
        result[id] = category;
      }
    }
    
    return result;
  }

  /**
   * 获取指定父级的子分类
   */
  static getChildCategories(parentId: string): Record<string, ProblemCategory> {
    const result: Record<string, ProblemCategory> = {};
    
    for (const [id, category] of Object.entries(this.backendCategories)) {
      if (category.parent === parentId) {
        result[id] = category;
      }
    }
    
    return result;
  }

  /**
   * 强制刷新分类数据
   */
  static async refresh(supabaseUrl?: string): Promise<void> {
    try {
      // 清除缓存
      await AsyncStorage.multiRemove([
        this.CACHE_KEY,
        this.CACHE_VERSION_KEY, 
        this.CACHE_EXPIRY_KEY
      ]);
      
      // 重新获取数据
      await this.fetchFromBackend(supabaseUrl);
      
      console.log('分类数据刷新成功');
    } catch (error) {
      console.error('刷新分类数据失败:', error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  static async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.CACHE_KEY,
        this.CACHE_VERSION_KEY,
        this.CACHE_EXPIRY_KEY
      ]);
      console.log('分类缓存已清除');
    } catch (error) {
      console.warn('清除分类缓存失败:', error);
    }
  }

  /**
   * 获取缓存信息
   */
  static async getCacheInfo(): Promise<{
    hasCache: boolean;
    version?: string;
    cachedAt?: string;
    expiresAt?: string;
    isExpired: boolean;
  }> {
    try {
      const [cachedData, version, expiry] = await AsyncStorage.multiGet([
        this.CACHE_KEY,
        this.CACHE_VERSION_KEY,
        this.CACHE_EXPIRY_KEY
      ]);
      
      const hasCache = !!cachedData[1];
      const isExpired = expiry[1] ? Date.now() > parseInt(expiry[1]) : true;
      
      let cachedAt: string | undefined;
      if (cachedData[1]) {
        try {
          const data = JSON.parse(cachedData[1]);
          cachedAt = data.cached_at;
        } catch {}
      }
      
      return {
        hasCache,
        version: version[1] || undefined,
        cachedAt,
        expiresAt: expiry[1] ? new Date(parseInt(expiry[1])).toISOString() : undefined,
        isExpired
      };
    } catch {
      return {
        hasCache: false,
        isExpired: true
      };
    }
  }
}

export default EnhancedProblemCategoryService;