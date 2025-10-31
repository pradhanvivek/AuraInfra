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

      // Fetch detailed asset data
      const response = await axios.get(
        `${API_URL}/api/portfolio/details`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const detailedData = response.data;

      // Prepare data for PDF
      const categories = getCategoriesData();
      const totalAssets = portfolio.properties_count + portfolio.vehicles_count + 
                         portfolio.appliances_count + portfolio.jewelry_count +
                         portfolio.furniture_count + portfolio.art_count;

      // Helper to render asset items
      const renderAssetSection = (title: string, items: any[], valueField: string = 'current_value') => {
        if (items.length === 0) return '';
        
        return `
          <div class="asset-section">
            <h2 class="asset-section-title">${title}</h2>
            ${items.map((item, index) => `
              <div class="asset-item">
                <div class="asset-number">${index + 1}</div>
                <div class="asset-details">
                  <div class="asset-name">${item.name || item.model || item.brand || 'Unnamed Item'}</div>
                  ${item.brand ? `<div class="asset-meta">Brand: ${item.brand}</div>` : ''}
                  ${item.model ? `<div class="asset-meta">Model: ${item.model}</div>` : ''}
                  ${item.address ? `<div class="asset-meta">Address: ${item.address}</div>` : ''}
                  ${item.category ? `<div class="asset-meta">Category: ${item.category}</div>` : ''}
                  ${item.artist ? `<div class="asset-meta">Artist: ${item.artist}</div>` : ''}
                  ${item.material ? `<div class="asset-meta">Material: ${item.material}</div>` : ''}
                  ${item.purchase_date ? `<div class="asset-meta">Purchased: ${new Date(item.purchase_date).toLocaleDateString()}</div>` : ''}
                  ${item.warranty_expiry ? `<div class="asset-meta">Warranty Until: ${new Date(item.warranty_expiry).toLocaleDateString()}</div>` : ''}
                  <div class="asset-value">${formatCurrency(item[valueField] || item.purchase_cost || item.appraisal_value || 0)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      };

      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 30px;
              color: #333;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 30px;
              border-bottom: 3px solid #5856D6;
            }
            .logo {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #5856D6 0%, #7B79E8 100%);
              border-radius: 20px;
              margin: 0 auto 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 40px;
              font-weight: bold;
              box-shadow: 0 4px 15px rgba(88, 86, 214, 0.3);
            }
            h1 {
              color: #5856D6;
              margin: 10px 0;
              font-size: 32px;
            }
            .subtitle {
              color: #666;
              font-size: 16px;
              margin-top: 8px;
            }
            .summary-card {
              background: linear-gradient(135deg, #5856D6 0%, #7B79E8 100%);
              color: white;
              padding: 35px;
              border-radius: 20px;
              margin: 30px 0;
              text-align: center;
              box-shadow: 0 6px 20px rgba(88, 86, 214, 0.3);
            }
            .summary-label {
              font-size: 16px;
              opacity: 0.95;
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .summary-value {
              font-size: 48px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .summary-subtext {
              font-size: 16px;
              opacity: 0.9;
            }
            .section-title {
              font-size: 24px;
              font-weight: bold;
              margin: 40px 0 20px;
              color: #000;
              padding-bottom: 10px;
              border-bottom: 2px solid #f0f0f0;
            }
            .category-item {
              background: #f8f8f8;
              border-radius: 15px;
              padding: 20px;
              margin-bottom: 15px;
            }
            .category-name {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .category-count {
              font-size: 14px;
              color: #666;
              margin-bottom: 12px;
            }
            .category-value {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .category-percentage {
              font-size: 14px;
              color: #666;
            }
            .progress-bar {
              height: 8px;
              background: #e0e0e0;
              border-radius: 4px;
              margin-top: 12px;
              overflow: hidden;
            }
            .progress-fill {
              height: 100%;
              border-radius: 4px;
            }
            .asset-section {
              margin: 30px 0;
              page-break-inside: avoid;
            }
            .asset-section-title {
              font-size: 22px;
              font-weight: bold;
              color: #5856D6;
              margin: 25px 0 15px;
              padding: 12px 20px;
              background: #F3F2FF;
              border-left: 5px solid #5856D6;
              border-radius: 8px;
            }
            .asset-item {
              background: white;
              border: 1px solid #e0e0e0;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 15px;
              display: flex;
              gap: 20px;
              page-break-inside: avoid;
            }
            .asset-number {
              width: 40px;
              height: 40px;
              background: #5856D6;
              color: white;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 18px;
              flex-shrink: 0;
            }
            .asset-details {
              flex: 1;
            }
            .asset-name {
              font-size: 18px;
              font-weight: 700;
              color: #000;
              margin-bottom: 10px;
            }
            .asset-meta {
              font-size: 14px;
              color: #666;
              margin: 5px 0;
            }
            .asset-value {
              font-size: 20px;
              font-weight: bold;
              color: #5856D6;
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #f0f0f0;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin: 30px 0;
            }
            .stat-card {
              background: #f8f8f8;
              border-radius: 15px;
              padding: 25px;
              text-align: center;
            }
            .stat-value {
              font-size: 36px;
              font-weight: bold;
              margin: 15px 0;
              color: #5856D6;
            }
            .stat-label {
              font-size: 14px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .footer {
              margin-top: 60px;
              padding-top: 30px;
              border-top: 2px solid #e0e0e0;
              text-align: center;
              color: #666;
              font-size: 13px;
            }
            .page-break {
              page-break-after: always;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">A</div>
            <h1>AuraInfra.ai</h1>
            <div class="subtitle">Personal Asset Management System - Comprehensive Portfolio Report</div>
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

          <div class="section-title">Portfolio Breakdown</div>
          
          ${categories.map(cat => `
            <div class="category-item">
              <div class="category-name">${cat.name}</div>
              <div class="category-count">${cat.count} items</div>
              <div class="category-value" style="color: ${cat.color};">${formatCurrency(cat.value)}</div>
              <div class="category-percentage">${cat.percentage.toFixed(1)}% of total portfolio</div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
              </div>
            </div>
          `).join('')}

          <div class="page-break"></div>

          <!-- Detailed Asset Listings -->
          ${renderAssetSection('Properties', detailedData.properties)}
          ${renderAssetSection('Vehicles', detailedData.vehicles)}
          ${renderAssetSection('Appliances', detailedData.appliances)}
          ${renderAssetSection('Jewelry', detailedData.jewelry, 'appraisal_value')}
          ${renderAssetSection('Furniture', detailedData.furniture)}
          ${renderAssetSection('Art', detailedData.art, 'appraisal_value')}

          <div class="footer">
            <p><strong>Generated on ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</strong></p>
            <p style="margin-top: 10px;">AuraInfra.ai - Your Digital Vault for Physical Assets</p>
            <p style="margin-top: 5px; font-size: 12px; color: #999;">This report contains confidential information. Keep secure.</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({ 
        html: htmlContent,
        width: 612, // A4 width in points
        height: 792, // A4 height in points
      });
      
      // Share PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Portfolio Report - AuraInfra.ai',
          UTI: 'com.adobe.pdf',
        });
        Alert.alert('Success', 'Comprehensive portfolio PDF generated successfully!');
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

  const categories = getCategoriesData();

  // Prepare chart data
  const chartData = categories.map((cat) => ({
    name: cat.name,
    population: cat.value,
    color: cat.color,
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  const totalAssets = portfolio.properties_count + portfolio.vehicles_count + 
                     portfolio.appliances_count + portfolio.jewelry_count +
                     portfolio.furniture_count + portfolio.art_count;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity onPress={handleGeneratePDF} disabled={generatingPDF}>
          <Ionicons 
            name={generatingPDF ? "hourglass-outline" : "download-outline"} 
            size={28} 
            color="#007AFF" 
          />
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
            {totalAssets} items total
          </Text>
        </View>

        {/* Visual Chart */}
        {chartData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Portfolio Distribution</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={chartData}
                width={screenWidth - 48}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          </View>
        )}

        {/* Category Breakdown */}
        <Text style={styles.sectionTitle}>Asset Breakdown</Text>
        
        {categories.map((category) => {
          // Map category names to routes
          const routeMap: { [key: string]: string } = {
            'Properties': '/properties',
            'Vehicles': '/vehicles',
            'Appliances': '/appliances',
            'Jewelry': '/jewelry',
            'Furniture': '/furniture',
            'Art': '/arts',
          };
          
          return (
            <TouchableOpacity 
              key={category.name} 
              style={styles.categoryCard}
              onPress={() => router.push(routeMap[category.name] as any)}
              activeOpacity={0.7}
            >
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
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" style={{ marginLeft: 4 }} />
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
            </TouchableOpacity>
          );
        })}

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
            <Text style={styles.statValue}>{totalAssets}</Text>
            <Text style={styles.statLabel}>Total Assets</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="bar-chart" size={32} color="#007AFF" />
            <Text style={styles.statValue}>{categories.length}</Text>
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
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
});