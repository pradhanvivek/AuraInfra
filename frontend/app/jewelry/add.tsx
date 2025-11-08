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
import { Platform } from 'react-native';

// Conditionally import react-datepicker only on web
let ReactDatePicker: any = null;
if (Platform.OS === 'web') {
  ReactDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const jewelryTypes = [
  'Ring', 'Necklace', 'Bracelet', 'Earrings', 'Watch',
  'Brooch', 'Pendant', 'Anklet', 'Cufflinks', 'Tiara',
  'Chain', 'Bangle', 'Other'
];

const metalTypes = [
  'Gold', 'Silver', 'Platinum', 'White Gold', 'Rose Gold',
  'Titanium', 'Stainless Steel', 'Mixed', 'Other'
];

export default function AddJewelryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const scanMode = params.mode === 'scan';
  const colorScheme = useColorScheme();
  
  // Dynamic placeholder color based on theme
  const placeholderColor = colorScheme === 'dark' ? '#999999' : '#666666';
  const editId = params.id as string | undefined;
  const isEditing = !!editId;

  const [loading, setLoading] = useState(isEditing);
  const [name, setName] = useState('');
  const [type, setType] = useState('Ring');
  const [metal, setMetal] = useState('Gold');
  const [stones, setStones] = useState('');
  const [weight, setWeight] = useState('');
  const [purity, setPurity] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [appraisalValue, setAppraisalValue] = useState('');
  const [appraisalDate, setAppraisalDate] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [certificate, setCertificate] = useState('');
  const [notes, setNotes] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [metalModalVisible, setMetalModalVisible] = useState(false);

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(scanMode);
  const [receiptCameraVisible, setReceiptCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [receiptCameraRef, setReceiptCameraRef] = useState<any>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'appraisal' | 'warranty'>('purchase');

  useEffect(() => {
    if (isEditing) {
      fetchJewelry();
    }
  }, [editId]);

  const fetchJewelry = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/jewelry/${editId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data;
      setName(data.name || '');
      setType(data.type || 'Ring');
      setMetal(data.metal || 'Gold');
      setStones(data.stones || '');
      setWeight(data.weight ? data.weight.toString() : '');
      setPurity(data.purity || '');
      setPurchaseDate(data.purchase_date || '');
      setPurchaseCost(data.purchase_cost ? data.purchase_cost.toString() : '');
      setAppraisalValue(data.appraisal_value ? data.appraisal_value.toString() : '');
      setAppraisalDate(data.appraisal_date || '');
      setCertificateNumber(data.certificate_number || '');
      setPhotos(data.photos || []);
      setCertificate(data.certificate || '');
      setNotes(data.notes || '');
      setWarrantyInfo(data.warranty_info || '');
      setWarrantyExpiry(data.warranty_expiry || '');
    } catch (error: any) {
      console.error('Failed to fetch jewelry:', error);
      Alert.alert('Error', 'Failed to load jewelry details');
      router.back();
    } finally {
      setLoading(false);
    }
  };
  const handleScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan jewelry');
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleTakePicture = async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.7 });
      setCameraVisible(false);
      setScanning(true);

      // Call AI jewelry recognition API
      const response = await axios.post(
        `${API_URL}/api/jewelry/scan`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.name) setName(data.name);
      if (data.type) setType(data.type);
      if (data.metal) setMetal(data.metal);
      if (data.stones) setStones(data.stones);
      if (data.weight) setWeight(data.weight.toString());
      if (data.estimated_value) setAppraisalValue(data.estimated_value.toString());
      setPhotos([photo.base64!]);
      
      Alert.alert(
        'Jewelry Identified!',
        `${data.name || 'Jewelry item'} detected. Please review and complete the details.`
      );
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to scan jewelry. Please enter details manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleScanReceipt = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission needed');
        return;
      }
    }
    setReceiptCameraVisible(true);
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
      if (data.purchase_date) setPurchaseDate(data.purchase_date);
      if (data.purchase_cost) setPurchaseCost(data.purchase_cost.toString());
      if (data.warranty_info) setWarrantyInfo(data.warranty_info);
      if (data.warranty_months && data.purchase_date) {
        // Calculate warranty expiry from purchase date + warranty months
        const purchaseD = new Date(data.purchase_date);
        purchaseD.setMonth(purchaseD.getMonth() + data.warranty_months);
        setWarrantyExpiry(purchaseD.toISOString().split('T')[0]);
      }
      
      // Store the receipt photo as certificate
      setCertificate(photo.base64!);
      
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
      Alert.alert('Error', 'Please enter jewelry name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        metal,
        stones: stones.trim() || undefined,
        weight: weight ? parseFloat(weight) : undefined,
        purity: purity.trim() || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        appraisal_value: appraisalValue ? parseFloat(appraisalValue) : undefined,
        appraisal_date: appraisalDate || undefined,
        certificate_number: certificateNumber.trim() || undefined,
        photos,
        certificate: certificate || undefined,
        notes: notes.trim() || undefined,
        warranty_info: warrantyInfo.trim() || undefined,
        warranty_expiry_date: warrantyExpiry || undefined,
      };

      if (isEditing) {
        await axios.put(
          `${API_URL}/api/jewelry/${editId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Jewelry updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await axios.post(
          `${API_URL}/api/jewelry`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Jewelry added successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'save'} jewelry`);
    } finally {
      setSaving(false);
    }
  };

  const showDatePicker = (mode: 'purchase' | 'appraisal' | 'warranty') => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (datePickerMode === 'purchase') setPurchaseDate(dateStr);
    else if (datePickerMode === 'appraisal') setAppraisalDate(dateStr);
    else if (datePickerMode === 'warranty') setWarrantyExpiry(dateStr);
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
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Jewelry' : 'Add Jewelry'}</Text>
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
              <Text style={styles.scanButtonText}>Scan Jewelry with AI</Text>
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
          placeholder="e.g., Diamond Engagement Ring"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Type</Text>
        <TouchableOpacity 
          style={styles.selectInput}
          onPress={() => setTypeModalVisible(true)}
        >
          <Text style={styles.selectText}>{type}</Text>
          <Ionicons name="chevron-down" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <Text style={styles.label}>Metal</Text>
        <TouchableOpacity 
          style={styles.selectInput}
          onPress={() => setMetalModalVisible(true)}
        >
          <Text style={styles.selectText}>{metal}</Text>
          <Ionicons name="chevron-down" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <Text style={styles.label}>Stones/Gems</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 1 carat diamond, 2 rubies"
          placeholderTextColor={placeholderColor}
          value={stones}
          onChangeText={setStones}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Weight (grams)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Purity</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 18K, 925"
              placeholderTextColor={placeholderColor}
              value={purity}
              onChangeText={setPurity}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Financial</Text>
        
        <Text style={styles.label}>Purchase Date</Text>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => showDatePicker('purchase')}
        >
          <Text style={purchaseDate ? styles.dateText : styles.datePlaceholder}>
            {purchaseDate || 'Select date'}
          </Text>
          <Ionicons name="calendar" size={20} color="#8E8E93" />
        </TouchableOpacity>

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
            <Text style={styles.label}>Appraisal Value</Text>
            <TextInput
              style={styles.input}
              placeholder={`${getCurrencyInfo().symbol}0`}
              placeholderTextColor={placeholderColor}
              value={appraisalValue}
              onChangeText={setAppraisalValue}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Text style={styles.label}>Appraisal Date</Text>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => showDatePicker('appraisal')}
        >
          <Text style={appraisalDate ? styles.dateText : styles.datePlaceholder}>
            {appraisalDate || 'Select date'}
          </Text>
          <Ionicons name="calendar" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Certificate & Warranty</Text>
        
        <Text style={styles.label}>Certificate Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., GIA 1234567890"
          placeholderTextColor={placeholderColor}
          value={certificateNumber}
          onChangeText={setCertificateNumber}
        />

        <Text style={styles.label}>Warranty Information</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Lifetime manufacturer warranty"
          placeholderTextColor={placeholderColor}
          value={warrantyInfo}
          onChangeText={setWarrantyInfo}
        />

        <Text style={styles.label}>Warranty Expiry</Text>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => showDatePicker('warranty')}
        >
          <Text style={warrantyExpiry ? styles.dateText : styles.datePlaceholder}>
            {warrantyExpiry || 'Select date'}
          </Text>
          <Ionicons name="calendar" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Photos & Certificate</Text>
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
            <Ionicons name="add" size={32} color="#FF2D55" />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Additional notes, history, special occasions..."
          placeholderTextColor={placeholderColor}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </ScrollView>

      {/* Type Modal */}
      <Modal
        visible={typeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setTypeModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Type</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView>
            {jewelryTypes.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.optionItem}
                onPress={() => {
                  setType(t);
                  setTypeModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, type === t && styles.optionSelected]}>
                  {t}
                </Text>
                {type === t && <Ionicons name="checkmark" size={24} color="#007AFF" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Metal Modal */}
      <Modal
        visible={metalModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMetalModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMetalModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Metal</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView>
            {metalTypes.map((m) => (
              <TouchableOpacity
                key={m}
                style={styles.optionItem}
                onPress={() => {
                  setMetal(m);
                  setMetalModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, metal === m && styles.optionSelected]}>
                  {m}
                </Text>
                {metal === m && <Ionicons name="checkmark" size={24} color="#007AFF" />}
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
              <Text style={styles.instructionText}>Point at jewelry item</Text>
              <Text style={styles.instructionSubtext}>Ensure good lighting for best results</Text>
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
              <Text style={styles.instructionText}>Scan Receipt/Invoice</Text>
              <Text style={styles.instructionSubtext}>Position receipt within frame</Text>
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
            <ActivityIndicator size="large" color="#FF2D55" />
            <Text style={styles.scanningText}>Analyzing jewelry...</Text>
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
  scanButton: {
    flexDirection: 'row',
    backgroundColor: '#FF2D55',
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
  selectInput: {
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
  selectText: {
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
    borderColor: '#FF2D55',
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
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  optionSelected: {
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
    borderColor: '#FF2D55',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF2D55',
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