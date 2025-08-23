import { StyleSheet, Platform } from 'react-native';

// 现代化颜色系统
export const Colors = {
  // Primary colors
  primary: '#3B82F6',
  primaryDark: '#1E40AF',
  primaryLight: '#60A5FA',
  
  // Success colors
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#047857',
  
  // Warning colors
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  
  // Error colors
  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  
  // Info colors
  info: '#8B5CF6',
  infoLight: '#A78BFA',
  infoDark: '#7C3AED',
  
  // Neutral colors (Slate palette)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // Background gradients
  gradients: {
    primary: ['#667eea', '#764ba2'],
    secondary: ['#f093fb', '#f5576c'],
    success: ['#4facfe', '#00f2fe'],
    warning: ['#fa709a', '#fee140'],
    danger: ['#ff9a9e', '#fecfef'],
    info: ['#a8edea', '#fed6e3'],
  },
};

// 现代化间距系统
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

// 现代化字体系统
export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

// 现代化圆角系统
export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

// 现代化阴影系统
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modern: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

// 现代化通用样式
export const CommonStyles = StyleSheet.create({
  // 现代化容器样式
  container: {
    flex: 1,
    backgroundColor: Colors.slate[50],
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  
  // 现代化卡片样式
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Shadows.modern,
  },
  
  modernCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.3)',
    ...Shadows.lg,
  },
  
  // 现代化按钮样式
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.modern,
  },
  buttonText: {
    color: 'white',
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
  gradientButton: {
    borderRadius: BorderRadius.xl,
    ...Shadows.lg,
  },
  buttonOutline: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.5)',
    ...Shadows.modern,
  },
  buttonOutlineText: {
    color: Colors.slate[600],
  },
  buttonDisabled: {
    backgroundColor: Colors.slate[300],
  },
  
  // 现代化输入框样式
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: Colors.slate[200],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSizes.base,
    color: Colors.slate[800],
    ...Shadows.sm,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'white',
  },
  inputError: {
    borderColor: Colors.error,
  },
  
  // 现代化文本样式
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.slate[800],
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.slate[700],
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.slate[600],
    marginBottom: Spacing.xs,
  },
  text: {
    fontSize: FontSizes.base,
    color: Colors.slate[700],
    lineHeight: FontSizes.base * 1.5,
  },
  textSmall: {
    fontSize: FontSizes.sm,
    color: Colors.slate[500],
  },
  
  // 现代化布局
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  column: {
    flexDirection: 'column',
  },
  
  // 现代化中心对齐
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // 现代化徽章样式
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  modernBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    color: 'white',
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  
  // 现代化分隔线
  divider: {
    height: 1,
    backgroundColor: Colors.slate[200],
    marginVertical: Spacing.lg,
  },
  
  // 现代化空状态
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyStateText: {
    fontSize: FontSizes.lg,
    color: Colors.slate[500],
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  
  // 现代化列表项
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate[200],
  },
  
  // Glass morphism 效果
  glassMorphism: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Shadows.modern,
  },
  
  // Safe Area 相关样式
  safeAreaContainer: {
    flex: 1,
    backgroundColor: Colors.slate[50],
  },
  
  safeAreaContent: {
    flex: 1,
  },
  
  // 适配不同设备的头部样式
  adaptiveHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate[200],
    ...Shadows.sm,
  },
  
  // 适配不同设备的底部样式
  adaptiveFooter: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.slate[200],
    ...Shadows.lg,
  },
});

// 现代化动态样式生成器
export const createStyles = {
  // 创建现代化徽章
  modernBadge: (color: string, textColor: string = 'white') => ({
    backgroundColor: `${color}20`,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: `${color}40`,
  }),
  
  // 创建渐变按钮样式
  gradientButton: (colors: string[]) => ({
    borderRadius: BorderRadius.xl,
    ...Shadows.lg,
  }),
  
  // 创建玻璃态效果
  glassMorphism: (opacity: number = 0.8) => ({
    backgroundColor: `rgba(255, 255, 255, ${opacity})`,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...Shadows.modern,
  }),
  
  // 创建现代化卡片
  modernCard: (padding: number = Spacing.lg) => ({
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.xl,
    padding,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 225, 0.3)',
    ...Shadows.modern,
  }),
  
  // 创建带阴影的容器
  shadowContainer: (shadow: keyof typeof Shadows = 'modern') => ({
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.xl,
    ...Shadows[shadow],
  }),
  
  // 创建 Safe Area 适配样式
  safeAreaStyle: (top: number, bottom: number, includeTabBar: boolean = true) => ({
    paddingTop: Math.max(top, Platform.OS === 'ios' ? 44 : 24),
    paddingBottom: includeTabBar 
      ? Math.max(bottom + 64, 100) // 64px for tab bar
      : Math.max(bottom, Platform.OS === 'ios' ? 34 : 16),
  }),
  
  // 创建适配不同设备的头部样式
  adaptiveHeaderStyle: (safeTop: number) => ({
    ...CommonStyles.adaptiveHeader,
    paddingTop: Math.max(safeTop, Platform.OS === 'ios' ? 44 : 24),
    height: 56 + Math.max(safeTop, Platform.OS === 'ios' ? 44 : 24),
  }),
};