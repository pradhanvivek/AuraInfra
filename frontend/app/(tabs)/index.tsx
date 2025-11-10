import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageDemo, { propertiesPageSteps } from '../../components/PageDemo';

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
  const [viewMoreModalVisible, setViewMoreModalVisible] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProperties();
    }, [token])
  );

  const saveSelectedProperty = async (property: Property) => {
    try {
      await AsyncStorage.setItem('selectedProperty', JSON.stringify(property));
    } catch (error) {
      console.error('Error saving selected property:', error);
    }
  };

  const loadSelectedProperty = async (): Promise<Property | null> => {
    try {
      const saved = await AsyncStorage.getItem('selectedProperty');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Error loading selected property:', error);
      return null;
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/users/properties`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProperties(response.data);
      
      // Try to load previously selected property
      const savedProperty = await loadSelectedProperty();
      if (savedProperty && response.data.find((p: Property) => p.id === savedProperty.id)) {
        // If saved property still exists in the list, use it
        setSelectedProperty(savedProperty);
      } else if (response.data.length > 0 && !selectedProperty) {
        // Otherwise, default to first property
        const firstProperty = response.data[0];
        setSelectedProperty(firstProperty);
        await saveSelectedProperty(firstProperty);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const myPropertyCards = [
    {
      id: 'documents',
      title: 'My Documents',
      icon: 'document-text-outline',
      color: '#007AFF',
      route: '/property-documents/[id]',
      isAd: false,
    },
    {
      id: 'fixtures',
      title: 'My Fixtures',
      icon: 'construct-outline',
      color: '#34C759',
      route: '/property-fixtures/[id]',
      isAd: false,
    },
    {
      id: 'measurements',
      title: 'House Measurements',
      icon: 'resize-outline',
      color: '#FF9500',
      route: '/property-measurements/[id]',
      isAd: false,
    },
    {
      id: 'vastu',
      title: 'Vastu',
      icon: 'compass-outline',
      color: '#AF52DE',
      route: '/property-vastu/[id]',
      isAd: false,
    },
    {
      id: 'nearme',
      title: 'Near Me',
      icon: 'location-outline',
      color: '#00C7BE',
      route: '/near-me',
      isAd: false,
    },
    {
      id: 'builder',
      title: 'My Builder',
      icon: 'business-outline',
      color: '#5856D6',
      route: '/my-builder',
      isAd: false,
    },
    {
      id: 'ad-tile',
      title: 'Ad Space',
      icon: 'megaphone-outline',
      color: '#FF2D55',
      route: null,
      isAd: true,
    },
    {
      id: 'view-more',
      title: 'View More',
      icon: 'ellipsis-horizontal-circle-outline',
      color: '#8E8E93',
      route: null,
      isAd: false,
      isViewMore: true,
    },
  ];

  const allPropertyFeatures = [
    {
      id: 'documents',
      title: 'My Documents',
      icon: 'document-text-outline',
      color: '#007AFF',
      route: '/property-documents/[id]',
    },
    {
      id: 'fixtures',
      title: 'My Fixtures',
      icon: 'construct-outline',
      color: '#34C759',
      route: '/property-fixtures/[id]',
    },
    {
      id: 'measurements',
      title: 'House Measurements',
      icon: 'resize-outline',
      color: '#FF9500',
      route: '/property-measurements/[id]',
    },
    {
      id: 'vastu',
      title: 'Vastu',
      icon: 'compass-outline',
      color: '#AF52DE',
      route: '/property-vastu/[id]',
    },
    {
      id: 'fengshui',
      title: 'Feng Shui',
      icon: 'leaf-outline',
      color: '#34C759',
      route: '/property-fengshui/[id]',
    },
    {
      id: 'paint',
      title: 'Paint Estimate',
      icon: 'color-palette-outline',
      color: '#FF3B30',
      route: '/property-paint/[id]',
    },
    {
      id: 'health',
      title: 'Property Health',
      icon: 'fitness-outline',
      color: '#00C7BE',
      route: '/property-health/[id]',
    },
    {
      id: 'builder',
      title: 'My Builder',
      icon: 'business-outline',
      color: '#5856D6',
      route: '/my-builder',
    },
  ];

  const managementCards = [
    {
      id: 'hoa',
      title: 'HOA Maintenance',
      description: 'View and pay maintenance charges',
      icon: 'cash-outline',
      color: '#34C759',
      route: '/hoa-maintenance',
      isAd: false,
    },
    {
      id: 'visitors',
      title: 'Visitor Management',
      description: 'Pre-approve and track visitors',
      icon: 'people-outline',
      color: '#007AFF',
      route: '/visitors',
      isAd: false,
    },
    {
      id: 'community',
      title: 'Community Board',
      description: 'Announcements and discussions',
      icon: 'chatbubbles-outline',
      color: '#FF9500',
      route: '/community',
      isAd: false,
    },
    {
      id: 'amenities',
      title: 'Amenities Booking',
      description: 'Book clubhouse, gym & facilities',
      icon: 'calendar-outline',
      color: '#5856D6',
      route: '/amenities',
      isAd: false,
    },
    {
      id: 'complaints',
      title: 'Service Requests',
      description: 'Submit and track complaints',
      icon: 'construct-outline',
      color: '#FF3B30',
      route: '/complaints',
      isAd: false,
    },
    {
      id: 'documents',
      title: 'HOA Documents',
      description: 'Bylaws, minutes & reports',
      icon: 'document-text-outline',
      color: '#AF52DE',
      route: '/hoa-documents',
      isAd: false,
    },
    {
      id: 'meetings',
      title: 'Meetings & Events',
      description: 'Schedule and RSVP to meetings',
      icon: 'calendar-sharp',
      color: '#00C7BE',
      route: '/hoa-meetings',
      isAd: false,
    },
    {
      id: 'ad-tile',
      title: 'Special Offer',
      description: 'Sponsored content',
      icon: 'megaphone-outline',
      color: '#FF2D55',
      route: null,
      isAd: true,
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
          {selectedProperty ? (
            <>
              <View style={styles.propertyLogoNameContainer}>
                {selectedProperty.logo ? (
                  <Image
                    source={{ uri: selectedProperty.logo }}
                    style={styles.propertyLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <Image
                    source={require('../../assets/images/level-constructions-logo.png')}
                    style={styles.propertyLogo}
                    resizeMode="contain"
                  />
                )}
                <View style={styles.propertyTextContainer}>
                  <Text style={styles.propertyNameHeader} numberOfLines={1}>
                    {selectedProperty.name}
                  </Text>
                  <Text style={styles.propertyAddressHeader} numberOfLines={1}>
                    {selectedProperty.address}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-down-circle" size={24} color="#007AFF" />
            </>
          ) : (
            <>
              <View style={styles.addressContent}>
                <Text style={styles.selectText}>Select Property</Text>
              </View>
              <Ionicons name="chevron-down-circle" size={24} color="#007AFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Banner with Real Estate Ad */}
        <TouchableOpacity 
          style={styles.heroBanner}
          activeOpacity={0.9}
          onPress={() => {
            // Add navigation to ad/listing here if needed
            console.log('Hero banner tapped');
          }}
        >
          <Image 
            source={require('../../assets/images/hero-banner.png')} 
            style={styles.heroBannerImage}
            resizeMode="cover"
          />
        </TouchableOpacity>

        {/* My Property - Quick Access */}
        <Text style={styles.sectionTitle}>My Property</Text>
        <View style={styles.compactGrid}>
          {myPropertyCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.compactCard,
                card.isAd && styles.adCard
              ]}
              onPress={() => {
                if (card.isAd) {
                  console.log('Ad tile tapped');
                } else if ((card as any).isViewMore) {
                  setViewMoreModalVisible(true);
                } else {
                  router.push({
                    pathname: card.route,
                    params: { id: selectedProperty?.id }
                  } as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.compactIcon,
                { backgroundColor: card.color + '20' },
                card.isAd && styles.adIcon
              ]}>
                <Ionicons name={card.icon as any} size={24} color={card.color} />
              </View>
              <Text style={[
                styles.compactLabel,
                card.isAd && styles.adLabel
              ]} numberOfLines={2}>
                {card.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add New Property Action */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/property/add' as any)}
        >
          <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Add New Property</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        {/* Property Management - Compact Cards */}
        <Text style={styles.sectionTitle}>Property Management</Text>
        <View style={styles.compactGrid}>
          {managementCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.compactCard,
                card.isAd && styles.adCard
              ]}
              onPress={() => {
                if (card.isAd) {
                  // Handle ad click - can open external link or modal
                  console.log('Ad tile tapped');
                } else {
                  router.push({
                    pathname: card.route,
                    params: { propertyId: selectedProperty?.id }
                  } as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.compactIcon,
                { backgroundColor: card.color + '20' },
                card.isAd && styles.adIcon
              ]}>
                <Ionicons name={card.icon as any} size={24} color={card.color} />
              </View>
              <Text style={[
                styles.compactLabel,
                card.isAd && styles.adLabel
              ]} numberOfLines={2}>
                {card.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
                  onPress={async () => {
                    setSelectedProperty(property);
                    await saveSelectedProperty(property);
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

      {/* View More Modal */}
      <Modal
        visible={viewMoreModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setViewMoreModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewMoreModalContent}>
            <View style={styles.viewMoreHeader}>
              <Text style={styles.viewMoreTitle}>All Property Features</Text>
              <TouchableOpacity onPress={() => setViewMoreModalVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.viewMoreScroll} contentContainerStyle={styles.viewMoreGrid}>
              {allPropertyFeatures.map((feature) => (
                <TouchableOpacity
                  key={feature.id}
                  style={styles.viewMoreCard}
                  onPress={() => {
                    setViewMoreModalVisible(false);
                    router.push({
                      pathname: feature.route,
                      params: { id: selectedProperty?.id }
                    } as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.viewMoreIcon,
                    { backgroundColor: feature.color + '20' }
                  ]}>
                    <Ionicons name={feature.icon as any} size={32} color={feature.color} />
                  </View>
                  <Text style={styles.viewMoreLabel} numberOfLines={2}>
                    {feature.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Page Demo */}
      <PageDemo
        visible={demoVisible}
        onClose={() => setDemoVisible(false)}
        title="Properties Page Guide"
        steps={propertiesPageSteps}
      />

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setDemoVisible(true)}
      >
        <Ionicons name="help-circle" size={28} color="#fff" />
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
    paddingTop: 5,
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
  propertyLogoNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 12,
  },
  propertyLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  propertyTextContainer: {
    flex: 1,
  },
  addressContent: {
    flex: 1,
    marginRight: 8,
  },
  propertyNameHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  propertyAddressHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  selectText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  content: {
    padding: 16,
  },
  heroBanner: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  compactCard: {
    width: '22%',
    alignItems: 'center',
    marginBottom: 20,
  },
  compactIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 13,
  },
  adCard: {
    opacity: 0.95,
  },
  adIcon: {
    borderWidth: 1,
    borderColor: '#FF2D5550',
    borderStyle: 'dashed',
  },
  adLabel: {
    fontStyle: 'italic',
    fontSize: 10,
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
    fontSize: 18,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  viewMoreModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    height: '80%',
    paddingBottom: 20,
  },
  viewMoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  viewMoreTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  viewMoreScroll: {
    flex: 1,
    minHeight: 200,
  },
  viewMoreGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  viewMoreCard: {
    width: '47%',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewMoreIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  viewMoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  helpButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
