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

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Visitor {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  purpose: string;
  expected_date: string;
  expected_time?: string;
  status: string;
  approval_code?: string;
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

export default function VisitorsScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'today' | 'past'>('today');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    visitor_name: '',
    visitor_phone: '',
    purpose: '',
    expected_date: new Date().toISOString().split('T')[0],
    expected_time: '',
    notes: '',
  });

  useEffect(() => {
    if (propertyId) {
      fetchVisitors();
    }
  }, [propertyId, activeTab]);

  const fetchVisitors = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/visitors?date_filter=${activeTab}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVisitors(response.data);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      Alert.alert('Error', 'Failed to load visitors');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVisitors();
  };

  const handleAddVisitor = async () => {
    if (!formData.visitor_name || !formData.visitor_phone || !formData.purpose) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/properties/${propertyId}/visitors`,
        {
          ...formData,
          property_id: propertyId,
          expected_date: new Date(formData.expected_date).toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('Success', 'Visitor registered successfully');
      setAddModalVisible(false);
      setFormData({
        visitor_name: '',
        visitor_phone: '',
        purpose: '',
        expected_date: new Date().toISOString().split('T')[0],
        expected_time: '',
        notes: '',
      });
      fetchVisitors();
    } catch (error) {
      console.error('Error adding visitor:', error);
      Alert.alert('Error', 'Failed to register visitor');
    }
  };

  const handleCheckIn = async (visitorId: string) => {
    try {
      await axios.post(
        `${API_URL}/api/visitors/${visitorId}/check-in`,
        { check_in_time: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Visitor checked in');
      fetchVisitors();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check in visitor');
    }
  };

  const handleCheckOut = async (visitorId: string) => {
    try {
      await axios.post(
        `${API_URL}/api/visitors/${visitorId}/check-out`,
        { check_out_time: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Visitor checked out');
      fetchVisitors();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to check out visitor');
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

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'approved': return '#007AFF';
      case 'checked_in': return '#34C759';
      case 'checked_out': return '#8E8E93';
      case 'rejected': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const renderVisitorCard = (visitor: Visitor) => {
    return (
      <View key={visitor.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.iconCircle,
            { backgroundColor: getStatusColor(visitor.status) + '20' }
          ]}>
            <Ionicons name="person" size={24} color={getStatusColor(visitor.status)} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.visitorName}>{visitor.visitor_name}</Text>
            <Text style={styles.visitorPhone}>{visitor.visitor_phone}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(visitor.status) }
          ]}>
            <Text style={styles.statusText}>{visitor.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoLabel}>Purpose:</Text>
            <Text style={styles.infoValue}>{visitor.purpose}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoLabel}>Expected:</Text>
            <Text style={styles.infoValue}>
              {formatDate(visitor.expected_date)}
              {visitor.expected_time && ` at ${visitor.expected_time}`}
            </Text>
          </View>

          {visitor.approval_code && (
            <View style={styles.approvalCodeContainer}>
              <Text style={styles.approvalCodeLabel}>Approval Code:</Text>
              <Text style={styles.approvalCode}>{visitor.approval_code}</Text>
            </View>
          )}

          {visitor.check_in_time && (
            <View style={styles.timeContainer}>
              <Ionicons name="enter-outline" size={16} color="#34C759" />
              <Text style={styles.timeText}>Checked in: {formatTime(visitor.check_in_time)}</Text>
            </View>
          )}

          {visitor.check_out_time && (
            <View style={styles.timeContainer}>
              <Ionicons name="exit-outline" size={16} color="#8E8E93" />
              <Text style={styles.timeText}>Checked out: {formatTime(visitor.check_out_time)}</Text>
            </View>
          )}

          {visitor.notes && (
            <Text style={styles.notes}>Note: {visitor.notes}</Text>
          )}
        </View>

        {visitor.status === 'approved' && !visitor.check_in_time && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCheckIn(visitor.id)}
          >
            <Ionicons name="enter-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Check In</Text>
          </TouchableOpacity>
        )}

        {visitor.status === 'checked_in' && !visitor.check_out_time && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8E8E93' }]}
            onPress={() => handleCheckOut(visitor.id)}
          >
            <Ionicons name="exit-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Check Out</Text>
          </TouchableOpacity>
        )}
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visitor Management</Text>
        <TouchableOpacity onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'today' && styles.activeTab]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {visitors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No visitors</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'today'
                ? 'No visitors expected today'
                : activeTab === 'upcoming'
                ? 'No upcoming visitors'
                : 'No past visitors'}
            </Text>
          </View>
        ) : (
          visitors.map(renderVisitorCard)
        )}
      </ScrollView>

      {/* Add Visitor Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Visitor</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Visitor Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.visitor_name}
                onChangeText={(text) => setFormData({ ...formData, visitor_name: text })}
                placeholder="Enter visitor name"
              />

              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={formData.visitor_phone}
                onChangeText={(text) => setFormData({ ...formData, visitor_phone: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Purpose *</Text>
              <TextInput
                style={styles.input}
                value={formData.purpose}
                onChangeText={(text) => setFormData({ ...formData, purpose: text })}
                placeholder="e.g., Delivery, Guest, Meeting"
              />

              <Text style={styles.inputLabel}>Expected Date *</Text>
              <TextInput
                style={styles.input}
                value={formData.expected_date}
                onChangeText={(text) => setFormData({ ...formData, expected_date: text })}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.inputLabel}>Expected Time (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.expected_time}
                onChangeText={(text) => setFormData({ ...formData, expected_time: text })}
                placeholder="e.g., 2:00 PM"
              />

              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Additional notes"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleAddVisitor}>
                <Text style={styles.submitButtonText}>Register Visitor</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingVertical: 12,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  visitorName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  visitorPhone: {
    fontSize: 14,
    color: '#8E8E93',
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
  cardBody: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    flex: 1,
  },
  approvalCodeContainer: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  approvalCodeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  approvalCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timeText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  notes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    paddingHorizontal: 40,
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
    maxHeight: '90%',
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