import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { propertyApi } from '../../services/api';

// API endpoint configuration
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const NOMINATIM_URL = process.env.EXPO_PUBLIC_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  distance: number;
  lat: number;
  lon: number;
  address?: string;
}

interface NearMeScreenProps {
  propertyId: string;
}

const CATEGORY_ICONS: { [key: string]: string } = {
  hospital: 'medical',
  school: 'school',
  mall: 'cart',
  restaurant: 'restaurant',
  bank: 'card',
  pharmacy: 'medkit',
  'fuel_station': 'gas-station',
  'police_station': 'shield',
  default: 'location',
};

const CATEGORY_COLORS: { [key: string]: string } = {
  hospital: '#FF3B30',
  school: '#34C759',
  mall: '#FF9500',
  restaurant: '#FF2D55',
  bank: '#5856D6',
  pharmacy: '#AF52DE',
  'fuel_station': '#007AFF',
  'police_station': '#FF3B30',
  default: '#8E8E93',
};

export default function NearMeScreen({ propertyId }: NearMeScreenProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [property, setProperty] = useState<any>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'hospital', label: 'Hospitals', icon: 'medical' },
    { key: 'school', label: 'Schools', icon: 'school' },
    { key: 'mall', label: 'Shopping', icon: 'cart' },
    { key: 'restaurant', label: 'Restaurants', icon: 'restaurant' },
  ];

  useEffect(() => {
    fetchPropertyAndPlaces();
  }, []);

  const fetchPropertyAndPlaces = async () => {
    try {
      const propertyData = await propertyApi.getById(token!, propertyId);
      setProperty(propertyData);
      
      // Check if property has coordinates stored
      if (propertyData.latitude && propertyData.longitude) {
        await fetchNearbyPlaces(propertyData.latitude, propertyData.longitude);
      } else if (propertyData.address) {
        // Fallback: Geocode the address if coordinates not stored
        await geocodeAndFetchPlaces(propertyData.address);
      } else {
        Alert.alert('Info', 'Property address and coordinates are required to find nearby places');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  };

  const geocodeAndFetchPlaces = async (address: string) => {
    try {
      const geocodeResponse = await fetch(
        `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(address)}`
      );
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.length === 0) {
        Alert.alert('Error', 'Could not find coordinates for this address');
        return;
      }

      const { lat, lon } = geocodeData[0];
      await fetchNearbyPlaces(parseFloat(lat), parseFloat(lon));
    } catch (error: any) {
      console.error('Error geocoding address:', error);
      Alert.alert('Error', 'Failed to find location. Please add coordinates to the property.');
    }
  };

  const fetchNearbyPlaces = async (lat: number, lon: number) => {
    try {
      // Use Google Places API instead of Overpass for better reliability
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      
      if (!apiKey) {
        Alert.alert('Error', 'Google Maps API key not configured');
        return;
      }

      const radius = 2000; // 2km
      const types = ['hospital', 'school', 'shopping_mall', 'restaurant', 'bank', 'pharmacy', 'gas_station', 'police'];
      
      const allPlaces: NearbyPlace[] = [];
      
      // Fetch places for each type via backend proxy to avoid CORS issues
      for (const type of types) {
        try {
          const response = await fetch(
            `${API_URL}/api/places/nearby?lat=${lat}&lon=${lon}&radius=${radius}&place_type=${type}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (!response.ok) {
            console.log(`Failed to fetch ${type}:`, response.status);
            continue;
          }
          
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            data.results.forEach((place: any) => {
              const distance = calculateDistance(
                lat,
                lon,
                place.geometry.location.lat,
                place.geometry.location.lng
              );
              
              // Map Google types to our categories
              let category = type;
              if (type === 'shopping_mall') category = 'mall';
              if (type === 'gas_station') category = 'fuel_station';
              
              allPlaces.push({
                id: place.place_id,
                name: place.name,
                category: category,
                distance: distance,
                lat: place.geometry.location.lat,
                lon: place.geometry.location.lng,
                address: place.vicinity,
              });
            });
          }
        } catch (typeError) {
          console.log(`Error fetching ${type}:`, typeError);
          continue;
        }
      }
      
      // Remove duplicates and sort by distance
      const uniquePlaces = Array.from(
        new Map(allPlaces.map(place => [place.id, place])).values()
      );
      
      uniquePlaces.sort((a, b) => a.distance - b.distance);
      setPlaces(uniquePlaces);
      
      if (uniquePlaces.length === 0) {
        Alert.alert('Info', 'No nearby places found within 2km radius');
      }
    } catch (error: any) {
      console.error('Error fetching nearby places:', error);
      Alert.alert('Error', 'Failed to fetch nearby places. Please try again.');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  const openInMaps = (place: NearbyPlace) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
    Linking.openURL(url);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPropertyAndPlaces();
    setRefreshing(false);
  };

  const filteredPlaces =
    selectedCategory === 'all'
      ? places
      : places.filter((place) => place.category === selectedCategory);

  const renderPlace = ({ item }: { item: NearbyPlace }) => {
    const icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.default;
    const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;

    return (
      <TouchableOpacity
        style={styles.placeCard}
        onPress={() => openInMaps(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.placeIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.placeInfo}>
          <Text style={styles.placeName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.placeCategory}>
            {item.category.replace('_', ' ').toUpperCase()}
          </Text>
          {item.address && (
            <Text style={styles.placeAddress} numberOfLines={1}>
              {item.address}
            </Text>
          )}
        </View>
        <View style={styles.placeDistance}>
          <Text style={styles.distanceText}>{item.distance.toFixed(1)} km</Text>
          <Ionicons name="navigate" size={20} color="#007AFF" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Finding nearby places...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCategory === item.key && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Ionicons
                name={item.icon as any}
                size={18}
                color={selectedCategory === item.key ? '#fff' : '#007AFF'}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === item.key && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Places List */}
      {filteredPlaces.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No places found nearby</Text>
          <Text style={styles.emptySubtext}>
            Try changing the filter or check back later
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlaces}
          keyExtractor={(item) => item.id}
          renderItem={renderPlace}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterChipText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  placeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  placeCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 13,
    color: '#8E8E93',
  },
  placeDistance: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
