import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { formatCurrency, formatDate } from '../../utils/localeUtils';
import ImageViewer from '../../components/ImageViewer';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Vehicle {
  id: string;
  name: string;
  type: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  license_plate?: string;
  color?: string;
  mileage?: number;
  purchase_date?: string;
  purchase_cost?: number;
  current_value?: number;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
  registration_expiry?: string;
  warranty_info?: string;
  warranty_expiry?: string;
  last_service?: string;
  next_service?: string;
  service_frequency?: number;
  photos?: string[];
  documents?: string[];
  notes?: string;
}

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchVehicle();
  }, [id]);

  const fetchVehicle = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/vehicles/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVehicle(response.data);
    } catch (error: any) {
      console.error('Failed to fetch vehicle:', error);
      Alert.alert('Error', 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(
        `${API_URL}/api/vehicles/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Vehicle deleted successfully');
      router.back();
    } catch (error: any) {
      console.error('Failed to delete vehicle:', error);
      Alert.alert('Error', 'Failed to delete vehicle');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    router.push(`/vehicle/edit/${id}`);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Vehicle not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{vehicle.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.iconBtn}>
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleDelete} 
            style={styles.iconBtn}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photos */}
        {vehicle.photos && vehicle.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {vehicle.photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: `data:image/jpeg;base64,${photo}` }}
                  style={styles.photo}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <DetailRow label="Type" value={vehicle.type} />
          <DetailRow label="Make" value={vehicle.make} />
          <DetailRow label="Model" value={vehicle.model} />
          <DetailRow label="Year" value={vehicle.year?.toString()} />
          {vehicle.color && <DetailRow label="Color" value={vehicle.color} />}
          {vehicle.vin && <DetailRow label="VIN" value={vehicle.vin} />}
          {vehicle.license_plate && <DetailRow label="License Plate" value={vehicle.license_plate} />}
          {vehicle.mileage && <DetailRow label="Mileage" value={`${vehicle.mileage.toLocaleString()} miles`} />}
        </View>

        {/* Financial Information */}
        {(vehicle.purchase_date || vehicle.purchase_cost || vehicle.current_value) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Information</Text>
            {vehicle.purchase_date && <DetailRow label="Purchase Date" value={formatDate(vehicle.purchase_date)} />}
            {vehicle.purchase_cost && <DetailRow label="Purchase Cost" value={formatCurrency(vehicle.purchase_cost)} />}
            {vehicle.current_value && <DetailRow label="Current Value" value={formatCurrency(vehicle.current_value)} />}
          </View>
        )}

        {/* Insurance */}
        {(vehicle.insurance_provider || vehicle.insurance_policy || vehicle.insurance_expiry) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insurance</Text>
            {vehicle.insurance_provider && <DetailRow label="Provider" value={vehicle.insurance_provider} />}
            {vehicle.insurance_policy && <DetailRow label="Policy Number" value={vehicle.insurance_policy} />}
            {vehicle.insurance_expiry && <DetailRow label="Expiry Date" value={formatDate(vehicle.insurance_expiry)} />}
          </View>
        )}

        {/* Registration & Warranty */}
        {(vehicle.registration_expiry || vehicle.warranty_info || vehicle.warranty_expiry) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Registration & Warranty</Text>
            {vehicle.registration_expiry && <DetailRow label="Registration Expiry" value={formatDate(vehicle.registration_expiry)} />}
            {vehicle.warranty_info && <DetailRow label="Warranty Info" value={vehicle.warranty_info} />}
            {vehicle.warranty_expiry && <DetailRow label="Warranty Expiry" value={formatDate(vehicle.warranty_expiry)} />}
          </View>
        )}

        {/* Service History */}
        {(vehicle.last_service || vehicle.next_service || vehicle.service_frequency) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service History</Text>
            {vehicle.last_service && <DetailRow label="Last Service" value={formatDate(vehicle.last_service)} />}
            {vehicle.next_service && <DetailRow label="Next Service" value={formatDate(vehicle.next_service)} />}
            {vehicle.service_frequency && <DetailRow label="Service Frequency" value={`Every ${vehicle.service_frequency} months`} />}
          </View>
        )}

        {/* Notes */}
        {vehicle.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{vehicle.notes}</Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  detailLabel: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginRight: 12,
  },
  notesText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
  },
  bottomPadding: {
    height: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
