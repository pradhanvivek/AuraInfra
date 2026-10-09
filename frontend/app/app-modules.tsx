import { useEffect, useState } from 'react';
import { View, Text, Switch, Button, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { API_URL } from '../services/config';
import { type ModuleFlags, parseModuleFlags } from '../utils/moduleFlags';

export default function AppModulesScreen() {
  const { token } = useAuth();
  const { refresh } = useFeatureFlags();
  const router = useRouter();
  const [flags, setFlags] = useState<ModuleFlags | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void axios.get(`${API_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
      .then(async ({ data }) => {
        if (!data.is_super_admin) { if (active) setError(true); return; }
        const config = await axios.get(`${API_URL}/api/app-config`, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        const parsed = parseModuleFlags(config.data);
        if (active) { setAllowed(true); setFlags(parsed); }
      }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [token]);
  async function save() {
    if (!flags || busy) return;
    setBusy(true);
    try {
      await axios.put(`${API_URL}/api/admin/super/app-config`, flags, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
      await refresh(); Alert.alert('Saved', 'Module visibility has been updated.');
    } catch { Alert.alert('Unable to save', 'Check your connection and permissions.'); }
    finally { setBusy(false); }
  }
  return <View style={{ flex: 1, padding: 24, gap: 20 }}>
    <Button title="My account" onPress={() => router.replace('/(tabs)/profile')} />
    <Text style={{ fontSize: 26, fontWeight: '700' }}>App modules</Text>
    {error ? <Text>Platform administrator access is required, or configuration could not be loaded.</Text> : !allowed || !flags ? <ActivityIndicator /> : <>
      <Text>These settings apply to all users of this deployment. Existing data is retained when a tab is disabled.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>Community</Text><Switch accessibilityLabel="Enable Community" disabled={busy} value={flags.community} onValueChange={value => setFlags({ ...flags, community: value })} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text>My Assets</Text><Switch accessibilityLabel="Enable My Assets" disabled={busy} value={flags.assets} onValueChange={value => setFlags({ ...flags, assets: value })} /></View>
      {!flags.community && !flags.assets && <Text>Both tabs will be unavailable. Account access and these settings remain accessible.</Text>}
      <Button disabled={busy} title={busy ? 'Saving…' : 'Save module settings'} onPress={() => void save()} />
    </>}
  </View>;
}
