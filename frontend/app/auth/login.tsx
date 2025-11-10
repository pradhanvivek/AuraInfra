import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Login() {
  const router = useRouter();
  const { login, setToken } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const colorScheme = useColorScheme();
  
  // Dynamic colors based on theme
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#000' : '#fff';
  const textColor = isDark ? '#fff' : '#000';
  const subtextColor = isDark ? '#999' : '#666';
  const inputBgColor = isDark ? '#1C1C1E' : '#f5f5f5';
  const inputBorderColor = isDark ? '#38383A' : '#e0e0e0';
  const placeholderColor = isDark ? '#999' : '#666';

  // Check for session_id in URL fragment on mount
  useEffect(() => {
    const processSessionId = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');
        
        if (sessionId) {
          setGoogleLoading(true);
          try {
            // Call backend to exchange session_id for session_token
            const response = await fetch(`${API_URL}/api/auth/session`, {
              method: 'POST',
              headers: {
                'X-Session-ID': sessionId,
              },
            });

            if (!response.ok) {
              throw new Error('Failed to authenticate with Google');
            }

            const data = await response.json();
            
            // Store session token
            if (setToken) {
              await setToken(data.session_token);
            }
            
            // Clean URL fragment
            window.history.replaceState(null, '', window.location.pathname);
            
            // Check if user needs to accept disclaimer
            const userResponse = await fetch(`${API_URL}/api/auth/me`, {
              headers: {
                'Authorization': `Bearer ${data.session_token}`,
              },
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (!userData.disclaimer_accepted) {
                // Navigate to disclaimer page
                router.replace('/auth/disclaimer');
                return;
              }
            }
            
            // Navigate to main app
            router.replace('/(tabs)');
          } catch (error: any) {
            console.error('Google auth error:', error);
            Alert.alert('Authentication Failed', error.message || 'Failed to sign in with Google');
            // Clean URL fragment on error too
            window.history.replaceState(null, '', window.location.pathname);
          } finally {
            setGoogleLoading(false);
          }
        }
      }
    };

    processSessionId();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const loginToken = await login(username, password);
      
      // Check if user needs to accept disclaimer
      const userResponse = await fetch(`${API_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${loginToken}`,
        },
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (!userData.disclaimer_accepted) {
          // Navigate to disclaimer page
          router.replace('/auth/disclaimer');
          return;
        }
      }
      
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Get current URL as redirect target
      const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
      const authUrl = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
      
      // Redirect to Emergent Auth
      window.location.href = authUrl;
    } else {
      // For mobile, use Linking API
      const redirectUrl = 'aurainfraa://auth/login'; // Deep link back to app
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      const supported = await Linking.canOpenURL(authUrl);
      if (supported) {
        await Linking.openURL(authUrl);
      } else {
        Alert.alert('Error', 'Cannot open authentication page');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
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
                placeholder="Username"
                placeholderTextColor={placeholderColor}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
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
                editable={!loading}
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

              {/* Divider */}
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
                <Text style={[styles.dividerText, { color: subtextColor }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: inputBorderColor }]} />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={[styles.googleButton, { borderColor: inputBorderColor }]}
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
                <Text style={styles.linkText}>Don't have an account? Register</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.footer}>
            <Text style={[styles.companyName, { color: subtextColor }]}>
              Jash Vish Infratech Private Limited
            </Text>
          </View>
        </View>
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
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
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
