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
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface PaintEstimationScreenProps {
  propertyId: string;
}

interface WallCapture {
  image: string;
  label: string;
}

interface WallDimensions {
  wall_width: number;
  wall_height: number;
  doors: number;
  windows: number;
}

interface RoomAnalysis {
  total_wall_area: number;
  ceiling_area: number;
  paintable_wall_area: number;
  paintable_ceiling_area: number;
  total_paintable_area: number;
  paint_gallons_needed: number;
  estimated_cost_low: number;
  estimated_cost_high: number;
  walls: WallDimensions[];
}

interface SavedEstimation {
  id: string;
  room_name: string;
  total_paintable_area: number;
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
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);

  // Multi-wall capture state
  const [numberOfWalls, setNumberOfWalls] = useState(4);
  const [includeCeiling, setIncludeCeiling] = useState(false);
  const [wallCaptures, setWallCaptures] = useState<WallCapture[]>([]);
  const [currentCaptureIndex, setCurrentCaptureIndex] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  
  // Results state
  const [currentAnalysis, setCurrentAnalysis] = useState<RoomAnalysis | null>(null);
  const [roomName, setRoomName] = useState('');
  
  // Device orientation helper
  const [isLevelHorizontal, setIsLevelHorizontal] = useState(false);

  // Unit preferences and country
  const [country, setCountry] = useState<'India' | 'US' | 'UK' | 'Canada' | 'Australia' | 'UAE'>('US');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'GBP' | 'CAD' | 'AUD' | 'AED'>('USD');
  const [volumeUnit, setVolumeUnit] = useState<'gallons' | 'liters'>('gallons');
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Handle country change and auto-set defaults
  const handleCountryChange = (selectedCountry: typeof country) => {
    setCountry(selectedCountry);
    
    // Auto-set currency and volume unit based on country
    const countryDefaults: Record<typeof country, { currency: typeof currency, volumeUnit: typeof volumeUnit }> = {
      'India': { currency: 'INR', volumeUnit: 'liters' },
      'US': { currency: 'USD', volumeUnit: 'gallons' },
      'UK': { currency: 'GBP', volumeUnit: 'liters' },
      'Canada': { currency: 'CAD', volumeUnit: 'liters' },
      'Australia': { currency: 'AUD', volumeUnit: 'liters' },
      'UAE': { currency: 'AED', volumeUnit: 'liters' },
    };
    
    const defaults = countryDefaults[selectedCountry];
    setCurrency(defaults.currency);
    setVolumeUnit(defaults.volumeUnit);
  };

  // Helper functions for unit conversion
  const convertVolume = (gallons: number): number => {
    if (volumeUnit === 'liters') {
      return gallons * 3.78541; // 1 gallon = 3.78541 liters
    }
    return gallons;
  };

  // Calculate cost based on country/currency and actual market prices
  const calculateCost = (gallons: number, isLowEstimate: boolean): number => {
    const liters = gallons * 3.78541;
    
    // Country-specific pricing (per liter or per gallon)
    const pricing: Record<typeof country, { low: number, high: number, unit: 'liter' | 'gallon' }> = {
      'India': { low: 300, high: 700, unit: 'liter' }, // ₹/liter (Asian Paints)
      'US': { low: 35, high: 70, unit: 'gallon' }, // $/gallon
      'UK': { low: 30, high: 60, unit: 'liter' }, // £/liter (Dulux, Crown)
      'Canada': { low: 45, high: 90, unit: 'liter' }, // CAD/liter (Benjamin Moore Canada)
      'Australia': { low: 50, high: 100, unit: 'liter' }, // AUD/liter (Dulux Australia)
      'UAE': { low: 40, high: 80, unit: 'liter' }, // AED/liter (Jotun, Berger)
    };
    
    const countryPrice = pricing[country];
    const price = isLowEstimate ? countryPrice.low : countryPrice.high;
    
    if (countryPrice.unit === 'liter') {
      return liters * price;
    } else {
      return gallons * price;
    }
  };

  const formatCurrency = (amount: number): string => {
    const currencySymbols: Record<typeof currency, string> = {
      'INR': '₹',
      'USD': '$',
      'GBP': '£',
      'CAD': 'CA$',
      'AUD': 'A$',
      'AED': 'AED ',
    };
    
    const symbol = currencySymbols[currency];
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  };

  const formatVolume = (gallons: number): string => {
    const converted = convertVolume(gallons);
    const unit = volumeUnit === 'liters' ? 'liters' : 'gallons';
    return `${converted.toFixed(1)} ${unit}`;
  };

  useEffect(() => {
    fetchEstimations();
  }, []);

  useEffect(() => {
    let subscription: any;
    // Only use Accelerometer on native platforms (iOS/Android), not on web
    if (cameraVisible && Platform.OS !== 'web') {
      try {
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          // Check if device is roughly level (for better wall photos)
          const isLevel = Math.abs(x) < 0.2 && Math.abs(y) < 0.2;
          setIsLevelHorizontal(isLevel);
        });
        Accelerometer.setUpdateInterval(100);
      } catch (error) {
        console.log('Accelerometer not available:', error);
      }
    }
    return () => subscription && subscription.remove();
  }, [cameraVisible]);

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

  const handleStartCapture = () => {
    setSetupComplete(true);
    const totalCaptures = numberOfWalls + (includeCeiling ? 1 : 0);
    const captures: WallCapture[] = [];
    
    for (let i = 1; i <= numberOfWalls; i++) {
      captures.push({ image: '', label: `Wall ${i}` });
    }
    if (includeCeiling) {
      captures.push({ image: '', label: 'Ceiling' });
    }
    
    setWallCaptures(captures);
    setCurrentCaptureIndex(0);
    handleOpenCamera();
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to capture walls');
        return;
      }
    }
    setCameraVisible(true);
  };

  const handleTakePicture = async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({ base64: true, quality: 0.7 });
      
      // Save the capture
      const updatedCaptures = [...wallCaptures];
      updatedCaptures[currentCaptureIndex].image = photo.base64!;
      setWallCaptures(updatedCaptures);
      
      setCameraVisible(false);
      
      // Check if more captures needed
      if (currentCaptureIndex < wallCaptures.length - 1) {
        Alert.alert(
          'Photo Captured!',
          `Ready to capture ${wallCaptures[currentCaptureIndex + 1].label}?`,
          [
            {
              text: 'Continue',
              onPress: () => {
                setCurrentCaptureIndex(currentCaptureIndex + 1);
                setCameraVisible(true);
              },
            },
          ]
        );
      } else {
        // All captures done, analyze
        Alert.alert(
          'All Photos Captured!',
          'Ready to analyze the room?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Analyze', onPress: handleAnalyzeRoom },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const handleAnalyzeRoom = async () => {
    setAnalyzing(true);
    try {
      // Prepare all images
      const wallImages = wallCaptures.filter(c => c.label.startsWith('Wall')).map(c => c.image);
      const ceilingImage = wallCaptures.find(c => c.label === 'Ceiling')?.image;
      
      const response = await axios.post(
        `${API_URL}/api/paint-estimation/analyze-room`,
        {
          wall_images: wallImages,
          ceiling_image: ceilingImage || null,
          include_ceiling: includeCeiling,
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000
        }
      );

      setCurrentAnalysis(response.data);
      setSaveModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to analyze room');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveEstimation = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    if (!currentAnalysis) return;

    try {
      await axios.post(
        `${API_URL}/api/properties/${propertyId}/paint-estimations`,
        {
          room_name: roomName,
          scan_image: '',
          total_wall_area: currentAnalysis.total_wall_area,
          paintable_area: currentAnalysis.total_paintable_area,
          paint_gallons_needed: currentAnalysis.paint_gallons_needed,
          estimated_cost_low: currentAnalysis.estimated_cost_low,
          estimated_cost_high: currentAnalysis.estimated_cost_high,
          walls_data: JSON.stringify({
            walls: currentAnalysis.walls,
            ceiling_area: currentAnalysis.ceiling_area,
            include_ceiling: includeCeiling,
          }),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Paint estimation saved successfully');
      handleReset();
      fetchEstimations();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save estimation');
    }
  };

  const handleReset = () => {
    setSaveModalVisible(false);
    setSetupComplete(false);
    setWallCaptures([]);
    setCurrentCaptureIndex(0);
    setRoomName('');
    setCurrentAnalysis(null);
    setNumberOfWalls(4);
    setIncludeCeiling(false);
  };

  // Settings Modal - accessible from all screens
  const renderSettingsModal = () => (
    <Modal
      visible={settingsVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        console.log('Modal onRequestClose called');
        setSettingsVisible(false);
      }}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        {console.log('Modal is rendering! settingsVisible:', settingsVisible)}
        <View style={styles.modalHeader}>
          <View style={{ width: 60 }} />
          <Text style={styles.modalTitle}>Display Settings</Text>
          <TouchableOpacity onPress={() => {
            console.log('Done button pressed');
            setSettingsVisible(false);
          }}>
            <Text style={styles.saveButton}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsSection}>Country</Text>
            <Text style={styles.settingHint}>Automatically sets currency, units, and pricing</Text>
            
            {(['India', 'US', 'UK', 'Canada', 'Australia', 'UAE'] as const).map((countryOption) => (
              <TouchableOpacity
                key={countryOption}
                style={[
                  styles.optionButton,
                  country === countryOption && styles.optionButtonActive
                ]}
                onPress={() => handleCountryChange(countryOption)}
              >
                <View style={styles.optionContent}>
                  <Text style={[
                    styles.optionText,
                    country === countryOption && styles.optionTextActive
                  ]}>
                    {countryOption === 'US' ? 'United States' : countryOption === 'UK' ? 'United Kingdom' : countryOption === 'UAE' ? 'United Arab Emirates' : countryOption}
                  </Text>
                  {country === countryOption && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[styles.settingsSection, { marginTop: 24 }]}>Currency</Text>
            
            <TouchableOpacity
              style={[
                styles.optionButton,
                currency === 'USD' && styles.optionButtonActive
              ]}
              onPress={() => setCurrency('USD')}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  currency === 'USD' && styles.optionTextActive
                ]}>
                  US Dollar ($)
                </Text>
                {currency === 'USD' && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                currency === 'INR' && styles.optionButtonActive
              ]}
              onPress={() => setCurrency('INR')}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  currency === 'INR' && styles.optionTextActive
                ]}>
                  Indian Rupee (₹)
                </Text>
                {currency === 'INR' && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </View>
            </TouchableOpacity>

            <Text style={[styles.settingsSection, { marginTop: 24 }]}>Paint Volume</Text>
            
            <TouchableOpacity
              style={[
                styles.optionButton,
                volumeUnit === 'gallons' && styles.optionButtonActive
              ]}
              onPress={() => setVolumeUnit('gallons')}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  volumeUnit === 'gallons' && styles.optionTextActive
                ]}>
                  Gallons (US)
                </Text>
                {volumeUnit === 'gallons' && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                volumeUnit === 'liters' && styles.optionButtonActive
              ]}
              onPress={() => setVolumeUnit('liters')}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  volumeUnit === 'liters' && styles.optionTextActive
                ]}>
                  Liters
                </Text>
                {volumeUnit === 'liters' && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.conversionNote}>
              <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
              <Text style={styles.conversionNoteText}>
                Volume: 1 gallon ≈ 3.79 liters{'\n'}
                INR pricing: ₹300-700/liter (Asian Paints){'\n'}
                USD pricing: $35-70/gallon (US market)
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
        {renderSettingsModal()}
      </>
    );
  }

  if (!setupComplete) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="color-palette" size={32} color="#34C759" />
                <View style={styles.headerTexts}>
                  <Text style={styles.headerTitle}>Room Paint Estimation</Text>
                  <Text style={styles.headerSubtitle}>
                    Capture all walls for accurate room painting cost
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  console.log('Settings button pressed - Current state:', settingsVisible);
                  setSettingsVisible(true);
                  console.log('State set to true');
                  setTimeout(() => {
                    console.log('After timeout - settingsVisible should be:', settingsVisible);
                  }, 100);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="settings-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Setup Room Capture</Text>
            
            <Text style={styles.label}>Number of Walls</Text>
            <View style={styles.wallCountContainer}>
              {[3, 4, 5, 6].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.wallCountButton,
                    numberOfWalls === num && styles.wallCountButtonActive,
                  ]}
                  onPress={() => setNumberOfWalls(num)}
                >
                  <Text
                    style={[
                      styles.wallCountButtonText,
                      numberOfWalls === num && styles.wallCountButtonTextActive,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.ceilingOption}
              onPress={() => setIncludeCeiling(!includeCeiling)}
            >
              <View style={styles.checkbox}>
                {includeCeiling && <Ionicons name="checkmark" size={20} color="#007AFF" />}
              </View>
              <Text style={styles.ceilingOptionText}>Include ceiling painting</Text>
            </TouchableOpacity>

            <View style={styles.capturePreview}>
              <Text style={styles.previewTitle}>You will capture:</Text>
              {Array.from({ length: numberOfWalls }, (_, i) => (
                <View key={i} style={styles.previewItem}>
                  <Ionicons name="square-outline" size={20} color="#007AFF" />
                  <Text style={styles.previewText}>Wall {i + 1}</Text>
                </View>
              ))}
              {includeCeiling && (
                <View style={styles.previewItem}>
                  <Ionicons name="square-outline" size={20} color="#FF9500" />
                  <Text style={styles.previewText}>Ceiling</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartCapture}
            >
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.startButtonText}>Start Capturing</Text>
            </TouchableOpacity>
          </View>

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
                      <Text style={styles.detailValue}>{est.total_paintable_area} sq ft</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Paint Needed:</Text>
                      <Text style={styles.detailValue}>{formatVolume(est.paint_gallons_needed)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Estimated Cost:</Text>
                      <Text style={styles.detailValue}>
                        {formatCurrency(calculateCost(est.paint_gallons_needed, true))} - {formatCurrency(calculateCost(est.paint_gallons_needed, false))}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
        {renderSettingsModal()}
      </View>
    );
  }

  return (
    <>
    <View style={styles.container}>
      <View style={styles.captureProgress}>
        <Text style={styles.progressText}>
          Capturing {wallCaptures[currentCaptureIndex]?.label} ({currentCaptureIndex + 1}/{wallCaptures.length})
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentCaptureIndex) / wallCaptures.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.captureList}>
        {wallCaptures.map((capture, index) => (
          <View key={index} style={styles.captureItem}>
            <Ionicons
              name={capture.image ? 'checkmark-circle' : 'radio-button-off'}
              size={24}
              color={capture.image ? '#34C759' : '#C7C7CC'}
            />
            <Text style={[styles.captureLabel, capture.image && styles.captureLabelDone]}>
              {capture.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>Reset & Start Over</Text>
      </TouchableOpacity>

      {/* Camera Modal */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            ref={(ref) => setCameraRef(ref)}
            facing="back"
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.closeCamera}
                onPress={() => setCameraVisible(false)}
              >
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>

              <View style={styles.cameraInstructions}>
                <Text style={styles.instructionTitle}>
                  {wallCaptures[currentCaptureIndex]?.label}
                </Text>
                <Text style={styles.instructionText}>
                  Hold device level and capture the entire surface
                </Text>
                {!isLevelHorizontal && (
                  <View style={styles.levelWarning}>
                    <Ionicons name="warning" size={16} color="#FF9500" />
                    <Text style={styles.levelWarningText}>Keep device level</Text>
                  </View>
                )}
              </View>

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

      {/* Results Modal */}
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
            <Text style={styles.modalTitle}>Room Analysis</Text>
            <TouchableOpacity onPress={handleSaveEstimation}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {currentAnalysis && (
              <>
                <View style={styles.resultCard}>
                  <Text style={styles.resultTitle}>Analysis Complete!</Text>
                  
                  <View style={styles.resultSection}>
                    <Text style={styles.sectionLabel}>WALL PAINTING</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Paintable Area:</Text>
                      <Text style={styles.resultValue}>
                        {currentAnalysis.paintable_wall_area} sq ft
                      </Text>
                    </View>
                  </View>

                  {includeCeiling && (
                    <View style={styles.resultSection}>
                      <Text style={styles.sectionLabel}>CEILING PAINTING</Text>
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Paintable Area:</Text>
                        <Text style={styles.resultValue}>
                          {currentAnalysis.paintable_ceiling_area} sq ft
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Total Paintable:</Text>
                      <Text style={styles.resultValue}>
                        {currentAnalysis.total_paintable_area} sq ft
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Paint Needed:</Text>
                      <Text style={styles.resultValue}>
                        {formatVolume(currentAnalysis.paint_gallons_needed)} (2 coats)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.costContainer}>
                    <Text style={styles.costLabel}>Estimated Total Cost:</Text>
                    <Text style={styles.costValue}>
                      {formatCurrency(calculateCost(currentAnalysis.paint_gallons_needed, true))} - {formatCurrency(calculateCost(currentAnalysis.paint_gallons_needed, false))}
                    </Text>
                    <Text style={styles.costNote}>
                      *Includes paint + labor
                    </Text>
                  </View>
                </View>

                <Text style={styles.label}>Room Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Master Bedroom, Living Room"
                  value={roomName}
                  onChangeText={setRoomName}
                  autoFocus
                />
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Analyzing Overlay */}
      {analyzing && (
        <View style={styles.analyzingOverlay}>
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.analyzingText}>Analyzing room dimensions...</Text>
            <Text style={styles.analyzingSubtext}>This may take a moment</Text>
          </View>
        </View>
      )}
    </View>
    {renderSettingsModal()}
    </>
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
  setupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  wallCountContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  wallCountButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  wallCountButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  wallCountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  wallCountButtonTextActive: {
    color: '#fff',
  },
  ceilingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ceilingOptionText: {
    fontSize: 16,
    color: '#000',
  },
  capturePreview: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  previewText: {
    fontSize: 14,
    color: '#000',
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  captureProgress: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  captureList: {
    padding: 16,
  },
  captureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  captureLabel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  captureLabelDone: {
    color: '#000',
    fontWeight: '600',
  },
  resetButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FF3B30',
    fontSize: 16,
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
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
  cameraInstructions: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  instructionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  levelWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(255,149,0,0.2)',
    borderRadius: 8,
    gap: 8,
  },
  levelWarningText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
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
    borderColor: '#34C759',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#34C759',
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
    marginBottom: 20,
    textAlign: 'center',
  },
  resultSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  totalSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  costContainer: {
    alignItems: 'center',
    paddingTop: 16,
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
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
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
    minWidth: 250,
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  analyzingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTexts: {
    marginLeft: 12,
    flex: 1,
  },
  settingsButton: {
    padding: 8,
    marginLeft: 8,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingsSection: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  settingHint: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
  },
  optionButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  optionTextActive: {
    fontWeight: '600',
    color: '#007AFF',
  },
  conversionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  conversionNoteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
});
