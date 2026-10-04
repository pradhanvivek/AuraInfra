import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInGoogle, finishGoogleCallback, signInApple, isNativeGoogleAuthActive } from '../../services/socialAuth';

import { API_URL } from '../../services/config';
import axios from 'axios';

export default function Login() {
  const router = useRouter();
  const { login, setToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const callbackStarted = useRef(false);
  const colorScheme = useColorScheme();
  
  // Dynamic colors based on theme
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#000' : '#fff';
  const textColor = isDark ? '#fff' : '#000';
  const subtextColor = isDark ? '#999' : '#666';
  const inputBgColor = isDark ? '#1C1C1E' : '#f5f5f5';
  const inputBorderColor = isDark ? '#38383A' : '#e0e0e0';
  const placeholderColor = isDark ? '#999' : '#666';

  const finishSignIn = useCallback(async (newToken: string, deleting = false) => {
    await setToken(newToken);
    if (deleting) {
      router.replace('/(tabs)/profile');
      Alert.alert('Identity confirmed', 'You can now delete your account from Profile.');
      return;
    }
    const response = await axios.get(`${API_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${newToken}` }, timeout: 15000 });
    const profile = response.data;
    router.replace(profile.disclaimer_accepted ? '/(tabs)' : '/auth/disclaimer');
  }, [setToken, router]);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(value => {
      if (active) setAppleAvailable(value);
    }).catch(() => {});
    const processCallback = async (url: string | null) => {
      if (!url || !url.includes('session_id=') || callbackStarted.current || isNativeGoogleAuthActive()) return;
      const parsed = new URL(url);
      if (Platform.OS !== 'web' && (parsed.protocol !== 'aurainfra:' || parsed.hostname !== 'auth' || parsed.pathname !== '/login')) return;
      callbackStarted.current = true;
      setGoogleLoading(true);
      try {
        const { auth, pending } = await finishGoogleCallback(url);
        if (active) await finishSignIn(auth.access_token, pending.purpose === 'delete');
      } catch (error: any) {
        if (active) Alert.alert('Sign-in failed', error.response?.data?.detail || error.message);
      } finally {
        if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname);
        if (active) setGoogleLoading(false);
      }
    };
    if (Platform.OS === 'web') void processCallback(window.location.href);
    else void Linking.getInitialURL().then(url => { if (active) return processCallback(url); }).catch(() => {});
    return () => { active = false; };
  }, [finishSignIn]);

  const handleLogin = async () => {
    if (loading || googleLoading) return;
    if (!username.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const loginToken = await login(username.trim(), password);
      
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${loginToken}` }, timeout: 15000,
      });
      router.replace(response.data.disclaimer_accepted ? '/(tabs)' : '/auth/disclaimer');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    try {
      const auth = await signInGoogle();
      if (auth) await finishSignIn(auth.access_token);
    } catch (error: any) {
      Alert.alert('Sign-in failed', error.response?.data?.detail || error.message);
    } finally { setGoogleLoading(false); }
  };
    
  const handleAppleSignIn = async () => {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    try {
      const auth = await signInApple();
      await finishSignIn(auth.access_token);
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Sign-in failed', error.response?.data?.detail || error.message);
    } finally { setGoogleLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.innerContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>A</Text>
              </View>
              <Text style={[styles.appName, { color: textColor }]}>AuraInfra.ai</Text>
              <Text style={[styles.tagline, { color: subtextColor }]}>Your Digital Vault for Physical Assets</Text>
            </View>

            <Text style={[styles.title, { color: textColor }]}>AuraInfra.ai</Text>
            <Text style={[styles.subtitle, { color: subtextColor }]}>Sign in to continue</Text>

            <View style={styles.form}>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: inputBgColor, 
                  borderColor: inputBorderColor,
                  color: textColor 
                }]}
                placeholder="Email or Username"
                placeholderTextColor={placeholderColor}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                accessibilityLabel="Email or username"
                editable={!loading && !googleLoading}
              />

              <TextInput
                style={[styles.input, { 
                  backgroundColor: inputBgColor, 
                  borderColor: inputBorderColor,
                  color: textColor 
                }]}
                placeholder="Password"
                placeholderTextColor={placeholderColor}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                accessibilityLabel="Password"
                editable={!loading && !googleLoading}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/auth/reset-password')} disabled={loading || googleLoading}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </TouchableOpacity>
              {/* Divider */}
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                <Text style={[styles.dividerText, { color: subtextColor }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
              </View>

              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={{ width: '100%', height: 50 }}
                  onPress={handleAppleSignIn}
                />
              )}
              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={[styles.googleButton, { 
                  borderColor: inputBorderColor,
                  backgroundColor: inputBgColor 
                }]}
                onPress={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#DB4437" />
                    <Text style={[styles.googleButtonText, { color: textColor }]}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/auth/register')}
                disabled={loading || googleLoading}
              >
                <Text style={styles.linkText}>Don&apos;t have an account? Register</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL('https://aurainfra.ai/privacy-policy.html')}><Text style={styles.linkText}>Privacy policy</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL('mailto:support@aurainfra.ai')}><Text style={styles.linkText}>Contact support</Text></TouchableOpacity>
            <Text style={[styles.companyName, { color: subtextColor }]}>
              Jash Vish Infratech Private Limited
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  innerContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#666',
  },
  googleButton: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  companyName: {
    fontSize: 12,
    textAlign: 'center',
  },
});
