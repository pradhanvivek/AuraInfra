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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface HOACharge {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  created_at: string;
  paid_date?: string;
}

export default function HOAMaintenanceScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [charges, setCharges] = useState<HOACharge[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
  const [payingChargeId, setPayingChargeId] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId) {
      fetchCharges();
    }
  }, [propertyId]);

  const fetchCharges = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/hoa-charges`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCharges(response.data);
    } catch (error) {
      console.error('Error fetching HOA charges:', error);
      Alert.alert('Error', 'Failed to load HOA charges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCharges();
  };

  const handlePay = async (chargeId: string, amount: number, currency: string) => {
    setPayingChargeId(chargeId);
    try {
      // Get origin URL for redirect
      const origin = API_URL.replace('/api', '');
      
      // Create Stripe checkout session
      const response = await axios.post(
        `${API_URL}/api/payments/hoa/create-checkout`,
        {
          charge_id: chargeId,
          origin_url: origin,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { url, session_id } = response.data;

      // Open Stripe checkout in browser
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        
        // Start polling payment status
        Alert.alert(
          'Payment Started',
          'Complete the payment in your browser. We will update the status automatically.',
          [
            {
              text: 'Check Status',
              onPress: () => checkPaymentStatus(session_id),
            },
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Error', 'Cannot open payment URL');
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to initiate payment');
    } finally {
      setPayingChargeId(null);
    }
  };

  const checkPaymentStatus = async (sessionId: string) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/payments/checkout/status/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.payment_status === 'paid') {
        Alert.alert('Success', 'Payment completed successfully!');
        fetchCharges(); // Refresh the list
      } else if (response.data.status === 'open') {
        Alert.alert('Pending', 'Payment is still pending. Please complete the checkout.');
      } else {
        Alert.alert('Status', `Payment status: ${response.data.payment_status}`);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      Alert.alert('Error', 'Failed to check payment status');
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

  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getDaysUntilDue = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderChargeCard = (charge: HOACharge) => {
    const daysUntil = getDaysUntilDue(charge.due_date);
    const isOverdue = daysUntil < 0 && charge.status === 'pending';
    const isPaying = payingChargeId === charge.id;

    return (
      <View key={charge.id} style={[
        styles.card,
        isOverdue && styles.overdueCard
      ]}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.iconCircle,
            { backgroundColor: charge.status === 'paid' ? '#34C759' : isOverdue ? '#FF3B30' : '#FF9500' }
          ]}>
            <Ionicons
              name={charge.status === 'paid' ? 'checkmark-circle' : 'cash'}
              size={24}
              color="#fff"
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.chargeTitle}>{charge.title}</Text>
            <Text style={styles.chargeDescription}>{charge.description}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={[
              styles.amount,
              charge.status === 'paid' && styles.paidAmount
            ]}>
              {formatCurrency(charge.amount, charge.currency)}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <Text style={styles.dateLabel}>Due Date:</Text>
            <Text style={[
              styles.date,
              isOverdue && styles.overdueText
            ]}>
              {formatDate(charge.due_date)}
              {isOverdue && ` (${Math.abs(daysUntil)} days overdue)`}
              {!isOverdue && charge.status === 'pending' && ` (in ${daysUntil} days)`}
            </Text>
          </View>

          {charge.status === 'paid' && charge.paid_date && (
            <View style={styles.paidBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={styles.paidText}>
                Paid on {formatDate(charge.paid_date)}
              </Text>
            </View>
          )}

          {charge.status === 'pending' && (
            <TouchableOpacity
              style={[
                styles.payButton,
                isPaying && styles.payButtonDisabled
              ]}
              onPress={() => handlePay(charge.id, charge.amount, charge.currency)}
              disabled={isPaying}
            >
              {isPaying ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.payButtonText}>Processing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#fff" />
                  <Text style={styles.payButtonText}>Pay Now</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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

  const pendingCharges = charges.filter(c => c.status === 'pending');
  const paidCharges = charges.filter(c => c.status === 'paid');
  const currentCharges = activeTab === 'pending' ? pendingCharges : paidCharges;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HOA Maintenance</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending
          </Text>
          {pendingCharges.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCharges.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'paid' && styles.activeTab]}
          onPress={() => setActiveTab('paid')}
        >
          <Text style={[styles.tabText, activeTab === 'paid' && styles.activeTabText]}>
            Paid
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {currentCharges.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeTab === 'pending' ? 'checkmark-done-circle-outline' : 'receipt-outline'}
              size={64}
              color="#C7C7CC"
            />
            <Text style={styles.emptyText}>
              {activeTab === 'pending' ? 'No pending charges' : 'No payment history'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'pending'
                ? 'All maintenance charges are paid'
                : 'Completed payments will appear here'}
            </Text>
          </View>
        ) : (
          currentCharges.map(renderChargeCard)
        )}
      </ScrollView>
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
    paddingTop: 16,
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
    backgroundColor: '#FF3B30',
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
  overdueCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
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
  chargeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  chargeDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  cardBody: {
    gap: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  amountLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9500',
  },
  paidAmount: {
    color: '#34C759',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  date: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  overdueText: {
    color: '#FF3B30',
  },
  paidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginTop: 8,
  },
  paidText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
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
});
