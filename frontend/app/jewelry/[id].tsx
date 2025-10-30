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

interface Jewelry {
  id: string;
  name: string;
  type: string;
  metal?: string;
  stones?: string;
  weight?: number;
  purity?: string;
  purchase_date?: string;
  purchase_cost?: number;
  appraisal_value?: number;
  appraisal_date?: string;
  certificate_number?: string;
  warranty_info?: string;
  warranty_expiry?: string;
  photos?: string[];
  certificate?: string;
  notes?: string;
}

export default function JewelryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  
  const [jewelry, setJewelry] = useState<Jewelry | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState('');

  useEffect(() => {
    fetchJewelry();
  }, [id]);

  const fetchJewelry = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/jewelry/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJewelry(response.data);
    } catch (error: any) {
      console.error('Failed to fetch jewelry:', error);
      Alert.alert('Error', 'Failed to load jewelry details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Jewelry',
      'Are you sure you want to delete this jewelry item? This action cannot be undone.',
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
        `${API_URL}/api/jewelry/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Jewelry deleted successfully');
      router.back();
    } catch (error: any) {
      console.error('Failed to delete jewelry:', error);
      Alert.alert('Error', 'Failed to delete jewelry');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    router.push(`/jewelry/edit/${id}`);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!jewelry) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Jewelry item not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{jewelry.name}</Text>
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
        {jewelry.photos && jewelry.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {jewelry.photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setSelectedImageUri(`data:image/jpeg;base64,${photo}`);
                    setImageViewerVisible(true);
                  }}
                >
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${photo}` }}
                    style={styles.photo}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <DetailRow label="Type" value={jewelry.type} />
          {jewelry.metal && <DetailRow label="Metal" value={jewelry.metal} />}
          {jewelry.purity && <DetailRow label="Purity" value={jewelry.purity} />}
          {jewelry.stones && <DetailRow label="Stones/Gems" value={jewelry.stones} />}
          {jewelry.weight && <DetailRow label="Weight" value={`${jewelry.weight} grams`} />}
          {jewelry.certificate_number && <DetailRow label="Certificate Number" value={jewelry.certificate_number} />}
        </View>

        {/* Financial Information */}
        {(jewelry.purchase_date || jewelry.purchase_cost || jewelry.appraisal_value || jewelry.appraisal_date) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Information</Text>
            {jewelry.purchase_date && <DetailRow label="Purchase Date" value={formatDate(jewelry.purchase_date)} />}
            {jewelry.purchase_cost && <DetailRow label="Purchase Cost" value={formatCurrency(jewelry.purchase_cost)} />}
            {jewelry.appraisal_value && <DetailRow label="Appraisal Value" value={formatCurrency(jewelry.appraisal_value)} />}
            {jewelry.appraisal_date && <DetailRow label="Appraisal Date" value={formatDate(jewelry.appraisal_date)} />}
          </View>
        )}

        {/* Warranty */}
        {(jewelry.warranty_info || jewelry.warranty_expiry) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Warranty</Text>
            {jewelry.warranty_info && <DetailRow label="Warranty Info" value={jewelry.warranty_info} />}
            {jewelry.warranty_expiry && <DetailRow label="Warranty Expiry" value={formatDate(jewelry.warranty_expiry)} />}
          </View>
        )}

        {/* Certificate */}
        {jewelry.certificate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certificate</Text>
            <Image
              source={{ uri: `data:image/jpeg;base64,${jewelry.certificate}` }}
              style={styles.certificateImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Notes */}
        {jewelry.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{jewelry.notes}</Text>
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
  certificateImage: {
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
