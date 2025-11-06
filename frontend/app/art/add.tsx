import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getCurrencyInfo } from '../../utils/localeUtils';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const ART_TYPES = ['Painting', 'Sculpture', 'Print', 'Photograph', 'Drawing', 'Collage', 'Digital Art', 'Mixed Media', 'Other'];
const MEDIUMS = ['Oil', 'Acrylic', 'Watercolor', 'Bronze', 'Marble', 'Wood', 'Canvas', 'Paper', 'Digital', 'Other'];

export default function AddArtScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const placeholderColor = colorScheme === 'dark' ? '#999999' : '#666666';
  const editId = params.id as string | undefined;
  const isEditing = !!editId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('Painting');
  const [artist, setArtist] = useState('');
  const [medium, setMedium] = useState('Oil');
  const [dimensions, setDimensions] = useState('');
  const [yearCreated, setYearCreated] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [appraisalValue, setAppraisalValue] = useState('');
  const [appraisalDate, setAppraisalDate] = useState('');
  const [provenance, setProvenance] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [certificate, setCertificate] = useState('');
  const [notes, setNotes] = useState('');

  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [mediumModalVisible, setMediumModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'appraisal'>('purchase');

  useEffect(() => {
    if (isEditing) {
      fetchArt();
    }
  }, [editId]);

  const fetchArt = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/art/${editId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data;
      setName(data.name || '');
      setType(data.type || 'Painting');
      setArtist(data.artist || '');
      setMedium(data.medium || 'Oil');
      setDimensions(data.dimensions || '');
      setYearCreated(data.year_created ? data.year_created.toString() : '');
      setPurchaseDate(data.purchase_date || '');
      setPurchaseCost(data.purchase_cost ? data.purchase_cost.toString() : '');
      setCurrentValue(data.current_value ? data.current_value.toString() : '');
      setAppraisalValue(data.appraisal_value ? data.appraisal_value.toString() : '');
      setAppraisalDate(data.appraisal_date || '');
      setProvenance(data.provenance || '');
      setPhotos(data.photos || []);
      setCertificate(data.authenticity_certificate || '');
      setNotes(data.notes || '');
    } catch (error: any) {
      console.error('Failed to fetch art:', error);
      Alert.alert('Error', 'Failed to load art details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter art name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        artist: artist.trim() || undefined,
        medium,
        dimensions: dimensions.trim() || undefined,
        year_created: yearCreated ? parseInt(yearCreated) : undefined,
        purchase_date: purchaseDate || undefined,
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        current_value: currentValue ? parseFloat(currentValue) : undefined,
        appraisal_value: appraisalValue ? parseFloat(appraisalValue) : undefined,
        appraisal_date: appraisalDate || undefined,
        provenance: provenance.trim() || undefined,
        photos,
        authenticity_certificate: certificate || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await axios.put(
          `${API_URL}/api/art/${editId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Art updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        await axios.post(
          `${API_URL}/api/art`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Art added successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'save'} art`);
    } finally {
      setSaving(false);
    }
  };

  const handleAIScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan art');
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      setCameraVisible(false);
      setScanning(true);

      // Call AI art recognition API
      const response = await axios.post(
        `${API_URL}/api/art/scan`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      if (data.name) setName(data.name);
      if (data.type) setType(data.type);
      if (data.artist) setArtist(data.artist);
      if (data.medium) setMedium(data.medium);
      if (data.estimated_period) setYearCreated(data.estimated_period);
      if (data.subject_matter) setNotes(data.subject_matter);
      setPhotos([photo.base64!]);
      
      Alert.alert(
        'Art Identified!',
        `${data.name || 'Artwork'} detected (${Math.round(data.confidence * 100)}% confidence). Please review and complete the details.`
      );
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to scan art. Please enter details manually.');
    } finally {
      setScanning(false);
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

  const pickCertificate = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCertificate(result.assets[0].base64);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const showDatePicker = (mode: 'purchase' | 'appraisal') => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleDateConfirm = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    if (datePickerMode === 'purchase') {
      setPurchaseDate(dateStr);
    } else {
      setAppraisalDate(dateStr);
    }
    setDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5856D6" />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Art' : 'Add Art'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {!isEditing && (
            <View style={styles.aiScanContainer}>
              <TouchableOpacity
                style={styles.aiScanButton}
                onPress={handleAIScan}
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.aiScanText}>Scanning...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="scan" size={20} color="#fff" />
                    <Text style={styles.aiScanText}>AI Scan Artwork</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Starry Night"
                placeholderTextColor={placeholderColor}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Type *</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setTypeModalVisible(true)}
              >
                <Text>{type}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Artist</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Vincent van Gogh"
                placeholderTextColor={placeholderColor}
                value={artist}
                onChangeText={setArtist}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Medium</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setMediumModalVisible(true)}
              >
                <Text>{medium}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Dimensions</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., H: 73.7cm x W: 92.1cm"
                placeholderTextColor={placeholderColor}
                value={dimensions}
                onChangeText={setDimensions}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Year Created</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1889"
                placeholderTextColor={placeholderColor}
                value={yearCreated}
                onChangeText={setYearCreated}
                keyboardType="number-pad"
              />
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
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => showDatePicker('purchase')}
              >
                <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                <Text style={purchaseDate ? styles.dateText : styles.datePlaceholder}>
                  {purchaseDate || 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
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

            <View style={styles.section}>
              <Text style={styles.label}>Appraisal Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => showDatePicker('appraisal')}
              >
                <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                <Text style={appraisalDate ? styles.dateText : styles.datePlaceholder}>
                  {appraisalDate || 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Provenance</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="History of ownership..."
                placeholderTextColor={placeholderColor}
                value={provenance}
                onChangeText={setProvenance}
                multiline
                numberOfLines={4}
              />
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
                    <Ionicons name="camera" size={32} color="#5856D6" />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Authenticity Certificate</Text>
              {certificate ? (
                <View style={styles.certificateContainer}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${certificate}` }}
                    style={styles.certificatePreview}
                  />
                  <TouchableOpacity
                    style={styles.removeCertificateBtn}
                    onPress={() => setCertificate('')}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={pickCertificate}>
                  <Ionicons name="ribbon" size={24} color="#5856D6" />
                  <Text style={styles.uploadText}>Upload Certificate</Text>
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

          <Modal visible={typeModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Type</Text>
                <ScrollView>
                  {ART_TYPES.map((artType) => (
                    <TouchableOpacity
                      key={artType}
                      style={styles.modalOption}
                      onPress={() => {
                        setType(artType);
                        setTypeModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{artType}</Text>
                      {type === artType && (
                        <Ionicons name="checkmark" size={24} color="#5856D6" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setTypeModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={mediumModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Medium</Text>
                <ScrollView>
                  {MEDIUMS.map((med) => (
                    <TouchableOpacity
                      key={med}
                      style={styles.modalOption}
                      onPress={() => {
                        setMedium(med);
                        setMediumModalVisible(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{med}</Text>
                      {medium === med && (
                        <Ionicons name="checkmark" size={24} color="#5856D6" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setMediumModalVisible(false)}
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

          <Modal visible={cameraVisible} animationType="slide">
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                ref={cameraRef}
              >
                <View style={styles.cameraOverlay}>
                  <TouchableOpacity
                    style={styles.cameraCloseBtn}
                    onPress={() => setCameraVisible(false)}
                  >
                    <Ionicons name="close" size={32} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.cameraControls}>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={handleTakePicture}
                    >
                      <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cameraHint}>Position artwork in frame</Text>
                </View>
              </CameraView>
            </View>
          </Modal>
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
    borderColor: '#5856D6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#5856D6',
    marginTop: 4,
  },
  certificateContainer: {
    gap: 12,
  },
  certificatePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeCertificateBtn: {
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
    color: '#5856D6',
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
    backgroundColor: '#5856D6',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
