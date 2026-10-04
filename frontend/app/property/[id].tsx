import { createMaterialTopTabNavigator } from 'expo-router/js-top-tabs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { propertyApi } from '../../services/api';
import DocumentsScreen from '../../screens/property/DocumentsScreen';
import FixturesScreen from '../../screens/property/FixturesScreen';
import MeasurementsScreen from '../../screens/property/MeasurementsScreen';
import VastuScreen from '../../screens/property/VastuScreen';
import NearMeScreen from '../../screens/property/NearMeScreen';
import HealthScoreScreen from '../../screens/property/HealthScoreScreen';
import PaintEstimationScreen from '../../screens/property/PaintEstimationScreen';

const Tab = createMaterialTopTabNavigator();

interface Property {
  id: string;
  name: string;
  address: string;
  purchase_cost?: number;
  current_value?: number;
}

export default function PropertyDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProperty = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const data = await propertyApi.getById(token!, id!);
      if (!isActive()) return;
      setProperty(data);
    } catch (error) {
      if (!isActive()) return;
      console.error('Failed to fetch property:', error);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    let active = true;
    void fetchProperty(() => active);
    return () => { active = false; };
  }, [fetchProperty]);



  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Property Header with dynamic safe area padding - only for native */}
      <View style={[styles.headerWrapper, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.propertyName} numberOfLines={1}>
              {property?.name || 'Property Details'}
            </Text>
            {property?.address && (
              <Text style={styles.propertyAddress} numberOfLines={1}>
                {property.address}
              </Text>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => router.push(`/property/edit/${id}`)} 
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

        {/* Tabs Container */}
        <View style={styles.tabsContainer}>
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarIndicatorStyle: {
              backgroundColor: '#007AFF',
              height: 3,
            },
            tabBarStyle: {
              backgroundColor: '#fff',
            },
            tabBarLabelStyle: {
              fontSize: 13,
              fontWeight: '600',
              textTransform: 'none',
            },
            tabBarScrollEnabled: true,
          }}
        >
          <Tab.Screen name="Health">{() => <HealthScoreScreen propertyId={id!} />}</Tab.Screen>
          <Tab.Screen name="Documents">{() => <DocumentsScreen propertyId={id!} />}</Tab.Screen>
          <Tab.Screen name="Fixtures">{() => <FixturesScreen propertyId={id!} />}</Tab.Screen>
          <Tab.Screen name="Measurements">{() => <MeasurementsScreen propertyId={id!} />}</Tab.Screen>
          <Tab.Screen name="Paint">{() => <PaintEstimationScreen propertyId={id!} />}</Tab.Screen>
          <Tab.Screen name="Vastu">{() => <VastuScreen propertyId={id!} geomancyType="vastu" />}</Tab.Screen>
          <Tab.Screen name="Feng Shui">{() => <VastuScreen propertyId={id!} geomancyType="feng_shui" />}</Tab.Screen>
          <Tab.Screen name="Near Me">{() => <NearMeScreen propertyId={id!} />}</Tab.Screen>
        </Tab.Navigator>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerWrapper: {
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
  backBtn: {
    padding: 8,
  },
  editBtn: {
    padding: 8,
  },
  tabsContainer: {
    flex: 1,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
    textAlign: 'center',
  },
  propertyAddress: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
