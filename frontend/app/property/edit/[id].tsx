import 'react-native-get-random-values';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Constants from 'expo-constants';
import { useAuth } from '../../../contexts/AuthContext';
import { propertyApi } from '../../../services/api';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || Constants.expoConfig?.extra?.googleMapsApiKey || '';

export default function EditPropertyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    fetchProperty();
  }, []);

  const fetchProperty = async () => {
    try {
      const property = await propertyApi.getById(token!, id!);
      setName(property.name);
      setAddress(property.address);
      setLatitude(property.latitude);
      setLongitude(property.longitude);
      
      // Set the address in GooglePlacesAutocomplete after a short delay
      setTimeout(() => {
        if (autocompleteRef.current) {
          autocompleteRef.current.setAddressText(property.address);
        }
      }, 100);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load property details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a property name');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    setSaving(true);
    try {
      await propertyApi.update(token!, id!, {
        name: name.trim(),
        address: address.trim(),
        latitude,
        longitude,
      });
      Alert.alert('Success', 'Property updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Property</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
          <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.formContainer}>
          <View style={styles.section}>
            <Text style={styles.label}>Property Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., My Home, Office Building"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Address</Text>
            {GOOGLE_MAPS_API_KEY ? (
              <GooglePlacesAutocomplete
                ref={autocompleteRef}
                placeholder="Search for address..."
                minLength={2}
                fetchDetails={true}
                predefinedPlaces={[]}
                onPress={(data, details = null) => {
                  if (details) {
                    setAddress(data.description);
                    setLatitude(details.geometry.location.lat);
                    setLongitude(details.geometry.location.lng);
                  }
                }}
                query={{
                  key: GOOGLE_MAPS_API_KEY,
                  language: 'en',
                }}
                styles={{
                  container: {
                    flex: 0,
                  },
                  textInputContainer: {
                    backgroundColor: '#F2F2F7',
                    borderTopWidth: 0,
                    borderBottomWidth: 0,
                  },
                  textInput: {
                    height: 48,
                    color: '#000',
                    fontSize: 16,
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    borderWidth: 1,
                    borderColor: '#E5E5EA',
                  },
                  listView: {
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    marginTop: 8,
                    elevation: 3,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    maxHeight: 200,
                  },
                  row: {
                    backgroundColor: '#fff',
                    padding: 13,
                    height: 60,
                    flexDirection: 'row',
                  },
                  separator: {
                    height: 1,
                    backgroundColor: '#F2F2F7',
                  },
                  description: {
                    fontSize: 14,
                  },
                  predefinedPlacesDescription: {
                    color: '#007AFF',
                  },
                }}
                textInputProps={{
                  value: address,
                  onChangeText: setAddress,
                }}
                listViewDisplayed="auto"
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                renderRow={(rowData) => {
                  const title = rowData.structured_formatting.main_text;
                  const address = rowData.structured_formatting.secondary_text;
                  return (
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{title}</Text>
                      <Text style={{ fontSize: 12, color: '#8E8E93' }}>{address}</Text>
                    </View>
                  );
                }}
                enablePoweredByContainer={false}
                debounce={300}
                onFail={(error) => console.error('Google Places Error:', error)}
                requestUrl={{
                  useOnPlatform: 'web',
                  url: 'https://cors-anywhere.herokuapp.com/https://maps.googleapis.com/maps/api',
                }}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Enter full address"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </View>

          {latitude && longitude && (
            <View style={styles.coordinatesCard}>
              <Ionicons name="location" size={20} color="#007AFF" />
              <View style={styles.coordinatesText}>
                <Text style={styles.coordinatesLabel}>Coordinates</Text>
                <Text style={styles.coordinatesValue}>
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Select an address from the dropdown to automatically capture coordinates for accurate nearby place suggestions.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    padding: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonTextDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  coordinatesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  coordinatesText: {
    marginLeft: 12,
    flex: 1,
  },
  coordinatesLabel: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  coordinatesValue: {
    fontSize: 14,
    color: '#000',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
});
