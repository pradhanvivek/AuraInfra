import 'react-native-get-random-values';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { propertyApi } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrencyInfo } from '../../utils/localeUtils';

// Conditional import for GooglePlacesAutocomplete (mobile only)
let GooglePlacesAutocomplete: any = null;
if (Platform.OS !== 'web') {
  GooglePlacesAutocomplete = require('react-native-google-places-autocomplete').GooglePlacesAutocomplete;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || Constants.expoConfig?.extra?.googleMapsApiKey || '';

export default function AddProperty() {
  const router = useRouter();
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [purchaseCost, setPurchaseCost] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [ownershipType, setOwnershipType] = useState<'owner' | 'tenant'>('owner');
  const [loading, setLoading] = useState(false);
  const autocompleteRef = useRef<any>(null);

  const handleSubmit = async () => {
    if (!name || !address) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await propertyApi.create(token!, { 
        name, 
        address,
        latitude,
        longitude,
        purchase_cost: purchaseCost ? parseFloat(purchaseCost) : undefined,
        current_value: currentValue ? parseFloat(currentValue) : undefined,
        ownership_type: ownershipType,
      });
      Alert.alert('Success', 'Property added successfully');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with Back and Cancel */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Property</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.section}>
            <Text style={styles.label}>Property Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., My Home, Office Building"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Ownership Type</Text>
            <View style={styles.ownershipSelector}>
              <TouchableOpacity
                style={[
                  styles.ownershipOption,
                  ownershipType === 'owner' && styles.ownershipOptionActive
                ]}
                onPress={() => setOwnershipType('owner')}
                disabled={loading}
              >
                <Ionicons 
                  name={ownershipType === 'owner' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={24} 
                  color={ownershipType === 'owner' ? '#007AFF' : '#8E8E93'} 
                />
                <Text style={[
                  styles.ownershipText,
                  ownershipType === 'owner' && styles.ownershipTextActive
                ]}>
                  Owner
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.ownershipOption,
                  ownershipType === 'tenant' && styles.ownershipOptionActive
                ]}
                onPress={() => setOwnershipType('tenant')}
                disabled={loading}
              >
                <Ionicons 
                  name={ownershipType === 'tenant' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={24} 
                  color={ownershipType === 'tenant' ? '#007AFF' : '#8E8E93'} 
                />
                <Text style={[
                  styles.ownershipText,
                  ownershipType === 'tenant' && styles.ownershipTextActive
                ]}>
                  Tenant
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Address</Text>
            {GOOGLE_MAPS_API_KEY && GooglePlacesAutocomplete && Platform.OS !== 'web' ? (
              <GooglePlacesAutocomplete
                ref={autocompleteRef}
                placeholder="Search for address..."
                minLength={2}
                fetchDetails={true}
                predefinedPlaces={[]}
                onPress={(data: any, details: any = null) => {
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
                  autoFocus: false,
                  placeholder: "Search for address...",
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

          <View style={styles.section}>
            <Text style={styles.label}>Purchase Cost (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={`${getCurrencyInfo().symbol}0`}
              value={purchaseCost}
              onChangeText={setPurchaseCost}
              keyboardType="decimal-pad"
              editable={!loading}
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
              editable={!loading}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoText}>
              Select an address from the dropdown to automatically capture coordinates for accurate nearby place suggestions.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Add Property</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  cancelText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  coordinatesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    marginTop: 16,
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
    marginTop: 16,
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
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ownershipSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  ownershipOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  ownershipOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  ownershipText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
    fontWeight: '500',
  },
  ownershipTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
