import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../services/config';

type Community = { id: string; name: string; address: string; status: string; admin_notes?: string };

export default function CommunityMembership() {
  const { token } = useAuth();
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/public/properties`);
      const rows = await Promise.all(response.data.map(async (community: Community) => {
        const status = await axios.get(`${API_URL}/api/user/approval-status/${community.id}`, { headers: { Authorization: `Bearer ${token}` } });
        return { ...community, status: status.data.status, admin_notes: status.data.admin_notes };
      }));
      setCommunities(rows);
    } catch (error: any) { Alert.alert('Unable to load communities', error.response?.data?.detail || 'Please try again.'); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const join = async (community: Community) => {
    try {
      await axios.post(`${API_URL}/api/properties/${community.id}/join`, {}, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Request submitted', 'A community administrator will review your membership. Your personal assets remain available.');
      await load();
    } catch (error: any) { Alert.alert('Unable to request membership', error.response?.data?.detail || 'Please try again.'); }
  };
  return <SafeAreaView style={styles.page}>
    <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>Back</Text></TouchableOpacity>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={styles.heading}>Community membership</Text>
      <Text style={styles.body}>Request access to the community where you live. Approval is required before you can see its residents, documents, and discussions.</Text>
      {communities.map(community => <View key={community.id} style={styles.card}>
        <Text style={styles.title}>{community.name}</Text><Text style={styles.body}>{community.address}</Text>
        <Text style={styles.body}>Status: {community.status.replace('_', ' ')}</Text>
        {!!community.admin_notes && <Text style={styles.body}>{community.admin_notes}</Text>}
        {['not_submitted', 'rejected', 'inactive'].includes(community.status) && <TouchableOpacity onPress={() => join(community)}><Text style={styles.link}>Request membership</Text></TouchableOpacity>}
      </View>)}
      {!loading && communities.length === 0 && <Text style={styles.body}>No communities are currently available.</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, padding: 20, backgroundColor: '#f4f6fa' },
  heading: { fontSize: 26, fontWeight: '700', marginVertical: 16 },
  title: { fontSize: 19, fontWeight: '600', marginBottom: 8 }, body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginVertical: 8 },
  link: { color: '#075ac8', fontSize: 16, paddingVertical: 12 },
});
