import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

interface CustomHeaderProps {
  title: string;
  onBack?: () => void;
  rightButton?: {
    icon: string;
    onPress: () => void;
  };
  backgroundColor?: string;
}

export function CustomHeader({ 
  title, 
  onBack, 
  rightButton,
  backgroundColor
}: CustomHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme, fontSize } = useTheme();
  
  const finalBg = backgroundColor || theme.colors.headerBackground;
  const textColor = theme.colors.headerText;
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.headerContainer, { backgroundColor: finalBg }]}>
      {/* 添加顶部安全区域 */}
      <View style={[styles.safeArea, { height: insets.top }]} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { 
          color: textColor,
          fontSize: fontSize(18)
        }]}>{title}</Text>
        
        {rightButton ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={rightButton.onPress}
          >
            <MaterialIcons name={rightButton.icon as any} size={24} color={textColor} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#3B82F6',
  },
  safeArea: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});