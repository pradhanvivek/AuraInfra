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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  agenda?: string[];
  organizer_name: string;
  max_attendees?: number;
  rsvp_deadline?: string;
}

interface RSVP {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  status: string;
  guests_count: number;
}

export default function HOAMeetingsScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [rsvps, setRsvps] = useState<{ [key: string]: RSVP }>({});
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rsvpingMeetingId, setRsvpingMeetingId] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId) {
      fetchMeetings();
    }
  }, [propertyId, activeTab]);

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/meetings?upcoming=${activeTab === 'upcoming'}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeetings(response.data);
      
      // Fetch RSVPs for all meetings
      const rsvpPromises = response.data.map((meeting: Meeting) =>
        fetchRSVPForMeeting(meeting.id)
      );
      await Promise.all(rsvpPromises);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRSVPForMeeting = async (meetingId: string) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/meetings/${meetingId}/rsvps`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const myRsvp = response.data.find((r: RSVP) => r.user_id === token);
      if (myRsvp) {
        setRsvps(prev => ({ ...prev, [meetingId]: myRsvp }));
      }
    } catch (error) {
      console.error('Error fetching RSVP:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMeetings();
  };

  const handleRSVP = async (meetingId: string, status: 'attending' | 'not_attending' | 'maybe') => {
    setRsvpingMeetingId(meetingId);
    try {
      await axios.post(
        `${API_URL}/api/meetings/rsvp`,
        {
          meeting_id: meetingId,
          status: status,
          guests_count: 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      await fetchRSVPForMeeting(meetingId);
      Alert.alert('Success', `You have confirmed you are ${status.replace('_', ' ')}`);
    } catch (error: any) {
      console.error('Error submitting RSVP:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit RSVP');
    } finally {
      setRsvpingMeetingId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getMeetingTypeIcon = (type: string): string => {
    switch (type) {
      case 'agm':
        return 'ribbon';
      case 'committee':
        return 'people';
      case 'emergency':
        return 'alert-circle';
      case 'social':
        return 'happy';
      default:
        return 'calendar';
    }
  };

  const getMeetingTypeColor = (type: string): string => {
    switch (type) {
      case 'agm':
        return '#FF9500';
      case 'committee':
        return '#5856D6';
      case 'emergency':
        return '#FF3B30';
      case 'social':
        return '#34C759';
      default:
        return '#007AFF';
    }
  };

  const getRSVPStatusIcon = (status?: string): { name: any; color: string } => {
    switch (status) {
      case 'attending':
        return { name: 'checkmark-circle', color: '#34C759' };
      case 'not_attending':
        return { name: 'close-circle', color: '#FF3B30' };
      case 'maybe':
        return { name: 'help-circle', color: '#FF9500' };
      default:
        return { name: 'radio-button-off', color: '#C7C7CC' };
    }
  };

  const openMeetingDetails = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setShowDetailModal(true);
  };

  const renderMeetingCard = (meeting: Meeting) => {
    const myRsvp = rsvps[meeting.id];
    const rsvpStatus = getRSVPStatusIcon(myRsvp?.status);
    const typeColor = getMeetingTypeColor(meeting.meeting_type);
    const isRsvping = rsvpingMeetingId === meeting.id;

    return (
      <TouchableOpacity
        key={meeting.id}
        style={[styles.card, { borderLeftColor: typeColor }]}
        onPress={() => openMeetingDetails(meeting)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: typeColor }]}>
            <Ionicons
              name={getMeetingTypeIcon(meeting.meeting_type) as any}
              size={24}
              color="#fff"
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.meetingTitle}>{meeting.title}</Text>
            <Text style={styles.meetingType}>
              {meeting.meeting_type.toUpperCase().replace('_', ' ')}
            </Text>
          </View>
          <Ionicons name={rsvpStatus.name} size={28} color={rsvpStatus.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>{formatDate(meeting.date)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>
              {formatTime(meeting.time)} ({meeting.duration_minutes} mins)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>{meeting.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color="#8E8E93" />
            <Text style={styles.infoText}>Organized by {meeting.organizer_name}</Text>
          </View>
        </View>

        {activeTab === 'upcoming' && !myRsvp && (
          <View style={styles.rsvpButtons}>
            <TouchableOpacity
              style={[styles.rsvpButton, styles.attendingButton]}
              onPress={() => handleRSVP(meeting.id, 'attending')}
              disabled={isRsvping}
            >
              {isRsvping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.rsvpButtonText}>Attending</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rsvpButton, styles.maybeButton]}
              onPress={() => handleRSVP(meeting.id, 'maybe')}
              disabled={isRsvping}
            >
              {isRsvping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="help-circle-outline" size={18} color="#fff" />
                  <Text style={styles.rsvpButtonText}>Maybe</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rsvpButton, styles.notAttendingButton]}
              onPress={() => handleRSVP(meeting.id, 'not_attending')}
              disabled={isRsvping}
            >
              {isRsvping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#fff" />
                  <Text style={styles.rsvpButtonText}>Can't Attend</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {myRsvp && (
          <View style={[styles.rsvpBanner, { backgroundColor: rsvpStatus.color + '20' }]}>
            <Ionicons name={rsvpStatus.name} size={18} color={rsvpStatus.color} />
            <Text style={[styles.rsvpBannerText, { color: rsvpStatus.color }]}>
              You are {myRsvp.status.replace('_', ' ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedMeeting) return null;

    const myRsvp = rsvps[selectedMeeting.id];
    const typeColor = getMeetingTypeColor(selectedMeeting.meeting_type);

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meeting Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={[styles.modalIconCircle, { backgroundColor: typeColor }]}>
                <Ionicons
                  name={getMeetingTypeIcon(selectedMeeting.meeting_type) as any}
                  size={40}
                  color="#fff"
                />
              </View>

              <Text style={styles.modalMeetingTitle}>{selectedMeeting.title}</Text>
              <View style={styles.modalTypeBadge}>
                <Text style={styles.modalTypeText}>
                  {selectedMeeting.meeting_type.toUpperCase().replace('_', ' ')}
                </Text>
              </View>

              <Text style={styles.modalDescription}>{selectedMeeting.description}</Text>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Details</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={20} color="#007AFF" />
                  <Text style={styles.detailText}>{formatDate(selectedMeeting.date)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time" size={20} color="#007AFF" />
                  <Text style={styles.detailText}>
                    {formatTime(selectedMeeting.time)} ({selectedMeeting.duration_minutes} minutes)
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={20} color="#007AFF" />
                  <Text style={styles.detailText}>{selectedMeeting.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={20} color="#007AFF" />
                  <Text style={styles.detailText}>
                    Organized by {selectedMeeting.organizer_name}
                  </Text>
                </View>
                {selectedMeeting.max_attendees && (
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={20} color="#007AFF" />
                    <Text style={styles.detailText}>
                      Max attendees: {selectedMeeting.max_attendees}
                    </Text>
                  </View>
                )}
              </View>

              {selectedMeeting.agenda && selectedMeeting.agenda.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Agenda</Text>
                  {selectedMeeting.agenda.map((item, index) => (
                    <View key={index} style={styles.agendaItem}>
                      <Text style={styles.agendaNumber}>{index + 1}.</Text>
                      <Text style={styles.agendaText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {myRsvp && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Your RSVP</Text>
                  <View style={styles.currentRsvp}>
                    <Ionicons
                      name={getRSVPStatusIcon(myRsvp.status).name}
                      size={24}
                      color={getRSVPStatusIcon(myRsvp.status).color}
                    />
                    <Text style={styles.currentRsvpText}>
                      You are {myRsvp.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {activeTab === 'upcoming' && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalAttendingButton]}
                  onPress={() => {
                    handleRSVP(selectedMeeting.id, 'attending');
                    setShowDetailModal(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Attending</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalMaybeButton]}
                  onPress={() => {
                    handleRSVP(selectedMeeting.id, 'maybe');
                    setShowDetailModal(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Maybe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalNotAttendingButton]}
                  onPress={() => {
                    handleRSVP(selectedMeeting.id, 'not_attending');
                    setShowDetailModal(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Can't Attend</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const upcomingMeetings = meetings.filter(
    m => new Date(m.date) >= new Date()
  );
  const pastMeetings = meetings.filter(
    m => new Date(m.date) < new Date()
  );
  const currentMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>HOA Meetings</Text>
          <View style={{ width: 28 }} />
        </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
          {upcomingMeetings.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{upcomingMeetings.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {currentMeetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              size={64}
              color="#C7C7CC"
            />
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'upcoming'
                ? 'Scheduled meetings will appear here'
                : 'Previous meetings will be shown here'}
            </Text>
          </View>
        ) : (
          currentMeetings.map(renderMeetingCard)
        )}
      </ScrollView>

      {renderDetailModal()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
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
    paddingTop: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  meetingType: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 10,
    borderRadius: 10,
  },
  attendingButton: {
    backgroundColor: '#34C759',
  },
  maybeButton: {
    backgroundColor: '#FF9500',
  },
  notAttendingButton: {
    backgroundColor: '#FF3B30',
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rsvpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  rsvpBannerText: {
    fontSize: 14,
    fontWeight: '600',
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
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  modalBody: {
    padding: 20,
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalMeetingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalTypeBadge: {
    alignSelf: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modalDescription: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#000',
    flex: 1,
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  agendaNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  agendaText: {
    fontSize: 15,
    color: '#000',
    flex: 1,
    lineHeight: 22,
  },
  currentRsvp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  currentRsvpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalAttendingButton: {
    backgroundColor: '#34C759',
  },
  modalMaybeButton: {
    backgroundColor: '#FF9500',
  },
  modalNotAttendingButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
