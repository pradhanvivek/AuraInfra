import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Meeting {
  id: string;
  title: string;
  description: string;
  meeting_type: string;
  date: string;
  time: string;
  duration_minutes: number;
  location: string;
  organizer_name: string;
  max_attendees?: number;
  agenda?: string[];
}

const meetingTypes = [
  { id: 'general', name: 'General', icon: 'people' },
  { id: 'agm', name: 'AGM', icon: 'document-text' },
  { id: 'committee', name: 'Committee', icon: 'briefcase' },
  { id: 'emergency', name: 'Emergency', icon: 'alert-circle' },
  { id: 'social', name: 'Social', icon: 'happy' },
];

export default function AdminMeetings() {
  const router = useRouter();
  const { token } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_type: 'general',
    date: new Date(),
    time: '18:00',
    duration_minutes: 60,
    location: '',
    max_attendees: 50,
    agenda: [''],
  });

  useEffect(() => {
    fetchPropertyId();
  }, []);

  useEffect(() => {
    if (propertyId) {
      fetchMeetings();
    }
  }, [propertyId]);

  const fetchPropertyId = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.managed_properties?.length > 0) {
        setPropertyId(response.data.managed_properties[0]);
      } else {
        Alert.alert('Error', 'No managed properties found');
        router.back();
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/meetings`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.location) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const meetingDate = new Date(formData.date);
      const [hours, minutes] = formData.time.split(':');
      meetingDate.setHours(parseInt(hours), parseInt(minutes));

      await axios.post(
        `${API_URL}/api/properties/${propertyId}/meetings`,
        {
          property_id: propertyId,
          title: formData.title,
          description: formData.description,
          meeting_type: formData.meeting_type,
          date: meetingDate.toISOString(),
          time: formData.time,
          duration_minutes: formData.duration_minutes,
          location: formData.location,
          max_attendees: formData.max_attendees,
          agenda: formData.agenda.filter(item => item.trim() !== ''),
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      Alert.alert('Success', 'Meeting scheduled successfully!');
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        meeting_type: 'general',
        date: new Date(),
        time: '18:00',
        duration_minutes: 60,
        location: '',
        max_attendees: 50,
        agenda: [''],
      });
      fetchMeetings();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to schedule meeting');
    } finally {
      setSaving(false);
    }
  };

  const addAgendaItem = () => {
    setFormData({ ...formData, agenda: [...formData.agenda, ''] });
  };

  const removeAgendaItem = (index: number) => {
    const newAgenda = formData.agenda.filter((_, i) => i !== index);
    setFormData({ ...formData, agenda: newAgenda });
  };

  const updateAgendaItem = (index: number, value: string) => {
    const newAgenda = [...formData.agenda];
    newAgenda[index] = value;
    setFormData({ ...formData, agenda: newAgenda });
  };

  const getMeetingIcon = (type: string) => {
    const meetingType = meetingTypes.find(t => t.id === type);
    return meetingType?.icon || 'people';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Meetings</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {meetings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No meetings scheduled</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
              <Text style={styles.addButtonText}>Schedule First Meeting</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {meetings.map((meeting) => (
              <View key={meeting.id} style={styles.meetingCard}>
                <View style={styles.meetingHeader}>
                  <View style={styles.meetingIcon}>
                    <Ionicons name={getMeetingIcon(meeting.meeting_type) as any} size={24} color="#007AFF" />
                  </View>
                  <View style={styles.meetingInfo}>
                    <Text style={styles.meetingTitle}>{meeting.title}</Text>
                    <Text style={styles.meetingType}>{meeting.meeting_type.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.meetingDescription}>{meeting.description}</Text>
                <View style={styles.meetingDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>{formatDate(meeting.date)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>{meeting.time} ({meeting.duration_minutes} min)</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>{meeting.location}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color="#8E8E93" />
                    <Text style={styles.detailText}>By {meeting.organizer_name}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Meeting Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Meeting</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="e.g., Monthly HOA Meeting"
              />

              <Text style={styles.label}>Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                {meetingTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeChip,
                      formData.meeting_type === type.id && styles.typeChipActive
                    ]}
                    onPress={() => setFormData({ ...formData, meeting_type: type.id })}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={18}
                      color={formData.meeting_type === type.id ? '#fff' : '#007AFF'}
                    />
                    <Text style={[
                      styles.typeText,
                      formData.meeting_type === type.id && styles.typeTextActive
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
              >
                <Text>{formData.date.toLocaleDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={formData.date}
                  mode="date"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setFormData({ ...formData, date: selectedDate });
                    }
                  }}
                />
              )}

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Time *</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text>{formData.time}</Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={new Date(`2000-01-01T${formData.time}:00`)}
                      mode="time"
                      onChange={(event, selectedTime) => {
                        setShowTimePicker(false);
                        if (selectedTime) {
                          const hours = selectedTime.getHours().toString().padStart(2, '0');
                          const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
                          setFormData({ ...formData, time: `${hours}:${minutes}` });
                        }
                      }}
                    />
                  )}
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>Duration (min) *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.duration_minutes.toString()}
                    onChangeText={(text) => setFormData({ ...formData, duration_minutes: parseInt(text) || 60 })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="e.g., Clubhouse, Hall A"
              />

              <Text style={styles.label}>Max Attendees</Text>
              <TextInput
                style={styles.input}
                value={formData.max_attendees.toString()}
                onChangeText={(text) => setFormData({ ...formData, max_attendees: parseInt(text) || 50 })}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Meeting details..."
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Agenda Items</Text>
              {formData.agenda.map((item, index) => (
                <View key={index} style={styles.agendaRow}>
                  <TextInput
                    style={[styles.input, styles.agendaInput]}
                    value={item}
                    onChangeText={(text) => updateAgendaItem(index, text)}
                    placeholder={`Item ${index + 1}`}
                  />
                  {formData.agenda.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeAgendaItem(index)}
                    >
                      <Ionicons name="trash" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addAgendaButton} onPress={addAgendaItem}>
                <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.addAgendaText}>Add Agenda Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={saving}
              >
                <Text style={styles.submitButtonText}>
                  {saving ? 'Scheduling...' : 'Schedule Meeting'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  meetingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  meetingHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  meetingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  meetingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  meetingType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  meetingDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  meetingDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#000',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    maxHeight: 80,
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    gap: 6,
  },
  typeChipActive: {
    backgroundColor: '#007AFF',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  typeTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  agendaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  agendaInput: {
    flex: 1,
  },
  removeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAgendaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addAgendaText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
