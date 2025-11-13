import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface MaintenanceDue {
  id: string;
  user_id: string;
  username?: string;
  email?: string;
  amount: number;
  due_date: string;
  description: string;
  status: string;
  created_at: string;
  paid_at?: string;
}

interface Resident {
  user_id: string;
  username: string;
  email?: string;
  unit_number?: string;
}

export default function MaintenanceDuesScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams();
  const { token } = useAuth();
  const [dues, setDues] = useState<MaintenanceDue[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [sendType, setSendType] = useState<'individual' | 'bulk'>('bulk');
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchDues();
    fetchResidents();
  }, [filterStatus]);

  const fetchDues = async () => {
    setLoading(true);
    try {
      const url =
        filterStatus === 'all'
          ? `${API_URL}/api/properties/${propertyId}/dues`
          : `${API_URL}/api/properties/${propertyId}/dues?status=${filterStatus}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDues(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load dues');
    } finally {
      setLoading(false);
    }
  };

  const fetchResidents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/properties/${propertyId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResidents(response.data);
    } catch (error: any) {
      console.error('Error fetching residents:', error);
    }
  };

  const openSendModal = (type: 'individual' | 'bulk') => {
    setSendType(type);
    setAmount('');
    setDescription('');
    setDueDate(new Date());
    setSelectedUserId('');
    setModalVisible(true);
  };

  const handleSendDue = async () => {
    if (!amount || !description) {
      Alert.alert('Error', 'Amount and description are required');
      return;
    }

    if (sendType === 'individual' && !selectedUserId) {
      Alert.alert('Error', 'Please select a resident');
      return;
    }

    setSaving(true);
    try {
      if (sendType === 'bulk') {
        await axios.post(
          `${API_URL}/api/properties/${propertyId}/dues/bulk`,
          {
            amount: parseFloat(amount),
            due_date: dueDate.toISOString(),
            description,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Dues sent to all residents');
      } else {
        await axios.post(
          `${API_URL}/api/properties/${propertyId}/dues`,
          {
            user_id: selectedUserId,
            amount: parseFloat(amount),
            due_date: dueDate.toISOString(),
            description,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Alert.alert('Success', 'Due sent successfully');
      }

      setModalVisible(false);
      fetchDues();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send due');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDue = (due: MaintenanceDue) => {
    Alert.alert(
      'Delete Due',
      `Are you sure you want to delete this due for ${due.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/api/dues/${due.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Success', 'Due deleted successfully');
              fetchDues();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete due');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#34C759';
      case 'overdue':
        return '#FF3B30';
      default:
        return '#FF9500';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maintenance Dues</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openSendModal('bulk')}
        >
          <Ionicons name="people" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Send to All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => openSendModal('individual')}
        >
          <Ionicons name="person" size={20} color="#007AFF" />
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            Send Individual
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'unpaid', 'paid', 'overdue'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {dues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No dues found</Text>
              <Text style={styles.emptySubtext}>Send dues to residents to get started</Text>
            </View>
          ) : (
            dues.map((due) => (
              <View key={due.id} style={styles.dueCard}>
                <View style={styles.dueHeader}>
                  <View style={styles.dueInfo}>
                    <Text style={styles.dueName}>{due.username}</Text>
                    {due.email && <Text style={styles.dueEmail}>{due.email}</Text>}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(due.status) + '20' },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(due.status) }]}>
                      {due.status.charAt(0).toUpperCase() + due.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.dueDetails}>
                  <View style={styles.dueDetailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.dueDetailText}>Due: {formatDate(due.due_date)}</Text>
                  </View>
                  <Text style={styles.dueAmount}>{formatCurrency(due.amount)}</Text>
                </View>

                <Text style={styles.dueDescription}>{due.description}</Text>

                {due.paid_at && (
                  <View style={styles.paidInfo}>
                    <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                    <Text style={styles.paidText}>Paid on {formatDate(due.paid_at)}</Text>
                  </View>
                )}

                <View style={styles.dueActions}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteDue(due)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Send Due Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {sendType === 'bulk' ? 'Send to All Residents' : 'Send Individual Due'}
            </Text>
            <TouchableOpacity onPress={handleSendDue} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                {saving ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {sendType === 'individual' && (
              <>
                <Text style={styles.label}>Select Resident *</Text>
                <ScrollView style={styles.residentList} nestedScrollEnabled>
                  {residents.map((resident) => (
                    <TouchableOpacity
                      key={resident.user_id}
                      style={[
                        styles.residentItem,
                        selectedUserId === resident.user_id && styles.residentItemSelected,
                      ]}
                      onPress={() => setSelectedUserId(resident.user_id)}
                    >
                      <View style={styles.residentInfo}>
                        <Text style={styles.residentName}>{resident.username}</Text>
                        {resident.email && (
                          <Text style={styles.residentEmail}>{resident.email}</Text>
                        )}
                        {resident.unit_number && (
                          <Text style={styles.residentUnit}>Unit: {resident.unit_number}</Text>
                        )}
                      </View>
                      {selectedUserId === resident.user_id && (
                        <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Due Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#007AFF" />
              <Text style={styles.dateButtonText}>{formatDate(dueDate.toISOString())}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setDueDate(selectedDate);
                  }
                }}
              />
            )}

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description (e.g., Monthly Maintenance)"
              multiline
              numberOfLines={3}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#007AFF',
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  dueCard: {
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
  dueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dueInfo: {
    flex: 1,
  },
  dueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  dueEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dueDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDetailText: {
    fontSize: 14,
    color: '#666',
  },
  dueAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  dueDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  paidText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  dueActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
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
    flex: 1,
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
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000',
  },
  residentList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    marginBottom: 16,
  },
  residentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  residentItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  residentInfo: {
    flex: 1,
  },
  residentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  residentEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  residentUnit: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
});
