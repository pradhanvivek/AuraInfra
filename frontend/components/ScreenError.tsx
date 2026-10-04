import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

export default function ScreenError({ retry }: ErrorBoundaryProps) {
  const [busy, setBusy] = useState(false);
  const tryAgain = async () => {
    if (busy) return;
    setBusy(true);
    try { await retry(); } finally { setBusy(false); }
  };
  return <View style={styles.container}>
    <Text style={styles.title}>Unable to open this screen</Text>
    <Text style={styles.body}>Please try again. If the issue continues, close and reopen AuraInfra or contact support.</Text>
    <TouchableOpacity accessibilityRole="button" style={styles.button} disabled={busy} onPress={tryAgain}><Text style={styles.buttonText}>{busy ? 'Trying again…' : 'Try again'}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL('mailto:support@aurainfra.ai?subject=AuraInfra%20app%20support')}><Text style={styles.link}>Contact support</Text></TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#101c30', marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 24, color: '#485365', marginBottom: 24 },
  button: { backgroundColor: '#075ac8', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 }, link: { color: '#075ac8', paddingVertical: 20, textAlign: 'center', fontSize: 16 },
});
