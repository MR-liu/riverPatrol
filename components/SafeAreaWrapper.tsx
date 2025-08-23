import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, Edge } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: any;
  contentStyle?: any;
  statusBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
  statusBarBackgroundColor?: string;
  statusBarTranslucent?: boolean;
}

export const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({
  children,
  edges = ['top', 'bottom'],
  style,
  contentStyle,
  statusBarStyle = 'dark',
  statusBarBackgroundColor = 'transparent',
  statusBarTranslucent = true,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      <StatusBar 
        barStyle={`${statusBarStyle}-content` as any}
        backgroundColor={statusBarBackgroundColor}
        translucent={statusBarTranslucent}
      />
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

export const SafeAreaScrollWrapper: React.FC<SafeAreaWrapperProps & {
  scrollViewProps?: any;
  automaticBottomPadding?: boolean;
}> = ({
  children,
  edges = ['top'],
  style,
  contentStyle,
  statusBarStyle = 'dark',
  statusBarBackgroundColor = 'transparent',
  statusBarTranslucent = true,
  scrollViewProps = {},
  automaticBottomPadding = true,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      <StatusBar 
        barStyle={`${statusBarStyle}-content` as any}
        backgroundColor={statusBarBackgroundColor}
        translucent={statusBarTranslucent}
      />
      <View style={[styles.content, contentStyle]}>
        {React.cloneElement(children as React.ReactElement, {
          ...scrollViewProps,
          contentContainerStyle: [
            scrollViewProps.contentContainerStyle,
            automaticBottomPadding && {
              paddingBottom: Math.max(insets.bottom + 80, 100), // 80px for tab bar
            },
          ],
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
});

// 工具函数
export const useSafeAreaPadding = () => {
  const insets = useSafeAreaInsets();
  
  return {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
};

export const useTabBarHeight = () => {
  const insets = useSafeAreaInsets();
  
  return Platform.OS === 'ios' 
    ? 64 + Math.max(insets.bottom, 20)
    : 64 + Math.max(insets.bottom, 8);
};