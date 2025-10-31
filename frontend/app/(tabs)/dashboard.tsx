import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useCallback } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import { formatCurrency } from '../../utils/localeUtils';
import { getCurrencyInfo } from '../../utils/localeUtils';
import { PieChart } from 'react-native-chart-kit';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const { width } = Dimensions.get('window');
// Responsive tile size: smaller on larger screens, rectangular shape
const getTileSize = () => {
  if (width > 1024) return { width: 160, height: 120 }; // Desktop/Laptop - rectangular
  if (width > 768) return { width: 150, height: 110 }; // Tablet - rectangular
  return { width: width * 0.4, height: width * 0.28 }; // Mobile - rectangular (wider than tall)
};
const tileSize = getTileSize();

interface PortfolioData {
  total_value: number;
  properties_value: number;
  vehicles_value: number;
  appliances_value: number;
  jewelry_value: number;
  furniture_value: number;
  art_value: number;
  properties_count: number;
  vehicles_count: number;
  appliances_count: number;
  jewelry_count: number;
  furniture_count: number;
  art_count: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { token, username } = useAuth();
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValueHidden, setIsValueHidden] = useState(true);

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
        furniture_count: 0,
        art_count: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPortfolioSummary();
    }, [token])
  );

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
      id: 'furniture',
      title: 'Furniture',
      icon: 'bed',
      color: '#34C759',
      route: '/furniture',
      count: portfolioData?.furniture_count || 0,
    },
    {
      id: 'art',
      title: 'Art',
      icon: 'color-palette',
      color: '#AF52DE',
      route: '/art',
      count: portfolioData?.art_count || 0,
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

  // Prepare pie chart data
  const getChartData = () => {
    if (!portfolioData) return [];
    
    const currencySymbol = getCurrencyInfo().symbol;
    
    const formatChartValue = (value: number) => {
      return `${currencySymbol}${value.toLocaleString()}`;
    };
    
    const data = [
      { 
        name: `Properties: ${formatChartValue(portfolioData.properties_value)}`, 
        value: portfolioData.properties_value, 
        color: '#007AFF', 
        legendFontColor: '#000', 
        legendFontSize: 11 
      },
      { 
        name: `Vehicles: ${formatChartValue(portfolioData.vehicles_value)}`, 
        value: portfolioData.vehicles_value, 
        color: '#FF9500', 
        legendFontColor: '#000', 
        legendFontSize: 11 
      },
      { 
        name: `Appliances: ${formatChartValue(portfolioData.appliances_value)}`, 
        value: portfolioData.appliances_value, 
        color: '#34C759', 
        legendFontColor: '#000', 
        legendFontSize: 11 
      },
      { 
        name: `Jewelry: ${formatChartValue(portfolioData.jewelry_value)}`, 
        value: portfolioData.jewelry_value, 
        color: '#FF2D55', 
        legendFontColor: '#000', 
        legendFontSize: 11 
      },
      { 
        name: `Furniture: ${formatChartValue(portfolioData.furniture_value)}`, 
        value: portfolioData.furniture_value, 
        color: '#5856D6', 
        legendFontColor: '#000', 
        legendFontSize: 11 
      },
      { 
        name: `Art: ${formatChartValue(portfolioData.art_value)}`, 
        value: portfolioData.art_value, 
        color: '#FF3B30', 
        legendFontColor: '#000', 
        legendFontSize: 11 
      },
    ];
    
    // Filter out categories with 0 value
    return data.filter(item => item.value > 0);
  };

  const chartData = getChartData();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Image 
              source={{ uri: 'https://customer-assets.emergentagent.com/job_95500ee6-6a87-4222-9712-857c1f99b6e3/artifacts/6qjibbhd_logo-new-over.webp' }}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.greeting}>Hello, {username || 'User'}!</Text>
          </View>
          {portfolioData && (
            <View style={styles.valueCard}>
              <Text style={styles.valueLabel}>Total Portfolio Value</Text>
              <Text style={styles.valueAmount}>
                {formatCurrency(portfolioData.total_value)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio Chart Preview */}
        {chartData.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Portfolio Overview</Text>
            <View style={styles.chartCard}>
              <PieChart
                data={chartData}
                width={width - 40}
                height={180}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="value"
                backgroundColor="transparent"
                paddingLeft="0"
                center={[10, 0]}
                absolute
                hasLegend={false}
              />
              {/* Custom Legend without numbers */}
              <View style={styles.customLegend}>
                {chartData.map((item, index) => (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Horizontally Scrollable Tiles */}
        <View style={styles.tilesSection}>
          <Text style={styles.sectionTitle}>Your Assets</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tilesContainer}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.tile, { backgroundColor: category.color }]}
                onPress={() => handleTilePress(category.route)}
                activeOpacity={0.8}
              >
                <View style={styles.tileTop}>
                  <Ionicons name={category.icon as any} size={28} color="#fff" />
                  {category.count > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{category.count}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.tileBottom}>
                  <Text style={styles.tileTitle}>{category.title}</Text>
                  <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  valueCard: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  valueLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  valueAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
  },
  content: {
    padding: 12,
  },
  chartSection: {
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customLegend: {
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#000',
    flex: 1,
  },
  tilesSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  tilesContainer: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 12,
  },
  tile: {
    width: tileSize.width,
    height: tileSize.height,
    borderRadius: 16,
    padding: 10,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
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
