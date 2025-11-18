import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { formatCurrency } from '../utils/localeUtils';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_f39f8d1e-b9ca-4840-9416-b6502fc8ae5e/artifacts/pyxhwxcq_Screenshot%202025-11-03%20at%201.19.46%E2%80%AFPM.png';

interface Appliance {
  id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  current_value?: number;
  photos: string[];
  warranty_expiry_date?: string;
  next_maintenance_date?: string;
}

export default function AppliancesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppliances();
  }, []);

  const fetchAppliances = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/appliances`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAppliances(response.data);
    } catch (error) {
      console.error('Error fetching appliances:', error);
      Alert.alert('Error', 'Failed to load appliances');
    } finally {
      setLoading(false);
    }
  };

  const getWarrantyStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const isExpired = new Date(expiryDate) < new Date();
    return {
      expired: isExpired,
      color: isExpired ? '#FF3B30' : '#34C759',
      text: isExpired ? 'Expired' : 'Active',
    };
  };

  const renderAppliance = ({ item }: { item: Appliance }) => {
    const warrantyStatus = getWarrantyStatus(item.warranty_expiry_date);
    
    return (
      <TouchableOpacity
        style={styles.applianceCard}
        onPress={() => router.push(`/appliance/${item.id}` as any)}
      >
        {item.photos && item.photos.length > 0 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.photos[0]}` }}
            style={styles.applianceImage}
          />
        ) : (
          <View style={[styles.applianceImage, styles.placeholderImage]}>
            <Ionicons name="tv" size={48} color="#C7C7CC" />
          </View>
        )}
        <View style={styles.applianceInfo}>
          <Text style={styles.applianceName}>{item.name}</Text>
          <Text style={styles.applianceCategory}>{item.category}</Text>
          {(item.brand || item.model) && (
            <Text style={styles.applianceDetails}>
              {item.brand} {item.model}
            </Text>
          )}
          {item.current_value && (
            <Text style={styles.applianceValue}>{formatCurrency(item.current_value)}</Text>
          )}
          {warrantyStatus && (
            <View style={[styles.warrantyBadge, { backgroundColor: warrantyStatus.color + '20' }]}>
              <Ionicons
                name={warrantyStatus.expired ? 'alert-circle' : 'checkmark-circle'}
                size={14}
                color={warrantyStatus.color}
              />
              <Text style={[styles.warrantyText, { color: warrantyStatus.color }]}>
                {warrantyStatus.text}
              </Text>
            </View>
          )}
          {item.next_maintenance_date && (
            <View style={styles.maintenanceBadge}>
              <Ionicons name="build" size={14} color="#FF9500" />
              <Text style={styles.maintenanceText}>
                Next: {new Date(item.next_maintenance_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appliances</Text>
          <Image 
            source={{ uri: LOGO_URL }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

      <FlatList
        data={appliances}
        renderItem={renderAppliance}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="tv-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No appliances yet</Text>
            <Text style={styles.emptySubtext}>Add your first appliance</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.scanFab}
        onPress={() => router.push('/appliance/add?mode=scan' as any)}
      >
        <Ionicons name="camera" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/appliance/add' as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    height: 50,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  logo: {
    width: 80,
    height: 80,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  applianceCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  applianceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applianceInfo: {
    flex: 1,
  },
  applianceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  applianceCategory: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  applianceDetails: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  applianceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 4,
  },
  warrantyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  warrantyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  maintenanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  maintenanceText: {
    fontSize: 12,
    color: '#FF9500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  scanFab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});