import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../services/config';

type Item = { id: string; title?: string; content: string; user_id: string; user_name: string; photos?: string[] };
type Report = { id: string; content_type: 'post' | 'comment'; content_id: string; reason: string; item?: Item };
type Queue = { posts: Item[]; comments: Item[]; reports: Report[] };

export default function Moderation() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState<Queue>({ posts: [], comments: [], reports: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  const load = useCallback(async () => {
    if (!propertyId || !token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/properties/${propertyId}/moderation`, { headers: { Authorization: `Bearer ${token}` } });
      setQueue(response.data);
    } catch (error: any) { Alert.alert('Unable to load moderation', error.response?.data?.detail || 'Please try again.'); }
    finally { setLoading(false); }
  }, [propertyId, token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const review = async (type: 'post' | 'comment', id: string, action: 'approve' | 'remove') => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.post(`${API_URL}/api/admin/properties/${propertyId}/moderation`, {
        content_type: type, content_id: id, action,
      }, { headers });
      await load();
    } catch (error: any) { Alert.alert('Review failed', error.response?.data?.detail || 'Please try again.'); }
    finally { setBusy(false); }
  };

  const suspend = (userId: string) => Alert.alert('Suspend community access?',
    'This resident will lose access to this community. Their posts and comments will be hidden.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Suspend', style: 'destructive', onPress: async () => {
        try {
          await axios.post(`${API_URL}/api/admin/properties/${propertyId}/community/suspend/${userId}`, {}, { headers });
          await load();
        } catch (error: any) { Alert.alert('Unable to suspend', error.response?.data?.detail || 'Please try again.'); }
      } },
    ]);

  const content = (item: Item) => <>
    <Text style={styles.author}>{item.user_name}</Text>
    {!!item.title && <Text style={styles.title}>{item.title}</Text>}
    <Text style={styles.body}>{item.content}</Text>
    {item.photos?.map((photo, index) => <Image key={index} source={{ uri: photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}` }} style={styles.photo} resizeMode="contain" />)}
  </>;
  const actions = (type: 'post' | 'comment', id: string, userId?: string) => <View style={styles.actions}>
    <TouchableOpacity disabled={busy} onPress={() => review(type, id, 'approve')}><Text style={styles.link}>Approve / Keep</Text></TouchableOpacity>
    <TouchableOpacity disabled={busy} onPress={() => review(type, id, 'remove')}><Text style={styles.danger}>Remove</Text></TouchableOpacity>
    {userId && <TouchableOpacity disabled={busy} onPress={() => suspend(userId)}><Text style={styles.danger}>Suspend author</Text></TouchableOpacity>}
  </View>;

  return <SafeAreaView style={styles.page}>
    <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>Back</Text></TouchableOpacity>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={styles.heading}>Community moderation</Text>
      <Text style={styles.body}>Review text and every photo before approving. Remove harassment, threats, explicit material, spam, and private information shared without permission. Review reports promptly.</Text>
      <Text style={styles.title}>Reports ({queue.reports.length})</Text>
      {queue.reports.map(report => <View key={report.id} style={styles.card}>
        <Text style={styles.danger}>{report.reason}</Text>
        {report.item ? content(report.item) : <Text>Content is no longer available.</Text>}
        {actions(report.content_type, report.content_id, report.item?.user_id)}
      </View>)}
      <Text style={styles.title}>Awaiting publication</Text>
      {queue.posts.map(item => <View key={item.id} style={styles.card}>{content(item)}{actions('post', item.id, item.user_id)}</View>)}
      {queue.comments.map(item => <View key={item.id} style={styles.card}>{content(item)}{actions('comment', item.id, item.user_id)}</View>)}
      {!loading && queue.posts.length + queue.comments.length + queue.reports.length === 0 && <Text style={styles.body}>Nothing needs review.</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, padding: 20, backgroundColor: '#f4f6fa' },
  heading: { fontSize: 26, fontWeight: '700', marginVertical: 16 },
  title: { fontSize: 19, fontWeight: '600', marginVertical: 12 },
  author: { color: '#566175', fontWeight: '600' }, body: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, marginVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, paddingVertical: 12 },
  link: { color: '#075ac8', fontSize: 16, paddingVertical: 8 }, danger: { color: '#ba2535', fontSize: 16, paddingVertical: 8 },
  photo: { width: '100%', height: 240, marginVertical: 8 },
});
