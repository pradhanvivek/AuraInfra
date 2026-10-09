import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import AccountActions from '../../components/AccountActions';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { flags } = useFeatureFlags();
  return <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <AccountActions />
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#007AFF' }}>
      <Tabs.Screen name="index" options={{ title: 'Community', href: flags.community ? '/(tabs)' : null,
        tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="assets" options={{ title: 'My Assets', href: flags.assets ? '/(tabs)/assets' : null,
        tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  </SafeAreaView>;
}
