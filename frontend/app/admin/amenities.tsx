import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Amenity {
  id: string;
  name: string;
  description: string;
  amenity_type: string;
  capacity: number;
  booking_fee: number;
  available: boolean;
  operating_hours_start: string;
  operating_hours_end: string;
}

const amenityTypes = [
  { id: 'clubhouse', name: 'Clubhouse', icon: 'home' },
  { id: 'gym', name: 'Gym', icon: 'fitness' },
  { id: 'pool', name: 'Swimming Pool', icon: 'water' },
  { id: 'sports_court', name: 'Sports Court', icon: 'basketball' },
  { id: 'party_hall', name: 'Party Hall', icon: 'wine' },
  { id: 'playground', name: 'Playground', icon: 'happy' },
  { id: 'other', name: 'Other', icon: 'apps' },
];

export default function AdminAmenities() {
  const router = useRouter();
  const { token } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amenity_type: 'clubhouse',
    capacity: '',
    booking_fee: '',
    operating_hours_start: '09:00',
    operating_hours_end: '18:00',
  });

  useEffect(() => {
    fetchPropertyId();
  }, []);

  useEffect(() => {
    if (propertyId) {
      fetchAmenities();
    }
  }, [propertyId]);

  const fetchPropertyId = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.managed_properties?.length > 0) {
        setPropertyId(response.data.managed_properties[0]);
      } else {
        Alert.alert('Error', 'No managed properties found');
        router.back();
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const fetchAmenities = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/amenities`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setAmenities(response.data);
    } catch (error) {
      console.error('Error fetching amenities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.description || !formData.capacity || !formData.booking_fee) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/properties/${propertyId}/amenities`,
        {
          property_id: propertyId,
          name: formData.name,
          description: formData.description,
          amenity_type: formData.amenity_type,
          capacity: parseInt(formData.capacity),
          booking_fee: parseFloat(formData.booking_fee),
          operating_hours_start: formData.operating_hours_start,
          operating_hours_end: formData.operating_hours_end,
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      Alert.alert('Success', 'Amenity created successfully!');
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        amenity_type: 'clubhouse',
        capacity: '',
        booking_fee: '',
        operating_hours_start: '09:00',
        operating_hours_end: '18:00',
      });
      fetchAmenities();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create amenity');
    } finally {
      setSaving(false);
    }
  };

  const getAmenityIcon = (type: string) => {
    const amenityType = amenityTypes.find(t => t.id === type);
    return amenityType?.icon || 'apps';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Amenities</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {amenities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No amenities added yet</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
              <Text style={styles.addButtonText}>Add First Amenity</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {amenities.map((amenity) => (
              <View key={amenity.id} style={styles.amenityCard}>
                <View style={styles.amenityIcon}>
                  <Ionicons name={getAmenityIcon(amenity.amenity_type) as any} size={28} color="#007AFF" />
                </View>
                <View style={styles.amenityInfo}>
                  <Text style={styles.amenityName}>{amenity.name}</Text>
                  <Text style={styles.amenityDetail}>{amenity.description}</Text>
                  <View style={styles.amenityMeta}>
                    <Text style={styles.metaText}>
                      <Ionicons name="people" size={14} /> {amenity.capacity} people
                    </Text>
                    <Text style={styles.metaText}>
                      <Ionicons name="cash" size={14} /> ${amenity.booking_fee}
                    </Text>
                  </View>
                  <Text style={styles.hoursText}>
                    <Ionicons name="time" size={14} /> {amenity.operating_hours_start} - {amenity.operating_hours_end}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Amenity Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Amenity</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Community Clubhouse"
              />

              <Text style={styles.label}>Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                {amenityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeChip,
                      formData.amenity_type === type.id && styles.typeChipActive
                    ]}
                    onPress={() => setFormData({ ...formData, amenity_type: type.id })}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={20}
                      color={formData.amenity_type === type.id ? '#fff' : '#007AFF'}
                    />
                    <Text style={[
                      styles.typeText,
                      formData.amenity_type === type.id && styles.typeTextActive
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Capacity *</Text>
              <TextInput
                style={styles.input}
                value={formData.capacity}
                onChangeText={(text) => setFormData({ ...formData, capacity: text })}
                placeholder="Number of people"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Booking Fee ($) *</Text>
              <TextInput
                style={styles.input}
                value={formData.booking_fee}
                onChangeText={(text) => setFormData({ ...formData, booking_fee: text })}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Opening Time *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.operating_hours_start}
                    onChangeText={(text) => setFormData({ ...formData, operating_hours_start: text })}
                    placeholder="09:00"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Closing Time *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.operating_hours_end}
                    onChangeText={(text) => setFormData({ ...formData, operating_hours_end: text })}
                    placeholder="18:00"
                  />
                </View>
              </View>

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Describe the amenity..."
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={saving}
              >
                <Text style={styles.submitButtonText}>
                  {saving ? 'Creating...' : 'Create Amenity'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  amenityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  amenityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityInfo: {
    flex: 1,
  },
  amenityName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  amenityDetail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  amenityMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#000',
  },
  hoursText: {
    fontSize: 13,
    color: '#8E8E93',
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    maxHeight: 80,
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    gap: 6,
  },
  typeChipActive: {
    backgroundColor: '#007AFF',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  typeTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
