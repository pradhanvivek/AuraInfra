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

interface Art {
  id: string;
  name: string;
  type: string;
  artist?: string;
  medium?: string;
  dimensions?: string;
  year_created?: number;
  purchase_date?: string;
  purchase_cost?: number;
  current_value?: number;
  appraisal_value?: number;
  appraisal_date?: string;
  authenticity_certificate?: string;
  provenance?: string;
  photos: string[];
  notes?: string;
}

export default function ArtDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [art, setArt] = useState<Art | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    fetchArt();
  }, [id]);

  const fetchArt = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/art/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setArt(response.data);
    } catch (error) {
      console.error('Error fetching art:', error);
      Alert.alert('Error', 'Failed to load art details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push(`/art/add?id=${id}`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Art',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/art/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Art deleted successfully');
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete art');
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
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  if (!art) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Art Details</Text>
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
        {art.photos && art.photos.length > 0 && (
          <View style={styles.photosSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {art.photos.map((photo, index) => {
                // Smart image source detection
                const getImageSource = (photoData: string) => {
                  if (photoData.startsWith('data:')) {
                    return { uri: photoData };
                  }
                  if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
                    return { uri: photoData };
                  }
                  return { uri: `data:image/jpeg;base64,${photoData}` };
                };

                return (
                  <TouchableOpacity key={index} onPress={() => openImageViewer(index)}>
                    <Image
                      source={getImageSource(photo)}
                      style={styles.photo}
                      onError={(error) => {
                        console.error(`Failed to load photo ${index}:`, error.nativeEvent?.error);
                      }}
                      onLoad={() => {
                        console.log(`Successfully loaded photo ${index}`);
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.name}>{art.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{art.type}</Text>
          </View>
        </View>

        {(art.artist || art.medium || art.dimensions || art.year_created) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            {art.artist && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={20} color="#5856D6" />
                <Text style={styles.detailLabel}>Artist:</Text>
                <Text style={styles.detailValue}>{art.artist}</Text>
              </View>
            )}
            {art.medium && (
              <View style={styles.detailRow}>
                <Ionicons name="brush" size={20} color="#FF2D55" />
                <Text style={styles.detailLabel}>Medium:</Text>
                <Text style={styles.detailValue}>{art.medium}</Text>
              </View>
            )}
            {art.dimensions && (
              <View style={styles.detailRow}>
                <Ionicons name="resize" size={20} color="#FF9500" />
                <Text style={styles.detailLabel}>Dimensions:</Text>
                <Text style={styles.detailValue}>{art.dimensions}</Text>
              </View>
            )}
            {art.year_created && (
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={20} color="#007AFF" />
                <Text style={styles.detailLabel}>Year Created:</Text>
                <Text style={styles.detailValue}>{art.year_created}</Text>
              </View>
            )}
          </View>
        )}

        {(art.purchase_date || art.purchase_cost || art.current_value || art.appraisal_value) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial</Text>
            {art.purchase_date && (
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={20} color="#007AFF" />
                <Text style={styles.detailLabel}>Purchase Date:</Text>
                <Text style={styles.detailValue}>{art.purchase_date}</Text>
              </View>
            )}
            {art.purchase_cost && (
              <View style={styles.detailRow}>
                <Ionicons name="cash" size={20} color="#34C759" />
                <Text style={styles.detailLabel}>Purchase Cost:</Text>
                <Text style={styles.detailValue}>${art.purchase_cost.toLocaleString()}</Text>
              </View>
            )}
            {art.current_value && (
              <View style={styles.detailRow}>
                <Ionicons name="trending-up" size={20} color="#FF9500" />
                <Text style={styles.detailLabel}>Current Value:</Text>
                <Text style={styles.detailValue}>${art.current_value.toLocaleString()}</Text>
              </View>
            )}
            {art.appraisal_value && (
              <View style={styles.detailRow}>
                <Ionicons name="ribbon" size={20} color="#5856D6" />
                <Text style={styles.detailLabel}>Appraisal Value:</Text>
                <Text style={styles.detailValue}>${art.appraisal_value.toLocaleString()}</Text>
              </View>
            )}
            {art.appraisal_date && (
              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color="#8E8E93" />
                <Text style={styles.detailLabel}>Appraisal Date:</Text>
                <Text style={styles.detailValue}>{art.appraisal_date}</Text>
              </View>
            )}
          </View>
        )}

        {art.provenance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Provenance</Text>
            <Text style={styles.notes}>{art.provenance}</Text>
          </View>
        )}

        {art.authenticity_certificate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authenticity Certificate</Text>
            <TouchableOpacity onPress={() => openImageViewer(art.photos.length)}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${art.authenticity_certificate}` }}
                style={styles.certificateImage}
              />
            </TouchableOpacity>
          </View>
        )}

        {art.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{art.notes}</Text>
          </View>
        )}
      </ScrollView>

      {imageViewerVisible && (
        <ImageViewer
          images={[...art.photos, ...(art.authenticity_certificate ? [art.authenticity_certificate] : [])]}
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
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 14,
    color: '#5856D6',
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
  certificateImage: {
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
