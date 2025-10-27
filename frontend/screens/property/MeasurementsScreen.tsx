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

  // Form state
  const [roomType, setRoomType] = useState('master_bedroom');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [unit, setUnit] = useState('feet');
  const [notes, setNotes] = useState('');
  const [floorPlanImage, setFloorPlanImage] = useState('');

  const roomTypes = [
    { value: 'master_bedroom', label: 'Master Bedroom' },
    { value: 'living_area', label: 'Living Area' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'dining_area', label: 'Dining Area' },
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
    setLength('');
    setWidth('');
    setHeight('');
    setUnit('feet');
    setNotes('');
    setFloorPlanImage('');
    setEditMode(false);
    setSelectedMeasurement(null);
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
    setModalVisible(true);
  };

  const handleSaveMeasurement = async () => {
    if (!length && !width && !floorPlanImage) {
      Alert.alert('Error', 'Please enter dimensions or upload a floor plan');
      return;
    }

    setSaving(true);
    try {
      const measurementData = {
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

  const handleAnalyzeFloorPlan = async () => {
    if (!floorPlanImage) {
      Alert.alert('Error', 'Please upload a floor plan first');
      return;
    }

    setAnalyzingFloorPlan(true);
    try {
      const result = await measurementApi.analyzeFloorPlan(token!, floorPlanImage);
      
      // Auto-create measurements from AI analysis
      Alert.alert(
        'AI Analysis Complete',
        'Would you like to automatically create measurements from the floor plan analysis?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setNotes(result.analysis);
            },
          },
          {
            text: 'Auto-Create',
            onPress: async () => {
              // Try to parse the AI response and create measurements
              await autoCreateMeasurements(result.analysis);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to analyze floor plan');
    } finally {
      setAnalyzingFloorPlan(false);
    }
  };

  const autoCreateMeasurements = async (analysisText: string) => {
    try {
      // Parse the analysis text to extract room measurements
      const roomMapping: { [key: string]: string } = {
        'master bedroom': 'master_bedroom',
        'bedroom': 'master_bedroom',
        'living room': 'living_area',
        'living area': 'living_area',
        'living': 'living_area',
        'kitchen': 'kitchen',
        'bathroom': 'bathroom',
        'bath': 'bathroom',
        'dining room': 'dining_area',
        'dining area': 'dining_area',
        'dining': 'dining_area',
      };

      const lines = analysisText.toLowerCase().split('\n');
      let createdCount = 0;

      for (const line of lines) {
        // Look for room mentions with dimensions
        for (const [roomName, roomType] of Object.entries(roomMapping)) {
          if (line.includes(roomName)) {
            // Try to extract dimensions (e.g., "12x15", "12 x 15", "12ft x 15ft")
            const dimensionMatch = line.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/);
            
            if (dimensionMatch) {
              const length = parseFloat(dimensionMatch[1]);
              const width = parseFloat(dimensionMatch[2]);
              
              // Create measurement for this room
              try {
                await measurementApi.create(token!, propertyId, {
                  room_type: roomType,
                  length,
                  width,
                  unit: 'feet',
                  floor_plan_image: floorPlanImage,
                  notes: `Auto-generated from AI analysis: ${line.trim()}`,
                });
                createdCount++;
              } catch (err) {
                console.log(`Failed to create measurement for ${roomName}`);
              }
              
              break; // Move to next line after finding a match
            }
          }
        }
      }

      if (createdCount > 0) {
        Alert.alert('Success', `Created ${createdCount} measurement(s) from the floor plan`);
        setModalVisible(false);
        resetForm();
        fetchMeasurements();
      } else {
        Alert.alert(
          'No Dimensions Found',
          'Could not automatically extract dimensions. Please review the analysis and enter measurements manually:\n\n' + analysisText
        );
        setNotes(analysisText);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create measurements automatically');
      setNotes(analysisText);
    }
  };

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'master_bedroom':
        return 'bed-outline';
      case 'living_area':
        return 'tv-outline';
      case 'kitchen':
        return 'restaurant-outline';
      case 'bathroom':
        return 'water-outline';
      case 'dining_area':
        return 'fast-food-outline';
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
          <Text style={styles.emptySubtext}>Add room measurements</Text>
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
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editMode ? 'Edit Measurement' : 'Add Measurement'}
            </Text>
            <View style={styles.headerRight}>
              {editMode && (
                <TouchableOpacity 
                  onPress={() => {
                    setModalVisible(false);
                    selectedMeasurement && handleDeleteMeasurement(selectedMeasurement);
                  }}
                  style={styles.deleteHeaderButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSaveMeasurement} disabled={saving}>
                <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Room Type *</Text>
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

            <Text style={styles.sectionTitle}>Manual Entry</Text>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Length</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={length}
                  onChangeText={setLength}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.halfWidth}>
                <Text style={styles.label}>Width</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={width}
                  onChangeText={setWidth}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Height (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="decimal-pad"
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

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>OR Upload Floor Plan</Text>

            <TouchableOpacity style={styles.photoButton} onPress={handlePickFloorPlan}>
              {floorPlanImage ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${floorPlanImage}` }}
                  style={styles.photoPreview}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#8E8E93" />
                  <Text style={styles.photoPlaceholderText}>Upload Floor Plan</Text>
                </View>
              )}
            </TouchableOpacity>

            {floorPlanImage && (
              <TouchableOpacity
                style={[styles.aiButton, analyzingFloorPlan && styles.aiButtonDisabled]}
                onPress={handleAnalyzeFloorPlan}
                disabled={analyzingFloorPlan}
              >
                {analyzingFloorPlan ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.aiButtonText}>  Analyzing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                    <Text style={styles.aiButtonText}>  Analyze with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Additional notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
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
  },
  deleteHeaderButton: {
    padding: 4,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 24,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 8,
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
  roomTypeContainer: {
    gap: 8,
  },
  roomTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  roomTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roomTypeButtonText: {
    fontSize: 14,
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
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 16,
  },
  photoButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  photoPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
  },
  aiButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
