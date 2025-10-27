import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { vastuApi } from '../../services/api';

interface VastuAnalysis {
  id: string;
  floor_plan_image: string;
  analysis_text: string;
  compliance_score?: number;
  created_at: string;
}

interface VastuScreenProps {
  propertyId: string;
}

export default function VastuScreen({ propertyId }: VastuScreenProps) {
  const { token } = useAuth();
  const [analyses, setAnalyses] = useState<VastuAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const data = await vastuApi.getAll(token!, propertyId);
      setAnalyses(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load Vastu analyses');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFloorPlan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const file = result.assets[0];
    const base64Data = file.base64;

    if (!base64Data) {
      Alert.alert('Error', 'Unable to process image');
      return;
    }

    setAnalyzing(true);
    try {
      await vastuApi.create(token!, propertyId, base64Data);
      Alert.alert('Success', 'Vastu analysis completed successfully');
      fetchAnalyses();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to analyze floor plan');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteAnalysis = (analysis: VastuAnalysis) => {
    Alert.alert(
      'Delete Analysis',
      'Are you sure you want to delete this Vastu analysis?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await vastuApi.delete(token!, propertyId, analysis.id);
              fetchAnalyses();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete analysis');
            }
          },
        },
      ]
    );
  };

  const getScoreColor = (score?: number) => {
    if (!score) return '#8E8E93';
    if (score >= 80) return '#34C759';
    if (score >= 60) return '#FF9500';
    return '#FF3B30';
  };

  const getScoreLabel = (score?: number) => {
    if (!score) return 'Not rated';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {analyses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No Vastu Analysis Yet</Text>
          <Text style={styles.emptySubtext}>
            Upload a floor plan to get Vastu compliance analysis
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handleAnalyzeFloorPlan}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>  Analyze Floor Plan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {analyses.map((analysis) => (
            <View key={analysis.id} style={styles.analysisCard}>
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <Ionicons name="stats-chart" size={24} color="#007AFF" />
                  <View style={styles.headerInfo}>
                    <Text style={styles.cardTitle}>Vastu Analysis</Text>
                    <Text style={styles.cardDate}>
                      {new Date(analysis.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteAnalysis(analysis)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>

              {analysis.compliance_score !== undefined && (
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreCircle}>
                    <Text
                      style={[
                        styles.scoreText,
                        { color: getScoreColor(analysis.compliance_score) },
                      ]}
                    >
                      {analysis.compliance_score}
                    </Text>
                    <Text style={styles.scoreOutOf}>/100</Text>
                  </View>
                  <View style={styles.scoreInfo}>
                    <Text style={styles.scoreLabel}>Compliance Score</Text>
                    <Text
                      style={[
                        styles.scoreStatus,
                        { color: getScoreColor(analysis.compliance_score) },
                      ]}
                    >
                      {getScoreLabel(analysis.compliance_score)}
                    </Text>
                  </View>
                </View>
              )}

              {analysis.floor_plan_image && (
                <Image
                  source={{
                    uri: `data:image/jpeg;base64,${analysis.floor_plan_image}`,
                  }}
                  style={styles.floorPlanImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.analysisContent}>
                <Text style={styles.analysisTitle}>Analysis & Recommendations</Text>
                <Text style={styles.analysisText}>{analysis.analysis_text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {analyses.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, analyzing && styles.fabDisabled]}
          onPress={handleAnalyzeFloorPlan}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="add" size={28} color="#fff" />
          )}
        </TouchableOpacity>
      )}
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
  content: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  analysisCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cardDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreOutOf: {
    fontSize: 12,
    color: '#8E8E93',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  scoreStatus: {
    fontSize: 18,
    fontWeight: '600',
  },
  floorPlanImage: {
    width: '100%',
    height: 200,
  },
  analysisContent: {
    padding: 16,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  analysisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDisabled: {
    opacity: 0.6,
  },
});
