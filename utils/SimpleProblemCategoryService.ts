import ProblemCategoryService from './ProblemCategoryService';

export interface ProblemCategory {
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
}

/**
 * 简化的问题分类服务 - 基于ProblemCategoryService
 * 为保持向后兼容性而创建的轻量级包装器
 */
class SimpleProblemCategoryService {
  private static cachedCategories: Record<string, ProblemCategory> = {};
  private static isInitialized = false;

  static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // 使用新的ProblemCategoryService初始化
      await ProblemCategoryService.initialize();
      
      // 从ProblemCategoryService获取分类并转换格式
      const categories = ProblemCategoryService.getCategories();
      this.cachedCategories = {};
      
      // 转换为兼容的格式
      categories.forEach(cat => {
        this.cachedCategories[cat.id] = {
          name: cat.name,
          level: 1,
          parent: cat.parent_id || null
        };
        
        // 处理子分类
        if (cat.children) {
          cat.children.forEach(subCat => {
            this.cachedCategories[subCat.id] = {
              name: subCat.name,
              level: 2,
              parent: cat.id
            };
            
            // 处理三级分类
            if (subCat.children) {
              subCat.children.forEach(detailCat => {
                this.cachedCategories[detailCat.id] = {
                  name: detailCat.name,
                  level: 3,
                  parent: subCat.id
                };
              });
            }
          });
        }
      });
      
      this.isInitialized = true;
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
    // 强制刷新ProblemCategoryService的缓存
    await ProblemCategoryService.forceRefresh();
    this.isInitialized = false;
    await this.initialize();
  }

  // 添加缺少的方法以保持兼容性
  static getMainCategories() {
    return Object.entries(this.cachedCategories)
      .filter(([_, cat]) => cat.level === 1)
      .map(([id, cat]) => ({ id, name: cat.name }));
  }

  static getSubCategories(parentId: string) {
    return Object.entries(this.cachedCategories)
      .filter(([_, cat]) => cat.level === 2 && cat.parent === parentId)
      .map(([id, cat]) => ({ id, name: cat.name }));
  }

  static getDetailCategories(parentId: string) {
    return Object.entries(this.cachedCategories)
      .filter(([_, cat]) => cat.level === 3 && cat.parent === parentId)
      .map(([id, cat]) => ({ id, name: cat.name }));
  }

  static getCategoryById(categoryId: string) {
    const category = this.cachedCategories[categoryId];
    if (category) {
      return { id: categoryId, name: category.name };
    }
    return null;
  }
}

export default SimpleProblemCategoryService;