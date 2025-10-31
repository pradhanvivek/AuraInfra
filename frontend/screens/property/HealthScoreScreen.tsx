import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { propertyApi, authApi } from '../../services/api';

interface HealthScoreScreenProps {
  propertyId: string;
}

export default function HealthScoreScreen({ propertyId }: HealthScoreScreenProps) {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [geomancyPreference, setGeomancyPreference] = useState<'vastu' | 'feng_shui'>('vastu');

  useEffect(() => {
    fetchUserPreferenceAndHealthScore();
  }, []);

  const fetchUserPreferenceAndHealthScore = async () => {
    try {
      // Fetch user preference first
      const profile = await authApi.getProfile(token!);
      setGeomancyPreference(profile.geomancy_preference || 'vastu');
      
      // Then fetch health score
      const data = await propertyApi.getHealthScore(token!, propertyId);
      setHealthData(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load health score');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryPress = (key: string) => {
    // Map health score categories to their respective screens
    const routeMap: { [key: string]: string } = {
      'documents': `/property/${propertyId}/documents`,
      'fixtures': `/property/${propertyId}/fixtures`,
      'measurements': `/property/${propertyId}/measurements`,
      'vastu_feng_shui': `/property/${propertyId}/vastu`,
      'paint_estimation': `/property/${propertyId}/paint-estimation`,
    };
    
    if (routeMap[key]) {
      router.push(routeMap[key] as any);
    }
  };
    try {
      const data = await propertyApi.getHealthScore(token!, propertyId);
      setHealthData(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load health score');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHealthScore();
    setRefreshing(false);
  };

  const geomancyLabel = geomancyPreference === 'vastu' ? 'Vastu' : 'Feng Shui';

  const getCategoryName = (category: string) => {
    if (category === 'vastu') {
      return 'Geomancy';
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      documents: 'document-text',
      fixtures: 'construct',
      measurements: 'resize',
      vastu: 'compass',
    };
    return icons[category] || 'information-circle';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return '#FF3B30';
    if (priority === 'medium') return '#FF9500';
    return '#5856D6';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!healthData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No data available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Overall Score Card */}
      <View style={styles.overallCard}>
        <View style={[styles.scoreCircle, { borderColor: healthData.grade_color }]}>
          <Text style={[styles.scoreGrade, { color: healthData.grade_color }]}>
            {healthData.grade}
          </Text>
        </View>
        <View style={styles.overallInfo}>
          <Text style={styles.scoreLabel}>Property Health Score</Text>
          <Text style={[styles.scoreValue, { color: healthData.grade_color }]}>
            {healthData.score}%
          </Text>
          <Text style={styles.scoreDescription}>
            {healthData.score >= 90 ? 'Excellent' :
             healthData.score >= 80 ? 'Very Good' :
             healthData.score >= 70 ? 'Good' :
             healthData.score >= 60 ? 'Fair' : 'Needs Improvement'}
          </Text>
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        
        {Object.entries(healthData.breakdown).map(([key, data]: [string, any]) => (
          <TouchableOpacity 
            key={key} 
            style={styles.categoryCard}
            onPress={() => handleCategoryPress(key)}
            activeOpacity={0.7}
          >
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleRow}>
                <Ionicons name={getCategoryIcon(key) as any} size={24} color="#007AFF" />
                <View style={styles.categoryTextContainer}>
                  <Text style={styles.categoryTitle}>
                    {getCategoryName(key)}
                  </Text>
                  <Text style={styles.categoryWeight}>Weight: {data.weight}%</Text>
                </View>
              </View>
              <Text style={[styles.categoryScore, { color: data.score >= 70 ? '#34C759' : '#FF9500' }]}>
                {data.score}%
              </Text>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { 
                    width: `${data.score}%`,
                    backgroundColor: data.score >= 70 ? '#34C759' : '#FF9500'
                  }
                ]} 
              />
            </View>

            {/* Category Details */}
            {key === 'documents' && (
              <Text style={styles.categoryDetail}>
                {data.count} of {data.expected} documents added
              </Text>
            )}
            {key === 'fixtures' && (
              <Text style={styles.categoryDetail}>
                {data.count} fixture(s) tracked
              </Text>
            )}
            {key === 'measurements' && (
              <Text style={styles.categoryDetail}>
                {data.measured_rooms} of {data.expected_rooms} rooms measured
              </Text>
            )}
            {key === 'vastu' && (
              <Text style={styles.categoryDetail}>
                {data.analyzed ? 'Analysis complete' : 'Not analyzed'}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Recommendations */}
      {healthData.recommendations && healthData.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {healthData.recommendations.map((rec: any, index: number) => (
            <View key={index} style={styles.recommendationCard}>
              <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(rec.priority)}20` }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(rec.priority) }]}>
                  {rec.priority.toUpperCase()}
                </Text>
              </View>
              <View style={styles.recommendationContent}>
                <Ionicons 
                  name={getCategoryIcon(rec.category) as any}
                  size={20} 
                  color="#007AFF" 
                  style={styles.recIcon}
                />
                <Text style={styles.recommendationText}>{rec.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  overallCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  scoreGrade: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  overallInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  categoryWeight: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  categoryScore: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  categoryDetail: {
    fontSize: 13,
    color: '#8E8E93',
  },
  recommendationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  recommendationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
