import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import DocumentsScreen from '../../screens/property/DocumentsScreen';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PropertyDocumentsRoute() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const [propertyName, setPropertyName] = useState<string>('My Documents');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPropertyName();
  }, [id]);

  const fetchPropertyName = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/properties/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPropertyName(response.data.name || 'My Documents');
    } catch (error) {
      console.error('Error fetching property:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerSubtitle}>Documents</Text>
            <Text style={styles.headerTitle}>{propertyName}</Text>
          </View>
        )}
        <View style={styles.placeholder} />
      </View>
      <DocumentsScreen propertyId={id as string} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 32,
  },
});
