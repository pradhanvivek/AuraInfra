import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface DashboardStats {
  property_id: string;
  total_users: number;
  pending_approvals: number;
  active_residents: number;
  payment_requests_sent: number;
  payments_received: number;
  unpaid_amount: number;
  recent_posts: number;
  upcoming_meetings: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { token, userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [propertyName, setPropertyName] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [managedProperties, setManagedProperties] = useState<any[]>([]);
  const [selectorVisible, setSelectorVisible] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchDashboardStats();
    }
  }, [selectedProperty]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProfile(response.data);
      
      // Fetch full details for all managed properties
      if (response.data.managed_properties?.length > 0) {
        const propertyDetailsPromises = response.data.managed_properties.map((propId: string) =>
          axios.get(`${API_URL}/api/properties/${propId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        );
        
        const propertyDetailsResponses = await Promise.all(propertyDetailsPromises);
        const properties = propertyDetailsResponses.map(res => res.data);
        setManagedProperties(properties);
        
        // Set first managed property as default
        setSelectedProperty(response.data.managed_properties[0]);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/properties/${selectedProperty}/dashboard`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setStats(response.data);
      
      // Fetch property name
      const propResponse = await axios.get(
        `${API_URL}/api/properties/${selectedProperty}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setPropertyName(propResponse.data.name || 'Community');
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!profile?.is_hoa_admin && !profile?.is_super_admin) {
    return (
      <View style={styles.container}>
        <Text style={styles.noAccessText}>Admin access required</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          {propertyName && (
            <Text style={styles.propertyName}>{propertyName}</Text>
          )}
          <Text style={styles.headerSubtitle}>
            {profile.is_super_admin ? 'Super Admin' : 'HOA Admin'}
          </Text>
        </View>

      {/* Property Selector - only show if admin manages multiple properties */}
      {managedProperties.length > 1 && (
        <View style={styles.selectorContainer}>
          <TouchableOpacity
            style={styles.propertySelector}
            onPress={() => setSelectorVisible(true)}
          >
            <View style={styles.selectorContent}>
              <Ionicons name="business" size={20} color="#007AFF" />
              <Text style={styles.selectorText}>
                {managedProperties.find(p => p.id === selectedProperty)?.name || 'Select Property'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: '#007AFF' }]}
            onPress={() => router.push('/admin/approvals')}
          >
            <Ionicons name="people" size={32} color="#fff" />
            <Text style={styles.statNumber}>{stats.pending_approvals}</Text>
            <Text style={styles.statLabel}>Pending Approvals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: '#34C759' }]}
            onPress={() => router.push('/admin/payments')}
          >
            <Ionicons name="cash" size={32} color="#fff" />
            <Text style={styles.statNumber}>${stats.unpaid_amount.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Unpaid Amount</Text>
          </TouchableOpacity>

          <View style={[styles.statCard, { backgroundColor: '#FF9500' }]}>
            <Ionicons name="chatbubbles" size={32} color="#fff" />
            <Text style={styles.statNumber}>{stats.recent_posts}</Text>
            <Text style={styles.statLabel}>Recent Posts</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#5856D6' }]}>
            <Ionicons name="calendar" size={32} color="#fff" />
            <Text style={styles.statNumber}>{stats.upcoming_meetings}</Text>
            <Text style={styles.statLabel}>Upcoming Meetings</Text>
          </View>
        </View>
      )}

      {/* Residents Info */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Residents Overview</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Users</Text>
              <Text style={styles.infoValue}>{stats.total_users}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Active Residents</Text>
              <Text style={styles.infoValue}>{stats.active_residents}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payments Received</Text>
              <Text style={styles.infoValue}>{stats.payments_received}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Management</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/admin/approvals')}
        >
          <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
          <Text style={styles.actionText}>User Approvals</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/admin/create-payment')}
        >
          <Ionicons name="cash-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Create Payment Request</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/admin/create-post')}
        >
          <Ionicons name="megaphone-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Create Announcement</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/admin/amenities')}
        >
          <Ionicons name="business-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Manage Amenities</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/admin/meetings')}
        >
          <Ionicons name="calendar-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Manage Meetings</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/admin/booking-approvals')}
        >
          <Ionicons name="checkmark-done-outline" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Amenity Booking Approvals</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        {/* New Feature: Maintenance Dues */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/admin/maintenance-dues/${selectedProperty}`)}
          disabled={!selectedProperty}
        >
          <Ionicons name="receipt-outline" size={24} color={selectedProperty ? "#007AFF" : "#C7C7CC"} />
          <Text style={[styles.actionText, !selectedProperty && styles.actionTextDisabled]}>
            Maintenance Dues
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      {/* Super Admin Section */}
      {profile.is_super_admin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Super Admin</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/admin/super-admin')}
          >
            <Ionicons name="shield-checkmark" size={24} color="#FF3B30" />
            <Text style={styles.actionText}>Super Admin Panel</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      )}

      {/* Property Selector Modal */}
      <Modal
        visible={selectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Property</Text>
              <TouchableOpacity onPress={() => setSelectorVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.propertiesList}>
              {managedProperties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.propertyItem,
                    selectedProperty === property.id && styles.selectedPropertyItem
                  ]}
                  onPress={() => {
                    setSelectedProperty(property.id);
                    setSelectorVisible(false);
                  }}
                >
                  <View style={styles.propertyInfo}>
                    <Text style={[
                      styles.propertyItemName,
                      selectedProperty === property.id && styles.selectedPropertyText
                    ]}>
                      {property.name}
                    </Text>
                    <Text style={styles.propertyItemAddress}>{property.address}</Text>
                  </View>
                  {selectedProperty === property.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  propertyName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  noAccessText: {
    textAlign: 'center',
    fontSize: 18,
    color: '#8E8E93',
    marginTop: 100,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  infoLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  actionTextDisabled: {
    color: '#C7C7CC',
  },
  selectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  propertySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  propertiesList: {
    padding: 16,
  },
  propertyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginBottom: 12,
  },
  selectedPropertyItem: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  propertyInfo: {
    flex: 1,
  },
  propertyItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  selectedPropertyText: {
    color: '#007AFF',
  },
  propertyItemAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
