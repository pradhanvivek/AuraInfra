import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import { useAppTour } from '../../components/AppTour';

interface UserProfile {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  avatar?: string;
  warranty_reminder_days: number;
  geomancy_preference: string;
  country?: string;
  currency_preference?: string;
  measurement_system?: string;
  is_super_admin?: boolean;
  is_hoa_admin?: boolean;
  managed_properties?: string[];
  created_at: string;
}

export default function Profile() {
  const router = useRouter();
  const { username, logout, token, loading: authLoading } = useAuth();
  const { resetTour } = useAppTour();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchComplete, setFetchComplete] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [warrantyModalVisible, setWarrantyModalVisible] = useState(false);
  const [selectedReminderDays, setSelectedReminderDays] = useState(30);
  const [geomancyModalVisible, setGeomancyModalVisible] = useState(false);
  const [selectedGeomancy, setSelectedGeomancy] = useState<'vastu' | 'feng_shui'>('vastu');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [measurementModalVisible, setMeasurementModalVisible] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<'metric' | 'imperial'>('metric');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<'India' | 'US' | 'UK' | 'Canada' | 'Australia' | 'UAE'>('India');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    // Only fetch profile once when auth is ready and we haven't fetched yet
    if (!authLoading && !fetchComplete) {
      if (token && token !== 'null' && token.length > 10) {
        fetchProfile();
      } else {
        setLoading(false);
        setFetchComplete(true);
      }
    }
  }, [authLoading, fetchComplete]); // Removed token dependency to prevent Safari reference issues

  const fetchProfile = async () => {
    if (!token || token === 'null' || token.length < 10) {
      setLoading(false);
      setFetchComplete(true);
      return;
    }
    
    try {
      const data = await authApi.getProfile(token);
      setProfile(data);
      setSelectedReminderDays(data.warranty_reminder_days || 30);
      setSelectedGeomancy(data.geomancy_preference || 'vastu');
      setSelectedCountry(data.country || 'India');
      setSelectedCurrency(data.currency_preference || 'INR');
      setSelectedMeasurement(data.measurement_system || 'metric');
      
      // Store preferences using the helper functions from localeUtils
      const { setCurrencyPreference, setMeasurementPreference, initializePreferences } = await import('../../utils/localeUtils');
      
      console.log('Profile data received:', {
        currency_preference: data.currency_preference,
        measurement_system: data.measurement_system
      });
      
      if (data.currency_preference) {
        await setCurrencyPreference(data.currency_preference);
        console.log('Currency preference set to:', data.currency_preference);
      } else {
        console.log('No currency preference in profile data, defaulting to INR');
        await setCurrencyPreference('INR');
      }
      
      if (data.measurement_system) {
        await setMeasurementPreference(data.measurement_system);
        console.log('Measurement preference set to:', data.measurement_system);
      } else {
        console.log('No measurement preference in profile data, defaulting to metric');
        await setMeasurementPreference('metric');
      }
      
      // Re-initialize preferences to update cache
      await initializePreferences();
      console.log('Preferences reinitialized after profile fetch');
      
      setFetchComplete(true);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
      setFetchComplete(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (field: 'email' | 'phone') => {
    setEditField(field);
    setEditValue(field === 'email' ? profile?.email || '' : profile?.phone || '');
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editValue.trim() && editField) {
      Alert.alert('Error', `Please enter a valid ${editField}`);
      return;
    }

    setSaving(true);
    try {
      const updateData = editField === 'email' 
        ? { email: editValue.trim() }
        : { phone: editValue.trim() };
      
      const updatedProfile = await authApi.updateProfile(token!, updateData);
      setProfile(updatedProfile);
      setEditModalVisible(false);
      Alert.alert('Success', `${editField === 'email' ? 'Email' : 'Phone number'} updated successfully`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleWarrantyReminderChange = async (days: number) => {
    setSaving(true);
    try {
      const updatedProfile = await authApi.updateProfile(token!, { 
        warranty_reminder_days: days 
      });
      setProfile(updatedProfile);
      setSelectedReminderDays(days);
      setWarrantyModalVisible(false);
      Alert.alert('Success', 'Warranty reminder updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update warranty reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleGeomancyChange = async (preference: 'vastu' | 'feng_shui') => {
    setSaving(true);
    try {
      const updatedProfile = await authApi.updateProfile(token!, { 
        geomancy_preference: preference 
      });
      setProfile(updatedProfile);
      setSelectedGeomancy(preference);
      setGeomancyModalVisible(false);
      Alert.alert('Success', `Geomancy preference updated to ${preference === 'vastu' ? 'Vastu Shastra' : 'Feng Shui'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update geomancy preference');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    setSaving(true);
    try {
      const updatedProfile = await authApi.updateProfile(token!, { 
        currency_preference: currency 
      });
      setProfile(updatedProfile);
      setSelectedCurrency(currency);
      
      // Update cache using the helper function
      const { setCurrencyPreference } = await import('../../utils/localeUtils');
      await setCurrencyPreference(currency);
      
      setCurrencyModalVisible(false);
      Alert.alert('Success', `Currency updated to ${currency}. App will now display prices in ${currency}.`, [
        { text: 'OK', onPress: () => {
          // Force reload by navigating back and forth
          router.replace('/(tabs)/dashboard');
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update currency');
    } finally {
      setSaving(false);
    }
  };

  const handleMeasurementChange = async (system: 'metric' | 'imperial') => {
    setSaving(true);
    try {
      const updatedProfile = await authApi.updateProfile(token!, { 
        measurement_system: system 
      });
      setProfile(updatedProfile);
      setSelectedMeasurement(system);
      
      // Update cache using the helper function
      const { setMeasurementPreference } = await import('../../utils/localeUtils');
      await setMeasurementPreference(system);
      
      setMeasurementModalVisible(false);
      Alert.alert('Success', `Measurement system updated to ${system === 'metric' ? 'Metric' : 'Imperial'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update measurement system');
    } finally {
      setSaving(false);
    }
  };

  const handleCountryChange = async (country: 'India' | 'US' | 'UK' | 'Canada' | 'Australia' | 'UAE') => {
    setSaving(true);
    try {
      const updatedProfile = await authApi.updateProfile(token!, { 
        country: country 
      });
      setProfile(updatedProfile);
      setSelectedCountry(country);
      setCountryModalVisible(false);
      Alert.alert('Success', `Country updated to ${country === 'US' ? 'United States' : country === 'UK' ? 'United Kingdom' : country === 'UAE' ? 'United Arab Emirates' : country}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update country');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // On web, confirm and logout directly
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        logout().then(() => {
          // Clear all storage
          if (typeof window !== 'undefined') {
            localStorage.clear();
          }
          // Force navigation to login
          router.replace('/auth/login');
        }).catch((error) => {
          console.error('Logout error:', error);
        });
      }
    } else {
      // Use Alert.alert for native
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                await logout();
                router.replace('/auth/login');
              } catch (error) {
                console.error('Logout error:', error);
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleChangeAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploadingAvatar(true);
        
        // Update profile with new avatar
        const updatedProfile = await authApi.updateProfile(token!, { 
          avatar: result.assets[0].base64 
        });
        
        setProfile(updatedProfile);
        Alert.alert('Success', 'Avatar updated successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update avatar');
    } finally {
      setUploadingAvatar(false);
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
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
      <ScrollView style={[styles.content, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
        <View style={[styles.profileSection, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handleChangeAvatar}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : profile?.avatar ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${profile.avatar}` }}
                style={styles.avatar}
              />
            ) : (
              <Ionicons name="person" size={48} color="#007AFF" />
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.username, { color: isDark ? '#FFFFFF' : '#000' }]}>{profile?.username}</Text>
          <Text style={[styles.memberSince, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>
            Member since {new Date(profile?.created_at || '').toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Preferences</Text>

          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
            onPress={() => setWarrantyModalVisible(true)}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="time-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Warranty Reminder</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>
                {profile?.warranty_reminder_days} days before expiry
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
            onPress={() => setGeomancyModalVisible(true)}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="compass-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Geomancy Preference</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>
                {selectedGeomancy === 'vastu' ? 'Vastu Shastra' : 'Feng Shui'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => setCountryModalVisible(true)}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="globe-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Country</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>
                {selectedCountry === 'US' ? 'United States' : selectedCountry === 'UK' ? 'United Kingdom' : selectedCountry === 'UAE' ? 'United Arab Emirates' : selectedCountry}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => setCurrencyModalVisible(true)}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="cash-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Currency</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>{selectedCurrency}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => setMeasurementModalVisible(true)}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="resize-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Measurement System</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>
                {selectedMeasurement === 'metric' ? 'Metric (m, kg)' : 'Imperial (ft, lb)'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Notifications</Text>
          
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => router.push('/notifications' as any)}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="notifications-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>View Notifications</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>Warranty reminders and alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* Admin Access Section - Only for HOA Admins and Super Admins */}
        {(profile?.is_hoa_admin || profile?.is_super_admin) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Administration</Text>
            <TouchableOpacity
              style={[styles.infoCard, styles.adminCard]}
              onPress={() => router.push('/admin/dashboard')}
            >
              <View style={[styles.infoIcon, styles.adminIcon]}>
                <Ionicons name="shield-checkmark" size={24} color="#fff" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.adminLabel}>Admin Dashboard</Text>
                <Text style={styles.adminSubtext}>
                  {profile.is_super_admin ? 'Super Admin Access' : 'HOA Admin Access'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Contact Information</Text>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => handleEdit('email')}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="mail-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Email</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>
                {profile?.email || 'Not provided'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => handleEdit('phone')}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="call-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Phone Number</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>
                {profile?.phone || 'Not provided'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Account</Text>

          <View style={[styles.infoCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isDark ? '#A0A0A0' : '#8E8E93' }]}>Username</Text>
              <Text style={[styles.infoValue, { color: isDark ? '#FFFFFF' : '#000' }]}>{profile?.username}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.replayTourCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]} onPress={resetTour}>
            <View style={styles.infoIcon}>
              <Ionicons name="school-outline" size={24} color="#007AFF" />
            </View>
            <Text style={styles.replayTourText}>Replay App Tour</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.logoutCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]} onPress={handleLogout}>
            <View style={styles.infoIcon}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </View>
            <Text style={styles.logoutText}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}
        >
          <View style={[styles.modalHeader, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Edit {editField === 'email' ? 'Email' : 'Phone Number'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.modalContent, { backgroundColor: isDark ? '#000' : '#F2F2F7' }]}>
            <Text style={[styles.label, { color: isDark ? '#FFFFFF' : '#000' }]}>
              {editField === 'email' ? 'Email Address' : 'Phone Number'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#1C1C1E' : '#fff', color: isDark ? '#FFFFFF' : '#000', borderColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
              placeholder={
                editField === 'email' 
                  ? 'your.email@example.com' 
                  : '+1 234 567 8900'
              }
              value={editValue}
              onChangeText={setEditValue}
              keyboardType={editField === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Warranty Reminder Modal */}
      <Modal
        visible={warrantyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWarrantyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setWarrantyModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Warranty Reminder</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.reminderDescription}>
              Choose when you want to be notified before a warranty expires
            </Text>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedReminderDays === 7 && styles.optionCardSelected,
              ]}
              onPress={() => handleWarrantyReminderChange(7)}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={selectedReminderDays === 7 ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedReminderDays === 7 && styles.optionTitleSelected,
                  ]}>
                    7 Days Before
                  </Text>
                  <Text style={styles.optionSubtitle}>Get notified 1 week early</Text>
                </View>
              </View>
              {selectedReminderDays === 7 && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedReminderDays === 14 && styles.optionCardSelected,
              ]}
              onPress={() => handleWarrantyReminderChange(14)}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={selectedReminderDays === 14 ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedReminderDays === 14 && styles.optionTitleSelected,
                  ]}>
                    14 Days Before
                  </Text>
                  <Text style={styles.optionSubtitle}>Get notified 2 weeks early</Text>
                </View>
              </View>
              {selectedReminderDays === 14 && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedReminderDays === 30 && styles.optionCardSelected,
              ]}
              onPress={() => handleWarrantyReminderChange(30)}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={selectedReminderDays === 30 ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedReminderDays === 30 && styles.optionTitleSelected,
                  ]}>
                    30 Days Before
                  </Text>
                  <Text style={styles.optionSubtitle}>Get notified 1 month early</Text>
                </View>
              </View>
              {selectedReminderDays === 30 && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            {saving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.savingText}>Updating...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Geomancy Preference Modal */}
      <Modal
        visible={geomancyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGeomancyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setGeomancyModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Geomancy Preference</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Choose your preferred geomancy system for property analysis
            </Text>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedGeomancy === 'vastu' && styles.optionCardSelected,
              ]}
              onPress={() => handleGeomancyChange('vastu')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="compass-outline"
                  size={24}
                  color={selectedGeomancy === 'vastu' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedGeomancy === 'vastu' && styles.optionTitleSelected,
                  ]}>
                    Vastu Shastra
                  </Text>
                  <Text style={styles.optionSubtitle}>Ancient Indian architectural science</Text>
                </View>
              </View>
              {selectedGeomancy === 'vastu' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedGeomancy === 'feng_shui' && styles.optionCardSelected,
              ]}
              onPress={() => handleGeomancyChange('feng_shui')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flower-outline"
                  size={24}
                  color={selectedGeomancy === 'feng_shui' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedGeomancy === 'feng_shui' && styles.optionTitleSelected,
                  ]}>
                    Feng Shui
                  </Text>
                  <Text style={styles.optionSubtitle}>Chinese philosophical system of harmonizing</Text>
                </View>
              </View>
              {selectedGeomancy === 'feng_shui' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            {saving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.savingText}>Updating...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Currency Preference Modal */}
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Currency</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Choose your preferred currency for displaying values
            </Text>

            {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD'].map((currency) => (
              <TouchableOpacity
                key={currency}
                style={[
                  styles.optionCard,
                  selectedCurrency === currency && styles.optionCardSelected,
                ]}
                onPress={() => handleCurrencyChange(currency)}
                disabled={saving}
              >
                <View style={styles.optionContent}>
                  <Ionicons
                    name="cash-outline"
                    size={24}
                    color={selectedCurrency === currency ? '#007AFF' : '#8E8E93'}
                  />
                  <View style={styles.optionText}>
                    <Text style={[
                      styles.optionTitle,
                      selectedCurrency === currency && styles.optionTitleSelected,
                    ]}>
                      {currency === 'INR' && '₹ Indian Rupee (INR)'}
                      {currency === 'USD' && '$ US Dollar (USD)'}
                      {currency === 'EUR' && '€ Euro (EUR)'}
                      {currency === 'GBP' && '£ British Pound (GBP)'}
                      {currency === 'JPY' && '¥ Japanese Yen (JPY)'}
                      {currency === 'AUD' && '$ Australian Dollar (AUD)'}
                      {currency === 'CAD' && '$ Canadian Dollar (CAD)'}
                      {currency === 'CHF' && 'Fr Swiss Franc (CHF)'}
                      {currency === 'CNY' && '¥ Chinese Yuan (CNY)'}
                      {currency === 'SGD' && '$ Singapore Dollar (SGD)'}
                    </Text>
                  </View>
                </View>
                {selectedCurrency === currency && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}

            {saving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.savingText}>Updating...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Measurement System Modal */}
      <Modal
        visible={measurementModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMeasurementModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMeasurementModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Measurement System</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Choose your preferred measurement system
            </Text>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedMeasurement === 'metric' && styles.optionCardSelected,
              ]}
              onPress={() => handleMeasurementChange('metric')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="resize-outline"
                  size={24}
                  color={selectedMeasurement === 'metric' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedMeasurement === 'metric' && styles.optionTitleSelected,
                  ]}>
                    Metric
                  </Text>
                  <Text style={styles.optionSubtitle}>Meters, kilograms, liters</Text>
                </View>
              </View>
              {selectedMeasurement === 'metric' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedMeasurement === 'imperial' && styles.optionCardSelected,
              ]}
              onPress={() => handleMeasurementChange('imperial')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="resize-outline"
                  size={24}
                  color={selectedMeasurement === 'imperial' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedMeasurement === 'imperial' && styles.optionTitleSelected,
                  ]}>
                    Imperial
                  </Text>
                  <Text style={styles.optionSubtitle}>Feet, pounds, gallons</Text>
                </View>
              </View>
              {selectedMeasurement === 'imperial' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            {saving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.savingText}>Updating...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Country Modal */}
      <Modal
        visible={countryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Country</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Choose your country for localized currency, units, and pricing
            </Text>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedCountry === 'India' && styles.optionCardSelected,
              ]}
              onPress={() => handleCountryChange('India')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flag-outline"
                  size={24}
                  color={selectedCountry === 'India' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedCountry === 'India' && styles.optionTitleSelected,
                  ]}>
                    India
                  </Text>
                  <Text style={styles.optionSubtitle}>₹ INR, Liters, Asian Paints pricing</Text>
                </View>
              </View>
              {selectedCountry === 'India' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedCountry === 'US' && styles.optionCardSelected,
              ]}
              onPress={() => handleCountryChange('US')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flag-outline"
                  size={24}
                  color={selectedCountry === 'US' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedCountry === 'US' && styles.optionTitleSelected,
                  ]}>
                    United States
                  </Text>
                  <Text style={styles.optionSubtitle}>$ USD, Gallons, US market pricing</Text>
                </View>
              </View>
              {selectedCountry === 'US' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedCountry === 'UK' && styles.optionCardSelected,
              ]}
              onPress={() => handleCountryChange('UK')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flag-outline"
                  size={24}
                  color={selectedCountry === 'UK' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedCountry === 'UK' && styles.optionTitleSelected,
                  ]}>
                    United Kingdom
                  </Text>
                  <Text style={styles.optionSubtitle}>£ GBP, Liters, Dulux pricing</Text>
                </View>
              </View>
              {selectedCountry === 'UK' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedCountry === 'Canada' && styles.optionCardSelected,
              ]}
              onPress={() => handleCountryChange('Canada')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flag-outline"
                  size={24}
                  color={selectedCountry === 'Canada' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedCountry === 'Canada' && styles.optionTitleSelected,
                  ]}>
                    Canada
                  </Text>
                  <Text style={styles.optionSubtitle}>CA$ CAD, Liters, Canadian pricing</Text>
                </View>
              </View>
              {selectedCountry === 'Canada' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedCountry === 'Australia' && styles.optionCardSelected,
              ]}
              onPress={() => handleCountryChange('Australia')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flag-outline"
                  size={24}
                  color={selectedCountry === 'Australia' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedCountry === 'Australia' && styles.optionTitleSelected,
                  ]}>
                    Australia
                  </Text>
                  <Text style={styles.optionSubtitle}>A$ AUD, Liters, Dulux Australia</Text>
                </View>
              </View>
              {selectedCountry === 'Australia' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedCountry === 'UAE' && styles.optionCardSelected,
              ]}
              onPress={() => handleCountryChange('UAE')}
              disabled={saving}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="flag-outline"
                  size={24}
                  color={selectedCountry === 'UAE' ? '#007AFF' : '#8E8E93'}
                />
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionTitle,
                    selectedCountry === 'UAE' && styles.optionTitleSelected,
                  ]}>
                    United Arab Emirates
                  </Text>
                  <Text style={styles.optionSubtitle}>AED, Liters, Jotun pricing</Text>
                </View>
              </View>
              {selectedCountry === 'UAE' && (
                <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
              )}
            </TouchableOpacity>

            {saving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.savingText}>Updating...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 17,
    color: '#000',
  },
  replayTourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  replayTourText: {
    flex: 1,
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '500',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  logoutText: {
    flex: 1,
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
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
  reminderDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
    lineHeight: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  optionCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: '#007AFF',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  adminCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  adminIcon: {
    backgroundColor: '#FF6B35',
  },
  adminLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF6B35',
  },
  adminSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
});
