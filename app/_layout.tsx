import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AppProvider } from '@/contexts/AppContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="workorder-detail" options={{ headerShown: false }} />
            <Stack.Screen name="enhanced-workorder-detail" options={{ headerShown: false }} />
            <Stack.Screen name="process-result" options={{ headerShown: false }} />
            <Stack.Screen name="statistics" options={{ headerShown: false }} />
            <Stack.Screen name="enhanced-statistics" options={{ headerShown: false }} />
            <Stack.Screen name="data-export" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="enhanced-settings" options={{ headerShown: false }} />
            <Stack.Screen name="messages" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-settings" options={{ headerShown: false }} />
            <Stack.Screen name="attendance" options={{ headerShown: false }} />
            <Stack.Screen name="attendance-records" options={{ headerShown: false }} />
            <Stack.Screen name="help-center" options={{ headerShown: false }} />
            <Stack.Screen name="feedback" options={{ headerShown: false }} />
            <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
            <Stack.Screen name="account-security" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
