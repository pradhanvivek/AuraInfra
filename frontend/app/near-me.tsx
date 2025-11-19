import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import NearMeScreen from '../screens/property/NearMeScreen';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function NearMeRoute() {
  const router = useRouter();
  const { token } = useAuth();
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  // Refetch selected property whenever the page comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchSelectedProperty();
    }, [])
  );

  const fetchSelectedProperty = async () => {
    try {
      // Get selected property from AsyncStorage (saved from dashboard)
      const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
        (module) => module.default
      );
      const savedPropertyStr = await AsyncStorage.getItem('selectedProperty');
      
      if (savedPropertyStr) {
        // Use the saved property directly
        const property = JSON.parse(savedPropertyStr);
        setSelectedProperty(property);
      } else {
        // Fallback: fetch properties and use the first one
        const response = await axios.get(`${API_URL}/api/users/properties`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.data && response.data.length > 0) {
          const property = response.data[0];
          setSelectedProperty(property);
          // Save it for next time
          await AsyncStorage.setItem('selectedProperty', JSON.stringify(property));
        }
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    }
  };

  if (!selectedProperty) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Near Me</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Near Me</Text>
        <View style={styles.placeholder} />
      </View>
      <NearMeScreen propertyId={selectedProperty.id} />
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
