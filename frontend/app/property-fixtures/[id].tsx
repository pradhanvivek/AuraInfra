import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import FixturesScreen from '../../screens/property/FixturesScreen';

import { API_URL } from '../../services/config';

export default function PropertyFixturesRoute() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const [propertyName, setPropertyName] = useState<string>('My Fixtures');
  const [loading, setLoading] = useState(true);

  const fetchPropertyName = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const response = await axios.get(`${API_URL}/api/properties/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!isActive()) return;
      setPropertyName(response.data.name || 'My Fixtures');
    } catch (error) {
      if (!isActive()) return;
      console.error('Error fetching property:', error);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    let active = true;
    void fetchPropertyName(() => active);
    return () => { active = false; };
  }, [fetchPropertyName]);



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
            <Text style={styles.headerSubtitle}>Fixtures</Text>
            <Text style={styles.headerTitle}>{propertyName}</Text>
          </View>
        )}
        <View style={styles.placeholder} />
      </View>
      <FixturesScreen propertyId={id as string} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
