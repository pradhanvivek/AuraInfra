import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Property {
  id: string;
  name: string;
  address: string;
  user_id: string;
}

interface Admin {
  id: string;
  username: string;
  email?: string;
  managed_properties: string[];
}

interface User {
  id: string;
  username: string;
  email?: string;
}

export default function SuperAdminPanel() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'admins'>('properties');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [propertiesRes, adminsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/super/all-properties`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/admin/super/all-admins`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);

      setProperties(propertiesRes.data);
      setAdmins(adminsRes.data);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/super/all-users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAllUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const handleAssignAdmin = (property: Property) => {
    setSelectedProperty(property);
    fetchAllUsers();
    setShowAssignModal(true);
  };

  const assignAdmin = async () => {
    if (!selectedUserId || !selectedProperty) {
      Alert.alert('Error', 'Please select a user');
      return;
    }

    setAssigning(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/super/assign-hoa-admin`,
        null,
        {
          params: {
            target_user_id: selectedUserId,
            property_id: selectedProperty.id,
          },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      Alert.alert('Success', 'Admin assigned successfully!');
      setShowAssignModal(false);
      setSelectedUserId('');
      setSelectedProperty(null);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to assign admin');
    } finally {
      setAssigning(false);
    }
  };

  const removeAdmin = async (adminId: string, propertyId: string) => {
    Alert.alert(
      'Confirm Removal',
      'Are you sure you want to remove this admin from this property?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/admin/super/remove-hoa-admin`,
                {
                  params: {
                    target_user_id: adminId,
                    property_id: propertyId,
                  },
                  headers: { 'Authorization': `Bearer ${token}` }
                }
              );

              Alert.alert('Success', 'Admin removed successfully!');
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to remove admin');
            }
          }
        }
      ]
    );
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.name : 'Unknown Property';
  };

  const getAdminForProperty = (propertyId: string) => {
    return admins.find(admin => admin.managed_properties.includes(propertyId));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Super Admin Panel</Text>
        <TouchableOpacity onPress={fetchData}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
          onPress={() => setActiveTab('properties')}
        >
          <Ionicons
            name="business"
            size={20}
            color={activeTab === 'properties' ? '#007AFF' : '#8E8E93'}
          />
          <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>
            Properties ({properties.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'admins' && styles.tabActive]}
          onPress={() => setActiveTab('admins')}
        >
          <Ionicons
            name="shield-checkmark"
            size={20}
            color={activeTab === 'admins' ? '#007AFF' : '#8E8E93'}
          />
          <Text style={[styles.tabText, activeTab === 'admins' && styles.tabTextActive]}>
            HOA Admins ({admins.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'properties' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Properties</Text>
            {properties.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="business-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No properties in the system</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {properties.map((property) => {
                  const admin = getAdminForProperty(property.id);
                  return (
                    <View key={property.id} style={styles.propertyCard}>
                      <View style={styles.propertyHeader}>
                        <View style={styles.propertyIcon}>
                          <Ionicons name="home" size={24} color="#007AFF" />
                        </View>
                        <View style={styles.propertyInfo}>
                          <Text style={styles.propertyName}>{property.name}</Text>
                          <Text style={styles.propertyAddress}>{property.address}</Text>
                        </View>
                      </View>
                      
                      {admin ? (
                        <View style={styles.adminBadge}>
                          <Ionicons name="shield-checkmark" size={16} color="#34C759" />
                          <Text style={styles.adminBadgeText}>
                            Admin: {admin.username}
                          </Text>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeAdmin(admin.id, property.id)}
                          >
                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.assignButton}
                          onPress={() => handleAssignAdmin(property)}
                        >
                          <Ionicons name="person-add" size={18} color="#007AFF" />
                          <Text style={styles.assignButtonText}>Assign Admin</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HOA Administrators</Text>
            {admins.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No HOA admins assigned</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {admins.map((admin) => (
                  <View key={admin.id} style={styles.adminCard}>
                    <View style={styles.adminHeader}>
                      <View style={styles.adminIcon}>
                        <Ionicons name="person" size={24} color="#FF9500" />
                      </View>
                      <View style={styles.adminInfo}>
                        <Text style={styles.adminName}>{admin.username}</Text>
                        {admin.email && (
                          <Text style={styles.adminEmail}>{admin.email}</Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.adminProperties}>
                      <Text style={styles.propertiesLabel}>
                        Manages {admin.managed_properties.length} {admin.managed_properties.length === 1 ? 'property' : 'properties'}:
                      </Text>
                      {admin.managed_properties.map((propId) => (
                        <View key={propId} style={styles.propertyTag}>
                          <Ionicons name="home" size={14} color="#007AFF" />
                          <Text style={styles.propertyTagText}>
                            {getPropertyName(propId)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeAdmin(admin.id, propId)}
                          >
                            <Ionicons name="close-circle" size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Assign Admin Modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Admin</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {selectedProperty && (
                <>
                  <Text style={styles.modalLabel}>Property:</Text>
                  <View style={styles.selectedPropertyCard}>
                    <Ionicons name="home" size={20} color="#007AFF" />
                    <View style={styles.selectedPropertyInfo}>
                      <Text style={styles.selectedPropertyName}>{selectedProperty.name}</Text>
                      <Text style={styles.selectedPropertyAddress}>{selectedProperty.address}</Text>
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>Select User:</Text>
                  {allUsers.length > 0 ? (
                    <View style={styles.userList}>
                      {allUsers.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          style={[
                            styles.userItem,
                            selectedUserId === user.id && styles.userItemSelected
                          ]}
                          onPress={() => setSelectedUserId(user.id)}
                        >
                          <View style={styles.userItemIcon}>
                            <Ionicons name="person" size={20} color={selectedUserId === user.id ? '#007AFF' : '#8E8E93'} />
                          </View>
                          <View style={styles.userItemInfo}>
                            <Text style={[
                              styles.userItemName,
                              selectedUserId === user.id && styles.userItemNameSelected
                            ]}>
                              {user.username}
                            </Text>
                            {user.email && (
                              <Text style={styles.userItemEmail}>{user.email}</Text>
                            )}
                          </View>
                          {selectedUserId === user.id && (
                            <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.infoBox}>
                      <Ionicons name="information-circle" size={20} color="#FF9500" />
                      <Text style={styles.infoTextWarning}>
                        Loading users...
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.submitButton, !selectedUserId && styles.submitButtonDisabled]}
                    onPress={assignAdmin}
                    disabled={assigning || !selectedUserId}
                  >
                    <Text style={styles.submitButtonText}>
                      {assigning ? 'Assigning...' : 'Assign Admin'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 12,
  },
  list: {
    gap: 12,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  propertyHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  propertyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  propertyName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  propertyAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  adminBadgeText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  assignButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  adminCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  adminHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF9F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  adminName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  adminProperties: {
    gap: 8,
  },
  propertiesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  propertyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  propertyTagText: {
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  selectedPropertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  selectedPropertyInfo: {
    flex: 1,
  },
  selectedPropertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  selectedPropertyAddress: {
    fontSize: 13,
    color: '#8E8E93',
  },
  helpText: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
