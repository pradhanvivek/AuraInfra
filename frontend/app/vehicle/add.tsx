import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  useColorScheme,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getCurrencyInfo } from '../../utils/localeUtils';

// Conditionally import react-datepicker only on web
let ReactDatePicker: any = null;
if (Platform.OS === 'web') {
  ReactDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddVehicleScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  
  // Dynamic placeholder color based on theme
  const placeholderColor = colorScheme === 'dark' ? '#999999' : '#666666';
  const scanMode = params.mode === 'scan';

  // Form state
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [registration, setRegistration] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [lastMaintenance, setLastMaintenance] = useState('');
  const [nextMaintenance, setNextMaintenance] = useState('');
  const [maintenanceFrequency, setMaintenanceFrequency] = useState('');

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(scanMode);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'insurance' | 'lastMaint' | 'nextMaint'>('purchase');

  // Inject custom CSS for react-datepicker on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'custom-datepicker-styles-vehicle';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .vehicle-datepicker-input {
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
          
          .vehicle-datepicker-wrapper {
            width: 100%;
            display: block;
            position: relative;
          }
          
          .vehicle-datepicker-wrapper .react-datepicker-wrapper {
            width: 100%;
            display: block;
          }
          
          .vehicle-datepicker-wrapper .react-datepicker__input-container {
            width: 100%;
            display: block;
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
          
          @media (max-width: 768px) {
            .react-datepicker {
              font-size: 0.9rem;
            }
            
            .react-datepicker__day {
              width: 2.2rem;
              line-height: 2.2rem;
            }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  const processVehicleScan = async (base64Data: string) => {
    setScanning(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/vehicles/scan`,
        { image: base64Data },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.make) setMake(data.make);
      if (data.model) setModel(data.model);
      if (data.year) setYear(data.year.toString());
      if (!name && data.make && data.model) {
        setName(`${data.make} ${data.model}`);
      }
      setPhotos([`data:image/jpeg;base64,${base64Data}`]);
      
      if (Platform.OS === 'web') {
        alert(`Vehicle Detected!\n${data.make || ''} ${data.model || ''} ${data.year || ''} identified. Please review and complete the details.`);
      } else {
        Alert.alert(
          'Vehicle Detected!',
          `${data.make || ''} ${data.model || ''} ${data.year || ''} identified. Please review and complete the details.`
        );
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      if (Platform.OS === 'web') {
        alert('Failed to scan vehicle. Please enter details manually.');
      } else {
        Alert.alert('Error', 'Failed to scan vehicle. Please enter details manually.');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleScan = async () => {
    // Check if we're on web
    if (Platform.OS === 'web') {
      // On web, use image picker instead of camera
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await processVehicleScan(result.assets[0].base64);
      }
    } else {
      // Native app: use camera
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission needed');
          return;
        }
      }
      setCameraVisible(true);
    }
  };

  const handleTakePicture = async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.7 });
      setCameraVisible(false);
      setScanning(true);

      const response = await axios.post(
        `${API_URL}/api/vehicles/scan`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.make) setMake(data.make);
      if (data.model) setModel(data.model);
      if (data.year) setYear(data.year.toString());
      if (!name && data.make && data.model) {
        setName(`${data.make} ${data.model}`);
      }
      setPhotos([photo.base64!]);
      
      Alert.alert(
        'Vehicle Detected!',
        `${data.make || ''} ${data.model || ''} identified. Please review and complete the details.`
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to scan vehicle');
    } finally {
      setScanning(false);
    }
  };

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant photo library permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, result.assets[0].base64]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a vehicle name');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/vehicles`,
        {
          name: name.trim(),
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          year: year ? parseInt(year) : undefined,
          vin: vin.trim() || undefined,
          registration_number: registration.trim() || undefined,
          insurance_provider: insuranceProvider.trim() || undefined,
          insurance_policy: insurancePolicy.trim() || undefined,
          insurance_expiry: insuranceExpiry || undefined,
          purchase_date: purchaseDate || undefined,
          purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
          current_value: currentValue ? parseFloat(currentValue) : undefined,
          photos,
          notes: notes.trim() || undefined,
          last_maintenance_date: lastMaintenance || undefined,
          next_maintenance_date: nextMaintenance || undefined,
          maintenance_frequency_months: maintenanceFrequency ? parseInt(maintenanceFrequency) : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Vehicle added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const showDatePicker = (mode: 'purchase' | 'insurance' | 'lastMaint' | 'nextMaint') => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (datePickerMode === 'purchase') setPurchaseDate(dateStr);
    else if (datePickerMode === 'insurance') setInsuranceExpiry(dateStr);
    else if (datePickerMode === 'lastMaint') setLastMaintenance(dateStr);
    else if (datePickerMode === 'nextMaint') setNextMaintenance(dateStr);
    setDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Vehicle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!scanMode && (
          <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.scanButtonText}>
              {Platform.OS === 'web' ? 'Upload & Scan Vehicle with AI' : 'Scan Vehicle with AI'}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., My BMW"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Make</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., BMW"
              placeholderTextColor={placeholderColor}
              value={make}
              onChangeText={setMake}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 3 Series"
              placeholderTextColor={placeholderColor}
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Year</Text>
            <TextInput
              style={styles.input}
              placeholder="2020"
              placeholderTextColor={placeholderColor}
              value={year}
              onChangeText={setYear}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>VIN</Text>
            <TextInput
              style={styles.input}
              placeholder="17 characters"
              placeholderTextColor={placeholderColor}
              value={vin}
              onChangeText={setVin}
            />
          </View>
        </View>

        <Text style={styles.label}>Registration Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., ABC-1234"
          placeholderTextColor={placeholderColor}
          value={registration}
          onChangeText={setRegistration}
        />

        <Text style={styles.sectionTitle}>Insurance</Text>
        
        <Text style={styles.label}>Insurance Provider</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Geico"
          placeholderTextColor={placeholderColor}
          value={insuranceProvider}
          onChangeText={setInsuranceProvider}
        />

        <Text style={styles.label}>Policy Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Policy #"
          placeholderTextColor={placeholderColor}
          value={insurancePolicy}
          onChangeText={setInsurancePolicy}
        />

        <Text style={styles.label}>Insurance Expiry</Text>
        {Platform.OS === 'web' && ReactDatePicker ? (
          <View style={styles.datePickerContainer}>
            <ReactDatePicker
              selected={insuranceExpiry ? new Date(insuranceExpiry) : null}
              onChange={(date: Date | null) => {
                if (date) {
                  setInsuranceExpiry(date.toISOString().split('T')[0]);
                }
              }}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select insurance expiry date"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={10}
              scrollableYearDropdown
              customInput={
                <View style={styles.customDateInput}>
                  <Text style={insuranceExpiry ? styles.dateText : styles.datePlaceholder}>
                    {insuranceExpiry || 'Select insurance expiry date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#8E8E93" />
                </View>
              }
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.dateInput}
            onPress={() => showDatePicker('insurance')}
          >
            <Text style={insuranceExpiry ? styles.dateText : styles.datePlaceholder}>
              {insuranceExpiry || 'Select date'}
            </Text>
            <Ionicons name="calendar" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Financial</Text>
        
        <Text style={styles.label}>Purchase Date</Text>
        {Platform.OS === 'web' && ReactDatePicker ? (
          <View style={styles.datePickerContainer}>
            <ReactDatePicker
              selected={purchaseDate ? new Date(purchaseDate) : null}
              onChange={(date: Date | null) => {
                if (date) {
                  setPurchaseDate(date.toISOString().split('T')[0]);
                }
              }}
              maxDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select purchase date"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={10}
              scrollableYearDropdown
              popperPlacement="top-start"
              popperProps={{
                strategy: 'fixed'
              }}
              customInput={
                <View style={styles.customDateInput}>
                  <Text style={purchaseDate ? styles.dateText : styles.datePlaceholder}>
                    {purchaseDate || 'Select purchase date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#8E8E93" />
                </View>
              }
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.dateInput}
            onPress={() => showDatePicker('purchase')}
          >
            <Text style={purchaseDate ? styles.dateText : styles.datePlaceholder}>
              {purchaseDate || 'Select date'}
            </Text>
            <Ionicons name="calendar" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Purchase Cost</Text>
            <TextInput
              style={styles.input}
              placeholder={`${getCurrencyInfo().symbol}0`}
              placeholderTextColor={placeholderColor}
              value={purchaseCost}
              onChangeText={setPurchaseCost}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Current Value</Text>
            <TextInput
              style={styles.input}
              placeholder={`${getCurrencyInfo().symbol}0`}
              placeholderTextColor={placeholderColor}
              value={currentValue}
              onChangeText={setCurrentValue}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Maintenance</Text>
        
        <Text style={styles.label}>Last Maintenance</Text>
        {Platform.OS === 'web' && ReactDatePicker ? (
          <View style={styles.datePickerContainer}>
            <ReactDatePicker
              selected={lastMaintenance ? new Date(lastMaintenance) : null}
              onChange={(date: Date | null) => {
                if (date) {
                  setLastMaintenance(date.toISOString().split('T')[0]);
                }
              }}
              maxDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select last maintenance date"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={10}
              scrollableYearDropdown
              customInput={
                <View style={styles.customDateInput}>
                  <Text style={lastMaintenance ? styles.dateText : styles.datePlaceholder}>
                    {lastMaintenance || 'Select last maintenance date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#8E8E93" />
                </View>
              }
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.dateInput}
            onPress={() => showDatePicker('lastMaint')}
          >
            <Text style={lastMaintenance ? styles.dateText : styles.datePlaceholder}>
              {lastMaintenance || 'Select date'}
            </Text>
            <Ionicons name="calendar" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Next Maintenance</Text>
        {Platform.OS === 'web' && ReactDatePicker ? (
          <View style={styles.datePickerContainer}>
            <ReactDatePicker
              selected={nextMaintenance ? new Date(nextMaintenance) : null}
              onChange={(date: Date | null) => {
                if (date) {
                  setNextMaintenance(date.toISOString().split('T')[0]);
                }
              }}
              minDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select next maintenance date"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              yearDropdownItemNumber={10}
              scrollableYearDropdown
              customInput={
                <View style={styles.customDateInput}>
                  <Text style={nextMaintenance ? styles.dateText : styles.datePlaceholder}>
                    {nextMaintenance || 'Select next maintenance date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#8E8E93" />
                </View>
              }
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.dateInput}
            onPress={() => showDatePicker('nextMaint')}
          >
            <Text style={nextMaintenance ? styles.dateText : styles.datePlaceholder}>
              {nextMaintenance || 'Select date'}
            </Text>
            <Ionicons name="calendar" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Maintenance Frequency (months)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 6"
          placeholderTextColor={placeholderColor}
          value={maintenanceFrequency}
          onChangeText={setMaintenanceFrequency}
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView horizontal style={styles.photoScroll}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${photo}` }}
                style={styles.photo}
              />
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
              >
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhoto}>
            <Ionicons name="add" size={32} color="#007AFF" />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Additional notes..."
          placeholderTextColor={placeholderColor}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </ScrollView>

      <Modal visible={cameraVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={(ref) => setCameraRef(ref)}
            facing="back"
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.closeCamera}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <View style={styles.cameraInstructions}>
                <Text style={styles.instructionText}>Point at vehicle</Text>
              </View>
              <TouchableOpacity style={styles.captureButton} onPress={handleTakePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={datePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
      />

      {scanning && (
        <View style={styles.scanningOverlay}>
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Identifying vehicle...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    padding: 16,
  },
  webDatePickerWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  datePickerContainer: {
    marginBottom: 16,
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
  scanButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
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
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    color: '#000',
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#999999',  // Lighter for better visibility
  },
  photoScroll: {
    marginBottom: 16,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 24,
  },
  closeCamera: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    padding: 8,
  },
  cameraInstructions: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 16,
    alignSelf: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FF9500',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF9500',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
});