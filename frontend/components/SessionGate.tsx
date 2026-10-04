import { Fragment, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function SessionGate({ children }: { children: ReactNode }) {
  const { token, loading, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const publicRoute = segments[0] === 'auth';
  useEffect(() => {
    if (!loading && !token && !publicRoute) router.replace('/auth/login');
  }, [loading, token, publicRoute, router]);
  if (loading || (!token && !publicRoute)) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  return <Fragment key={publicRoute ? 'public' : userId || 'signed-out'}>{children}</Fragment>;
}
