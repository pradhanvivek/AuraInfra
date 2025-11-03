import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

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
}

interface RSVP {
  id: string;
  user_name: string;
  status: string;
  guests_count: number;
}

export default function MeetingsScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [rsvpModalVisible, setRsvpModalVisible] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<'attending' | 'not_attending' | 'maybe'>('attending');

  useEffect(() => {
    if (propertyId) {
      fetchMeetings();
    }
  }, [propertyId]);

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/meetings?upcoming=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeetings(response.data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  const handleRSVP = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/meetings/${meeting.id}/rsvps`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRsvps(response.data);
      setRsvpModalVisible(true);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
      Alert.alert('Error', 'Failed to load RSVPs');
    }
  };

  const handleSubmitRSVP = async () => {
    if (!selectedMeeting) return;

    try {
      await axios.post(
        `${API_URL}/api/meetings/rsvp`,
        {
          meeting_id: selectedMeeting.id,
          status: rsvpStatus,
          guests_count: 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'RSVP submitted successfully');
      setRsvpModalVisible(false);
      fetchMeetings();
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      Alert.alert('Error', 'Failed to submit RSVP');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntil = (dateString: string): number => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getMeetingTypeColor = (type: string): string => {
    switch (type) {
      case 'agm': return '#FF3B30';
      case 'emergency': return '#FF9500';
      case 'committee': return '#5856D6';
      default: return '#007AFF';
    }
  };

  const renderMeetingCard = (meeting: Meeting) => {
    const daysUntil = getDaysUntil(meeting.date);
    const attending = rsvps.filter(r => r.status === 'attending').length;

    return (
      <View key={meeting.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.iconCircle,
            { backgroundColor: getMeetingTypeColor(meeting.meeting_type) + '20' }
          ]}>
            <Ionicons
              name="calendar"
              size={28}
              color={getMeetingTypeColor(meeting.meeting_type)}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.meetingTitle}>{meeting.title}</Text>
            <Text style={styles.organizer}>By {meeting.organizer_name}</Text>
          </View>
          <View style={[
            styles.typeBadge,
            { backgroundColor: getMeetingTypeColor(meeting.meeting_type) }
          ]}>
            <Text style={styles.typeBadgeText}>{meeting.meeting_type.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>{meeting.description}</Text>

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <View>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(meeting.date)}</Text>
              {daysUntil >= 0 && (
                <Text style={styles.daysUntil}>
                  {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <View>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{meeting.time}</Text>
              <Text style={styles.duration}>{meeting.duration_minutes} min</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={16} color="#8E8E93" />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{meeting.location}</Text>
            </View>
          </View>

          {meeting.max_attendees && (
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <View>
                <Text style={styles.detailLabel}>Capacity</Text>
                <Text style={styles.detailValue}>{meeting.max_attendees} people</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.rsvpButton}
          onPress={() => handleRSVP(meeting)}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={styles.rsvpButtonText}>RSVP</Text>
        </TouchableOpacity>
      </View>
    );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meetings & Events</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {meetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No upcoming meetings</Text>
            <Text style={styles.emptySubtext}>Scheduled meetings will appear here</Text>
          </View>
        ) : (
          meetings.map(renderMeetingCard)
        )}
      </ScrollView>

      {/* RSVP Modal */}
      <Modal
        visible={rsvpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRsvpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>RSVP to Meeting</Text>
              <TouchableOpacity onPress={() => setRsvpModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.meetingTitleModal}>{selectedMeeting?.title}</Text>
              
              <Text style={styles.rsvpLabel}>Your Response</Text>
              <View style={styles.rsvpOptions}>
                <TouchableOpacity
                  style={[
                    styles.rsvpOption,
                    rsvpStatus === 'attending' && styles.rsvpOptionActive
                  ]}
                  onPress={() => setRsvpStatus('attending')}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={32}
                    color={rsvpStatus === 'attending' ? '#34C759' : '#C7C7CC'}
                  />
                  <Text style={[
                    styles.rsvpOptionText,
                    rsvpStatus === 'attending' && styles.rsvpOptionTextActive
                  ]}>
                    Attending
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.rsvpOption,
                    rsvpStatus === 'maybe' && styles.rsvpOptionActive
                  ]}
                  onPress={() => setRsvpStatus('maybe')}
                >
                  <Ionicons
                    name="help-circle"
                    size={32}
                    color={rsvpStatus === 'maybe' ? '#FF9500' : '#C7C7CC'}
                  />
                  <Text style={[
                    styles.rsvpOptionText,
                    rsvpStatus === 'maybe' && styles.rsvpOptionTextActive
                  ]}>
                    Maybe
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.rsvpOption,
                    rsvpStatus === 'not_attending' && styles.rsvpOptionActive
                  ]}
                  onPress={() => setRsvpStatus('not_attending')}
                >
                  <Ionicons
                    name="close-circle"
                    size={32}
                    color={rsvpStatus === 'not_attending' ? '#FF3B30' : '#C7C7CC'}
                  />
                  <Text style={[
                    styles.rsvpOptionText,
                    rsvpStatus === 'not_attending' && styles.rsvpOptionTextActive
                  ]}>
                    Not Attending
                  </Text>
                </TouchableOpacity>
              </View>

              {rsvps.length > 0 && (
                <View style={styles.rsvpList}>
                  <Text style={styles.rsvpListTitle}>Responses ({rsvps.length})</Text>
                  {rsvps.slice(0, 5).map((rsvp) => (
                    <View key={rsvp.id} style={styles.rsvpItem}>
                      <Ionicons
                        name={rsvp.status === 'attending' ? 'checkmark-circle' : rsvp.status === 'maybe' ? 'help-circle' : 'close-circle'}
                        size={20}
                        color={rsvp.status === 'attending' ? '#34C759' : rsvp.status === 'maybe' ? '#FF9500' : '#FF3B30'}
                      />
                      <Text style={styles.rsvpName}>{rsvp.user_name}</Text>
                    </View>
                  ))}
                  {rsvps.length > 5 && (
                    <Text style={styles.moreRsvps}>+{rsvps.length - 5} more</Text>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRSVP}>
                <Text style={styles.submitButtonText}>Submit RSVP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  organizer: {
    fontSize: 13,
    color: '#8E8E93',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  daysUntil: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  duration: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 12,
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalBody: {
    padding: 20,
  },
  meetingTitleModal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  rsvpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  rsvpOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  rsvpOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  rsvpOptionActive: {
    backgroundColor: '#E5F0FF',
  },
  rsvpOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 8,
  },
  rsvpOptionTextActive: {
    color: '#000',
  },
  rsvpList: {
    marginBottom: 20,
  },
  rsvpListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  rsvpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  rsvpName: {
    fontSize: 14,
    color: '#000',
  },
  moreRsvps: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});