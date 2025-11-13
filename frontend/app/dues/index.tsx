import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface MaintenanceDue {
  id: string;
  property_id: string;
  property_name?: string;
  property_address?: string;
  amount: number;
  due_date: string;
  description: string;
  status: string;
  created_at: string;
  paid_at?: string;
  payment_method?: string;
  payment_reference?: string;
}

export default function MyDuesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [dues, setDues] = useState<MaintenanceDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedDue, setSelectedDue] = useState<MaintenanceDue | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDues();
  }, []);

  const fetchDues = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/users/dues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDues(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load dues');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredDues = () => {
    if (filterStatus === 'all') return dues;
    return dues.filter((due) => due.status === filterStatus);
  };

  const openPaymentModal = (due: MaintenanceDue) => {
    setSelectedDue(due);
    setPaymentMethod('');
    setPaymentReference('');
    setPaymentModalVisible(true);
  };

  const handleMarkAsPaid = async () => {
    if (!paymentMethod || !paymentReference) {
      Alert.alert('Error', 'Please enter payment method and reference');
      return;
    }

    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/dues/${selectedDue?.id}`,
        {
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
          payment_reference: paymentReference,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Payment marked successfully');
      setPaymentModalVisible(false);
      fetchDues();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to mark payment');
    } finally {
      setSaving(false);
    }
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

  const isOverdue = (dueDate: string, status: string) => {
    return status === 'unpaid' && new Date(dueDate) < new Date();
  };

  const filteredDues = getFilteredDues();
  const totalUnpaid = dues
    .filter((due) => due.status === 'unpaid')
    .reduce((sum, due) => sum + due.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Dues</Text>
        <TouchableOpacity onPress={fetchDues}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {totalUnpaid > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="alert-circle" size={32} color="#FF9500" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Total Unpaid</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalUnpaid)}</Text>
          </View>
        </View>
      )}

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'unpaid', 'paid', 'overdue'].map((status) => {
            const count =
              status === 'all'
                ? dues.length
                : dues.filter((d) =>
                    status === 'overdue' ? isOverdue(d.due_date, d.status) : d.status === status
                  ).length;

            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  filterStatus === status && styles.filterButtonActive,
                ]}
                onPress={() => setFilterStatus(status)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterStatus === status && styles.filterButtonTextActive,
                  ]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {filteredDues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={64} color="#34C759" />
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubtext}>You have no {filterStatus} dues</Text>
            </View>
          ) : (
            filteredDues.map((due) => {
              const overdueFlag = isOverdue(due.due_date, due.status);
              return (
                <View key={due.id} style={styles.dueCard}>
                  <View style={styles.dueHeader}>
                    <View style={styles.dueInfo}>
                      <Text style={styles.propertyName}>{due.property_name}</Text>
                      {due.property_address && (
                        <Text style={styles.propertyAddress}>{due.property_address}</Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusColor(overdueFlag ? 'overdue' : due.status) + '20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(overdueFlag ? 'overdue' : due.status) },
                        ]}
                      >
                        {overdueFlag ? 'Overdue' : due.status.charAt(0).toUpperCase() + due.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dueAmount}>
                    <Text style={styles.amountLabel}>Amount Due</Text>
                    <Text style={styles.amountValue}>{formatCurrency(due.amount)}</Text>
                  </View>

                  <View style={styles.dueDetails}>
                    <View style={styles.dueDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#666" />
                      <Text style={styles.dueDetailText}>
                        Due: {formatDate(due.due_date)}
                        {overdueFlag && <Text style={styles.overdueText}> • Overdue</Text>}
                      </Text>
                    </View>
                    <View style={styles.dueDetailRow}>
                      <Ionicons name="document-text-outline" size={16} color="#666" />
                      <Text style={styles.dueDetailText}>{due.description}</Text>
                    </View>
                  </View>

                  {due.status === 'paid' ? (
                    <View style={styles.paidInfo}>
                      <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                      <View style={styles.paidDetails}>
                        <Text style={styles.paidText}>Paid on {formatDate(due.paid_at!)}</Text>
                        {due.payment_method && (
                          <Text style={styles.paidMethod}>
                            via {due.payment_method} • Ref: {due.payment_reference}
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={() => openPaymentModal(due)}
                    >
                      <Ionicons name="card-outline" size={20} color="#fff" />
                      <Text style={styles.payButtonText}>Mark as Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Mark Payment</Text>
            <TouchableOpacity onPress={handleMarkAsPaid} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedDue && (
              <>
                <View style={styles.dueInfoCard}>
                  <Text style={styles.dueInfoProperty}>{selectedDue.property_name}</Text>
                  <Text style={styles.dueInfoAmount}>{formatCurrency(selectedDue.amount)}</Text>
                  <Text style={styles.dueInfoDescription}>{selectedDue.description}</Text>
                </View>

                <Text style={styles.label}>Payment Method *</Text>
                <View style={styles.paymentMethods}>
                  {['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Credit Card'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.methodButton,
                        paymentMethod === method && styles.methodButtonActive,
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.methodButtonText,
                          paymentMethod === method && styles.methodButtonTextActive,
                        ]}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Transaction Reference / Receipt Number *</Text>
                <TextInput
                  style={styles.input}
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  placeholder="Enter transaction ID or receipt number"
                />

                <View style={styles.noteCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
                  <Text style={styles.noteText}>
                    Please keep your payment receipt for record. This will mark the due as paid in
                    your account.
                  </Text>
                </View>
              </>
            )}
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
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4B3',
  },
  summaryIcon: {
    marginRight: 12,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#CC8400',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#CC8400',
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
    fontSize: 20,
    fontWeight: '600',
    color: '#34C759',
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
  propertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  propertyAddress: {
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
  dueAmount: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  dueDetails: {
    marginBottom: 12,
  },
  dueDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dueDetailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  overdueText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FFF4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  paidDetails: {
    flex: 1,
  },
  paidText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  paidMethod: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  dueInfoCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  dueInfoProperty: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  dueInfoAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  dueInfoDescription: {
    fontSize: 14,
    color: '#666',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  methodButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  methodButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  methodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 24,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#007AFF',
    lineHeight: 18,
  },
});
