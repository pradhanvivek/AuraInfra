import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface PendingApproval {
  id: string;
  user_id: string;
  username: string;
  email: string;
  property_id: string;
  property_name: string;
  requested_role: string;
  documents: string[];
  document_names: string[];
  status: string;
  created_at: string;
}

export default function AdminApprovals() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [propertyId, setPropertyId] = useState('');

  useEffect(() => {
    fetchPropertyAndApprovals();
  }, []);

  const fetchPropertyAndApprovals = async () => {
    try {
      const profileResponse = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const managedProps = profileResponse.data.managed_properties || [];
      if (managedProps.length > 0) {
        setPropertyId(managedProps[0]);
        fetchApprovals(managedProps[0]);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching property:', error);
      setLoading(false);
    }
  };

  const fetchApprovals = async (propId: string) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/properties/${propId}/pending-approvals`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setApprovals(response.data);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalClick = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setAdminNotes('');
    setModalVisible(true);
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedApproval) return;

    setActionLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/properties/${propertyId}/approve-user`,
        {
          approval_id: selectedApproval.id,
          action: action,
          admin_notes: adminNotes
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      Alert.alert(
        'Success',
        `User ${action === 'approve' ? 'approved' : 'rejected'} successfully!`
      );
      setModalVisible(false);
      setSelectedApproval(null);
      fetchApprovals(propertyId);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
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
        <Text style={styles.headerTitle}>User Approvals</Text>
        <View style={{ width: 24 }} />
      </View>

      {approvals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No pending approvals</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {approvals.map((approval) => (
            <TouchableOpacity
              key={approval.id}
              style={styles.approvalCard}
              onPress={() => handleApprovalClick(approval)}
            >
              <View style={styles.approvalHeader}>
                <Ionicons name="person-circle" size={40} color="#007AFF" />
                <View style={styles.approvalInfo}>
                  <Text style={styles.approvalName}>{approval.username}</Text>
                  <Text style={styles.approvalEmail}>{approval.email}</Text>
                </View>
              </View>
              <View style={styles.approvalDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Role:</Text>
                  <Text style={styles.detailValue}>{approval.requested_role.toUpperCase()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Documents:</Text>
                  <Text style={styles.detailValue}>{approval.documents.length} submitted</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Submitted:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(approval.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Approval Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        {selectedApproval && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Approval Details</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.userSection}>
                <Text style={styles.sectionTitle}>User Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Username:</Text>
                  <Text style={styles.infoValue}>{selectedApproval.username}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>{selectedApproval.email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Requested Role:</Text>
                  <Text style={[styles.infoValue, styles.roleText]}>
                    {selectedApproval.requested_role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.documentsSection}>
                <Text style={styles.sectionTitle}>Submitted Documents</Text>
                {selectedApproval.documents.map((doc, index) => (
                  <View key={index} style={styles.documentCard}>
                    <Text style={styles.documentName}>
                      {selectedApproval.document_names[index] || `Document ${index + 1}`}
                    </Text>
                    <Image
                      source={{ uri: doc }}
                      style={styles.documentImage}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </View>

              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>Admin Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder="Add notes about this decision..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.actionsSection}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleAction('approve')}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    {actionLoading ? 'Processing...' : 'Approve User'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleAction('reject')}
                  disabled={actionLoading}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    {actionLoading ? 'Processing...' : 'Reject User'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  approvalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  approvalInfo: {
    marginLeft: 12,
    flex: 1,
  },
  approvalName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  approvalEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  approvalDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  userSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  roleText: {
    color: '#007AFF',
  },
  documentsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  documentCard: {
    marginBottom: 16,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  notesSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionsSection: {
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
  },
});
