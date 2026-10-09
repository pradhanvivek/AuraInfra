import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../services/config';

type Community = { id: string; name: string; address: string };
const actions = [
  { title: 'Local services', icon: 'storefront-outline', route: '/services' },
  { title: 'Gate & visitors', icon: 'people-outline', route: '/visitors' },
  { title: 'Maintenance dues', icon: 'cash-outline', route: '/hoa-maintenance' },
  { title: 'Complaints & requests', icon: 'construct-outline', route: '/complaints' },
  { title: 'Association SOPs', icon: 'checkbox-outline', route: '/sops' },
  { title: 'Community board', icon: 'chatbubbles-outline', route: '/community' },
  { title: 'Amenity bookings', icon: 'calendar-outline', route: '/amenities' },
  { title: 'Meetings & events', icon: 'calendar-sharp', route: '/hoa-meetings' },
  { title: 'Association documents', icon: 'document-text-outline', route: '/hoa-documents' },
] as const;
export default function CommunityScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/users/properties`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setCommunities(data); setSelectedId(previous => data.some((p: Community) => p.id === previous) ? previous : data[0]?.id || null); setError(false);
    } catch { setCommunities([]); setSelectedId(null); setError(true); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FB' }} contentContainerStyle={{ padding: 20, gap: 16 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
    <Text style={{ fontSize: 30, fontWeight: '700' }}>Community</Text>
    <Text style={{ color: '#526078' }}>Your society, services and association activities.</Text>
    {loading && <ActivityIndicator />}
    {error && <Text accessibilityRole="alert">Unable to load communities. Pull down to retry.</Text>}
    <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>{communities.map(item => <TouchableOpacity key={item.id} onPress={() => setSelectedId(item.id)} style={{ padding: 14, borderRadius: 12, backgroundColor: item.id === selectedId ? '#DDEAFF' : '#fff' }}><Text style={{ fontWeight: '600' }}>{item.name}</Text><Text>{item.address}</Text></TouchableOpacity>)}</ScrollView>
    {!loading && !error && !communities.length && <Text>Join a community to access its gate, maintenance and activities.</Text>}
    <TouchableOpacity onPress={() => router.push('/community-membership')}><Text style={{ color: '#007AFF' }}>Join or manage community membership</Text></TouchableOpacity>
    {!!selectedId && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{actions.map(action => <TouchableOpacity key={action.route} accessibilityRole="button" onPress={() => router.push({ pathname: action.route, params: { propertyId: selectedId } } as any)} style={{ width: '47%', padding: 18, minHeight: 112, borderRadius: 16, backgroundColor: '#fff', gap: 12 }}><Ionicons name={action.icon} size={26} color="#007AFF" /><Text style={{ fontSize: 15, fontWeight: '600' }}>{action.title}</Text></TouchableOpacity>)}</View>}
  </ScrollView>;
}
