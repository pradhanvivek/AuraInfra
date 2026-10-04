import { useEffect, useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, StyleSheet, Linking, ScrollView } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { ensureAIConsent, isAIRequest, setAIConsentPrompt } from '../services/aiConsent';

export default function AIConsent() {
  const { token } = useAuth();
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const pending = useRef<((value: boolean) => void)[]>([]);
  const settle = (accepted: boolean) => {
    setRequestToken(null);
    pending.current.splice(0).forEach(resolve => resolve(accepted));
  };
  useEffect(() => {
    const queue = pending.current;
    setAIConsentPrompt(requestToken => {
      if (!token || requestToken !== token) return Promise.resolve(false);
      return new Promise(resolve => { queue.push(resolve); setRequestToken(requestToken); });
    });
    return () => { setAIConsentPrompt(null); queue.splice(0).forEach(resolve => resolve(false)); };
  }, [token]);
  useEffect(() => {
    const id = axios.interceptors.request.use(async config => {
      if (isAIRequest(config.url || '', config.method)) {
        if (!token || config.headers.Authorization !== `Bearer ${token}`) throw new Error('Sign in again before starting AI analysis.');
        await ensureAIConsent(token);
      }
      return config;
    });
    return () => axios.interceptors.request.eject(id);
  }, [token]);
  return <Modal visible={Boolean(token) && requestToken === token} transparent animationType="fade" onRequestClose={() => settle(false)}>
    <SafeAreaView style={styles.overlay}><ScrollView style={styles.card} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.title}>Allow AI analysis?</Text>
      <Text style={styles.body}>The photo, receipt, floor plan, or text you select will be sent to AuraInfra’s server and processed by Google Gemini or OpenAI through our AI integration provider, Emergent. These services process the information to generate an estimate or analysis. Avoid uploading information you do not want them to process.</Text>
      <Text style={styles.body}>AI results can be inaccurate. You can use manual asset entry without AI and revoke this choice from Profile.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => Linking.openURL('https://aurainfra.ai/privacy-policy.html')}><Text style={styles.link}>Read the privacy policy</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => settle(true)}><Text style={styles.link}>Allow and continue</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => settle(false)}><Text style={styles.link}>Cancel analysis</Text></TouchableOpacity>
    </ScrollView></SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0008' },
  card: { borderRadius: 18, flexGrow: 0, maxHeight: '90%', backgroundColor: '#fff' }, title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 12 }, link: { fontSize: 16, color: '#075ac8', paddingVertical: 12 },
});
