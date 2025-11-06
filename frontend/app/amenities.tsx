import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Amenity {
  id: string;
  name: string;
  description: string;
  capacity?: number;
  booking_fee?: number;
  available_hours_start: string;
  available_hours_end: string;
}

interface Booking {
  id: string;
  amenity_id: string;
  user_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose?: string;
  status: string;
  payment_status: string;
}

export default function AmenitiesScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'amenities' | 'bookings'>('amenities');
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [bookingForm, setBookingForm] = useState({
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '11:00',
    purpose: '',
  });

  useEffect(() => {
    if (propertyId) {
      fetchData();
    }
  }, [propertyId, activeTab]);

  const fetchData = async () => {
    try {
      const [amenitiesRes, bookingsRes] = await Promise.all([
        axios.get(
          `${API_URL}/api/properties/${propertyId}/amenities`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${API_URL}/api/properties/${propertyId}/amenity-bookings`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);
      setAmenities(amenitiesRes.data);
      setBookings(bookingsRes.data);
    } catch (error) {
      console.error('Error fetching amenities:', error);
      Alert.alert('Error', 'Failed to load amenities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleBook = (amenity: Amenity) => {
    setSelectedAmenity(amenity);
    setBookModalVisible(true);
  };

  const handleSubmitBooking = async () => {
    if (!selectedAmenity) return;

    try {
      await axios.post(
        `${API_URL}/api/amenities/book`,
        {
          amenity_id: selectedAmenity.id,
          booking_date: new Date(bookingForm.booking_date).toISOString(),
          start_time: bookingForm.start_time,
          end_time: bookingForm.end_time,
          purpose: bookingForm.purpose,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Booking request submitted successfully');
      setBookModalVisible(false);
      setBookingForm({
        booking_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '11:00',
        purpose: '',
      });
      fetchData();
    } catch (error: any) {
      console.error('Error booking amenity:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to book amenity');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'approved': return '#34C759';
      case 'rejected': return '#FF3B30';
      case 'cancelled': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const renderAmenityCard = (amenity: Amenity) => {
    return (
      <View key={amenity.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="business" size={28} color="#5856D6" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.amenityName}>{amenity.name}</Text>
            <Text style={styles.amenityDescription}>{amenity.description}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {amenity.capacity && (
            <View style={styles.infoRow}>
              <Ionicons name="people" size={16} color="#8E8E93" />
              <Text style={styles.infoText}>Capacity: {amenity.capacity}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="time" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>
              Available: {amenity.available_hours_start} - {amenity.available_hours_end}
            </Text>
          </View>

          {amenity.booking_fee && (
            <View style={styles.infoRow}>
              <Ionicons name="cash" size={16} color="#8E8E93" />
              <Text style={styles.infoText}>Fee: ₹{amenity.booking_fee}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => handleBook(amenity)}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderBookingCard = (booking: Booking) => {
    const amenity = amenities.find(a => a.id === booking.amenity_id);
    return (
      <View key={booking.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.amenityName}>{amenity?.name || 'Amenity'}</Text>
            <Text style={styles.amenityDescription}>{booking.user_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>{formatDate(booking.booking_date)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>
              {booking.start_time} - {booking.end_time}
            </Text>
          </View>

          {booking.purpose && (
            <Text style={styles.purpose}>Purpose: {booking.purpose}</Text>
          )}

          <View style={styles.paymentBadge}>
            <Text style={styles.paymentText}>
              Payment: {booking.payment_status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
          <Text style={styles.headerTitle}>Amenities</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'amenities' && styles.activeTab]}
            onPress={() => setActiveTab('amenities')}
          >
            <Text style={[styles.tabText, activeTab === 'amenities' && styles.activeTabText]}>
              Available
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'bookings' && styles.activeTab]}
            onPress={() => setActiveTab('bookings')}
          >
            <Text style={[styles.tabText, activeTab === 'bookings' && styles.activeTabText]}>
              My Bookings
            </Text>
            {bookings.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{bookings.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {activeTab === 'amenities' ? (
            amenities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No amenities available</Text>
              </View>
            ) : (
              amenities.map(renderAmenityCard)
            )
          ) : (
            bookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              bookings.map(renderBookingCard)
            )
          )}
        </ScrollView>

        {/* Booking Modal */}
        <Modal
          visible={bookModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setBookModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Book {selectedAmenity?.name}</Text>
                <TouchableOpacity onPress={() => setBookModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
                <Text style={styles.inputLabel}>Booking Date *</Text>
                <TextInput
                  style={styles.input}
                  value={bookingForm.booking_date}
                  onChangeText={(text) => setBookingForm({ ...bookingForm, booking_date: text })}
                  placeholder="YYYY-MM-DD"
                />

                <Text style={styles.inputLabel}>Start Time *</Text>
                <TextInput
                  style={styles.input}
                  value={bookingForm.start_time}
                  onChangeText={(text) => setBookingForm({ ...bookingForm, start_time: text })}
                  placeholder="HH:MM (e.g., 09:00)"
                />

                <Text style={styles.inputLabel}>End Time *</Text>
                <TextInput
                  style={styles.input}
                  value={bookingForm.end_time}
                  onChangeText={(text) => setBookingForm({ ...bookingForm, end_time: text })}
                  placeholder="HH:MM (e.g., 11:00)"
                />

                <Text style={styles.inputLabel}>Purpose (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bookingForm.purpose}
                  onChangeText={(text) => setBookingForm({ ...bookingForm, purpose: text })}
                  placeholder="Enter purpose of booking"
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmitBooking}>
                  <Text style={styles.submitButtonText}>Submit Booking</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
    paddingTop: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  amenityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  amenityDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  cardBody: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#000',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5856D6',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  purpose: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  paymentBadge: {
    backgroundColor: '#F2F2F7',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalForm: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
