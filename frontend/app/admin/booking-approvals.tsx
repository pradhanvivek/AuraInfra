import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface AmenityBooking {
  id: string;
  amenity_id: string;
  property_id: string;
  user_id: string;
  user_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payment_status: 'unpaid' | 'paid';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

interface Amenity {
  id: string;
  name: string;
  booking_fee: number;
}

export default function BookingApprovals() {
  const router = useRouter();
  const { token } = useAuth();
  const [bookings, setBookings] = useState<AmenityBooking[]>([]);
  const [amenities, setAmenities] = useState<{ [key: string]: Amenity }>({});
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<AmenityBooking | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPropertyId();
  }, []);

  useEffect(() => {
    if (propertyId) {
      fetchBookings();
      fetchAmenities();
    }
  }, [propertyId]);

  const fetchPropertyId = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.managed_properties?.length > 0) {
        setPropertyId(response.data.managed_properties[0]);
      } else {
        Alert.alert('Error', 'No managed properties found');
        router.back();
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/amenity-bookings`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAmenities = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/amenities`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const amenityMap: { [key: string]: Amenity } = {};
      response.data.forEach((amenity: Amenity) => {
        amenityMap[amenity.id] = amenity;
      });
      setAmenities(amenityMap);
    } catch (error) {
      console.error('Error fetching amenities:', error);
    }
  };

  const handleApprove = async (booking: AmenityBooking) => {
    Alert.alert(
      'Approve Booking',
      `Approve booking for ${booking.user_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/api/amenity-bookings/${booking.id}`,
                { status: 'approved' },
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Booking approved successfully');
              fetchBookings();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to approve booking');
            }
          }
        }
      ]
    );
  };

  const handleReject = async (booking: AmenityBooking) => {
    Alert.alert(
      'Reject Booking',
      `Reject booking for ${booking.user_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/api/amenity-bookings/${booking.id}`,
                { status: 'rejected' },
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Booking rejected');
              fetchBookings();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to reject booking');
            }
          }
        }
      ]
    );
  };

  const handleMarkPaid = async (booking: AmenityBooking) => {
    setSelectedBooking(booking);
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedBooking) return;

    setProcessing(true);
    try {
      await axios.put(
        `${API_URL}/api/amenity-bookings/${selectedBooking.id}`,
        { payment_status: 'paid' },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Payment marked as received');
      setShowPaymentModal(false);
      setSelectedBooking(null);
      fetchBookings();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update payment status');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#34C759';
      case 'rejected': return '#FF3B30';
      case 'cancelled': return '#8E8E93';
      default: return '#FF9500';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    return status === 'paid' ? '#34C759' : '#FF9500';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const approvedBookings = bookings.filter(b => b.status === 'approved');
  const otherBookings = bookings.filter(b => !['pending', 'approved'].includes(b.status));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Approvals</Text>
        <TouchableOpacity onPress={fetchBookings}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Pending Bookings */}
        {pendingBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={20} color="#FF9500" />
              <Text style={styles.sectionTitle}>Pending Approval ({pendingBookings.length})</Text>
            </View>
            {pendingBookings.map((booking) => {
              const amenity = amenities[booking.amenity_id];
              return (
                <View key={booking.id} style={[styles.bookingCard, styles.pendingCard]}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.amenityName}>{amenity?.name || 'Unknown Amenity'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                      <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.bookingDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="person" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{booking.user_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{formatDate(booking.booking_date)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{booking.start_time} - {booking.end_time}</Text>
                    </View>
                    {amenity?.booking_fee > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash" size={16} color="#8E8E93" />
                        <Text style={styles.detailText}>${amenity.booking_fee}</Text>
                      </View>
                    )}
                    {booking.purpose && (
                      <View style={styles.detailRow}>
                        <Ionicons name="information-circle" size={16} color="#8E8E93" />
                        <Text style={styles.detailText}>{booking.purpose}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(booking)}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(booking)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Approved Bookings */}
        {approvedBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.sectionTitle}>Approved ({approvedBookings.length})</Text>
            </View>
            {approvedBookings.map((booking) => {
              const amenity = amenities[booking.amenity_id];
              return (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.amenityName}>{amenity?.name || 'Unknown Amenity'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(booking.payment_status) }]}>
                      <Text style={styles.statusText}>{booking.payment_status.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.bookingDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="person" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{booking.user_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{formatDate(booking.booking_date)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{booking.start_time} - {booking.end_time}</Text>
                    </View>
                    {amenity?.booking_fee > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="cash" size={16} color="#8E8E93" />
                        <Text style={styles.detailText}>${amenity.booking_fee}</Text>
                      </View>
                    )}
                  </View>

                  {booking.payment_status === 'unpaid' && amenity?.booking_fee > 0 && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.paymentButton]}
                      onPress={() => handleMarkPaid(booking)}
                    >
                      <Ionicons name="card" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Mark as Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Other Bookings */}
        {otherBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={20} color="#8E8E93" />
              <Text style={styles.sectionTitle}>History ({otherBookings.length})</Text>
            </View>
            {otherBookings.map((booking) => {
              const amenity = amenities[booking.amenity_id];
              return (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <Text style={styles.amenityName}>{amenity?.name || 'Unknown Amenity'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                      <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.bookingDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="person" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{booking.user_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={16} color="#8E8E93" />
                      <Text style={styles.detailText}>{formatDate(booking.booking_date)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {bookings.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No bookings yet</Text>
          </View>
        )}
      </ScrollView>

      {/* Payment Confirmation Modal */}
      <Modal visible={showPaymentModal} animationType="fade" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Payment Received</Text>
            <Text style={styles.modalMessage}>
              Mark payment as received for this booking?
            </Text>
            {selectedBooking && amenities[selectedBooking.amenity_id] && (
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentAmount}>
                  Amount: ${amenities[selectedBooking.amenity_id].booking_fee}
                </Text>
                <Text style={styles.paymentUser}>
                  From: {selectedBooking.user_name}
                </Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPaymentModal(false)}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmPayment}
                disabled={processing}
              >
                <Text style={styles.confirmButtonText}>
                  {processing ? 'Processing...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pendingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amenityName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#000',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  paymentButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  paymentInfo: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  paymentUser: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
