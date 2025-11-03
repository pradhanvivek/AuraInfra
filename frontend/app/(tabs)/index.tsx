import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useCallback } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Property {
  id: string;
  name: string;
  address: string;
  user_role: string;
}

export default function PropertiesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectorModalVisible, setSelectorModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProperties();
    }, [token])
  );

  const fetchProperties = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/users/properties`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProperties(response.data);
      if (response.data.length > 0 && !selectedProperty) {
        setSelectedProperty(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const managementCards = [
    {
      id: 'hoa',
      title: 'HOA Maintenance',
      description: 'View and pay maintenance charges',
      icon: 'cash-outline',
      color: '#34C759',
      route: '/hoa-maintenance',
    },
    {
      id: 'visitors',
      title: 'Visitor Management',
      description: 'Pre-approve and track visitors',
      icon: 'people-outline',
      color: '#007AFF',
      route: '/visitors',
    },
    {
      id: 'community',
      title: 'Community Board',
      description: 'Announcements and discussions',
      icon: 'chatbubbles-outline',
      color: '#FF9500',
      route: '/community',
    },
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (properties.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Properties</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="business-outline" size={80} color="#C7C7CC" />
          <Text style={styles.emptyText}>No Properties</Text>
          <Text style={styles.emptySubtext}>Add your first property to get started</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/property/add' as any)}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add Property</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Property Selector */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Ionicons name="business" size={24} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>Property Management</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Property Selector Card */}
        <View style={styles.propertySelector}>
          <View style={styles.selectorHeader}>
            <Ionicons name="business" size={24} color="#007AFF" />
            <Text style={styles.selectorTitle}>Selected Property</Text>
          </View>
          
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedProperty?.id}
              onValueChange={(value) => {
                const property = properties.find(p => p.id === value);
                setSelectedProperty(property || null);
              }}
              style={styles.picker}
            >
              {properties.map((property) => (
                <Picker.Item
                  key={property.id}
                  label={`${property.name} (${property.user_role})`}
                  value={property.id}
                />
              ))}
            </Picker>
          </View>

          {selectedProperty && (
            <View style={styles.propertyDetails}>
              <Text style={styles.propertyName}>{selectedProperty.name}</Text>
              <Text style={styles.propertyAddress}>{selectedProperty.address}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{selectedProperty.user_role.toUpperCase()}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Management Cards */}
        <Text style={styles.sectionTitle}>Property Management</Text>
        {managementCards.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.card}
            onPress={() => {
              // Pass selected property ID to the route
              router.push({
                pathname: card.route,
                params: { propertyId: selectedProperty?.id }
              } as any);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: card.color + '20' }]}>
              <Ionicons name={card.icon as any} size={32} color={card.color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
          </TouchableOpacity>
        ))}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/property/add' as any)}
        >
          <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Add New Property</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push(`/property/${selectedProperty?.id}` as any)}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Property Details & Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    padding: 16,
  },
  propertySelector: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  propertyDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
  },
  propertyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
