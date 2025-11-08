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
  Image,
  Modal,
  useColorScheme,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getCurrencyInfo } from '../../utils/localeUtils';
import { CameraView, useCameraPermissions } from 'expo-camera';

// Conditionally import react-datepicker only on web
let ReactDatePicker: any = null;
if (Platform.OS === 'web') {
  ReactDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const FURNITURE_CATEGORIES = ['Sofa', 'Table', 'Chair', 'Bed', 'Cabinet', 'Desk', 'Shelf', 'Wardrobe', 'Other'];
const MATERIALS = ['Wood', 'Metal', 'Fabric', 'Leather', 'Glass', 'Plastic', 'Mixed', 'Other'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

export default function AddFurnitureScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const placeholderColor = colorScheme === 'dark' ? '#999999' : '#666666';
  const editId = params.id as string | undefined;
  const isEditing = !!editId;
  const scanMode = params.mode === 'scan';

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(scanMode);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Sofa');
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('Wood');
  const [dimensions, setDimensions] = useState('');
  const [roomLocation, setRoomLocation] = useState('');
  const [condition, setCondition] = useState('Good');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'warranty'>('purchase');

  useEffect(() => {
    if (isEditing) {
      fetchFurniture();
    }
  }, [editId]);

  // Inject custom CSS for react-datepicker on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const baseCssId = 'react-datepicker-base-css-furniture';
      if (!document.getElementById(baseCssId)) {
        const link = document.createElement('link');
        link.id = baseCssId;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/react-datepicker@6.9.0/dist/react-datepicker.min.css';
        document.head.appendChild(link);
      }
      
      const styleId = 'custom-datepicker-styles-furniture';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .furniture-datepicker-input {
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
            background-color: #34C759;
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
            background-color: #34C759;
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
            background-color: #34C759;
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

  const fetchFurniture = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/furniture/${editId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data;
      setName(data.name || '');
      setCategory(data.category || 'Sofa');
      setBrand(data.brand || '');
      setMaterial(data.material || 'Wood');
      setDimensions(data.dimensions || '');
      setRoomLocation(data.room_location || '');
      setCondition(data.condition || 'Good');
      setPurchaseDate(data.purchase_date || '');
      setPurchaseCost(data.purchase_cost ? data.purchase_cost.toString() : '');
      setCurrentValue(data.current_value ? data.current_value.toString() : '');
      setWarrantyInfo(data.warranty_info || '');
      setWarrantyExpiry(data.warranty_expiry_date || '');
      setPhotos(data.photos || []);
      setInvoice(data.invoice || '');
      setNotes(data.notes || '');
    } catch (error: any) {
      console.error('Failed to fetch furniture:', error);
      Alert.alert('Error', 'Failed to load furniture details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan furniture');
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleTakePicture = async () => {
    if (!cameraRef) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      setScanning(true);
      const photo = await cameraRef.takePictureAsync({ base64: true });
      setCameraVisible(false);

      const response = await axios.post(
        `${API_URL}/api/furniture/scan`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      
      // Populate form fields from scan results
      if (data.name) setName(data.name);
      if (data.category) setCategory(data.category);
      if (data.brand) setBrand(data.brand);
      if (data.material) setMaterial(data.material);
      if (data.condition) setCondition(data.condition);
      
      // Append additional info to notes
      let scanNotes = '';
      if (data.style) scanNotes += `Style: ${data.style}\n`;
      if (data.estimated_age) scanNotes += `Estimated Age: ${data.estimated_age}\n`;
      if (scanNotes) setNotes((prev) => (prev ? `${prev}\n\n${scanNotes}` : scanNotes));
      
      // Add photo to gallery
      if (photo.base64) {
        setPhotos([photo.base64]);
      }

      Alert.alert(
        'Scan Complete',
        `Furniture identified with ${Math.round((data.confidence || 0) * 100)}% confidence. Please review and adjust the details.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Error', 'Failed to scan furniture. Please try again or enter details manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter furniture name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        brand: brand.trim() || undefined,
        material,
        dimensions: dimensions.trim() || undefined,
        room_location: roomLocation.trim() || undefined,
        condition,
        purchase_date: purchaseDate || undefined,
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        current_value: currentValue ? parseFloat(currentValue) : undefined,
        warranty_info: warrantyInfo.trim() || undefined,
        warranty_expiry_date: warrantyExpiry || undefined,
        photos,
        invoice: invoice || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await axios.put(
          `${API_URL}/api/furniture/${editId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Furniture updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await axios.post(
          `${API_URL}/api/furniture`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Furniture added successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'save'} furniture`);
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, result.assets[0].base64]);
    }
  };

  const pickInvoice = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setInvoice(result.assets[0].base64);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const showDatePicker = (mode: 'purchase' | 'warranty') => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (datePickerMode === 'purchase') {
      setPurchaseDate(dateStr);
    } else {
      setWarrantyExpiry(dateStr);
    }
    setDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#34C759" />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Furniture' : 'Add Furniture'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Living Room Sofa"
                placeholderTextColor={placeholderColor}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setCategoryModalVisible(true)}
              >
                <Text>{category}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., IKEA, Ashley"
                placeholderTextColor={placeholderColor}
                value={brand}
                onChangeText={setBrand}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Material</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setMaterialModalVisible(true)}
              >
                <Text>{material}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Dimensions</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., L: 200cm x W: 100cm x H: 80cm"
                placeholderTextColor={placeholderColor}
                value={dimensions}
                onChangeText={setDimensions}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Room Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Living Room, Bedroom"
                placeholderTextColor={placeholderColor}
                value={roomLocation}
                onChangeText={setRoomLocation}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Condition</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setConditionModalVisible(true)}
              >
                <Text>{condition}</Text>
              </TouchableOpacity>
            </View>

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

            <View style={styles.section}>
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
                  <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                  <Text style={purchaseDate ? styles.dateText : styles.datePlaceholder}>
                    {purchaseDate || 'Select date'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Warranty Info</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2 years manufacturer warranty"
                placeholderTextColor={placeholderColor}
                value={warrantyInfo}
                onChangeText={setWarrantyInfo}
              />
            </View>

            <View style={styles.section}>
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
                  <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                  <Text style={warrantyExpiry ? styles.dateText : styles.datePlaceholder}>
                    {warrantyExpiry || 'Select date'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photosContainer}>
                  {photos.map((photo, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${photo}` }}
                        style={styles.photoPreview}
                      />
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => removePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                    <Ionicons name="camera" size={32} color="#007AFF" />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Invoice</Text>
              {invoice ? (
                <View style={styles.invoiceContainer}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${invoice}` }}
                    style={styles.invoicePreview}
                  />
                  <TouchableOpacity
                    style={styles.removeInvoiceBtn}
                    onPress={() => setInvoice('')}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={pickInvoice}>
                  <Ionicons name="document" size={24} color="#007AFF" />
                  <Text style={styles.uploadText}>Upload Invoice</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any additional notes..."
                placeholderTextColor={placeholderColor}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>

          <Modal visible={categoryModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <ScrollView>
                  {FURNITURE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.modalOption}
                      onPress={() => {
                        setCategory(cat);
                        setCategoryModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{cat}</Text>
                      {category === cat && (
                        <Ionicons name="checkmark" size={24} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setCategoryModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={materialModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Material</Text>
                <ScrollView>
                  {MATERIALS.map((mat) => (
                    <TouchableOpacity
                      key={mat}
                      style={styles.modalOption}
                      onPress={() => {
                        setMaterial(mat);
                        setMaterialModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{mat}</Text>
                      {material === mat && (
                        <Ionicons name="checkmark" size={24} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setMaterialModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={conditionModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Condition</Text>
                {CONDITIONS.map((cond) => (
                  <TouchableOpacity
                    key={cond}
                    style={styles.modalOption}
                    onPress={() => {
                      setCondition(cond);
                      setConditionModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{cond}</Text>
                    {condition === cond && (
                      <Ionicons name="checkmark" size={24} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setConditionModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
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

          {/* Camera Modal for AI Scanning */}
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
                  <Text style={styles.instructionText}>Point at furniture item</Text>
                  <Text style={styles.instructionSubtext}>Ensure good lighting for best results</Text>
                </View>
                <TouchableOpacity style={styles.captureButton} onPress={handleTakePicture}>
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {scanning && (
            <View style={styles.scanningOverlay}>
              <View style={styles.scanningCard}>
                <ActivityIndicator size="large" color="#34C759" />
                <Text style={styles.scanningText}>Scanning furniture...</Text>
                <Text style={styles.scanningSubtext}>Analyzing with AI</Text>
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
    color: '#007AFF',
    fontWeight: '600',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
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
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
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
  photosContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  invoiceContainer: {
    gap: 12,
  },
  invoicePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeInvoiceBtn: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontWeight: '600',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  uploadText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#000',
  },
  modalCloseBtn: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 16,
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
    textAlign: 'center',
  },
  instructionSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
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
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
  },
  scanningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  scanningSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});
