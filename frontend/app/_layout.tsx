import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { initializePreferences } from '../utils/localeUtils';

export default function RootLayout() {
  useEffect(() => {
    // Initialize locale preferences on app start
    initializePreferences();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="properties" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen name="property/add" options={{ presentation: 'modal', headerShown: true, title: 'Add Property' }} />
          <Stack.Screen 
            name="property/[id]" 
            options={{ 
              headerShown: false,
            }} 
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
