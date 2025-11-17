import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import Constants from 'expo-constants';
import axios from 'axios';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function DisclaimerScreen() {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Prevent back navigation on disclaimer page - it's mandatory!
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Show alert when user tries to go back
        Alert.alert(
          'Accept Terms',
          'You must accept or decline the terms to continue.',
          [{ text: 'OK', style: 'cancel' }]
        );
        return true; // Prevent default back behavior
      });

      return () => backHandler.remove();
    }
  }, []);

  // For web, prevent browser back button
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        Alert.alert(
          'Accept Terms',
          'You must accept or decline the terms to continue.'
        );
        // Push state back to keep user on disclaimer page
        window.history.pushState(null, '', window.location.pathname);
      };

      // Push initial state
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/accept-disclaimer`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      console.log('Disclaimer accepted successfully:', response.data);
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Failed to accept disclaimer:', error);
      console.error('Error response:', error.response?.data);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept disclaimer. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    Alert.alert(
      'Decline Terms',
      'You must accept the terms and disclaimer to use AuraInfra.ai. Would you like to log out?',
      [
        {
          text: 'Review Again',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setDeclining(true);
            if (logout) {
              await logout();
            }
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>A</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>Terms & Disclaimer</Text>
        <Text style={styles.headerSubtitle}>Please read carefully before proceeding</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms of Service</Text>
          <Text style={styles.text}>
            Welcome to AuraInfra.ai. By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Storage & Privacy</Text>
          <Text style={styles.text}>
            • Your personal property information, documents, and asset details are stored securely in our database.{'\n\n'}
            • We use industry-standard encryption to protect your data.{'\n\n'}
            • Your information will not be shared with third parties without your explicit consent.{'\n\n'}
            • You retain full ownership of all data you upload to the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI-Powered Features</Text>
          <Text style={styles.text}>
            • AuraInfra.ai uses artificial intelligence to scan receipts, estimate values, and analyze property data.{'

'}
            • AI-generated information is provided for convenience and may not always be 100% accurate.{'

'}
            • You should verify important information independently.{'

'}
            • We are not responsible for decisions made based solely on AI-generated data.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disclaimer of Liability</Text>
          <Text style={styles.text}>
            • AuraInfra.ai is provided "as is" without warranties of any kind.{'

'}
            • We are not responsible for any loss, damage, or legal issues arising from the use of this application.{'

'}
            • Property valuations, Vastu/Feng Shui analysis, and paint estimates are for informational purposes only.{'

'}
            • Always consult with professional advisors for legal, financial, or property-related decisions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Responsibilities</Text>
          <Text style={styles.text}>
            • You are responsible for maintaining the accuracy of your property and asset information.{'

'}
            • You must keep your login credentials secure and not share them with others.{'

'}
            • You agree to use the application in compliance with all applicable laws.{'

'}
            • Misuse of the platform may result in account suspension or termination.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Storage</Text>
          <Text style={styles.text}>
            • You may upload documents, photos, and receipts related to your properties and assets.{'

'}
            • You are responsible for ensuring you have the right to upload and store these documents.{'

'}
            • We recommend keeping original copies of important documents in secure physical or cloud storage.
          </Text>
        </View>

        <View style={styles.importantBox}>
          <Ionicons name="warning" size={24} color="#FF9500" />
          <Text style={styles.importantText}>
            By clicking "I Accept", you acknowledge that you have read, understood, and agree to be bound by these terms and disclaimer.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.declineButton, declining && styles.buttonDisabled]}
          onPress={handleDecline}
          disabled={accepting || declining}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, accepting && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={accepting || declining}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>I Accept</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3C3C43',
    fontWeight: Platform.OS === 'android' ? '400' : 'normal',
  },
  importantBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  importantText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#856404',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
