import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface MaintenanceRecord {
  id: string;
  asset_type: string;
  asset_id: string;
  asset_name: string;
  maintenance_type: string;
  description: string;
  due_date: string;
  completed: boolean;
  completed_date?: string;
  cost?: number;
  notes?: string;
  recurring: boolean;
  recurring_interval_days?: number;
}

export default function MaintenanceScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'overdue' | 'completed'>('upcoming');
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceRecord[]>([]);
  const [overdueMaintenance, setOverdueMaintenance] = useState<MaintenanceRecord[]>([]);
  const [completedMaintenance, setCompletedMaintenance] = useState<MaintenanceRecord[]>([]);

  useEffect(() => {
    fetchMaintenance();
  }, []);

  const fetchMaintenance = async () => {
    try {
      // Fetch upcoming
      const upcomingRes = await axios.get(
        `${API_URL}/api/maintenance/upcoming?days=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUpcomingMaintenance(upcomingRes.data);

      // Fetch overdue
      const overdueRes = await axios.get(
        `${API_URL}/api/maintenance/overdue`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOverdueMaintenance(overdueRes.data);

      // Fetch completed
      const completedRes = await axios.get(
        `${API_URL}/api/maintenance?completed=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompletedMaintenance(completedRes.data);
    } catch (error) {
      console.error('Error fetching maintenance:', error);
      Alert.alert('Error', 'Failed to load maintenance records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMaintenance();
  };

  const handleMarkComplete = async (maintenanceId: string) => {
    Alert.alert(
      'Mark as Complete',
      'Mark this maintenance as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/api/maintenance/${maintenanceId}`,
                {
                  completed: true,
                  completed_date: new Date().toISOString(),
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Maintenance marked as complete');
              fetchMaintenance();
            } catch (error) {
              console.error('Error marking complete:', error);
              Alert.alert('Error', 'Failed to update maintenance');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (maintenanceId: string) => {
    Alert.alert(
      'Delete Maintenance',
      'Are you sure you want to delete this maintenance record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/api/maintenance/${maintenanceId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Maintenance deleted');
              fetchMaintenance();
            } catch (error) {
              console.error('Error deleting maintenance:', error);
              Alert.alert('Error', 'Failed to delete maintenance');
            }
          },
        },
      ]
    );
  };

  const getDaysUntilDue = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getAssetIcon = (assetType: string) => {
    const iconMap: { [key: string]: any } = {
      property: 'home',
      vehicle: 'car',
      appliance: 'tv',
      jewelry: 'diamond',
      furniture: 'bed',
      art: 'color-palette',
    };
    return iconMap[assetType] || 'list';
  };

  const getMaintenanceColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      service: '#007AFF',
      inspection: '#34C759',
      repair: '#FF3B30',
      cleaning: '#5856D6',
      replacement: '#FF9500',
    };
    return colorMap[type.toLowerCase()] || '#8E8E93';
  };

  const renderMaintenanceCard = (item: MaintenanceRecord, showActions: boolean = true) => {
    const daysUntil = getDaysUntilDue(item.due_date);
    const isOverdue = daysUntil < 0;
    const color = getMaintenanceColor(item.maintenance_type);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
            <Ionicons name={getAssetIcon(item.asset_type)} size={24} color={color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.assetName}>{item.asset_name}</Text>
            <Text style={styles.assetType}>{item.asset_type.toUpperCase()}</Text>
          </View>
          {showActions && (
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.maintenanceTypeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: color }]}>
              <Text style={styles.typeBadgeText}>{item.maintenance_type}</Text>
            </View>
            {item.recurring && (
              <View style={styles.recurringBadge}>
                <Ionicons name="repeat" size={14} color="#5856D6" />
                <Text style={styles.recurringText}>
                  Every {item.recurring_interval_days} days
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.dueDateContainer}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={isOverdue ? '#FF3B30' : '#8E8E93'}
            />
            <Text style={[styles.dueDate, isOverdue && styles.overdue]}>
              {formatDate(item.due_date)}
              {!item.completed && (
                <Text style={isOverdue ? styles.overdueText : styles.dueInText}>
                  {' '}
                  ({isOverdue ? `${Math.abs(daysUntil)} days overdue` : `in ${daysUntil} days`})
                </Text>
              )}
            </Text>
          </View>

          {item.cost && (
            <View style={styles.costContainer}>
              <Ionicons name="cash-outline" size={16} color="#34C759" />
              <Text style={styles.cost}>₹{item.cost.toLocaleString()}</Text>
            </View>
          )}

          {item.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              Note: {item.notes}
            </Text>
          )}
        </View>

        {showActions && !item.completed && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleMarkComplete(item.id)}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        )}

        {item.completed && item.completed_date && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
            <Text style={styles.completedText}>
              Completed on {formatDate(item.completed_date)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  const getCurrentData = () => {
    switch (activeTab) {
      case 'upcoming':
        return upcomingMaintenance;
      case 'overdue':
        return overdueMaintenance;
      case 'completed':
        return completedMaintenance;
      default:
        return [];
    }
  };

  const currentData = getCurrentData();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maintenance</Text>
          <TouchableOpacity onPress={() => router.push('/maintenance/add' as any)}>
            <Ionicons name="add-circle" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
          {upcomingMaintenance.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{upcomingMaintenance.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'overdue' && styles.activeTab]}
          onPress={() => setActiveTab('overdue')}
        >
          <Text style={[styles.tabText, activeTab === 'overdue' && styles.activeTabText]}>
            Overdue
          </Text>
          {overdueMaintenance.length > 0 && (
            <View style={[styles.badge, styles.badgeOverdue]}>
              <Text style={styles.badgeText}>{overdueMaintenance.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {currentData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={
                activeTab === 'upcoming'
                  ? 'calendar-outline'
                  : activeTab === 'overdue'
                  ? 'alert-circle-outline'
                  : 'checkmark-done-circle-outline'
              }
              size={64}
              color="#C7C7CC"
            />
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming'
                ? 'No upcoming maintenance'
                : activeTab === 'overdue'
                ? 'No overdue maintenance'
                : 'No completed maintenance'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'upcoming' || activeTab === 'overdue'
                ? 'Tap + to add a new maintenance schedule'
                : 'Completed maintenance will appear here'}
            </Text>
          </View>
        ) : (
          currentData.map((item) => renderMaintenanceCard(item, activeTab !== 'completed'))
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    paddingTop: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    height: 50,
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
  badgeOverdue: {
    backgroundColor: '#FF3B30',
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
    alignItems: 'center',
    marginBottom: 12,
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
  assetName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  assetType: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
  },
  cardBody: {
    gap: 10,
  },
  maintenanceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F2FF',
  },
  recurringText: {
    fontSize: 11,
    color: '#5856D6',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  overdue: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  dueInText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  overdueText: {
    color: '#FF3B30',
    fontWeight: '700',
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cost: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34C759',
  },
  notes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  completeButton: {
    marginTop: 12,
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  completedBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  completedText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
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
