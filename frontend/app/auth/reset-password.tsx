import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { requireApiUrl } from '../../services/config';

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requestCode = async () => {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Email required', 'Enter the email address registered with your password account.'); return;
    }
    setBusy(true);
    try {
      const response = await axios.post(`${requireApiUrl()}/api/auth/forgot-password`, { email: email.trim() }, { timeout: 20000 });
      setSent(true); setCode(''); setMessage(response.data.message);
    } catch (error: any) { Alert.alert('Unable to send code', error.response?.data?.detail || 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (busy) return;
    if (!/^\d{8}$/.test(code) || password.length < 8 || password !== confirmation) {
      Alert.alert('Check your details', 'Enter the eight-digit code and matching passwords of at least eight characters.'); return;
    }
    setBusy(true);
    try {
      await axios.post(`${requireApiUrl()}/api/auth/reset-password`, { email: email.trim(), code, password }, { timeout: 20000 });
      setPassword(''); setConfirmation(''); setCode('');
      Alert.alert('Password changed', 'Sign in with your new password. Other devices will also need to sign in again.', [{ text: 'Sign in', onPress: () => router.replace('/auth/login') }]);
    } catch (error: any) { Alert.alert('Unable to reset password', error.response?.data?.detail || 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.body}>For Google or Apple accounts, use the original sign-in provider. Password accounts can request a code by email.</Text>
        <TextInput accessibilityLabel="Registered email address" style={styles.input} placeholder="Registered email address" placeholderTextColor="#657080" value={email} onChangeText={setEmail} editable={!busy && !sent} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={254} />
        {sent && <>
          <Text accessibilityLiveRegion="polite" style={styles.body}>{message} Check spam too. Codes expire after 10 minutes.</Text>
          <TextInput accessibilityLabel="Eight-digit reset code" style={styles.input} placeholder="8-digit code" placeholderTextColor="#657080" value={code} onChangeText={setCode} editable={!busy} keyboardType="number-pad" maxLength={8} autoComplete="one-time-code" />
          <TextInput accessibilityLabel="New password" style={styles.input} placeholder="New password (at least 8 characters)" placeholderTextColor="#657080" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoComplete="new-password" />
          <TextInput accessibilityLabel="Confirm new password" style={styles.input} placeholder="Confirm new password" placeholderTextColor="#657080" value={confirmation} onChangeText={setConfirmation} editable={!busy} secureTextEntry autoComplete="new-password" />
        </>}
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]} onPress={sent ? reset : requestCode}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{sent ? 'Change password' : 'Send reset code'}</Text>}
        </TouchableOpacity>
        {sent && <>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={requestCode}><Text style={styles.link}>Send a new code</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setSent(false); setCode(''); }}><Text style={styles.link}>Use another email address</Text></TouchableOpacity>
        </>}
        <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/auth/login')}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL('mailto:support@aurainfra.ai')}><Text style={styles.link}>Contact support</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, content: { padding: 24, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#101c30' }, body: { fontSize: 16, lineHeight: 24, color: '#485365' },
  input: { padding: 16, fontSize: 16, color: '#101c30', borderWidth: 1, borderColor: '#bcc5d1', borderRadius: 12 },
  button: { minHeight: 48, backgroundColor: '#075ac8', padding: 16, alignItems: 'center', borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 }, link: { color: '#075ac8', fontSize: 16, paddingVertical: 10, textAlign: 'center' },
});
