import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface CommunityProperty {
  id: string;
  name: string;
  address: string;
  logo?: string;
  builder_name?: string;
  builder_contact?: string;
  builder_email?: string;
  project_details?: string;
  is_active: boolean;
  created_at: string;
}

export default function CommunityPropertiesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [properties, setProperties] = useState<CommunityProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentProperty, setCurrentProperty] = useState<CommunityProperty | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [logo, setLogo] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [builderContact, setBuilderContact] = useState('');
  const [builderEmail, setBuilderEmail] = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Google Places autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/super/community-properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProperties(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: Platform.OS === 'web' ? 'Images' as any : ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const base64 = await fetch(asset.uri)
          .then((res) => res.blob())
          .then((blob) => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          });
        setLogo(base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const openCreateModal = () => {
    setEditMode(false);
    setCurrentProperty(null);
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (property: CommunityProperty) => {
    setEditMode(true);
    setCurrentProperty(property);
    setName(property.name);
    setAddress(property.address);
    setLogo(property.logo || '');
    setBuilderName(property.builder_name || '');
    setBuilderContact(property.builder_contact || '');
    setBuilderEmail(property.builder_email || '');
    setProjectDetails(property.project_details || '');
    setIsActive(property.is_active);
    setModalVisible(true);
  };

  const resetForm = () => {
    setName('');
    setAddress('');
    setLogo('');
    setBuilderName('');
    setBuilderContact('');
    setBuilderEmail('');
    setProjectDetails('');
    setIsActive(true);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Google Places autocomplete functions
  const fetchPlaceSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/places/autocomplete?input=${encodeURIComponent(input)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.predictions) {
        setSuggestions(response.data.predictions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      fetchPlaceSuggestions(text);
    }, 300);
  };

  const selectSuggestion = (suggestion: any) => {
    setAddress(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSave = async () => {
    if (!name || !address) {
      Alert.alert('Error', 'Name and address are required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name,
        address,
        logo: logo || undefined,
        builder_name: builderName || undefined,
        builder_contact: builderContact || undefined,
        builder_email: builderEmail || undefined,
        project_details: projectDetails || undefined,
        is_active: isActive,
      };

      if (editMode && currentProperty) {
        await axios.put(
          `${API_URL}/api/admin/super/community-properties/${currentProperty.id}`,
          data,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Property updated successfully');
      } else {
        await axios.post(`${API_URL}/api/admin/super/community-properties`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
        Alert.alert('Success', 'Property created successfully');
      }

      setModalVisible(false);
      fetchProperties();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (property: CommunityProperty) => {
    Alert.alert(
      'Delete Property',
      `Are you sure you want to delete "${property.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/admin/super/community-properties/${property.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Property deleted successfully');
              fetchProperties();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete property');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Properties</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {properties.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No properties yet</Text>
              <Text style={styles.emptySubtext}>Add a community property to get started</Text>
            </View>
          ) : (
            properties.map((property) => (
              <View key={property.id} style={styles.propertyCard}>
                <View style={styles.propertyHeader}>
                  {property.logo ? (
                    <Image source={{ uri: property.logo }} style={styles.propertyLogo} />
                  ) : (
                    <View style={styles.propertyLogoPlaceholder}>
                      <Ionicons name="business" size={32} color="#007AFF" />
                    </View>
                  )}
                  <View style={styles.propertyInfo}>
                    <View style={styles.propertyTitleRow}>
                      <Text style={styles.propertyName}>{property.name}</Text>
                      {!property.is_active && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>Inactive</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.propertyAddress}>{property.address}</Text>
                    {property.builder_name && (
                      <Text style={styles.builderName}>Builder: {property.builder_name}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.propertyActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => openEditModal(property)}
                  >
                    <Ionicons name="pencil" size={20} color="#007AFF" />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(property)}
                  >
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                    <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editMode ? 'Edit Property' : 'New Property'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Property Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter property name"
            />

            <Text style={styles.label}>Address *</Text>
            <View style={{ zIndex: 1000 }}>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={handleAddressChange}
                placeholder="Start typing address..."
                multiline
              />
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item.place_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectSuggestion(item)}
                      >
                        <Ionicons name="location-outline" size={20} color="#007AFF" />
                        <Text style={styles.suggestionText}>{item.description}</Text>
                      </TouchableOpacity>
                    )}
                    style={styles.suggestionsList}
                    nestedScrollEnabled
                  />
                </View>
              )}
            </View>

            <Text style={styles.label}>Logo</Text>
            <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logoPreview} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Ionicons name="camera" size={32} color="#007AFF" />
                  <Text style={styles.imagePickerText}>Upload Logo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Builder Information</Text>

            <Text style={styles.label}>Builder Name</Text>
            <TextInput
              style={styles.input}
              value={builderName}
              onChangeText={setBuilderName}
              placeholder="Enter builder name"
            />

            <Text style={styles.label}>Builder Contact</Text>
            <TextInput
              style={styles.input}
              value={builderContact}
              onChangeText={setBuilderContact}
              placeholder="Enter contact number"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Builder Email</Text>
            <TextInput
              style={styles.input}
              value={builderEmail}
              onChangeText={setBuilderEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Project Details</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={projectDetails}
              onChangeText={setProjectDetails}
              placeholder="Enter project details, amenities, etc."
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.activeToggle}
              onPress={() => setIsActive(!isActive)}
            >
              <View style={styles.activeToggleContent}>
                <Text style={styles.activeToggleLabel}>Show on Registration</Text>
                <Text style={styles.activeToggleSubtext}>
                  {isActive ? 'Visible to new users' : 'Hidden from registration'}
                </Text>
              </View>
              <View style={[styles.toggleSwitch, isActive && styles.toggleSwitchActive]}>
                <View style={[styles.toggleThumb, isActive && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  addButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  propertyLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
  },
  propertyLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  inactiveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  propertyAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  builderName: {
    fontSize: 12,
    color: '#007AFF',
  },
  propertyActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  deleteButton: {
    borderLeftWidth: 1,
    borderLeftColor: '#F0F0F0',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  deleteText: {
    color: '#FF3B30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePickerButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePickerPlaceholder: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  logoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 24,
    marginBottom: 8,
  },
  activeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
  },
  activeToggleContent: {
    flex: 1,
  },
  activeToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  activeToggleSubtext: {
    fontSize: 12,
    color: '#666',
  },
  toggleSwitch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#E5E5E5',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#34C759',
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
});
