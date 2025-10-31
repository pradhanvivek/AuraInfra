import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { formatCurrency } from '../utils/localeUtils';
import { PieChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const screenWidth = Dimensions.get('window').width;

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

export default function PortfolioScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/portfolio/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPortfolio(response.data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      Alert.alert('Error', 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!portfolio) return;

    try {
      setGeneratingPDF(true);

      // Prepare data for PDF
      const categories = getCategoriesData();
      const totalAssets = portfolio.properties_count + portfolio.vehicles_count + 
                         portfolio.appliances_count + portfolio.jewelry_count +
                         portfolio.furniture_count + portfolio.art_count;

      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #5856D6;
            }
            .logo {
              width: 60px;
              height: 60px;
              background: #5856D6;
              border-radius: 15px;
              margin: 0 auto 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 32px;
              font-weight: bold;
            }
            h1 {
              color: #5856D6;
              margin: 0;
              font-size: 24px;
            }
            .subtitle {
              color: #666;
              font-size: 14px;
              margin-top: 5px;
            }
            .summary-card {
              background: linear-gradient(135deg, #5856D6 0%, #7B79E8 100%);
              color: white;
              padding: 25px;
              border-radius: 15px;
              margin: 20px 0;
              text-align: center;
            }
            .summary-label {
              font-size: 14px;
              opacity: 0.9;
              margin-bottom: 10px;
            }
            .summary-value {
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .summary-subtext {
              font-size: 14px;
              opacity: 0.9;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              margin: 30px 0 15px;
              color: #000;
            }
            .category-item {
              background: #f8f8f8;
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .category-info {
              flex: 1;
            }
            .category-name {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 5px;
            }
            .category-count {
              font-size: 12px;
              color: #666;
            }
            .category-values {
              text-align: right;
            }
            .category-value {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 3px;
            }
            .category-percentage {
              font-size: 12px;
              color: #666;
            }
            .progress-bar {
              height: 6px;
              background: #e0e0e0;
              border-radius: 3px;
              margin-top: 10px;
              overflow: hidden;
            }
            .progress-fill {
              height: 100%;
              border-radius: 3px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .stats-grid {
              display: flex;
              gap: 15px;
              margin: 20px 0;
            }
            .stat-card {
              flex: 1;
              background: #f8f8f8;
              border-radius: 12px;
              padding: 20px;
              text-align: center;
            }
            .stat-value {
              font-size: 28px;
              font-weight: bold;
              margin: 10px 0;
            }
            .stat-label {
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">A</div>
            <h1>AuraInfra.ai</h1>
            <div class="subtitle">Personal Asset Management System</div>
          </div>

          <div class="summary-card">
            <div class="summary-label">Total Portfolio Value</div>
            <div class="summary-value">${formatCurrency(portfolio.total_value)}</div>
            <div class="summary-subtext">${totalAssets} items across ${categories.length} categories</div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Assets</div>
              <div class="stat-value">${totalAssets}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Categories</div>
              <div class="stat-value">${categories.length}</div>
            </div>
          </div>

          <div class="section-title">Asset Breakdown</div>
          
          ${categories.map(cat => `
            <div class="category-item">
              <div class="category-info">
                <div class="category-name">${cat.name}</div>
                <div class="category-count">${cat.count} items</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
                </div>
              </div>
              <div class="category-values">
                <div class="category-value" style="color: ${cat.color};">${formatCurrency(cat.value)}</div>
                <div class="category-percentage">${cat.percentage.toFixed(1)}%</div>
              </div>
            </div>
          `).join('')}

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p>AuraInfra.ai - Your Digital Vault for Physical Assets</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Share PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Portfolio Report',
          UTI: 'com.adobe.pdf',
        });
        Alert.alert('Success', 'Portfolio PDF generated successfully!');
      } else {
        Alert.alert('Success', `PDF saved to: ${uri}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const getCategoriesData = () => {
    if (!portfolio) return [];
    
    const categories = [
      {
        name: 'Properties',
        value: portfolio.properties_value,
        count: portfolio.properties_count,
        icon: 'home',
        color: '#007AFF',
        percentage: portfolio.total_value > 0 ? (portfolio.properties_value / portfolio.total_value) * 100 : 0,
      },
      {
        name: 'Vehicles',
        value: portfolio.vehicles_value,
        count: portfolio.vehicles_count,
        icon: 'car',
        color: '#FF9500',
        percentage: portfolio.total_value > 0 ? (portfolio.vehicles_value / portfolio.total_value) * 100 : 0,
      },
      {
        name: 'Appliances',
        value: portfolio.appliances_value,
        count: portfolio.appliances_count,
        icon: 'tv',
        color: '#34C759',
        percentage: portfolio.total_value > 0 ? (portfolio.appliances_value / portfolio.total_value) * 100 : 0,
      },
      {
        name: 'Jewelry',
        value: portfolio.jewelry_value,
        count: portfolio.jewelry_count,
        icon: 'diamond',
        color: '#FF2D55',
        percentage: portfolio.total_value > 0 ? (portfolio.jewelry_value / portfolio.total_value) * 100 : 0,
      },
      {
        name: 'Furniture',
        value: portfolio.furniture_value,
        count: portfolio.furniture_count,
        icon: 'bed',
        color: '#5856D6',
        percentage: portfolio.total_value > 0 ? (portfolio.furniture_value / portfolio.total_value) * 100 : 0,
      },
      {
        name: 'Art',
        value: portfolio.art_value,
        count: portfolio.art_count,
        icon: 'color-palette',
        color: '#FF3B30',
        percentage: portfolio.total_value > 0 ? (portfolio.art_value / portfolio.total_value) * 100 : 0,
      },
    ];

    // Filter out categories with 0 items
    return categories.filter(cat => cat.count > 0);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  if (!portfolio) {
    return (
      <View style={styles.centerContainer}>
        <Text>Failed to load portfolio</Text>
      </View>
    );
  }

  const categories = [
    {
      name: 'Properties',
      value: portfolio.properties_value,
      count: portfolio.properties_count,
      icon: 'home',
      color: '#007AFF',
      percentage: (portfolio.properties_value / portfolio.total_value) * 100,
    },
    {
      name: 'Vehicles',
      value: portfolio.vehicles_value,
      count: portfolio.vehicles_count,
      icon: 'car',
      color: '#FF9500',
      percentage: (portfolio.vehicles_value / portfolio.total_value) * 100,
    },
    {
      name: 'Appliances',
      value: portfolio.appliances_value,
      count: portfolio.appliances_count,
      icon: 'tv',
      color: '#34C759',
      percentage: (portfolio.appliances_value / portfolio.total_value) * 100,
    },
    {
      name: 'Jewelry',
      value: portfolio.jewelry_value,
      count: portfolio.jewelry_count,
      icon: 'diamond',
      color: '#FF2D55',
      percentage: (portfolio.jewelry_value / portfolio.total_value) * 100,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity onPress={handleGeneratePDF}>
          <Ionicons name="download-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Total Value Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Portfolio Value</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(portfolio.total_value)}
          </Text>
          <Text style={styles.totalSubtext}>
            {portfolio.properties_count + portfolio.vehicles_count + 
             portfolio.appliances_count + portfolio.jewelry_count} items total
          </Text>
        </View>

        {/* Category Breakdown */}
        <Text style={styles.sectionTitle}>Asset Breakdown</Text>
        
        {categories.map((category) => (
          <View key={category.name} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryInfo}>
                <View style={[styles.iconCircle, { backgroundColor: category.color + '20' }]}>
                  <Ionicons name={category.icon as any} size={24} color={category.color} />
                </View>
                <View style={styles.categoryText}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryCount}>{category.count} items</Text>
                </View>
              </View>
              <View style={styles.categoryValues}>
                <Text style={[styles.categoryValue, { color: category.color }]}>
                  {formatCurrency(category.value)}
                </Text>
                <Text style={styles.categoryPercentage}>
                  {category.percentage.toFixed(1)}%
                </Text>
              </View>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${category.percentage}%`,
                    backgroundColor: category.color 
                  }
                ]} 
              />
            </View>
          </View>
        ))}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Reports & Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleGeneratePDF}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="document-text" size={24} color="#5856D6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Generate PDF Report</Text>
              <Text style={styles.actionSubtitle}>
                Complete asset inventory with photos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                'Insurance Report',
                'Coming soon: Generate insurance-ready asset report with appraisal values.'
              );
            }}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#34C759" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Insurance Report</Text>
              <Text style={styles.actionSubtitle}>
                For insurance claims & coverage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={32} color="#34C759" />
            <Text style={styles.statValue}>
              {portfolio.properties_count + portfolio.vehicles_count + 
               portfolio.appliances_count + portfolio.jewelry_count}
            </Text>
            <Text style={styles.statLabel}>Total Assets</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="bar-chart" size={32} color="#007AFF" />
            <Text style={styles.statValue}>4</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
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
  content: {
    padding: 16,
  },
  totalCard: {
    backgroundColor: '#5856D6',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  totalSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryText: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  categoryValues: {
    alignItems: 'flex-end',
  },
  categoryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#8E8E93',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  actionsSection: {
    marginTop: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEE7FF',
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
});