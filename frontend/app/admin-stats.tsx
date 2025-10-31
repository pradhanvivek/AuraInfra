import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface AdminStats {
  total_users: number;
  recent_users_30d: number;
  total_assets: number;
  assets_by_category: {
    properties: number;
    vehicles: number;
    appliances: number;
    jewelry: number;
    furniture: number;
    art: number;
  };
  users: Array<{
    id: string;
    username: string;
    email?: string;
    created_at: string;
  }>;
}

export default function AdminStatsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch admin stats:', error);
      Alert.alert('Error', 'Failed to load admin statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load statistics</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={fetchStats} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.cardsRow}>
            <View style={[styles.statCard, styles.primaryCard]}>
              <Ionicons name="people" size={32} color="#007AFF" />
              <Text style={styles.statValue}>{stats.total_users}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={[styles.statCard, styles.successCard]}>
              <Ionicons name="person-add" size={32} color="#34C759" />
              <Text style={styles.statValue}>{stats.recent_users_30d}</Text>
              <Text style={styles.statLabel}>New (30 days)</Text>
            </View>
          </View>
          <View style={[styles.statCard, styles.fullWidthCard]}>
            <Ionicons name="grid" size={32} color="#5856D6" />
            <Text style={styles.statValue}>{stats.total_assets}</Text>
            <Text style={styles.statLabel}>Total Assets</Text>
          </View>
        </View>

        {/* Assets Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assets by Category</Text>
          <View style={styles.categoryList}>
            <View style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Ionicons name="home" size={24} color="#FF9500" />
                <Text style={styles.categoryName}>Properties</Text>
              </View>
              <Text style={styles.categoryCount}>{stats.assets_by_category.properties}</Text>
            </View>
            <View style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Ionicons name="car" size={24} color="#007AFF" />
                <Text style={styles.categoryName}>Vehicles</Text>
              </View>
              <Text style={styles.categoryCount}>{stats.assets_by_category.vehicles}</Text>
            </View>
            <View style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Ionicons name="tv" size={24} color="#34C759" />
                <Text style={styles.categoryName}>Appliances</Text>
              </View>
              <Text style={styles.categoryCount}>{stats.assets_by_category.appliances}</Text>
            </View>
            <View style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Ionicons name="diamond" size={24} color="#FF2D55" />
                <Text style={styles.categoryName}>Jewelry</Text>
              </View>
              <Text style={styles.categoryCount}>{stats.assets_by_category.jewelry}</Text>
            </View>
            <View style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Ionicons name="bed" size={24} color="#34C759" />
                <Text style={styles.categoryName}>Furniture</Text>
              </View>
              <Text style={styles.categoryCount}>{stats.assets_by_category.furniture}</Text>
            </View>
            <View style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <Ionicons name="color-palette" size={24} color="#5856D6" />
                <Text style={styles.categoryName}>Art</Text>
              </View>
              <Text style={styles.categoryCount}>{stats.assets_by_category.art}</Text>
            </View>
          </View>
        </View>

        {/* Users List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registered Users ({stats.users.length})</Text>
          {stats.users.map((user, index) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.username}</Text>
                {user.email && <Text style={styles.userEmail}>{user.email}</Text>}
                <Text style={styles.userDate}>
                  Joined: {formatDate(user.created_at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryCard: {
    flex: 1,
  },
  successCard: {
    flex: 1,
  },
  fullWidthCard: {
    width: '100%',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  categoryList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
