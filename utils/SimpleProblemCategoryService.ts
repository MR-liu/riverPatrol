import OptimizedApiService from './OptimizedApiService';

export interface ProblemCategory {
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
}

/**
 * 简化的问题分类服务 - 基于OptimizedApiService
 * 为保持向后兼容性而创建的轻量级包装器
 */
class SimpleProblemCategoryService {
  private static cachedCategories: Record<string, ProblemCategory> = {};
  private static isInitialized = false;

  static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const result = await OptimizedApiService.getProblemCategories();
      if (result.success && result.data) {
        this.cachedCategories = result.data.categories || {};
        this.isInitialized = true;
      }
    } catch (error) {
      console.error('SimpleProblemCategoryService initialization failed:', error);
    }
  }

  static getCategoryFullName(categoryId: string): string {
    if (!categoryId || !this.cachedCategories[categoryId]) {
      return '未知分类';
    }

    const category = this.cachedCategories[categoryId];
    let fullName = category.name;

    // 如果有父级分类，递归构建完整路径
    if (category.parent) {
      const parentName = this.getCategoryFullName(category.parent);
      fullName = `${parentName} > ${fullName}`;
    }

    return fullName;
  }

  static getCategories(): Record<string, ProblemCategory> {
    return this.cachedCategories;
  }

  static async refreshCategories(): Promise<void> {
    this.isInitialized = false;
    await this.initialize();
  }
}

export default SimpleProblemCategoryService;