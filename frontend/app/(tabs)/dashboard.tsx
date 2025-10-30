import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import { formatCurrency } from '../../utils/localeUtils';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const { width } = Dimensions.get('window');
const tileSize = (width - 48) / 2; // 2 columns with padding

interface PortfolioData {
  total_value: number;
  properties_count: number;
  vehicles_count: number;
  appliances_count: number;
  jewelry_count: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolioSummary();
  }, []);

  const fetchPortfolioSummary = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/portfolio/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPortfolioData(response.data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      // Set default values if API fails
      setPortfolioData({
        total_value: 0,
        properties_count: 0,
        vehicles_count: 0,
        appliances_count: 0,
        jewelry_count: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    {
      id: 'properties',
      title: 'Properties',
      icon: 'home',
      color: '#007AFF',
      route: '/property-list',
      count: portfolioData?.properties_count || 0,
    },
    {
      id: 'vehicles',
      title: 'Vehicles',
      icon: 'car',
      color: '#FF9500',
      route: '/vehicles',
      count: portfolioData?.vehicles_count || 0,
    },
    {
      id: 'appliances',
      title: 'Appliances',
      icon: 'tv',
      color: '#34C759',
      route: '/appliances',
      count: portfolioData?.appliances_count || 0,
    },
    {
      id: 'jewelry',
      title: 'Jewelry',
      icon: 'diamond',
      color: '#FF2D55',
      route: '/jewelry',
      count: portfolioData?.jewelry_count || 0,
    },
    {
      id: 'portfolio',
      title: 'Portfolio',
      icon: 'pie-chart',
      color: '#5856D6',
      route: '/portfolio',
      count: 0,
    },
  ];

  const handleTilePress = (route: string) => {
    if (route === '/property-list') {
      router.push('/properties');
    } else {
      router.push(route as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.username || 'User'}!</Text>
          <Text style={styles.subtitle}>Manage your assets</Text>
        </View>
        {portfolioData && (
          <View style={styles.valueCard}>
            <Text style={styles.valueLabel}>Total Value</Text>
            <Text style={styles.valueAmount}>
              {formatCurrency(portfolioData.total_value)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Asset Categories</Text>
        
        <View style={styles.tilesContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.tile, { backgroundColor: category.color }]}
              onPress={() => handleTilePress(category.route)}
              activeOpacity={0.8}
            >
              <View style={styles.tileHeader}>
                <Ionicons name={category.icon as any} size={32} color="#fff" />
                {category.count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{category.count}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tileTitle}>{category.title}</Text>
              <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/portfolio' as any)}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="bar-chart" size={24} color="#007AFF" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Portfolio Report</Text>
              <Text style={styles.actionSubtitle}>See all assets & generate PDF</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/scan-asset' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="camera" size={24} color="#34C759" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Quick Scan</Text>
              <Text style={styles.actionSubtitle}>Use AI to identify any asset</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  valueCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  valueLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  valueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#34C759',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    marginTop: 8,
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  tile: {
    width: tileSize,
    aspectRatio: 1,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 'auto',
  },
  quickActions: {
    marginTop: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E5F1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
