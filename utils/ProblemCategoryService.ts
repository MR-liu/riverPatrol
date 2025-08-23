export interface ProblemCategory {
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parent: string | null;
  children?: CategoryOption[];
}

export class ProblemCategoryService {
  private static instance: ProblemCategoryService;
  
  // 问题分类数据结构
  private readonly problemCategories: Record<string, ProblemCategory> = {
    // 一级分类：大类
    "M00000": { name: "养护类问题", level: 1, parent: null },
    "S00000": { name: "监管类问题", level: 1, parent: null },
    
    // 二级分类：养护类子分类
    "M01000": { name: "河道堤防", level: 2, parent: "M00000" },
    "M02000": { name: "河道绿化", level: 2, parent: "M00000" },
    "M03000": { name: "河道护栏", level: 2, parent: "M00000" },
    "M04000": { name: "防汛通道", level: 2, parent: "M00000" },
    "M05000": { name: "河道景观设施", level: 2, parent: "M00000" },
    "M06000": { name: "河道标识标牌", level: 2, parent: "M00000" },
    "M07000": { name: "河面环境", level: 2, parent: "M00000" },
    "M08000": { name: "河边环境", level: 2, parent: "M00000" },
    
    // 二级分类：监管类子分类
    "S01000": { name: "违法侵占河道", level: 2, parent: "S00000" },
    "S02000": { name: "河道污染", level: 2, parent: "S00000" },
    
    // 三级分类：具体问题项（养护类-河道堤防）
    "M01001": { name: "结构损坏", level: 3, parent: "M01000" },
    "M01002": { name: "土体流失", level: 3, parent: "M01000" },
    "M01003": { name: "堤防坍塌", level: 3, parent: "M01000" },
    
    // 三级分类：具体问题项（养护类-河道绿化）
    "M02001": { name: "成片枯死，泥土裸露，大型杂草", level: 3, parent: "M02000" },
    "M02002": { name: "绿化设施破损", level: 3, parent: "M02000" },
    "M02003": { name: "树木缺失、枯死", level: 3, parent: "M02000" },
    "M02004": { name: "树木严重倾斜、倒伏", level: 3, parent: "M02000" },
    "M02005": { name: "病虫侵害", level: 3, parent: "M02000" },
    "M02006": { name: "绿化过高、过密", level: 3, parent: "M02000" },
    
    // 三级分类：具体问题项（养护类-河道护栏）
    "M03001": { name: "损坏", level: 3, parent: "M03000" },
    "M03002": { name: "缺失", level: 3, parent: "M03000" },
    "M03003": { name: "歪斜", level: 3, parent: "M03000" },
    "M03004": { name: "严重锈蚀", level: 3, parent: "M03000" },
    
    // 三级分类：具体问题项（养护类-防汛通道）
    "M04001": { name: "结构损坏", level: 3, parent: "M04000" },
    "M04002": { name: "暴露垃圾", level: 3, parent: "M04000" },
    
    // 三级分类：具体问题项（养护类-河道景观设施）
    "M05001": { name: "平台损坏", level: 3, parent: "M05000" },
    "M05002": { name: "凉亭损坏", level: 3, parent: "M05000" },
    "M05003": { name: "座椅损坏", level: 3, parent: "M05000" },
    "M05004": { name: "垃圾箱损坏", level: 3, parent: "M05000" },
    "M05005": { name: "灯光损坏", level: 3, parent: "M05000" },
    
    // 三级分类：具体问题项（养护类-河道标识标牌）
    "M06001": { name: "标牌缺失", level: 3, parent: "M06000" },
    "M06002": { name: "字体不清", level: 3, parent: "M06000" },
    
    // 三级分类：具体问题项（养护类-河面环境）
    "M07001": { name: "成片漂浮垃圾", level: 3, parent: "M07000" },
    "M07002": { name: "成片有害植物", level: 3, parent: "M07000" },
    "M07003": { name: "死亡动物", level: 3, parent: "M07000" },
    
    // 三级分类：具体问题项（养护类-河边环境）
    "M08001": { name: "垃圾堆积", level: 3, parent: "M08000" },
    
    // 三级分类：具体问题项（监管类-违法侵占河道）
    "S01001": { name: "违章搭建", level: 3, parent: "S01000" },
    "S01002": { name: "占绿毁绿", level: 3, parent: "S01000" },
    "S01003": { name: "河岸严重堆载", level: 3, parent: "S01000" },
    "S01004": { name: "堵塞防汛通道", level: 3, parent: "S01000" },
    "S01005": { name: "三无居家船只", level: 3, parent: "S01000" },
    "S01006": { name: "设置拦网渔网", level: 3, parent: "S01000" },
    
    // 三级分类：具体问题项（监管类-河道污染）
    "S02001": { name: "工业污染", level: 3, parent: "S02000" },
    "S02002": { name: "生活污染", level: 3, parent: "S02000" },
    "S02003": { name: "农业污染", level: 3, parent: "S02000" },
  };

  private constructor() {}

