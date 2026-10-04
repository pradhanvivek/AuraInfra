import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../services/config';

export default function Index() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loading) return;
    if (!token) { router.replace('/auth/login'); return; }
    let active = true;
    void axios.get(`${API_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }, timeout: 15000,
    }).then(response => {
      if (active) router.replace(response.data.disclaimer_accepted ? '/(tabs)' : '/auth/disclaimer');
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [token, loading, router, attempt]);
  return <View style={styles.container}>
    {failed ? <>
      <Text style={styles.message}>Unable to reach AuraInfra. Check your connection and try again.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setFailed(false); setAttempt(value => value + 1); }}><Text style={styles.link}>Try again</Text></TouchableOpacity>
    </> : <ActivityIndicator size="large" color="#007AFF" />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  message: { fontSize: 16, lineHeight: 24, color: '#485365', textAlign: 'center' },
  link: { color: '#075ac8', fontSize: 16, padding: 20 },
});
