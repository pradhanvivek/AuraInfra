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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { useCallback } from 'react';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Furniture {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  material?: string;
  room_location?: string;
  current_value?: number;
  photos: string[];
}

export default function FurnitureScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFurniture = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/furniture`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFurniture(response.data);
    } catch (error) {
      console.error('Error fetching furniture:', error);
      Alert.alert('Error', 'Failed to load furniture');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFurniture();
    }, [token])
  );

  const renderFurniture = ({ item }: { item: Furniture }) => (
    <TouchableOpacity
      style={styles.furnitureCard}
      onPress={() => router.push(`/furniture/${item.id}` as any)}
    >
      {item.photos && item.photos.length > 0 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.photos[0]}` }}
          style={styles.furnitureImage}
        />
      ) : (
        <View style={[styles.furnitureImage, styles.placeholderImage]}>
          <Ionicons name="bed" size={48} color="#C7C7CC" />
        </View>
      )}
      <View style={styles.furnitureInfo}>
        <Text style={styles.furnitureName}>{item.name}</Text>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        {(item.brand || item.material || item.room_location) && (
          <View style={styles.detailsRow}>
            {item.brand && (
              <View style={styles.detailBadge}>
                <Ionicons name="business" size={12} color="#007AFF" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.brand}</Text>
              </View>
            )}
            {item.material && (
              <View style={styles.detailBadge}>
                <Ionicons name="hammer" size={12} color="#FF9500" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.material}</Text>
              </View>
            )}
            {item.room_location && (
              <View style={styles.detailBadge}>
                <Ionicons name="location" size={12} color="#34C759" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.room_location}</Text>
              </View>
            )}
          </View>
        )}
        {item.current_value && (
          <Text style={styles.furnitureValue}>${item.current_value.toLocaleString()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Furniture</Text>
        <Image 
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <FlatList
        data={furniture}
        renderItem={renderFurniture}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bed-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No furniture yet</Text>
            <Text style={styles.emptySubtext}>Add your first item</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/furniture/add' as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fab, { bottom: 96, backgroundColor: '#FF9500' }]}
        onPress={() => router.push('/furniture/add?mode=scan' as any)}
      >
        <Ionicons name="scan" size={28} color="#fff" />
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
  furnitureCard: {
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
  furnitureImage: {
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
  furnitureInfo: {
    flex: 1,
  },
  furnitureName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#34C759',
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
  furnitureValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
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
