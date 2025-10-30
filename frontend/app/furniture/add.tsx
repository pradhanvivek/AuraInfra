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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { getCurrencyInfo } from '../../utils/localeUtils';

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

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
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
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => showDatePicker('warranty')}
              >
                <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                <Text style={warrantyExpiry ? styles.dateText : styles.datePlaceholder}>
                  {warrantyExpiry || 'Select date'}
                </Text>
              </TouchableOpacity>
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
});
