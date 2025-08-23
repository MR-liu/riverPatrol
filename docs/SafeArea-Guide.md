# Safe Area 和状态栏适配指南

## 问题描述
在有刘海屏、灵动岛或底部 Home Indicator 的设备上，应用内容可能被系统 UI 遮挡，导致用户体验不佳。

## 解决方案

### 1. 基础 Safe Area 设置

所有页面都应该使用 `SafeAreaProvider` 和 `SafeAreaView`：

```typescript
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatusBar, StatusBarConfigs } from '@/components/AppStatusBar';

export default function YourScreen() {
  const insets = useSafeAreaInsets();
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar {...StatusBarConfigs.transparent} />
      {/* 你的内容 */}
    </SafeAreaView>
  );
}
```

### 2. 全屏页面（如登录页）

对于需要延伸到状态栏的全屏页面：

```typescript
export default function LoginScreen() {
  return (
    <LinearGradient style={styles.container}>
      <AppStatusBar {...StatusBarConfigs.login} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* 内容 */}
      </SafeAreaView>
    </LinearGradient>
  );
}
```

### 3. 状态栏配置

使用预定义的状态栏配置：

- `StatusBarConfigs.login` - 蓝色背景页面
- `StatusBarConfigs.home` - 浅色背景页面  
- `StatusBarConfigs.dark` - 深色背景页面
- `StatusBarConfigs.transparent` - 透明状态栏

### 4. ScrollView 内容适配

对于包含 ScrollView 的页面：

```typescript
<ScrollView 
  contentContainerStyle={{
    paddingBottom: insets.bottom + 20, // 为 Tab Bar 留出空间
  }}
>
  {/* 内容 */}
</ScrollView>
```

### 5. Tab Bar 适配

Tab Bar 已自动适配，高度会根据设备的安全区域自动调整。

## 常用工具

### SafeAreaWrapper 组件
```typescript
import { SafeAreaWrapper } from '@/components/SafeAreaWrapper';

<SafeAreaWrapper edges={['top']}>
  {/* 内容 */}
</SafeAreaWrapper>
```

### 安全区域工具函数
```typescript
import { useSafeAreaValues } from '@/utils/SafeAreaConfig';

const { safeTop, safeBottom, tabBarHeight } = useSafeAreaValues();
```

## 设备适配覆盖

✅ iPhone X/XS/XR 系列（刘海屏）
✅ iPhone 12/13/14/15 系列（刘海屏）  
✅ iPhone 14 Pro/15 Pro 系列（灵动岛）
✅ Android 刘海屏设备
✅ 所有设备的 Home Indicator 区域

## 注意事项

1. **状态栏颜色一致性**：确保状态栏样式与页面背景色匹配
2. **底部安全区域**：为 Tab Bar 和 Home Indicator 留出足够空间
3. **内容不被遮挡**：重要内容应避开刘海和灵动岛区域
4. **滚动区域**：ScrollView 底部要有额外的 padding