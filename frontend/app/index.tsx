import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [checkingDisclaimer, setCheckingDisclaimer] = useState(false);

  useEffect(() => {
    const checkDisclaimerAndRoute = async () => {
      if (!loading && token) {
        setCheckingDisclaimer(true);
        try {
          // Check if user has accepted disclaimer
          const response = await axios.get(`${API_URL}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (response.data.disclaimer_accepted) {
            router.replace('/(tabs)');
          } else {
            router.replace('/auth/disclaimer');
          }
        } catch (error) {
          console.error('Error checking disclaimer:', error);
          // If error, assume not accepted and show disclaimer
          router.replace('/auth/disclaimer');
        } finally {
          setCheckingDisclaimer(false);
        }
      } else if (!loading && !token) {
        router.replace('/auth/login');
      }
    };

    checkDisclaimerAndRoute();
  }, [token, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
