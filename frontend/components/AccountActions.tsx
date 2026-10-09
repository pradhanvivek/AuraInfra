import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../services/config';

export default function AccountActions() {
  const router = useRouter();
  const { token } = useAuth();
  const { flags } = useFeatureFlags();
  const [superToken, setSuperToken] = useState<string | null>(null);
  const [managedToken, setManagedToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (token) void axios.get(`${API_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
    }).then(({ data }) => { if (active) { setManagedToken(data.managed_properties?.length ? token : null); setSuperToken(data.is_super_admin ? token : null); } }).catch(() => { if (active) { setManagedToken(null); setSuperToken(null); } });
    return () => { active = false; };
  }, [token]);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, padding: 12, backgroundColor: '#fff' }}>
    {token && superToken === token && <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/app-modules' as any)}><Text style={{ color: '#007AFF' }}>App settings</Text></TouchableOpacity>}
    {flags.community && token && managedToken === token && <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(tabs)/admin')}><Text style={{ color: '#007AFF' }}>Administration</Text></TouchableOpacity>}
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(tabs)/notifications')}><Text style={{ color: '#007AFF' }}>Notifications</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(tabs)/profile')}><Text style={{ color: '#007AFF' }}>My account</Text></TouchableOpacity>
  </View>;
}
