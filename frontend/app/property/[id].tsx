import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
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
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const fetchProperty = async () => {
    try {
      const data = await propertyApi.getById(token!, id!);
      setProperty(data);
    } catch (error) {
      console.error('Failed to fetch property:', error);
    } finally {
      setLoading(false);
    }
  };

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
      {/* Property Header */}
      <View style={styles.header}>
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
          <Tab.Screen
            name="Health"
            children={() => <HealthScoreScreen propertyId={id!} />}
          />
          <Tab.Screen
            name="Documents"
            children={() => <DocumentsScreen propertyId={id!} />}
          />
          <Tab.Screen
            name="Fixtures"
            children={() => <FixturesScreen propertyId={id!} />}
          />
          <Tab.Screen
            name="Measurements"
            children={() => <MeasurementsScreen propertyId={id!} />}
          />
          <Tab.Screen
            name="Paint"
            children={() => <PaintEstimationScreen propertyId={id!} />}
          />
          <Tab.Screen
            name="Vastu"
            children={() => <VastuScreen propertyId={id!} geomancyType="vastu" />}
          />
          <Tab.Screen
            name="Feng Shui"
            children={() => <VastuScreen propertyId={id!} geomancyType="feng_shui" />}
          />
          <Tab.Screen
            name="Near Me"
            children={() => <NearMeScreen propertyId={id!} />}
          />
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
