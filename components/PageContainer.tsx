import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomHeader } from './CustomHeader';
import { useTheme } from '@/hooks/useTheme';

interface PageContainerProps {
  title: string;
  onBack?: () => void;
  rightButton?: {
    icon: string;
    onPress: () => void;
  };
  children: React.ReactNode;
  backgroundColor?: string;
  headerBackgroundColor?: string;
}

export function PageContainer({ 
  title,
  onBack,
  rightButton,
  children,
  backgroundColor,
  headerBackgroundColor
}: PageContainerProps) {
  const { theme } = useTheme();
  
  const finalHeaderBg = headerBackgroundColor || theme.colors.headerBackground;
  
  return (
    <View style={[styles.container, { backgroundColor: finalHeaderBg }]}>
      <CustomHeader
        title={title}
        onBack={onBack}
        rightButton={rightButton}
        backgroundColor={finalHeaderBg}
      />
      
      <LinearGradient
        colors={backgroundColor ? [backgroundColor] : [
          theme.colors.gradientStart,
          theme.colors.gradientMiddle,
          theme.colors.gradientEnd
        ]}
        style={styles.background}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
});