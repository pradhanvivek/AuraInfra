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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface PaintEstimationScreenProps {
  propertyId: string;
}

interface WallDimensions {
  wall_width: number;
  wall_height: number;
  doors: number;
  windows: number;
}

interface PaintEstimate {
  total_wall_area: number;
  paintable_area: number;
  paint_gallons_needed: number;
  estimated_cost_low: number;
  estimated_cost_high: number;
  walls: WallDimensions[];
}

interface SavedEstimation {
  id: string;
  room_name: string;
  paintable_area: number;
  paint_gallons_needed: number;
  estimated_cost_low: number;
  estimated_cost_high: number;
  created_at: string;
}

export default function PaintEstimationScreen({ propertyId }: PaintEstimationScreenProps) {
  const { token } = useAuth();
  const [estimations, setEstimations] = useState<SavedEstimation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<PaintEstimate | null>(null);
  const [roomName, setRoomName] = useState('');
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);

  useEffect(() => {
    fetchEstimations();
  }, []);

  const fetchEstimations = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/paint-estimations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEstimations(response.data);
    } catch (error: any) {
      console.error('Error fetching estimations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan walls');
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleTakePicture = async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.7 });
      setCameraVisible(false);
      setAnalyzing(true);

      // Analyze wall
      const response = await axios.post(
        `${API_URL}/api/paint-estimation/analyze-wall`,
        { image: photo.base64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      setCurrentEstimate(response.data);
      setSaveModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to analyze wall');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveEstimation = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    if (!currentEstimate) return;

    try {
      await axios.post(
        `${API_URL}/api/properties/${propertyId}/paint-estimations`,
        {
          room_name: roomName,
          scan_image: '',
          total_wall_area: currentEstimate.total_wall_area,
          paintable_area: currentEstimate.paintable_area,
          paint_gallons_needed: currentEstimate.paint_gallons_needed,
          estimated_cost_low: currentEstimate.estimated_cost_low,
          estimated_cost_high: currentEstimate.estimated_cost_high,
          walls_data: JSON.stringify(currentEstimate.walls),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Paint estimation saved successfully');
      setSaveModalVisible(false);
      setRoomName('');
      setCurrentEstimate(null);
      fetchEstimations();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save estimation');
    }
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="color-palette" size={32} color="#34C759" />
          <Text style={styles.headerTitle}>Paint Estimation</Text>
          <Text style={styles.headerSubtitle}>
            Scan your room walls to get instant paint estimates
          </Text>
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleStartScan}
        >
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.scanButtonText}>Scan Room Walls</Text>
        </TouchableOpacity>

        {estimations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Previous Estimations</Text>
            {estimations.map((est) => (
              <View key={est.id} style={styles.estimationCard}>
                <View style={styles.estimationHeader}>
                  <Text style={styles.roomName}>{est.room_name}</Text>
                  <Text style={styles.date}>
                    {new Date(est.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.estimationDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Paintable Area:</Text>
                    <Text style={styles.detailValue}>{est.paintable_area} sq ft</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Paint Needed:</Text>
                    <Text style={styles.detailValue}>{est.paint_gallons_needed} gallons</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Estimated Cost:</Text>
                    <Text style={styles.detailValue}>
                      ${est.estimated_cost_low} - ${est.estimated_cost_high}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {estimations.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="brush-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No estimations yet</Text>
            <Text style={styles.emptySubtext}>Scan a room to get started</Text>
          </View>
        )}
      </ScrollView>

      {/* Camera Modal */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={(ref) => setCameraRef(ref)}
            facing="back"
          >
            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.closeCamera}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleTakePicture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Save Estimation Modal */}
      <Modal
        visible={saveModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSaveModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Paint Estimation</Text>
            <TouchableOpacity onPress={handleSaveEstimation}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {currentEstimate && (
              <>
                <View style={styles.resultCard}>
                  <Text style={styles.resultTitle}>Analysis Complete!</Text>
                  
                  <View style={styles.resultRow}>
                    <Ionicons name="resize" size={20} color="#007AFF" />
                    <Text style={styles.resultLabel}>Total Wall Area:</Text>
                    <Text style={styles.resultValue}>
                      {currentEstimate.total_wall_area} sq ft
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.resultLabel}>Paintable Area:</Text>
                    <Text style={styles.resultValue}>
                      {currentEstimate.paintable_area} sq ft
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <Ionicons name="color-fill" size={20} color="#FF9500" />
                    <Text style={styles.resultLabel}>Paint Needed:</Text>
                    <Text style={styles.resultValue}>
                      {currentEstimate.paint_gallons_needed} gallons (2 coats)
                    </Text>
                  </View>

                  <View style={styles.costContainer}>
                    <Text style={styles.costLabel}>Estimated Total Cost:</Text>
                    <Text style={styles.costValue}>
                      ${currentEstimate.estimated_cost_low} - $
                      {currentEstimate.estimated_cost_high}
                    </Text>
                    <Text style={styles.costNote}>
                      *Includes paint + labor
                    </Text>
                  </View>
                </View>

                <Text style={styles.label}>Room Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Living Room, Master Bedroom"
                  value={roomName}
                  onChangeText={setRoomName}
                  autoFocus
                />
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {analyzing && (
        <View style={styles.analyzingOverlay}>
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.analyzingText}>Analyzing wall dimensions...</Text>
          </View>
        </View>
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
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  scanButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  estimationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  estimationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
  },
  estimationDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 24,
  },
  closeCamera: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    padding: 8,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#007AFF',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  costContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  costValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  costNote: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
});
