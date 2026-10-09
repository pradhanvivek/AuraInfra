import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View, Text, Button } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { enabledHome, routeModule } from '../utils/moduleFlags';

export default function ModuleGate({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { flags, loading, error, refresh } = useFeatureFlags();
  const segments = useSegments();
  const router = useRouter();
  const module = routeModule(segments);
  const blocked = !!token && !!module && !flags[module];
  const home = enabledHome(flags);
  useEffect(() => {
    if (!loading && !error && blocked && home) router.replace(home);
  }, [loading, error, blocked, home, router]);
  if (!token || !module) return children;
  if (loading || (blocked && home && !error)) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (blocked) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 24, fontWeight: '600' }}>{error ? 'Unable to load your app' : 'Modules are currently unavailable'}</Text>
    <Text>{error ? 'Check your connection and try again.' : 'Your account is still available. Please check back later.'}</Text>
    <Button title="Retry" onPress={() => void refresh()} />
    <Button title="My account" onPress={() => router.push('/(tabs)/profile')} />
  </View>;
  return children;
}
