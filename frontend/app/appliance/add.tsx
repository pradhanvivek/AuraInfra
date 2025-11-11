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

const categories = [
  'TV', 'Laptop', 'Refrigerator', 'Washing Machine', 'Microwave',
  'Air Conditioner', 'Fan', 'Heater', 'Dishwasher', 'Oven',
  'Coffee Maker', 'Vacuum Cleaner', 'Other'
];

export default function AddApplianceScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  
  // Dynamic placeholder color based on theme
  const placeholderColor = colorScheme === 'dark' ? '#999999' : '#666666';
  const scanMode = params.mode === 'scan';
  const prescanMode = params.mode === 'prescan';
  const prescanImage = params.image ? decodeURIComponent(params.image as string) : null;
  const prescanDescription = params.description ? decodeURIComponent(params.description as string) : null;
  const editId = params.id as string | undefined;
  const isEditing = !!editId;

  const [loading, setLoading] = useState(isEditing);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TV');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [lastMaintenance, setLastMaintenance] = useState('');
  const [nextMaintenance, setNextMaintenance] = useState('');
  const [maintenanceFrequency, setMaintenanceFrequency] = useState('');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(scanMode && !prescanMode);
  const [receiptCameraVisible, setReceiptCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [receiptCameraRef, setReceiptCameraRef] = useState<any>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'warranty' | 'lastMaint' | 'nextMaint'>('purchase');

  // Handle prescan mode - automatically scan the provided image
  useEffect(() => {
    if (prescanMode && prescanImage) {
      // Use the pre-scanned image directly
      handlePrescanImage(prescanImage);
    }
  }, [prescanMode, prescanImage]);

  useEffect(() => {
    if (isEditing) {
      fetchAppliance();
    }
  }, [editId]);

  // Inject custom CSS for react-datepicker on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const baseCssId = 'react-datepicker-base-css-appliance';
      if (!document.getElementById(baseCssId)) {
        const link = document.createElement('link');
        link.id = baseCssId;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/react-datepicker@6.9.0/dist/react-datepicker.min.css';
        document.head.appendChild(link);
      }
      
      const styleId = 'custom-datepicker-styles-appliance';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .appliance-datepicker-input {
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

  const fetchAppliance = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/appliances/${editId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data;
      setName(data.name || '');
      setCategory(data.category || 'TV');
      setBrand(data.brand || '');
      setModel(data.model || '');
      setSerialNumber(data.serial_number || '');
      setPurchaseDate(data.purchase_date || '');
      setPurchaseCost(data.purchase_cost ? data.purchase_cost.toString() : '');
      setCurrentValue(data.current_value ? data.current_value.toString() : '');
      setWarrantyInfo(data.warranty_info || '');
      setWarrantyExpiry(data.warranty_expiry || '');
      setPhotos(data.photos || []);
      setInvoice(data.invoice || '');
      setNotes(data.notes || '');
      setLastMaintenance(data.last_maintenance || '');
      setNextMaintenance(data.next_maintenance || '');
      setMaintenanceFrequency(data.maintenance_frequency ? data.maintenance_frequency.toString() : '');
    } catch (error: any) {
      console.error('Failed to fetch appliance:', error);
      Alert.alert('Error', 'Failed to load appliance details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handlePrescanImage = async (imageData: string) => {
    // Process the pre-scanned image without opening camera
    try {
      // Remove data:image/jpeg;base64, prefix if present
      const base64Data = imageData.includes('base64,') 
        ? imageData.split('base64,')[1] 
        : imageData;
      
      await processApplianceScan(base64Data);
    } catch (error) {
      console.error('Failed to process prescan image:', error);
    }
  };

  const handleScan = async () => {
    if (Platform.OS === 'web') {
      // Use ImagePicker for web (works with React Native Web)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await processApplianceScan(result.assets[0].base64);
      }
    } else {
      // Use camera for native
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

  const processApplianceScan = async (base64Data: string) => {
    setScanning(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/fixtures/scan-appliance`,
        { image: base64Data },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.name) setName(data.name);
      if (data.category) setCategory(data.category);
      if (data.make) setBrand(data.make);
      if (data.model) setModel(data.model);
      if (data.serial_number) setSerialNumber(data.serial_number);
      setPhotos([`data:image/jpeg;base64,${base64Data}`]);
      
      if (Platform.OS === 'web') {
        alert(`Appliance Detected!\n${data.name || 'Appliance'} identified. Please review and complete the details.`);
      } else {
        Alert.alert(
          'Appliance Detected!',
          `${data.name || 'Appliance'} identified. Please review and complete the details.`
        );
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert('Failed to scan appliance');
      } else {
        Alert.alert('Error', 'Failed to scan appliance');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleTakePicture = async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.7 });
      setCameraVisible(false);
      setScanning(true);

      const response = await axios.post(
        `${API_URL}/api/fixtures/scan-appliance`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.name) setName(data.name);
      if (data.category) setCategory(data.category);
      if (data.make) setBrand(data.make);
      if (data.model) setModel(data.model);
      if (data.serial_number) setSerialNumber(data.serial_number);
      setPhotos([photo.base64!]);
      
      Alert.alert(
        'Appliance Detected!',
        `${data.name || 'Appliance'} identified. Please review and complete the details.`
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to scan appliance');
    } finally {
      setScanning(false);
    }
  };

  const handleScanReceipt = async () => {
    if (Platform.OS === 'web') {
      // Use ImagePicker for web (works with React Native Web)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await processReceiptScan(result.assets[0].base64);
      }
    } else {
      // Use camera for native
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission needed');
          return;
        }
      }
      setReceiptCameraVisible(true);
    }
  };

  const processReceiptScan = async (base64Data: string) => {
    setScanningReceipt(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/scan-receipt`,
        { image: base64Data },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      // Auto-populate form fields from receipt data
      if (data.item_name && !name) setName(data.item_name);
      if (data.brand) setBrand(data.brand);
      if (data.model) setModel(data.model);
      if (data.serial_number) setSerialNumber(data.serial_number);
      if (data.purchase_date) setPurchaseDate(data.purchase_date);
      if (data.purchase_cost) setPurchaseCost(data.purchase_cost.toString());
      if (data.warranty_info) setWarrantyInfo(data.warranty_info);
      if (data.warranty_months && data.purchase_date) {
        // Calculate warranty expiry from purchase date + warranty months
        const purchaseD = new Date(data.purchase_date);
        purchaseD.setMonth(purchaseD.getMonth() + data.warranty_months);
        setWarrantyExpiry(purchaseD.toISOString().split('T')[0]);
      }
      setInvoice(`data:image/jpeg;base64,${base64Data}`);
      
      if (Platform.OS === 'web') {
        alert(`Receipt Scanned!\nForm fields have been auto-populated. Please review and complete.`);
      } else {
        Alert.alert('Receipt Scanned!', 'Form fields have been auto-populated. Please review and complete.');
      }
    } catch (error: any) {
      console.error('Receipt scan error:', error);
      if (Platform.OS === 'web') {
        alert('Failed to scan receipt');
      } else {
        Alert.alert('Error', 'Failed to scan receipt');
      }
    } finally {
      setScanningReceipt(false);
    }
  };

  const handleTakeReceiptPicture = async () => {
    if (!receiptCameraRef) return;

    try {
      const photo = await receiptCameraRef.takePictureAsync({ base64: true, quality: 0.7 });
      setReceiptCameraVisible(false);
      setScanningReceipt(true);

      const response = await axios.post(
        `${API_URL}/api/scan-receipt`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      // Auto-populate form fields from receipt data
      if (data.item_name && !name) setName(data.item_name);
      if (data.brand) setBrand(data.brand);
      if (data.model) setModel(data.model);
      if (data.serial_number) setSerialNumber(data.serial_number);
      if (data.purchase_date) setPurchaseDate(data.purchase_date);
      if (data.purchase_cost) setPurchaseCost(data.purchase_cost.toString());
      if (data.warranty_info) setWarrantyInfo(data.warranty_info);
      if (data.warranty_months && data.purchase_date) {
        // Calculate warranty expiry from purchase date + warranty months
        const purchaseD = new Date(data.purchase_date);
        purchaseD.setMonth(purchaseD.getMonth() + data.warranty_months);
        setWarrantyExpiry(purchaseD.toISOString().split('T')[0]);
      }
      
      // Store the receipt photo as invoice
      setInvoice(photo.base64!);
      
      Alert.alert(
        'Receipt Scanned!',
        `Purchase details extracted. Confidence: ${Math.round(data.confidence * 100)}%\n\nPlease review and complete the details.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to scan receipt. Please enter details manually.');
    } finally {
      setScanningReceipt(false);
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
      Alert.alert('Error', 'Please enter an appliance name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        current_value: currentValue ? parseFloat(currentValue) : undefined,
        warranty_info: warrantyInfo.trim() || undefined,
        warranty_expiry_date: warrantyExpiry || undefined,
        photos,
        invoice: invoice || undefined,
        notes: notes.trim() || undefined,
        last_maintenance_date: lastMaintenance || undefined,
        next_maintenance_date: nextMaintenance || undefined,
        maintenance_frequency_months: maintenanceFrequency ? parseInt(maintenanceFrequency) : undefined,
      };

      if (isEditing) {
        await axios.put(
          `${API_URL}/api/appliances/${editId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Appliance updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await axios.post(
          `${API_URL}/api/appliances`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Appliance added successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'save'} appliance`);
    } finally {
      setSaving(false);
    }
  };

  const showDatePicker = (mode: 'purchase' | 'warranty' | 'lastMaint' | 'nextMaint') => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (datePickerMode === 'purchase') setPurchaseDate(dateStr);
    else if (datePickerMode === 'warranty') setWarrantyExpiry(dateStr);
    else if (datePickerMode === 'lastMaint') setLastMaintenance(dateStr);
    else if (datePickerMode === 'nextMaint') setNextMaintenance(dateStr);
    setDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Appliance' : 'Add Appliance'}</Text>
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
          <>
            <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.scanButtonText}>Scan Appliance with AI</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.receiptButton} onPress={handleScanReceipt}>
              <Ionicons name="receipt" size={24} color="#007AFF" />
              <Text style={styles.receiptButtonText}>Scan Receipt/Invoice</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.sectionTitle}>Basic Information</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Living Room TV"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Category</Text>
        <TouchableOpacity 
          style={styles.categoryInput}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Text style={styles.categoryText}>{category}</Text>
          <Ionicons name="chevron-down" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Samsung"
              placeholderTextColor={placeholderColor}
              value={brand}
              onChangeText={setBrand}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., UN55"
              placeholderTextColor={placeholderColor}
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        <Text style={styles.label}>Serial Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Serial #"
          placeholderTextColor={placeholderColor}
          value={serialNumber}
          onChangeText={setSerialNumber}
        />

        <Text style={styles.sectionTitle}>Warranty</Text>
        
        <Text style={styles.label}>Warranty Information</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 2 year manufacturer warranty"
          placeholderTextColor={placeholderColor}
          value={warrantyInfo}
          onChangeText={setWarrantyInfo}
        />

        <Text style={styles.label}>Warranty Expiry</Text>
        {Platform.OS === 'web' && ReactDatePicker ? (
          <View style={styles.datePickerContainer}>
            <ReactDatePicker
              selected={warrantyExpiry ? new Date(warrantyExpiry) : null}
              onChange={(date: Date | null) => {
                if (date) setWarrantyExpiry(date.toISOString().split('T')[0]);
              }}
              minDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select warranty expiry date"
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
                  <Text style={warrantyExpiry ? styles.dateText : styles.datePlaceholder}>
                    {warrantyExpiry || 'Select warranty expiry date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#8E8E93" />
                </View>
              }
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.dateInput}
            onPress={() => showDatePicker('warranty')}
          >
            <Text style={warrantyExpiry ? styles.dateText : styles.datePlaceholder}>
              {warrantyExpiry || 'Select date'}
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
                if (date) setPurchaseDate(date.toISOString().split('T')[0]);
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
                strategy: 'absolute',
                modifiers: [
                  { name: 'preventOverflow', options: { mainAxis: false, altAxis: false }},
                  { name: 'flip', enabled: false },
                ],
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
                if (date) setLastMaintenance(date.toISOString().split('T')[0]);
              }}
              maxDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select last maintenance date"
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
                if (date) setNextMaintenance(date.toISOString().split('T')[0]);
              }}
              minDate={new Date()}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select next maintenance date"
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
          placeholder="e.g., 12"
          placeholderTextColor={placeholderColor}
          value={maintenanceFrequency}
          onChangeText={setMaintenanceFrequency}
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Photos & Invoice</Text>
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
            <Ionicons name="add" size={32} color="#34C759" />
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

      {/* Category Modal */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Category</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryOption}
                onPress={() => {
                  setCategory(cat);
                  setCategoryModalVisible(false);
                }}
              >
                <Text style={[styles.categoryOptionText, category === cat && styles.categoryOptionSelected]}>
                  {cat}
                </Text>
                {category === cat && <Ionicons name="checkmark" size={24} color="#007AFF" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={(ref) => setCameraRef(ref)}
            facing="back"
          />
          <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.closeCamera}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <View style={styles.cameraInstructions}>
                <Text style={styles.instructionText}>Point at appliance</Text>
              </View>
              <TouchableOpacity style={styles.captureButton} onPress={handleTakePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Receipt Camera Modal */}
      <Modal visible={receiptCameraVisible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={(ref) => setReceiptCameraRef(ref)}
            facing="back"
          />
          <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.closeCamera}
                onPress={() => setReceiptCameraVisible(false)}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <View style={styles.cameraInstructions}>
                <Text style={styles.instructionText}>Point at receipt/invoice</Text>
                <Text style={styles.instructionSubtext}>Ensure text is clear and visible</Text>
              </View>
              <TouchableOpacity style={styles.captureButton} onPress={handleTakeReceiptPicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
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
            <Text style={styles.scanningText}>Identifying appliance...</Text>
          </View>
        </View>
      )}

      {scanningReceipt && (
        <View style={styles.scanningOverlay}>
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning receipt...</Text>
            <Text style={styles.scanningSubtext}>Extracting purchase details</Text>
          </View>
        </View>
      )}
        </>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
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
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  receiptButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  receiptButtonText: {
    color: '#007AFF',
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
  categoryInput: {
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
  categoryText: {
    fontSize: 16,
    color: '#000',
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
    borderColor: '#34C759',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
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
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#000',
  },
  categoryOptionSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  instructionSubtext: {
    color: '#fff',
    fontSize: 13,
    marginTop: 4,
    opacity: 0.9,
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
    borderColor: '#34C759',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#34C759',
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
  scanningSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
});