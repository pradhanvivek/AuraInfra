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

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Jewelry {
  id: string;
  name: string;
  type?: string;
  metal?: string;
  stones?: string;
  appraisal_value?: number;
  photos: string[];
  warranty_expiry_date?: string;
}

export default function JewelryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [jewelry, setJewelry] = useState<Jewelry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJewelry();
  }, []);

  const fetchJewelry = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/jewelry`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJewelry(response.data);
    } catch (error) {
      console.error('Error fetching jewelry:', error);
      Alert.alert('Error', 'Failed to load jewelry');
    } finally {
      setLoading(false);
    }
  };

  const renderJewelry = ({ item }: { item: Jewelry }) => (
    <TouchableOpacity
      style={styles.jewelryCard}
      onPress={() => router.push(`/jewelry/${item.id}` as any)}
    >
      {item.photos && item.photos.length > 0 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.photos[0]}` }}
          style={styles.jewelryImage}
        />
      ) : (
        <View style={[styles.jewelryImage, styles.placeholderImage]}>
          <Ionicons name="diamond" size={48} color="#C7C7CC" />
        </View>
      )}
      <View style={styles.jewelryInfo}>
        <Text style={styles.jewelryName}>{item.name}</Text>
        {item.type && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.type}</Text>
          </View>
        )}
        {(item.metal || item.stones) && (
          <View style={styles.detailsRow}>
            {item.metal && (
              <View style={styles.detailBadge}>
                <Ionicons name="sparkles" size={12} color="#FF9500" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.metal}</Text>
              </View>
            )}
            {item.stones && (
              <View style={styles.detailBadge}>
                <Ionicons name="diamond-outline" size={12} color="#FF2D55" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.stones}</Text>
              </View>
            )}
          </View>
        )}
        {item.appraisal_value && (
          <Text style={styles.jewelryValue}>${item.appraisal_value.toLocaleString()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF2D55" />
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
          <Text style={styles.headerTitle}>Jewelry & Collectibles</Text>
          <Image 
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

      <FlatList
        data={jewelry}
        renderItem={renderJewelry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="diamond-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No jewelry yet</Text>
            <Text style={styles.emptySubtext}>Add your first item</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.scanFab}
        onPress={() => router.push('/jewelry/add?mode=scan' as any)}
      >
        <Ionicons name="camera" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/jewelry/add' as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
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
    padding: 16,
    paddingTop: 0,
  },
  jewelryCard: {
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
  jewelryImage: {
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
  jewelryInfo: {
    flex: 1,
  },
  jewelryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#FFE5F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  typeText: {
    fontSize: 12,
    color: '#FF2D55',
    fontWeight: 'bold',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    maxWidth: '45%',
  },
  detailText: {
    fontSize: 11,
    color: '#8E8E93',
    flexShrink: 1,
  },
  jewelryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF2D55',
    marginTop: 8,
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
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});