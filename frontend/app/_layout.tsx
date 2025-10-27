import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="property/add" options={{ presentation: 'modal', headerShown: true, title: 'Add Property' }} />
          <Stack.Screen name="property/[id]" options={{ headerShown: true, title: 'Property Details' }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
