import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { measurementApi } from '../../services/api';

interface Measurement {
  id: string;
  room_type: string;
  length?: number;
  width?: number;
  height?: number;
  unit: string;
  floor_plan_image?: string;
  notes?: string;
}

interface RoomAnalysis {
  room_name: string;
  room_type: string;
  length?: number;
  width?: number;
  area?: number;
  ceiling_height?: number;
  windows?: number;
  notes?: string;
}

interface ComprehensiveAnalysis {
  house_type: string;
  total_bedrooms: number;
  total_bathrooms: number;
  total_rooms: number;
  rooms: RoomAnalysis[];
  overall_notes?: string;
}

interface MeasurementsScreenProps {
  propertyId: string;
}

export default function MeasurementsScreen({ propertyId }: MeasurementsScreenProps) {
  const { token } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzingFloorPlan, setAnalyzingFloorPlan] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<Measurement | null>(null);
  const [inputMode, setInputMode] = useState<'manual' | 'ai'>('manual'); // manual or ai

  // Form state
  const [roomType, setRoomType] = useState('master_bedroom');
  const [roomName, setRoomName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [windows, setWindows] = useState('');
  const [unit, setUnit] = useState('feet');
  const [notes, setNotes] = useState('');
  const [floorPlanImage, setFloorPlanImage] = useState('');

  // AI Analysis state
  const [aiAnalysisResult, setAiAnalysisResult] = useState<ComprehensiveAnalysis | null>(null);
  const [showAiResults, setShowAiResults] = useState(false);

  const roomTypes = [
    { value: 'master_bedroom', label: 'Master Bedroom' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'living_area', label: 'Living Area' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'dining_area', label: 'Dining Area' },
    { value: 'balcony', label: 'Balcony' },
    { value: 'utility', label: 'Utility' },
    { value: 'study', label: 'Study' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    fetchMeasurements();
  }, []);

  const fetchMeasurements = async () => {
    try {
      const data = await measurementApi.getAll(token!, propertyId);
      setMeasurements(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load measurements');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRoomType('master_bedroom');
    setRoomName('');
    setLength('');
    setWidth('');
    setHeight('');
    setWindows('');
    setUnit('feet');
    setNotes('');
    setFloorPlanImage('');
    setEditMode(false);
    setSelectedMeasurement(null);
    setInputMode('manual');
    setAiAnalysisResult(null);
    setShowAiResults(false);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const handleAddNew = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleEdit = async (measurement: Measurement) => {
    setEditMode(true);
    setSelectedMeasurement(measurement);
    setRoomType(measurement.room_type);
    setLength(measurement.length?.toString() || '');
    setWidth(measurement.width?.toString() || '');
    setHeight(measurement.height?.toString() || '');
    setUnit(measurement.unit || 'feet');
    setNotes(measurement.notes || '');
    setFloorPlanImage(measurement.floor_plan_image || '');
    setInputMode('manual');
    setModalVisible(true);
  };

  const handleSaveMeasurement = async () => {
    if (!length && !width && !floorPlanImage) {
      Alert.alert('Error', 'Please enter dimensions or upload a floor plan');
      return;
    }

    setSaving(true);
    try {
      const measurementData: any = {
        room_type: roomType,
        length: length ? parseFloat(length) : undefined,
        width: width ? parseFloat(width) : undefined,
        height: height ? parseFloat(height) : undefined,
        unit,
        floor_plan_image: floorPlanImage || undefined,
        notes: notes || undefined,
      };

      if (editMode && selectedMeasurement) {
        await measurementApi.update(token!, propertyId, selectedMeasurement.id, measurementData);
        Alert.alert('Success', 'Measurement updated successfully');
      } else {
        await measurementApi.create(token!, propertyId, measurementData);
        Alert.alert('Success', 'Measurement added successfully');
      }

      setModalVisible(false);
      resetForm();
      fetchMeasurements();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save measurement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeasurement = (measurement: Measurement) => {
    Alert.alert(
      'Delete Measurement',
      `Are you sure you want to delete this measurement?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await measurementApi.delete(token!, propertyId, measurement.id);
              fetchMeasurements();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete measurement');
            }
          },
        },
      ]
    );
  };

  const handlePickFloorPlan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFloorPlanImage(result.assets[0].base64);
    }
  };

  const handleAIAnalyzeFloorPlan = async () => {
    if (!floorPlanImage) {
      Alert.alert('Error', 'Please upload a floor plan first');
      return;
    }

    setAnalyzingFloorPlan(true);
    try {
      const result = await measurementApi.analyzeFloorPlanComprehensive(token!, floorPlanImage);
      
      setAiAnalysisResult(result);
      setShowAiResults(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to analyze floor plan. Please try again.');
    } finally {
      setAnalyzingFloorPlan(false);
    }
  };

  const handleCreateAllMeasurements = async () => {
    if (!aiAnalysisResult) return;

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const room of aiAnalysisResult.rooms) {
      try {
        await measurementApi.create(token!, propertyId, {
          room_type: room.room_type,
          length: room.length,
          width: room.width,
          height: room.ceiling_height,
          unit: 'feet',
          floor_plan_image: floorPlanImage,
          notes: `${room.room_name}${room.notes ? ` - ${room.notes}` : ''}${room.windows ? ` - ${room.windows} window(s)` : ''}`,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to create measurement for ${room.room_name}:`, err);
        errorCount++;
      }
    }

    setSaving(false);
    
    if (successCount > 0) {
      Alert.alert(
        'Success',
        `Created ${successCount} measurement(s) from AI analysis.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setModalVisible(false);
              resetForm();
              fetchMeasurements();
            },
          },
        ]
      );
    } else {
      Alert.alert('Error', 'Failed to create measurements. Please try again.');
    }
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'master_bedroom':
      case 'bedroom':
        return 'bed-outline';
      case 'living_area':
        return 'tv-outline';
      case 'kitchen':
        return 'restaurant-outline';
      case 'bathroom':
        return 'water-outline';
      case 'dining_area':
        return 'fast-food-outline';
      case 'balcony':
        return 'sunny-outline';
      case 'utility':
        return 'construct-outline';
      case 'study':
        return 'book-outline';
      default:
        return 'home-outline';
    }
  };

  const formatRoomType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderMeasurement = ({ item }: { item: Measurement }) => (
    <TouchableOpacity 
      style={styles.measurementCard}
      onPress={() => handleEdit(item)}
    >
      <View style={styles.measurementIcon}>
        <Ionicons name={getRoomIcon(item.room_type)} size={24} color="#007AFF" />
      </View>
      <View style={styles.measurementInfo}>
        <Text style={styles.measurementRoom}>{formatRoomType(item.room_type)}</Text>
        {item.length && item.width ? (
          <Text style={styles.measurementDimensions}>
            {item.length} × {item.width} {item.unit}
            {item.height && ` × ${item.height} ${item.unit}`}
          </Text>
        ) : (
          <Text style={styles.measurementDimensions}>Floor plan attached</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {measurements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="resize-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No measurements yet</Text>
          <Text style={styles.emptySubtext}>Add room measurements manually or use AI</Text>
        </View>
      ) : (
        <FlatList
          data={measurements}
          renderItem={renderMeasurement}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAddNew}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Measurement Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseModal}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editMode ? 'Edit Measurement' : 'Add Measurement'}
            </Text>
            <View style={styles.headerRight}>
              {editMode && (
                <TouchableOpacity 
                  onPress={() => {
                    handleCloseModal();
                    selectedMeasurement && handleDeleteMeasurement(selectedMeasurement);
                  }}
                  style={styles.deleteHeaderButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {!editMode && !showAiResults && (
              <>
                <Text style={styles.sectionTitle}>Choose Input Method</Text>
                <View style={styles.methodContainer}>
                  <TouchableOpacity
                    style={[
                      styles.methodButton,
                      inputMode === 'manual' && styles.methodButtonActive,
                    ]}
                    onPress={() => setInputMode('manual')}
                  >
                    <Ionicons 
                      name="create-outline" 
                      size={24} 
                      color={inputMode === 'manual' ? '#fff' : '#007AFF'} 
                    />
                    <Text
                      style={[
                        styles.methodButtonText,
                        inputMode === 'manual' && styles.methodButtonTextActive,
                      ]}
                    >
                      Manual Entry
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.methodButton,
                      inputMode === 'ai' && styles.methodButtonActive,
                    ]}
                    onPress={() => setInputMode('ai')}
                  >
                    <Ionicons 
                      name="sparkles" 
                      size={24} 
                      color={inputMode === 'ai' ? '#fff' : '#34C759'} 
                    />
                    <Text
                      style={[
                        styles.methodButtonText,
                        inputMode === 'ai' && styles.methodButtonTextActive,
                      ]}
                    >
                      AI Analysis
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {inputMode === 'manual' && !showAiResults && (
              <>
                <Text style={styles.sectionTitle}>Room Details</Text>

                <Text style={styles.label}>Room Type *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomTypeScroll}>
                  <View style={styles.roomTypeContainer}>
                    {roomTypes.map((room) => (
                      <TouchableOpacity
                        key={room.value}
                        style={[
                          styles.roomTypeButton,
                          roomType === room.value && styles.roomTypeButtonActive,
                        ]}
                        onPress={() => setRoomType(room.value)}
                      >
                        <Text
                          style={[
                            styles.roomTypeButtonText,
                            roomType === room.value && styles.roomTypeButtonTextActive,
                          ]}
                        >
                          {room.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Text style={styles.label}>Length *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      value={length}
                      onChangeText={setLength}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#C7C7CC"
                    />
                  </View>

                  <View style={styles.halfWidth}>
                    <Text style={styles.label}>Width *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      value={width}
                      onChangeText={setWidth}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#C7C7CC"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Text style={styles.label}>Ceiling Height</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      value={height}
                      onChangeText={setHeight}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#C7C7CC"
                    />
                  </View>

                  <View style={styles.halfWidth}>
                    <Text style={styles.label}>Unit</Text>
                    <View style={styles.unitContainer}>
                      <TouchableOpacity
                        style={[styles.unitButton, unit === 'feet' && styles.unitButtonActive]}
                        onPress={() => setUnit('feet')}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            unit === 'feet' && styles.unitButtonTextActive,
                          ]}
                        >
                          Feet
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitButton, unit === 'meters' && styles.unitButtonActive]}
                        onPress={() => setUnit('meters')}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            unit === 'meters' && styles.unitButtonTextActive,
                          ]}
                        >
                          Meters
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Number of Windows</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={windows}
                  onChangeText={setWindows}
                  keyboardType="number-pad"
                  placeholderTextColor="#C7C7CC"
                />

                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Additional notes (e.g., attached bathroom, has wardrobe)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor="#C7C7CC"
                />

                <TouchableOpacity
                  style={[styles.saveButtonLarge, saving && styles.saveButtonDisabled]}
                  onPress={handleSaveMeasurement}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editMode ? 'Update Measurement' : 'Save Measurement'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {inputMode === 'ai' && !showAiResults && (
              <>
                <Text style={styles.sectionTitle}>AI Floor Plan Analysis</Text>
                <Text style={styles.aiDescription}>
                  Upload a floor plan image and our AI will automatically identify the house type, 
                  number of rooms, and extract measurements for each room.
                </Text>

                <TouchableOpacity style={styles.photoButton} onPress={handlePickFloorPlan}>
                  {floorPlanImage ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${floorPlanImage}` }}
                      style={styles.photoPreview}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image-outline" size={48} color="#8E8E93" />
                      <Text style={styles.photoPlaceholderText}>Upload Floor Plan Image</Text>
                      <Text style={styles.photoPlaceholderSubtext}>Tap to select from gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {floorPlanImage && (
                  <TouchableOpacity
                    style={[styles.aiAnalyzeButton, analyzingFloorPlan && styles.aiButtonDisabled]}
                    onPress={handleAIAnalyzeFloorPlan}
                    disabled={analyzingFloorPlan}
                  >
                    {analyzingFloorPlan ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.aiButtonText}>  Analyzing with Gemini AI...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={20} color="#fff" />
                        <Text style={styles.aiButtonText}>  Analyze Floor Plan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {showAiResults && aiAnalysisResult && (
              <>
                <View style={styles.aiResultsHeader}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setShowAiResults(false)}
                  >
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.aiResultsCard}>
                  <Text style={styles.aiResultsTitle}>AI Analysis Results</Text>
                  
                  <View style={styles.propertyTypeContainer}>
                    <Ionicons name="home" size={32} color="#34C759" />
                    <View style={styles.propertyTypeInfo}>
                      <Text style={styles.propertyTypeLabel}>Property Type</Text>
                      <Text style={styles.propertyTypeValue}>{aiAnalysisResult.house_type}</Text>
                    </View>
                  </View>

                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{aiAnalysisResult.total_bedrooms}</Text>
                      <Text style={styles.statLabel}>Bedrooms</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{aiAnalysisResult.total_bathrooms}</Text>
                      <Text style={styles.statLabel}>Bathrooms</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{aiAnalysisResult.total_rooms}</Text>
                      <Text style={styles.statLabel}>Total Rooms</Text>
                    </View>
                  </View>

                  {aiAnalysisResult.overall_notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>{aiAnalysisResult.overall_notes}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.roomsListTitle}>Detected Rooms ({aiAnalysisResult.rooms.length})</Text>
                
                {aiAnalysisResult.rooms.map((room, index) => (
                  <View key={index} style={styles.roomCard}>
                    <View style={styles.roomCardHeader}>
                      <Ionicons name={getRoomIcon(room.room_type)} size={20} color="#007AFF" />
                      <Text style={styles.roomCardTitle}>{room.room_name}</Text>
                    </View>
                    <View style={styles.roomCardContent}>
                      {(room.length && room.width) ? (
                        <Text style={styles.roomCardDimension}>
                          📏 {room.length} × {room.width} ft
                          {room.area ? ` (${room.area} sq ft)` : ''}
                        </Text>
                      ) : null}
                      {room.ceiling_height ? (
                        <Text style={styles.roomCardDetail}>📐 Height: {room.ceiling_height} ft</Text>
                      ) : null}
                      {(room.windows && room.windows > 0) ? (
                        <Text style={styles.roomCardDetail}>🪟 Windows: {room.windows}</Text>
                      ) : null}
                      {room.notes ? (
                        <Text style={styles.roomCardNotes}>💡 {room.notes}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.createAllButton, saving && styles.saveButtonDisabled]}
                  onPress={handleCreateAllMeasurements}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.createAllButtonText}>  Create All Measurements</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  listContent: {
    padding: 16,
  },
  measurementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  measurementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  measurementInfo: {
    flex: 1,
  },
  measurementRoom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  measurementDimensions: {
    fontSize: 14,
    color: '#8E8E93',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardView: {
    flex: 1,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: 80,
    justifyContent: 'flex-end',
  },
  deleteHeaderButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8,
    marginBottom: 16,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  methodButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  roomTypeScroll: {
    marginBottom: 8,
  },
  roomTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  roomTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  roomTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roomTypeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
  },
  roomTypeButtonTextActive: {
    color: '#fff',
  },
  unitContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  photoButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  photoPlaceholder: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  photoPlaceholderSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#8E8E93',
  },
  photoPreview: {
    width: '100%',
    height: 250,
    resizeMode: 'contain',
  },
  aiDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 20,
  },
  aiAnalyzeButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonLarge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  aiResultsHeader: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  aiResultsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  aiResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  propertyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  propertyTypeInfo: {
    flex: 1,
  },
  propertyTypeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  propertyTypeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  notesContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  notesText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  roomsListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roomCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  roomCardContent: {
    gap: 6,
  },
  roomCardDimension: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  roomCardDetail: {
    fontSize: 13,
    color: '#6B7280',
  },
  roomCardNotes: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  createAllButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  createAllButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
