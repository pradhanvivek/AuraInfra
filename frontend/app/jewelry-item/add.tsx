import { useState } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const jewelryTypes = [
  'Ring', 'Necklace', 'Bracelet', 'Earrings', 'Watch',
  'Pendant', 'Brooch', 'Anklet', 'Chain', 'Other'
];

const metals = ['Gold', 'Silver', 'Platinum', 'White Gold', 'Rose Gold', 'Diamond', 'Other'];
const stones = ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'None', 'Other'];

export default function AddJewelryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const scanMode = params.mode === 'scan';

  const [name, setName] = useState('');
  const [type, setType] = useState('Ring');
  const [metal, setMetal] = useState('Gold');
  const [stonesValue, setStonesValue] = useState('Diamond');
  const [numberOfStones, setNumberOfStones] = useState('');
  const [weight, setWeight] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [appraisalValue, setAppraisalValue] = useState('');
  const [appraisalDate, setAppraisalDate] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [certificatePhoto, setCertificatePhoto] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(scanMode);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'appraisal' | 'warranty'>('purchase');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'type' | 'metal' | 'stones'>('type');

  const handleScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission needed');
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

      const response = await axios.post(
        `${API_URL}/api/jewelry/scan`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.type) setType(data.type);
      if (data.metal) setMetal(data.metal);
      if (data.estimated_value) setAppraisalValue(data.estimated_value.toString());
      if (!name && data.type) setName(data.type);
      setPhotos([photo.base64!]);
      
      Alert.alert(
        'Jewelry Detected!',
        `${data.type || 'Jewelry'} identified. Please review and complete the details.`
      );
    } catch (error: any) {
      Alert.alert('Error', 'Failed to scan jewelry');
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
      Alert.alert('Error', 'Please enter a jewelry name');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/jewelry`,
        {
          name: name.trim(),
          type,
          metal,
          stones: stonesValue,
          number_of_stones: numberOfStones ? parseInt(numberOfStones) : undefined,
          weight: weight ? parseFloat(weight) : undefined,
          purchase_date: purchaseDate || undefined,
          purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
          appraisal_value: appraisalValue ? parseFloat(appraisalValue) : undefined,
          appraisal_date: appraisalDate || undefined,
          certificate_number: certificateNumber.trim() || undefined,
          certificate_photo: certificatePhoto || undefined,
          photos,
          notes: notes.trim() || undefined,
          warranty_info: warrantyInfo.trim() || undefined,
          warranty_expiry_date: warrantyExpiry || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Jewelry added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save jewelry');
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

  const openModal = (type: 'type' | 'metal' | 'stones') => {
    setModalType(type);
    setModalVisible(true);
  };

  const getModalData = () => {
    if (modalType === 'type') return jewelryTypes;
    if (modalType === 'metal') return metals;
    return stones;
  };

  const getModalValue = () => {
    if (modalType === 'type') return type;
    if (modalType === 'metal') return metal;
    return stonesValue;
  };

  const setModalValue = (value: string) => {
    if (modalType === 'type') setType(value);
    else if (modalType === 'metal') setMetal(value);
    else setStonesValue(value);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Jewelry</Text>
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
            <Text style={styles.scanButtonText}>Scan Jewelry with AI</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Wedding Ring"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Type</Text>
        <TouchableOpacity 
          style={styles.selectInput}
          onPress={() => openModal('type')}
        >
          <Text style={styles.selectText}>{type}</Text>
          <Ionicons name="chevron-down" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Metal</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => openModal('metal')}
            >
              <Text style={styles.selectText}>{metal}</Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Stones</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => openModal('stones')}
            >
              <Text style={styles.selectText}>{stonesValue}</Text>
              <Ionicons name="chevron-down" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Number of Stones</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 1"
              value={numberOfStones}
              onChangeText={setNumberOfStones}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Weight (grams)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5.5"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
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
              placeholder="$0"
              value={purchaseCost}
              onChangeText={setPurchaseCost}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Appraisal Value</Text>
            <TextInput
              style={styles.input}
              placeholder="$0"
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

        <Text style={styles.sectionTitle}>Certificate</Text>
        
        <Text style={styles.label}>Certificate Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Certificate #"
          value={certificateNumber}
          onChangeText={setCertificateNumber}
        />

        <Text style={styles.sectionTitle}>Warranty</Text>
        
        <Text style={styles.label}>Warranty Information</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Lifetime warranty"
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
            <Ionicons name="add" size={32} color="#FF2D55" />
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Additional notes..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </ScrollView>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {modalType === 'type' ? 'Select Type' : modalType === 'metal' ? 'Select Metal' : 'Select Stones'}
            </Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView>
            {getModalData().map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.modalOption}
                onPress={() => setModalValue(item)}
              >
                <Text style={[styles.modalOptionText, getModalValue() === item && styles.modalOptionSelected]}>
                  {item}
                </Text>
                {getModalValue() === item && <Ionicons name="checkmark" size={24} color="#007AFF" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Camera Modal */}
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
                <Text style={styles.instructionText}>Point at jewelry</Text>
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
            <Text style={styles.scanningText}>Identifying jewelry...</Text>
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
    color: '#8E8E93',
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
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#000',
  },
  modalOptionSelected: {
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
});