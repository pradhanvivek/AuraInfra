import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
          // Check if we've already verified disclaimer in this session
          const sessionChecked = await AsyncStorage.getItem('disclaimer_checked_session');
          
          if (sessionChecked === 'true') {
            // Already checked in this session, go directly to app
            router.replace('/(tabs)');
            return;
          }

          // Check if user has accepted disclaimer from backend
          const response = await axios.get(`${API_URL}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (response.data.disclaimer_accepted) {
            // Mark as checked for this session
            await AsyncStorage.setItem('disclaimer_checked_session', 'true');
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
        // Clear session flag on logout
        await AsyncStorage.removeItem('disclaimer_checked_session');
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
