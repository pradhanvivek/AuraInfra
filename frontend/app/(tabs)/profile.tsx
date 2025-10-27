import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

interface UserProfile {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  warranty_reminder_days: number;
  created_at: string;
}

export default function Profile() {
  const router = useRouter();
  const { username, logout, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [warrantyModalVisible, setWarrantyModalVisible] = useState(false);
  const [selectedReminderDays, setSelectedReminderDays] = useState(30);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await authApi.getProfile(token!);
      setProfile(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (field: 'email' | 'phone') => {
    setEditField(field);
    setEditValue(field === 'email' ? profile?.email || '' : profile?.phone || '');
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editValue.trim() && editField) {
      Alert.alert('Error', `Please enter a valid ${editField}`);
      return;
    }

    setSaving(true);
    try {
      const updateData = editField === 'email' 
        ? { email: editValue.trim() }
        : { phone: editValue.trim() };
      
      const updatedProfile = await authApi.updateProfile(token!, updateData);
      setProfile(updatedProfile);
      setEditModalVisible(false);
      Alert.alert('Success', `${editField === 'email' ? 'Email' : 'Phone number'} updated successfully`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ],
      { cancelable: true }
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#007AFF" />
          </View>
          <Text style={styles.username}>{profile?.username}</Text>
          <Text style={styles.memberSince}>
            Member since {new Date(profile?.created_at || '').toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="time-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Warranty Reminder</Text>
              <Text style={styles.infoValue}>
                {profile?.warranty_reminder_days} days before expiry
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => handleEdit('email')}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="mail-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {profile?.email || 'Not provided'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => handleEdit('phone')}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="call-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoValue}>
                {profile?.phone || 'Not provided'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={24} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{profile?.username}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
            <View style={styles.infoIcon}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </View>
            <Text style={styles.logoutText}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Edit {editField === 'email' ? 'Email' : 'Phone Number'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.label}>
              {editField === 'email' ? 'Email Address' : 'Phone Number'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={
                editField === 'email' 
                  ? 'your.email@example.com' 
                  : '+1 234 567 8900'
              }
              value={editValue}
              onChangeText={setEditValue}
              keyboardType={editField === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 17,
    color: '#000',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  logoutText: {
    flex: 1,
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '500',
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
  saveButtonDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
});
