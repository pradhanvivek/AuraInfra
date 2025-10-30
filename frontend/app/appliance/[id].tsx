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

interface Appliance {
  id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_cost?: number;
  current_value?: number;
  warranty_info?: string;
  warranty_expiry?: string;
  last_maintenance?: string;
  next_maintenance?: string;
  maintenance_frequency?: number;
  photos?: string[];
  invoice?: string;
  notes?: string;
}

export default function ApplianceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  
  const [appliance, setAppliance] = useState<Appliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAppliance();
  }, [id]);

  const fetchAppliance = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/appliances/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAppliance(response.data);
    } catch (error: any) {
      console.error('Failed to fetch appliance:', error);
      Alert.alert('Error', 'Failed to load appliance details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Appliance',
      'Are you sure you want to delete this appliance? This action cannot be undone.',
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
        `${API_URL}/api/appliances/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Appliance deleted successfully');
      router.back();
    } catch (error: any) {
      console.error('Failed to delete appliance:', error);
      Alert.alert('Error', 'Failed to delete appliance');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    router.push(`/appliance/edit/${id}`);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!appliance) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Appliance not found</Text>
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
        <Text style={styles.headerTitle}>{appliance.name}</Text>
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
        {appliance.photos && appliance.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {appliance.photos.map((photo, index) => (
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
          <DetailRow label="Category" value={appliance.category} />
          {appliance.brand && <DetailRow label="Brand" value={appliance.brand} />}
          {appliance.model && <DetailRow label="Model" value={appliance.model} />}
          {appliance.serial_number && <DetailRow label="Serial Number" value={appliance.serial_number} />}
        </View>

        {/* Financial Information */}
        {(appliance.purchase_date || appliance.purchase_cost || appliance.current_value) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Information</Text>
            {appliance.purchase_date && <DetailRow label="Purchase Date" value={formatDate(appliance.purchase_date)} />}
            {appliance.purchase_cost && <DetailRow label="Purchase Cost" value={formatCurrency(appliance.purchase_cost)} />}
            {appliance.current_value && <DetailRow label="Current Value" value={formatCurrency(appliance.current_value)} />}
          </View>
        )}

        {/* Warranty */}
        {(appliance.warranty_info || appliance.warranty_expiry) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Warranty</Text>
            {appliance.warranty_info && <DetailRow label="Warranty Info" value={appliance.warranty_info} />}
            {appliance.warranty_expiry && <DetailRow label="Warranty Expiry" value={formatDate(appliance.warranty_expiry)} />}
          </View>
        )}

        {/* Maintenance */}
        {(appliance.last_maintenance || appliance.next_maintenance || appliance.maintenance_frequency) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maintenance</Text>
            {appliance.last_maintenance && <DetailRow label="Last Maintenance" value={formatDate(appliance.last_maintenance)} />}
            {appliance.next_maintenance && <DetailRow label="Next Maintenance" value={formatDate(appliance.next_maintenance)} />}
            {appliance.maintenance_frequency && <DetailRow label="Maintenance Frequency" value={`Every ${appliance.maintenance_frequency} months`} />}
          </View>
        )}

        {/* Invoice */}
        {appliance.invoice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice</Text>
            <Image
              source={{ uri: `data:image/jpeg;base64,${appliance.invoice}` }}
              style={styles.invoiceImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Notes */}
        {appliance.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{appliance.notes}</Text>
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
  invoiceImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
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
