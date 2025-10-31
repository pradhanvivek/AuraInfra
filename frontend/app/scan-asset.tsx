import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ScanAssetScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<any>(null);

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan assets');
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
      setCapturedImage(photo.base64);
      await identifyAsset(photo.base64);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const identifyAsset = async (imageBase64: string) => {
    setScanning(true);
    try {
      // Use Gemini to identify what type of asset this is
      const response = await axios.post(
        `${API_URL}/api/identify-asset`,
        { image: imageBase64 },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      const data = response.data;
      setScanResults(data);

      // Show results
      Alert.alert(
        'Asset Identified',
        `Type: ${data.asset_type}\nConfidence: ${Math.round((data.confidence || 0) * 100)}%`,
        [
          { text: 'Scan Again', onPress: () => resetScan() },
          { 
            text: 'Add to Portfolio', 
            onPress: () => navigateToAdd(data.asset_type)
          }
        ]
      );
    } catch (error: any) {
      console.error('Identification error:', error);
      Alert.alert('Error', 'Failed to identify asset. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const navigateToAdd = (assetType: string) => {
    // Navigate to the appropriate add screen based on asset type
    const typeMap: { [key: string]: string } = {
      'vehicle': '/vehicle/add?mode=scan',
      'car': '/vehicle/add?mode=scan',
      'appliance': '/appliance/add?mode=scan',
      'jewelry': '/jewelry/add?mode=scan',
      'furniture': '/furniture/add?mode=scan',
      'art': '/art/add?mode=scan',
      'painting': '/art/add?mode=scan',
    };

    const route = typeMap[assetType.toLowerCase()] || '/appliance/add?mode=scan';
    router.push(route as any);
  };

  const resetScan = () => {
    setCapturedImage(null);
    setScanResults(null);
    setCameraVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Scan</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {!capturedImage && !scanning && (
          <View style={styles.emptyState}>
            <View style={styles.iconCircle}>
              <Ionicons name="scan" size={64} color="#007AFF" />
            </View>
            <Text style={styles.emptyTitle}>AI Asset Scanner</Text>
            <Text style={styles.emptySubtitle}>
              Point your camera at any item and let AI identify it
            </Text>
            <TouchableOpacity style={styles.scanButton} onPress={handleOpenCamera}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.scanButtonText}>Start Scanning</Text>
            </TouchableOpacity>

            <View style={styles.supportedTypes}>
              <Text style={styles.supportedTitle}>Supported Items:</Text>
              <View style={styles.typesGrid}>
                <View style={styles.typeChip}>
                  <Ionicons name="car" size={16} color="#007AFF" />
                  <Text style={styles.typeText}>Vehicles</Text>
                </View>
                <View style={styles.typeChip}>
                  <Ionicons name="tv" size={16} color="#34C759" />
                  <Text style={styles.typeText}>Appliances</Text>
                </View>
                <View style={styles.typeChip}>
                  <Ionicons name="diamond" size={16} color="#FF2D55" />
                  <Text style={styles.typeText}>Jewelry</Text>
                </View>
                <View style={styles.typeChip}>
                  <Ionicons name="bed" size={16} color="#34C759" />
                  <Text style={styles.typeText}>Furniture</Text>
                </View>
                <View style={styles.typeChip}>
                  <Ionicons name="color-palette" size={16} color="#5856D6" />
                  <Text style={styles.typeText}>Art</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {capturedImage && !scanning && scanResults && (
          <View style={styles.resultsContainer}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${capturedImage}` }}
              style={styles.capturedImage}
            />
            <View style={styles.resultsCard}>
              <Text style={styles.resultTitle}>Identified As:</Text>
              <Text style={styles.resultType}>{scanResults.asset_type}</Text>
              <Text style={styles.resultConfidence}>
                {Math.round((scanResults.confidence || 0) * 100)}% confidence
              </Text>
              {scanResults.description && (
                <Text style={styles.resultDescription}>{scanResults.description}</Text>
              )}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={resetScan}
              >
                <Text style={styles.secondaryButtonText}>Scan Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => navigateToAdd(scanResults.asset_type)}
              >
                <Text style={styles.primaryButtonText}>Add to Portfolio</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={(ref) => setCameraRef(ref)}
            facing="back"
          />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.closeCamera}
              onPress={() => setCameraVisible(false)}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <View style={styles.cameraInstructions}>
              <Text style={styles.instructionText}>Point at any asset</Text>
              <Text style={styles.instructionSubtext}>
                AI will identify what it is
              </Text>
            </View>
            <TouchableOpacity style={styles.captureButton} onPress={handleTakePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scanning Overlay */}
      {scanning && (
        <View style={styles.scanningOverlay}>
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Identifying asset...</Text>
            <Text style={styles.scanningSubtext}>Using AI to analyze</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  scanButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  supportedTypes: {
    marginTop: 48,
    alignItems: 'center',
  },
  supportedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  typeText: {
    fontSize: 13,
    color: '#000',
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  capturedImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: 16,
  },
  resultsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  resultType: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  resultConfidence: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 12,
  },
  resultDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  cameraInstructions: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 16,
    alignSelf: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  instructionSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
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
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
  },
  scanningText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  scanningSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});
