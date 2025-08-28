import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomHeader } from './CustomHeader';

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
  headerBackgroundColor = '#3B82F6'
}: PageContainerProps) {
  return (
    <View style={[styles.container, { backgroundColor: headerBackgroundColor }]}>
      <CustomHeader
        title={title}
        onBack={onBack}
        rightButton={rightButton}
        backgroundColor={headerBackgroundColor}
      />
      
      <LinearGradient
        colors={backgroundColor ? [backgroundColor] : ['#F8FAFC', '#EBF4FF', '#E0E7FF']}
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