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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { useCallback } from 'react';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_95500ee6-6a87-4222-9712-857c1f99b6e3/artifacts/6qjibbhd_logo-new-over.webp';
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Art {
  id: string;
  name: string;
  type: string;
  artist?: string;
  medium?: string;
  year_created?: number;
  appraisal_value?: number;
  photos: string[];
}

export default function ArtScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [art, setArt] = useState<Art[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArt = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/art`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setArt(response.data);
    } catch (error) {
      console.error('Error fetching art:', error);
      Alert.alert('Error', 'Failed to load art');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchArt();
    }, [token])
  );

  const renderArt = ({ item }: { item: Art }) => (
    <TouchableOpacity
      style={styles.artCard}
      onPress={() => router.push(`/art/${item.id}` as any)}
    >
      {item.photos && item.photos.length > 0 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.photos[0]}` }}
          style={styles.artImage}
        />
      ) : (
        <View style={[styles.artImage, styles.placeholderImage]}>
          <Ionicons name="color-palette" size={48} color="#C7C7CC" />
        </View>
      )}
      <View style={styles.artInfo}>
        <Text style={styles.artName}>{item.name}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
        {(item.artist || item.medium || item.year_created) && (
          <View style={styles.detailsRow}>
            {item.artist && (
              <View style={styles.detailBadge}>
                <Ionicons name="person" size={12} color="#5856D6" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.artist}</Text>
              </View>
            )}
            {item.medium && (
              <View style={styles.detailBadge}>
                <Ionicons name="brush" size={12} color="#FF2D55" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">{item.medium}</Text>
              </View>
            )}
            {item.year_created && (
              <View style={styles.detailBadge}>
                <Ionicons name="calendar" size={12} color="#FF9500" />
                <Text style={styles.detailText}>{item.year_created}</Text>
              </View>
            )}
          </View>
        )}
        {item.appraisal_value && (
          <Text style={styles.artValue}>${item.appraisal_value.toLocaleString()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Art & Collectibles</Text>
        <Image 
          source={{ uri: LOGO_URL }}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <FlatList
        data={art}
        renderItem={renderArt}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="color-palette-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No art yet</Text>
            <Text style={styles.emptySubtext}>Add your first piece</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/art/add' as any)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fab, { bottom: 96, backgroundColor: '#FF9500' }]}
        onPress={() => router.push('/art/add?mode=scan' as any)}
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
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
  },
  logo: {
    width: 80,
    height: 80,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  list: {
    padding: 16,
  },
  artCard: {
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
  artImage: {
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
  artInfo: {
    flex: 1,
  },
  artName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  typeText: {
    fontSize: 12,
    color: '#5856D6',
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
  artValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5856D6',
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
    backgroundColor: '#5856D6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
