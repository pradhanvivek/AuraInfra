import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageViewer from '../../components/ImageViewer';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Furniture {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  material?: string;
  dimensions?: string;
  room_location?: string;
  condition?: string;
  purchase_date?: string;
  purchase_cost?: number;
  current_value?: number;
  warranty_info?: string;
  warranty_expiry_date?: string;
  photos: string[];
  invoice?: string;
  notes?: string;
}

export default function FurnitureDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [furniture, setFurniture] = useState<Furniture | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    fetchFurniture();
  }, [id]);

  const fetchFurniture = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/furniture/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFurniture(response.data);
    } catch (error) {
      console.error('Error fetching furniture:', error);
      Alert.alert('Error', 'Failed to load furniture details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push(`/furniture/add?id=${id}`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Furniture',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/furniture/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Furniture deleted successfully');
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete furniture');
            }
          },
        },
      ]
    );
  };

  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  if (!furniture) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Furniture Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.iconButton}>
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {furniture.photos && furniture.photos.length > 0 && (
          <View style={styles.photosSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {furniture.photos.map((photo, index) => (
                <TouchableOpacity key={index} onPress={() => openImageViewer(index)}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${photo}` }}
                    style={styles.photo}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.name}>{furniture.name}</Text>
          {furniture.category && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{furniture.category}</Text>
            </View>
          )}
        </View>

        {(furniture.brand || furniture.material || furniture.dimensions) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            {furniture.brand && (
              <View style={styles.detailRow}>
                <Ionicons name="business" size={20} color="#007AFF" />
                <Text style={styles.detailLabel}>Brand:</Text>
                <Text style={styles.detailValue}>{furniture.brand}</Text>
              </View>
            )}
            {furniture.material && (
              <View style={styles.detailRow}>
                <Ionicons name="hammer" size={20} color="#FF9500" />
                <Text style={styles.detailLabel}>Material:</Text>
                <Text style={styles.detailValue}>{furniture.material}</Text>
              </View>
            )}
            {furniture.dimensions && (
              <View style={styles.detailRow}>
                <Ionicons name="resize" size={20} color="#34C759" />
                <Text style={styles.detailLabel}>Dimensions:</Text>
                <Text style={styles.detailValue}>{furniture.dimensions}</Text>
              </View>
            )}
            {furniture.room_location && (
              <View style={styles.detailRow}>
                <Ionicons name="location" size={20} color="#5856D6" />
                <Text style={styles.detailLabel}>Room:</Text>
                <Text style={styles.detailValue}>{furniture.room_location}</Text>
              </View>
            )}
            {furniture.condition && (
              <View style={styles.detailRow}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.detailLabel}>Condition:</Text>
                <Text style={styles.detailValue}>{furniture.condition}</Text>
              </View>
            )}
          </View>
        )}

        {(furniture.purchase_date || furniture.purchase_cost || furniture.current_value) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial</Text>
            {furniture.purchase_date && (
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={20} color="#007AFF" />
                <Text style={styles.detailLabel}>Purchase Date:</Text>
                <Text style={styles.detailValue}>{furniture.purchase_date}</Text>
              </View>
            )}
            {furniture.purchase_cost && (
              <View style={styles.detailRow}>
                <Ionicons name="cash" size={20} color="#34C759" />
                <Text style={styles.detailLabel}>Purchase Cost:</Text>
                <Text style={styles.detailValue}>${furniture.purchase_cost.toLocaleString()}</Text>
              </View>
            )}
            {furniture.current_value && (
              <View style={styles.detailRow}>
                <Ionicons name="trending-up" size={20} color="#FF9500" />
                <Text style={styles.detailLabel}>Current Value:</Text>
                <Text style={styles.detailValue}>${furniture.current_value.toLocaleString()}</Text>
              </View>
            )}
          </View>
        )}

        {(furniture.warranty_info || furniture.warranty_expiry_date) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Warranty</Text>
            {furniture.warranty_info && (
              <View style={styles.detailRow}>
                <Ionicons name="shield-checkmark" size={20} color="#34C759" />
                <Text style={styles.detailLabel}>Info:</Text>
                <Text style={styles.detailValue}>{furniture.warranty_info}</Text>
              </View>
            )}
            {furniture.warranty_expiry_date && (
              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color="#FF9500" />
                <Text style={styles.detailLabel}>Expires:</Text>
                <Text style={styles.detailValue}>{furniture.warranty_expiry_date}</Text>
              </View>
            )}
          </View>
        )}

        {furniture.invoice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice</Text>
            <TouchableOpacity onPress={() => openImageViewer(furniture.photos.length)}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${furniture.invoice}` }}
                style={styles.invoiceImage}
              />
            </TouchableOpacity>
          </View>
        )}

        {furniture.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{furniture.notes}</Text>
          </View>
        )}
      </ScrollView>

      {imageViewerVisible && (
        <ImageViewer
          images={[...furniture.photos, ...(furniture.invoice ? [furniture.invoice] : [])]}
          initialIndex={selectedImageIndex}
          onClose={() => setImageViewerVisible(false)}
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  photosSection: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  photosScroll: {
    padding: 16,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
    minWidth: 120,
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  invoiceImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  notes: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
});
