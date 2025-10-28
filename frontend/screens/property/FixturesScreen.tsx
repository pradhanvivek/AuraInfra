import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAuth } from '../../contexts/AuthContext';
import { fixtureApi } from '../../services/api';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Fixture {
  id: string;
  name: string;
  category: string;
  make?: string;
  model?: string;
  serial_number?: string;
  warranty_info?: string;
  warranty_expiry_date?: string;
  photo?: string;
  invoice?: string;
  vendor_name?: string;
  vendor_contact?: string;
  vendor_email?: string;
  maintenance_frequency?: string;
  last_maintenance_date?: string;
}

interface FixturesScreenProps {
  propertyId: string;
}

export default function FixturesScreen({ propertyId }: FixturesScreenProps) {
  const { token } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('lights');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [maintenanceFrequency, setMaintenanceFrequency] = useState('');
  const [photo, setPhoto] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  // Camera scan state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [scanningAppliance, setScanningAppliance] = useState(false);
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    fetchFixtures();
  }, []);

  const fetchFixtures = async () => {
    try {
      const data = await fixtureApi.getAll(token!, propertyId);
      setFixtures(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load fixtures');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('lights');
    setMake('');
    setModel('');
    setSerialNumber('');
    setWarrantyInfo('');
    setWarrantyExpiryDate('');
    setPhoto('');
    setInvoice('');
    setVendorName('');
    setVendorContact('');
    setVendorEmail('');
    setMaintenanceFrequency('');
    setIsEditMode(false);
    setEditingFixtureId(null);
  };

  const getWarrantyStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry >= today;
  };

  const getWarrantyBadge = (fixture: Fixture, showText: boolean = false) => {
    if (!fixture.warranty_info && !fixture.warranty_expiry_date) return null;
    
    const isActive = getWarrantyStatus(fixture.warranty_expiry_date);
    
    if (isActive === null) {
      return (
        <View style={[styles.warrantyBadge, !showText && styles.warrantyBadgeIconOnly]}>
          <Ionicons name="shield-checkmark" size={16} color="#8E8E93" />
          {showText && <Text style={[styles.warrantyBadgeText, { color: '#8E8E93' }]}>Warranty</Text>}
        </View>
      );
    }
    
    return (
      <View style={[
        styles.warrantyBadge, 
        isActive ? styles.warrantyBadgeActive : styles.warrantyBadgeExpired,
        !showText && styles.warrantyBadgeIconOnly
      ]}>
        <Ionicons name={isActive ? "shield-checkmark" : "alert-circle"} size={16} color={isActive ? "#34C759" : "#FF3B30"} />
        {showText && (
          <Text style={[styles.warrantyBadgeText, { color: isActive ? "#34C759" : "#FF3B30" }]}>
            {isActive ? "In Warranty" : "Warranty Expired"}
          </Text>
        )}
      </View>
    );
  };

  const renderWarrantyBadge = (expiryDate: string, showText: boolean = true) => {
    const isActive = new Date(expiryDate) > new Date();
    
    return (
      <View style={[
        styles.warrantyBadge, 
        isActive ? styles.warrantyBadgeActive : styles.warrantyBadgeExpired,
        !showText && styles.warrantyBadgeIconOnly
      ]}>
        <Ionicons name={isActive ? "shield-checkmark" : "alert-circle"} size={16} color={isActive ? "#34C759" : "#FF3B30"} />
        {showText && (
          <Text style={[styles.warrantyBadgeText, { color: isActive ? "#34C759" : "#FF3B30" }]}>
            {isActive ? "In Warranty" : "Warranty Expired"}
          </Text>
        )}
      </View>
    );
  };

  const handleAddFixture = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    setSaving(true);
    try {
      const fixtureData = {
        name,
        category,
        make: make || undefined,
        model: model || undefined,
        serial_number: serialNumber || undefined,
        warranty_info: warrantyInfo || undefined,
        warranty_expiry_date: warrantyExpiryDate || undefined,
        photo: photo || undefined,
        invoice: invoice || undefined,
        vendor_name: vendorName || undefined,
        vendor_contact: vendorContact || undefined,
        vendor_email: vendorEmail || undefined,
        maintenance_frequency: maintenanceFrequency || undefined,
      };

      if (isEditMode && editingFixtureId) {
        // Update existing fixture
        await fixtureApi.update(token!, propertyId, editingFixtureId, fixtureData);
        Alert.alert('Success', 'Fixture updated successfully');
      } else {
        // Create new fixture
        await fixtureApi.create(token!, propertyId, fixtureData);
        Alert.alert('Success', 'Fixture added successfully');
      }

      setModalVisible(false);
      resetForm();
      fetchFixtures();
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to ${isEditMode ? 'update' : 'add'} fixture`);
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const handlePickInvoice = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setInvoice(result.assets[0].base64);
    }
  };

  const handleScanReceipt = async () => {
    Alert.alert(
      'Scan Receipt',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please grant camera permissions');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.8,
              base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
              await analyzeReceipt(result.assets[0].base64);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please grant gallery permissions');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.8,
              base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
              await analyzeReceipt(result.assets[0].base64);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const analyzeReceipt = async (base64Image: string) => {
    setScanningReceipt(true);
    try {
      const response = await fetch('https://prophealth-app.preview.emergentagent.com/api/analyze-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze receipt');
      }

      const data = await response.json();
      
      // Auto-populate fields
      if (data.name) setName(data.name);
      if (data.make) setMake(data.make);
      if (data.model) setModel(data.model);
      if (data.serial_number) setSerialNumber(data.serial_number);
      if (data.vendor_name) setVendorName(data.vendor_name);
      if (data.vendor_contact) setVendorContact(data.vendor_contact);
      if (data.vendor_email) setVendorEmail(data.vendor_email);
      if (data.warranty_info) setWarrantyInfo(data.warranty_info);
      if (data.warranty_expiry_date) setWarrantyExpiryDate(data.warranty_expiry_date);
      
      // Also set the invoice photo
      setInvoice(base64Image);
      
      Alert.alert('Success', 'Receipt analyzed! Please review and edit the details if needed.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to analyze receipt. Please enter details manually.');
    } finally {
      setScanningReceipt(false);
    }
  };


  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirmDate = (date: Date) => {
    setWarrantyExpiryDate(date.toISOString().split('T')[0]);
    hideDatePicker();
  };

  const handleFixturePress = async (fixture: Fixture) => {
    setSelectedFixture(fixture);
    setDetailsModalVisible(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'lights':
        return 'bulb-outline';
      case 'fans':
        return 'sync-outline';
      case 'electrical appliances':
        return 'hardware-chip-outline';
      default:
        return 'cube-outline';
    }
  };

  const renderFixture = ({ item }: { item: Fixture }) => (
    <View style={styles.fixtureCard}>
      <TouchableOpacity 
        style={styles.fixtureCardContent}
        onPress={() => handleFixturePress(item)}
      >
        <View style={styles.fixtureIcon}>
          <Ionicons name={getCategoryIcon(item.category)} size={24} color="#007AFF" />
        </View>
        <View style={styles.fixtureInfo}>
          <View style={styles.fixtureNameRow}>
            <Text style={styles.fixtureName}>{item.name}</Text>
            {getWarrantyBadge(item, false)}
          </View>
          <Text style={styles.fixtureCategory}>{item.category}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteIconButton}
        onPress={() => handleDeleteFixture(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  const handleDeleteFixture = (fixture: Fixture) => {
    Alert.alert(
      'Delete Fixture',
      `Are you sure you want to delete "${fixture.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fixtureApi.delete(token!, propertyId, fixture.id);
              Alert.alert('Success', 'Fixture deleted successfully');
              fetchFixtures();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete fixture');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fixtures.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="hardware-chip-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No fixtures yet</Text>
          <Text style={styles.emptySubtext}>Add your first fixture</Text>
        </View>
      ) : (
        <FlatList
          data={fixtures}
          renderItem={renderFixture}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Fixture Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{isEditMode ? 'Edit Fixture' : 'Add Fixture'}</Text>
            <TouchableOpacity onPress={handleAddFixture} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Living Room Ceiling Fan"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryContainer}>
              {['lights', 'fans', 'electrical appliances'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Scan Receipt Button */}
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={handleScanReceipt}
              disabled={scanningReceipt}
            >
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.scanButtonText}>
                {scanningReceipt ? 'Analyzing Receipt...' : 'Scan Receipt to Auto-Fill'}
              </Text>
            </TouchableOpacity>
            
            {scanningReceipt && (
              <View style={styles.scanningIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.scanningText}>AI is analyzing your receipt...</Text>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>Make</Text>
            <TextInput
              style={styles.input}
              placeholder="Brand name"
              value={make}
              onChangeText={setMake}
            />

            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              placeholder="Model number"
              value={model}
              onChangeText={setModel}
            />

            <Text style={styles.label}>Serial Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Serial number"
              value={serialNumber}
              onChangeText={setSerialNumber}
            />

            <Text style={styles.label}>Warranty Information</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Warranty details"
              value={warrantyInfo}
              onChangeText={setWarrantyInfo}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Warranty Expiry Date (Optional)</Text>
            <TouchableOpacity style={styles.datePickerButton} onPress={showDatePicker}>
              <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              <Text style={[styles.datePickerText, !warrantyExpiryDate && styles.datePickerPlaceholder]}>
                {warrantyExpiryDate || 'Select date'}
              </Text>
            </TouchableOpacity>

            <DateTimePickerModal
              isVisible={isDatePickerVisible}
              mode="date"
              onConfirm={handleConfirmDate}
              onCancel={hideDatePicker}
              minimumDate={new Date()}
            />

            {/* Warranty Status Display */}
            {warrantyExpiryDate && (
              <View style={styles.warrantyStatusDisplay}>
                {renderWarrantyBadge(warrantyExpiryDate)}
              </View>
            )}

            {/* Vendor Information Section */}
            <View style={styles.sectionHeader}>
              <Ionicons name="build-outline" size={20} color="#007AFF" />
              <Text style={styles.sectionHeaderText}>Vendor & Maintenance</Text>
            </View>

            <Text style={styles.label}>Vendor Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., ABC Services"
              value={vendorName}
              onChangeText={setVendorName}
            />

            <Text style={styles.label}>Vendor Contact (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., +1 234 567 8900"
              value={vendorContact}
              onChangeText={setVendorContact}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Vendor Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., contact@vendor.com"
              value={vendorEmail}
              onChangeText={setVendorEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Maintenance Frequency (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Quarterly, Annually"
              value={maintenanceFrequency}
              onChangeText={setMaintenanceFrequency}
            />

            <Text style={styles.label}>Photo (Optional)</Text>
            <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
              {photo ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photo}` }}
                  style={styles.photoPreview}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color="#8E8E93" />
                  <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Invoice (Optional)</Text>
            <TouchableOpacity style={styles.photoButton} onPress={handlePickInvoice}>
              {invoice ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${invoice}` }}
                  style={styles.photoPreview}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="document-text-outline" size={32} color="#8E8E93" />
                  <Text style={styles.photoPlaceholderText}>Add Invoice</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Details Modal */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setDetailsModalVisible(false);
          setEditingDetails(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setDetailsModalVisible(false);
              setEditingDetails(false);
            }}>
              <Text style={styles.cancelButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Fixture Details</Text>
            <TouchableOpacity onPress={() => {
              setDetailsModalVisible(false);
              setEditingDetails(false);
              // Open in edit mode - populate form with current data
              if (selectedFixture) {
                setIsEditMode(true);
                setEditingFixtureId(selectedFixture.id);
                setName(selectedFixture.name);
                setCategory(selectedFixture.category);
                setMake(selectedFixture.make || '');
                setModel(selectedFixture.model || '');
                setSerialNumber(selectedFixture.serial_number || '');
                setWarrantyInfo(selectedFixture.warranty_info || '');
                setWarrantyExpiryDate(selectedFixture.warranty_expiry_date || '');
                setPhoto(selectedFixture.photo || '');
                setInvoice(selectedFixture.invoice || '');
                setVendorName(selectedFixture.vendor_name || '');
                setVendorContact(selectedFixture.vendor_contact || '');
                setVendorEmail(selectedFixture.vendor_email || '');
                setMaintenanceFrequency(selectedFixture.maintenance_frequency || '');
                setModalVisible(true);
              }
            }}>
              <Ionicons name="create-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedFixture?.photo && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${selectedFixture.photo}` }}
                style={styles.detailsPhoto}
              />
            )}

            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Name</Text>
              <Text style={styles.detailsValue}>{selectedFixture?.name}</Text>
            </View>

            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Category</Text>
              <Text style={styles.detailsValue}>{selectedFixture?.category}</Text>
            </View>

            {selectedFixture?.make && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Make</Text>
                <Text style={styles.detailsValue}>{selectedFixture.make}</Text>
              </View>
            )}

            {selectedFixture?.model && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Model</Text>
                <Text style={styles.detailsValue}>{selectedFixture.model}</Text>
              </View>
            )}

            {selectedFixture?.serial_number && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Serial Number</Text>
                <Text style={styles.detailsValue}>{selectedFixture.serial_number}</Text>
              </View>
            )}

            {selectedFixture?.warranty_info && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Warranty Information</Text>
                <Text style={styles.detailsValue}>{selectedFixture.warranty_info}</Text>
              </View>
            )}

            {selectedFixture?.warranty_expiry_date && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Warranty Expiry Date</Text>
                <View style={styles.detailsValueRow}>
                  <Text style={styles.detailsValue}>
                    {new Date(selectedFixture.warranty_expiry_date).toLocaleDateString()}
                  </Text>
                  {getWarrantyBadge(selectedFixture, true)}
                </View>
              </View>
            )}

            {selectedFixture?.invoice && (
              <>
                <Text style={styles.detailsLabel}>Invoice</Text>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${selectedFixture.invoice}` }}
                  style={styles.detailsPhoto}
                />
              </>
            )}
          </ScrollView>
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
  },
  listContent: {
    padding: 16,
  },
  fixtureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  fixtureCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteIconButton: {
    padding: 16,
    paddingLeft: 8,
  },
  fixtureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fixtureInfo: {
    flex: 1,
  },
  fixtureNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fixtureName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 8,
  },
  warrantyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  warrantyBadgeIconOnly: {
    width: 28,
    height: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  warrantyBadgeActive: {
    backgroundColor: '#E8F5E9',
  },
  warrantyBadgeExpired: {
    backgroundColor: '#FFEBEE',
  },
  warrantyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warrantyStatusDisplay: {
    marginTop: 8,
    marginBottom: 16,
  },
  fixtureCategory: {
    fontSize: 14,
    color: '#8E8E93',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 12,
  },
  datePickerText: {
    fontSize: 16,
    color: '#000',
  },
  datePickerPlaceholder: {
    color: '#8E8E93',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  photoButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  photoPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  detailsPhoto: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  detailsRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  detailsValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  detailsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  scanningText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  warrantyStatusDisplay: {
    marginTop: 12,
    alignItems: 'center',
  },
});
