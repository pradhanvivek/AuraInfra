import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

// Conditionally import react-datepicker only on web
let ReactDatePicker: any = null;
if (Platform.OS === 'web') {
  ReactDatePicker = require('react-datepicker').default;
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const ASSET_TYPES = [
  { label: 'Property', value: 'property' },
  { label: 'Vehicle', value: 'vehicle' },
  { label: 'Appliance', value: 'appliance' },
  { label: 'Furniture', value: 'furniture' },
  { label: 'Art', value: 'art' },
  { label: 'Jewelry', value: 'jewelry' },
];

const MAINTENANCE_TYPES = [
  'Service',
  'Inspection',
  'Repair',
  'Cleaning',
  'Warranty Check',
  'Safety Check',
  'Other',
];

const RECURRING_INTERVALS = [
  { label: 'Weekly', days: 7 },
  { label: 'Monthly', days: 30 },
  { label: 'Quarterly', days: 90 },
  { label: 'Semi-Annually', days: 180 },
  { label: 'Annually', days: 365 },
];

interface Asset {
  id: string;
  name: string;
  [key: string]: any;
}

export default function AddMaintenanceScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [assetType, setAssetType] = useState('property');
  const [assetId, setAssetId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('Service');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringIntervalDays, setRecurringIntervalDays] = useState<number | null>(null);

  // UI State
  const [assetTypeModalVisible, setAssetTypeModalVisible] = useState(false);
  const [maintenanceTypeModalVisible, setMaintenanceTypeModalVisible] = useState(false);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [recurringModalVisible, setRecurringModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  useEffect(() => {
    if (assetType) {
      fetchAssets();
    }
  }, [assetType]);

  // Inject custom CSS for react-datepicker on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const baseCssId = 'react-datepicker-base-css-maintenance';
      if (!document.getElementById(baseCssId)) {
        const link = document.createElement('link');
        link.id = baseCssId;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/react-datepicker@6.9.0/dist/react-datepicker.min.css';
        document.head.appendChild(link);
      }
      
      const styleId = 'custom-datepicker-styles-maintenance';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .maintenance-datepicker-input {
            width: 100%;
            padding: 14px;
            font-size: 16px;
            border: 1px solid #E5E5EA;
            border-radius: 12px;
            background-color: #fff;
            color: #000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: pointer;
          }
          
          .react-datepicker-popper {
            z-index: 99999 !important;
            position: absolute !important;
          }
          
          .react-datepicker {
            font-size: 1rem;
            border-radius: 12px;
            border: 1px solid #E5E5EA;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
            background-color: #fff;
            z-index: 99999;
          }
          
          .react-datepicker__triangle {
            display: none;
          }
          
          .react-datepicker__header {
            background-color: #007AFF;
            border-bottom: none;
            border-radius: 12px 12px 0 0;
            padding-top: 12px;
          }
          
          .react-datepicker__current-month,
          .react-datepicker__day-name {
            color: #fff;
          }
          
          .react-datepicker__day--selected,
          .react-datepicker__day--keyboard-selected {
            background-color: #007AFF;
            color: #fff;
          }
          
          .react-datepicker__day:hover {
            background-color: #E5E5EA;
          }
          
          .react-datepicker__month-dropdown,
          .react-datepicker__year-dropdown {
            background-color: #fff;
            border: 1px solid #E5E5EA;
            border-radius: 8px;
            max-height: 200px;
            overflow-y: auto;
          }
          
          .react-datepicker__month-option:hover,
          .react-datepicker__year-option:hover {
            background-color: #E5E5EA;
          }
          
          .react-datepicker__month-option--selected,
          .react-datepicker__year-option--selected {
            background-color: #007AFF;
            color: #fff;
          }
          
          .react-datepicker__navigation {
            top: 12px;
          }
          
          .react-datepicker__navigation--previous {
            border-right-color: #fff;
          }
          
          .react-datepicker__navigation--next {
            border-left-color: #fff;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const endpoint = assetType === 'property' 
        ? '/api/users/properties' 
        : `/api/${assetType}s`;
      
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const assets = response.data.map((asset: any) => ({
        id: asset.id,
        name: asset.name || asset.address || asset.make || asset.title || 'Unnamed',
      }));

      setAvailableAssets(assets);
    } catch (error: any) {
      console.error('Failed to fetch assets:', error);
      Alert.alert('Error', 'Failed to load assets');
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!assetId || !assetName) {
      Alert.alert('Error', 'Please select an asset');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!dueDate) {
      Alert.alert('Error', 'Please select a due date');
      return;
    }

    setSaving(true);
    try {
      const maintenanceData = {
        asset_type: assetType,
        asset_id: assetId,
        asset_name: assetName,
        maintenance_type: maintenanceType,
        description: description.trim(),
        due_date: new Date(dueDate).toISOString(),
        cost: cost ? parseFloat(cost) : undefined,
        notes: notes.trim() || undefined,
        recurring,
        recurring_interval_days: recurring ? recurringIntervalDays : undefined,
      };

      await axios.post(`${API_URL}/api/maintenance`, maintenanceData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Success', 'Maintenance record created successfully');
      router.back();
    } catch (error: any) {
      console.error('Failed to create maintenance:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create maintenance record');
    } finally {
      setSaving(false);
    }
  };

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleDateConfirm = (date: Date) => {
    setDueDate(date.toISOString().split('T')[0]);
    hideDatePicker();
  };

  const selectAsset = (asset: Asset) => {
    setAssetId(asset.id);
    setAssetName(asset.name);
    setAssetModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Maintenance</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Asset Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Asset Type</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setAssetTypeModalVisible(true)}
          >
            <Text style={styles.pickerText}>
              {ASSET_TYPES.find(t => t.value === assetType)?.label}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Select Asset */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Asset</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setAssetModalVisible(true)}
            disabled={loadingAssets}
          >
            <Text style={assetName ? styles.pickerText : styles.pickerPlaceholder}>
              {loadingAssets ? 'Loading...' : assetName || 'Choose an asset'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Maintenance Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Maintenance Type</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setMaintenanceTypeModalVisible(true)}
          >
            <Text style={styles.pickerText}>{maintenanceType}</Text>
            <Ionicons name="chevron-down" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the maintenance work"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Due Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Due Date *</Text>
          {Platform.OS === 'web' && ReactDatePicker ? (
            <View style={styles.datePickerContainer}>
              <ReactDatePicker
                selected={dueDate ? new Date(dueDate) : null}
                onChange={(date: Date | null) => {
                  if (date) setDueDate(date.toISOString().split('T')[0]);
                }}
                minDate={new Date()}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select due date"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                yearDropdownItemNumber={10}
                scrollableYearDropdown
                popperPlacement="top-start"
                popperProps={{
                  strategy: 'absolute',
                  modifiers: [
                    { name: 'preventOverflow', options: { mainAxis: false, altAxis: false }},
                    { name: 'flip', enabled: false },
                  ],
                }}
                customInput={
                  <View style={styles.customDateInput}>
                    <Text style={dueDate ? styles.dateText : styles.datePlaceholder}>
                      {dueDate || 'Select due date'}
                    </Text>
                    <Ionicons name="calendar" size={20} color="#8E8E93" />
                  </View>
                }
              />
            </View>
          ) : (
            <TouchableOpacity style={styles.dateInput} onPress={showDatePicker}>
              <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
              <Text style={dueDate ? styles.dateText : styles.datePlaceholder}>
                {dueDate || 'Select date'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cost */}
        <View style={styles.section}>
          <Text style={styles.label}>Estimated Cost (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="$0.00"
            value={cost}
            onChangeText={setCost}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Recurring */}
        <View style={styles.section}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setRecurring(!recurring)}
            >
              {recurring && <Ionicons name="checkmark" size={18} color="#007AFF" />}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Recurring Maintenance</Text>
          </View>
        </View>

        {recurring && (
          <View style={styles.section}>
            <Text style={styles.label}>Frequency</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setRecurringModalVisible(true)}
            >
              <Text style={recurringIntervalDays ? styles.pickerText : styles.pickerPlaceholder}>
                {recurringIntervalDays 
                  ? RECURRING_INTERVALS.find(i => i.days === recurringIntervalDays)?.label 
                  : 'Select frequency'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Additional notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Create Maintenance Record</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Asset Type Modal */}
      <Modal visible={assetTypeModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Asset Type</Text>
              <TouchableOpacity onPress={() => setAssetTypeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {ASSET_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={styles.modalOption}
                  onPress={() => {
                    setAssetType(type.value);
                    setAssetId('');
                    setAssetName('');
                    setAssetTypeModalVisible(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{type.label}</Text>
                  {assetType === type.value && (
                    <Ionicons name="checkmark" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Asset Selection Modal */}
      <Modal visible={assetModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Asset</Text>
              <TouchableOpacity onPress={() => setAssetModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {availableAssets.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No {assetType}s found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Add a {assetType} first to create maintenance records
                  </Text>
                </View>
              ) : (
                availableAssets.map((asset) => (
                  <TouchableOpacity
                    key={asset.id}
                    style={styles.modalOption}
                    onPress={() => selectAsset(asset)}
                  >
                    <Text style={styles.modalOptionText}>{asset.name}</Text>
                    {assetId === asset.id && (
                      <Ionicons name="checkmark" size={24} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Maintenance Type Modal */}
      <Modal visible={maintenanceTypeModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Maintenance Type</Text>
              <TouchableOpacity onPress={() => setMaintenanceTypeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {MAINTENANCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.modalOption}
                  onPress={() => {
                    setMaintenanceType(type);
                    setMaintenanceTypeModalVisible(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{type}</Text>
                  {maintenanceType === type && (
                    <Ionicons name="checkmark" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Recurring Interval Modal */}
      <Modal visible={recurringModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Frequency</Text>
              <TouchableOpacity onPress={() => setRecurringModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {RECURRING_INTERVALS.map((interval) => (
                <TouchableOpacity
                  key={interval.days}
                  style={styles.modalOption}
                  onPress={() => {
                    setRecurringIntervalDays(interval.days);
                    setRecurringModalVisible(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{interval.label}</Text>
                  {recurringIntervalDays === interval.days && (
                    <Ionicons name="checkmark" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal (for native) */}
      <DateTimePickerModal
        isVisible={datePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={hideDatePicker}
        minimumDate={new Date()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pickerText: {
    fontSize: 16,
    color: '#000',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#8E8E93',
  },
  datePickerContainer: {
    marginBottom: 0,
  },
  customDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    cursor: 'pointer',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  dateText: {
    fontSize: 16,
    color: '#000',
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#8E8E93',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#000',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
