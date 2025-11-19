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
import Constants from 'expo-constants';
import { useAuth } from '../../../contexts/AuthContext';
import { propertyApi } from '../../../services/api';
import { getCurrencyInfo } from '../../../utils/localeUtils';

// Conditional import for GooglePlacesAutocomplete (mobile only)
let GooglePlacesAutocomplete: any = null;
if (Platform.OS !== 'web') {
  GooglePlacesAutocomplete = require('react-native-google-places-autocomplete').GooglePlacesAutocomplete;
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || Constants.expoConfig?.extra?.googleMapsApiKey || '';

export default function EditPropertyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [savedAddress, setSavedAddress] = useState(''); // Original address from DB - display only
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  
  const autocompleteRef = useRef<any>(null);
  
  // Web autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    fetchProperty();
  }, []);

  const fetchProperty = async () => {
    try {
      const property = await propertyApi.getById(token!, id!);
      console.log('Property fetched:', property.name, 'Address:', property.address);
      setName(property.name);
      setAddress(property.address || '');
      setSavedAddress(property.address || ''); // Store original address for display
      setLatitude(property.latitude);
      setLongitude(property.longitude);
      setPurchaseCost(property.purchase_cost ? property.purchase_cost.toString() : '');
      setCurrentValue(property.current_value ? property.current_value.toString() : '');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load property details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Web-specific autocomplete functions using backend proxy
  const fetchPlaceSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/places/autocomplete?input=${encodeURIComponent(input)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.predictions) {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const fetchPlaceDetails = async (placeId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/api/places/details?place_id=${placeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.result) {
        const location = data.result.geometry.location;
        setLatitude(location.lat);
        setLongitude(location.lng);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    if (Platform.OS === 'web') {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        fetchPlaceSuggestions(text);
      }, 300);
    }
  };

  const selectSuggestion = (suggestion: any) => {
    setAddress(suggestion.description);
    setSavedAddress(suggestion.description); // Update display address
    setShowSuggestions(false);
    setSuggestions([]);
    if (suggestion.place_id) {
      fetchPlaceDetails(suggestion.place_id);
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
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        current_value: currentValue ? parseFloat(currentValue) : undefined,
      });
      
      // Platform-specific success message
      if (Platform.OS === 'web') {
        alert('✓ Property details saved successfully!');
        router.back();
      } else {
        Alert.alert('Success', 'Property details saved successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to update property');
      } else {
        Alert.alert('Error', error.message || 'Failed to update property');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    // Platform-specific confirmation handling
    if (Platform.OS === 'web') {
      // Use window.confirm for web
      const confirmed = window.confirm(
        'Are you sure you want to delete this property? This will also delete all documents, fixtures, and measurements.'
      );
      
      if (confirmed) {
        try {
          await propertyApi.delete(token!, id!);
          alert('Property deleted successfully');
          router.replace('/(tabs)');
        } catch (error: any) {
          alert(error.message || 'Failed to delete property');
        }
      }
    } else {
      // Use Alert.alert for mobile
      Alert.alert(
        'Delete Property',
        'Are you sure you want to delete this property? This will also delete all documents, fixtures, and measurements.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await propertyApi.delete(token!, id!);
                Alert.alert('Success', 'Property deleted successfully', [
                  { text: 'OK', onPress: () => router.replace('/(tabs)') }
                ]);
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to delete property');
              }
            },
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log('RENDERING - address state:', address, 'length:', address?.length);

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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
            {Platform.OS === 'web' && GOOGLE_MAPS_API_KEY ? (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Search for address..."
                  value={address}
                  onChangeText={handleAddressChange}
                  autoCapitalize="words"
                  editable={!saving}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="handled">
                      {suggestions.map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => selectSuggestion(suggestion)}
                        >
                          <Ionicons name="location-outline" size={20} color="#007AFF" />
                          <View style={styles.suggestionText}>
                            <Text style={styles.suggestionMain}>
                              {suggestion.structured_formatting?.main_text || suggestion.description}
                            </Text>
                            {suggestion.structured_formatting?.secondary_text && (
                              <Text style={styles.suggestionSecondary}>
                                {suggestion.structured_formatting.secondary_text}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : GOOGLE_MAPS_API_KEY && GooglePlacesAutocomplete && Platform.OS !== 'web' ? (
              <View>
                <View style={styles.currentAddressDisplay}>
                  <Text style={styles.currentAddressLabel}>Current Address:</Text>
                  {savedAddress && savedAddress.trim() !== '' ? (
                    <Text style={styles.currentAddressValue}>{savedAddress}</Text>
                  ) : (
                    <Text style={styles.noAddressText}>No address saved yet. Search below to add one.</Text>
                  )}
                </View>
                <Text style={styles.searchLabel}>Search for new address (optional):</Text>
                <GooglePlacesAutocomplete
                  ref={autocompleteRef}
                  placeholder="Search for address..."
                  minLength={2}
                  fetchDetails={true}
                  predefinedPlaces={[]}
                  listViewDisplayed={false}
                  onPress={(data: any, details: any = null) => {
                    if (details) {
                      setAddress(data.description);
                      setSavedAddress(data.description); // Update display address
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
                  placeholder: "Search for new address...",
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
              </View>
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

          {/* Coordinates hidden - stored in backend */}

          <View style={styles.section}>
            <Text style={styles.label}>Purchase Cost (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={`${getCurrencyInfo().symbol}0`}
              value={purchaseCost}
              onChangeText={setPurchaseCost}
              keyboardType="decimal-pad"
              editable={!saving}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Current Value (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={`${getCurrencyInfo().symbol}0`}
              value={currentValue}
              onChangeText={setCurrentValue}
              keyboardType="decimal-pad"
              editable={!saving}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Select an address from the dropdown to automatically capture coordinates for accurate nearby place suggestions.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Property</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  currentAddressNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  currentAddressText: {
    flex: 1,
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  currentAddressDisplay: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  currentAddressLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentAddressValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
    lineHeight: 22,
  },
  noAddressText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  searchLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 32,
    gap: 8,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  suggestionText: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionMain: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  suggestionSecondary: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