  static getInstance(): ProblemCategoryService {
    if (!ProblemCategoryService.instance) {
      ProblemCategoryService.instance = new ProblemCategoryService();
    }
    return ProblemCategoryService.instance;
  }

  /**
   * 获取所有分类数据
   */
  getAllCategories(): Record<string, ProblemCategory> {
    return { ...this.problemCategories };
  }

  /**
   * 根据ID获取分类信息
   */
  getCategoryById(id: string): ProblemCategory | null {
    return this.problemCategories[id] || null;
  }

  /**
   * 获取指定级别的分类
   */
  getCategoriesByLevel(level: 1 | 2 | 3): CategoryOption[] {
    return Object.entries(this.problemCategories)
      .filter(([_, category]) => category.level === level)
      .map(([id, category]) => ({
        id,
        name: category.name,
        level: category.level,
        parent: category.parent,
      }));
  }

  /**
   * 获取指定父分类的子分类
   */
  getChildCategories(parentId: string): CategoryOption[] {
    return Object.entries(this.problemCategories)
      .filter(([_, category]) => category.parent === parentId)
      .map(([id, category]) => ({
        id,
        name: category.name,
        level: category.level,
        parent: category.parent,
      }));
  }

  /**
   * 获取一级分类（主要分类）
   */
  getMainCategories(): CategoryOption[] {
    return this.getCategoriesByLevel(1);
  }

  /**
   * 获取二级分类（子分类）
   */
  getSubCategories(mainCategoryId?: string): CategoryOption[] {
    if (mainCategoryId) {
      return this.getChildCategories(mainCategoryId);
    }
    return this.getCategoriesByLevel(2);
  }

  /**
   * 获取三级分类（具体问题）
   */
  getDetailCategories(subCategoryId?: string): CategoryOption[] {
    if (subCategoryId) {
      return this.getChildCategories(subCategoryId);
    }
    return this.getCategoriesByLevel(3);
  }

  /**
   * 获取分类的完整路径（从根到当前节点）
   */
  getCategoryPath(categoryId: string): CategoryOption[] {
    const path: CategoryOption[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = this.problemCategories[currentId];
      if (!category) break;

      path.unshift({
        id: currentId,
        name: category.name,
        level: category.level,
        parent: category.parent,
      });

      currentId = category.parent;
    }

    return path;
  }

  /**
   * 获取分类的完整名称路径（用于显示）
   */
  getCategoryFullName(categoryId: string, separator: string = ' > '): string {
    const path = this.getCategoryPath(categoryId);
    return path.map(item => item.name).join(separator);
  }

  /**
   * 获取树形结构的分类数据
   */
  getCategoryTree(): CategoryOption[] {
    const buildTree = (parentId: string | null): CategoryOption[] => {
      return Object.entries(this.problemCategories)
        .filter(([_, category]) => category.parent === parentId)
        .map(([id, category]) => ({
          id,
          name: category.name,
          level: category.level,
          parent: category.parent,
          children: buildTree(id),
        }));
    };

    return buildTree(null);
  }

  /**
   * 根据名称搜索分类
   */
  searchCategories(keyword: string): CategoryOption[] {
    const results: CategoryOption[] = [];
    const lowerKeyword = keyword.toLowerCase();

    Object.entries(this.problemCategories).forEach(([id, category]) => {
      if (category.name.toLowerCase().includes(lowerKeyword)) {
        results.push({
          id,
          name: category.name,
          level: category.level,
          parent: category.parent,
        });
      }
    });

    return results;
  }

  /**
   * 验证分类ID是否有效
   */
  isValidCategoryId(categoryId: string): boolean {
    return categoryId in this.problemCategories;
  }

  /**
   * 获取分类统计信息
   */
  getCategoryStats(): {
    total: number;
    byLevel: Record<number, number>;
    mainCategories: number;
    subCategories: number;
    detailCategories: number;
  } {
    const total = Object.keys(this.problemCategories).length;
    const byLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

    Object.values(this.problemCategories).forEach(category => {
      byLevel[category.level]++;
    });

    return {
      total,
      byLevel,
      mainCategories: byLevel[1],
      subCategories: byLevel[2],
      detailCategories: byLevel[3],
    };
  }

  /**
   * 获取用于选择器的格式化数据
   */
  getPickerData(): Array<{
    label: string;
    value: string;
    level: number;
    children?: Array<{
      label: string;
      value: string;
      level: number;
      children?: Array<{
        label: string;
        value: string;
        level: number;
      }>;
    }>;
  }> {
    const mainCategories = this.getMainCategories();
    
    return mainCategories.map(main => ({
      label: main.name,
      value: main.id,
      level: main.level,
      children: this.getSubCategories(main.id).map(sub => ({
        label: sub.name,
        value: sub.id,
        level: sub.level,
        children: this.getDetailCategories(sub.id).map(detail => ({
          label: detail.name,
          value: detail.id,
          level: detail.level,
        })),
      })),
    }));
  }
}

// 导出单例实例
export const problemCategoryService = ProblemCategoryService.getInstance();
export default problemCategoryService;