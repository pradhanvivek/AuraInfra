import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image } from 'react-native';
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
      {/* Header with Property Address and Dropdown */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </View>
        
        <TouchableOpacity
          style={styles.addressDropdown}
          onPress={() => setSelectorModalVisible(true)}
        >
          <View style={styles.addressContent}>
            {selectedProperty ? (
              <>
                <Text style={styles.propertyAddressHeader} numberOfLines={1}>
                  {selectedProperty.address}
                </Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>{selectedProperty.user_role}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.selectText}>Select Property</Text>
            )}
          </View>
          <Ionicons name="chevron-down-circle" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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

      {/* Property Selector Modal */}
      <Modal
        visible={selectorModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Property</Text>
              <TouchableOpacity onPress={() => setSelectorModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalList}>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.propertyOption,
                    selectedProperty?.id === property.id && styles.propertyOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedProperty(property);
                    setSelectorModalVisible(false);
                  }}
                >
                  <View style={styles.propertyOptionContent}>
                    <Text style={styles.propertyOptionName}>{property.name}</Text>
                    <Text style={styles.propertyOptionAddress}>{property.address}</Text>
                    <View style={styles.propertyOptionBadge}>
                      <Text style={styles.propertyOptionRole}>{property.user_role}</Text>
                    </View>
                  </View>
                  {selectedProperty?.id === property.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 50,
    height: 50,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  addressDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  addressContent: {
    flex: 1,
    marginRight: 8,
  },
  propertyAddressHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    textTransform: 'uppercase',
  },
  selectText: {
    fontSize: 14,
    color: '#8E8E93',
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
  selectorButton: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorLeft: {
    flex: 1,
  },
  selectorPropertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  selectorPropertyAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: '#8E8E93',
  },
  propertyDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  propertyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F2F2F7',
  },
  propertyOptionSelected: {
    backgroundColor: '#E5F0FF',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  propertyOptionContent: {
    flex: 1,
  },
  propertyOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  propertyOptionAddress: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  propertyOptionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  propertyOptionRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
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
