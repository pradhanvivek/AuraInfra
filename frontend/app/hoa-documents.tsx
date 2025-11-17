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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Document {
  id: string;
  title: string;
  category: string;
  description?: string;
  file_name?: string;
  file_size?: number;
  upload_date: string;
  uploaded_by: string;
}

export default function HOADocumentsScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: 'bylaws',
    description: '',
    fileUri: '',
    fileName: '',
    fileType: '',
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  const [viewerDocument, setViewerDocument] = useState<{
    title: string;
    fileData: string;
    mimeType: string;
    fileName: string;
  } | null>(null);

  const categories = [
    { id: 'all', name: 'All', icon: 'folder-open' },
    { id: 'bylaws', name: 'Bylaws', icon: 'document-text' },
    { id: 'minutes', name: 'Minutes', icon: 'time' },
    { id: 'financial', name: 'Financial', icon: 'calculator' },
    { id: 'notice', name: 'Notice', icon: 'megaphone' },
    { id: 'form', name: 'Forms', icon: 'clipboard' },
  ];

  useEffect(() => {
    if (propertyId) {
      fetchDocuments();
      checkUserAdmin();
    }
  }, [propertyId, selectedCategory]);

  const fetchDocuments = async () => {
    try {
      if (!propertyId) {
        console.error('No property ID provided');
        setLoading(false);
        return;
      }
      
      const categoryParam = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/hoa-documents${categoryParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkUserAdmin = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const isPropertyAdmin = response.data.is_hoa_admin && 
        response.data.managed_properties?.includes(propertyId);
      setIsAdmin(isPropertyAdmin || response.data.is_super_admin);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setUploadForm({
          ...uploadForm,
          fileUri: file.uri,
          fileName: file.name,
          fileType: file.mimeType || 'application/pdf',
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.title || !uploadForm.fileUri) {
      Alert.alert('Error', 'Please provide title and select a file');
      return;
    }

    setUploading(true);
    try {
      const response = await fetch(uploadForm.fileUri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        try {
          await axios.post(
            `${API_URL}/api/properties/${propertyId}/hoa-documents`,
            {
              property_id: propertyId,
              title: uploadForm.title,
              category: uploadForm.category,
              description: uploadForm.description,
              file_data: base64data,
              file_type: uploadForm.fileType,
              file_name: uploadForm.fileName,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          Alert.alert('Success', 'Document uploaded successfully');
          setShowUploadModal(false);
          setUploadForm({
            title: '',
            category: 'bylaws',
            description: '',
            fileUri: '',
            fileName: '',
            fileType: '',
          });
          fetchDocuments();
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.detail || 'Failed to upload document');
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      Alert.alert('Error', 'Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'bylaws': return '#5856D6';
      case 'minutes': return '#007AFF';
      case 'financial': return '#34C759';
      case 'notice': return '#FF9500';
      case 'form': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat?.icon || 'document';
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      console.log('handleViewDocument called for:', doc.title);
      
      // Fetch the document with file data
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/hoa-documents/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Document fetched, file_type:', response.data.file_type);
      
      // Support both file_data (new) and file_url (old/legacy)
      let fileData = response.data.file_data || response.data.file_url;
      
      if (!fileData) {
        Alert.alert('Error', 'Document data not available');
        return;
      }
      
      // Remove data URI prefix if present (e.g., "data:application/pdf;base64,")
      if (fileData.includes(',')) {
        fileData = fileData.split(',')[1];
      }
      
      const fileName = doc.file_name || `${doc.title}.pdf`;
      const mimeType = response.data.file_type || 'application/pdf';

      console.log('Processing document - mimeType:', mimeType, 'Platform:', Platform.OS);

      if (Platform.OS === 'android') {
        // Android: Use IntentLauncher to open file directly in viewer app
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, fileData, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
      } else if (Platform.OS === 'ios') {
        // iOS: For PDFs, use Sharing API instead of WebView (more reliable)
        if (mimeType.includes('pdf')) {
          console.log('Opening PDF with Sharing API');
          const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, fileData, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          await Sharing.shareAsync(fileUri, {
            mimeType: mimeType,
            UTI: mimeType,
          });
        } else {
          // For images, show in modal
          console.log('Opening image in modal');
          setViewerDocument({
            title: doc.title,
            fileData: fileData,
            mimeType: mimeType,
            fileName: fileName,
          });
          setViewerModalVisible(true);
        }
      } else {
        // Web: Download the file
        const link = document.createElement('a');
        link.href = `data:${mimeType};base64,${fileData}`;
        link.download = fileName;
        link.click();
      }
    } catch (error: any) {
      console.error('Error viewing document:', error);
      console.error('Error stack:', error.stack);
      if (Platform.OS === 'web') {
        alert('Failed to open document: ' + error.message);
      } else {
        Alert.alert('Error', 'Failed to open document: ' + error.message);
      }
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      // Fetch the document with file data
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/hoa-documents/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Support both file_data (new) and file_url (old/legacy)
      let fileData = response.data.file_data || response.data.file_url;
      
      if (!fileData) {
        Alert.alert('Error', 'Document data not available');
        return;
      }
      
      // Remove data URI prefix if present
      if (fileData.includes(',')) {
        fileData = fileData.split(',')[1];
      }
      
      const fileName = doc.file_name || `${doc.title}.pdf`;
      
      if (Platform.OS === 'web') {
        // Web: Direct download
        const link = document.createElement('a');
        link.href = `data:${response.data.file_type || 'application/pdf'};base64,${fileData}`;
        link.download = fileName;
        link.click();
        Alert.alert('Success', 'Document downloaded');
      } else {
        // Mobile: Save to cache and share
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, fileData, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        await Sharing.shareAsync(fileUri, {
          mimeType: response.data.file_type || 'application/pdf',
          dialogTitle: `Download ${doc.title}`,
        });
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert('Error', 'Failed to download document');
    }
  };

  const handleShareDocument = async (doc: Document) => {
    try {
      // Fetch the document with file data
      const response = await axios.get(
        `${API_URL}/api/properties/${propertyId}/hoa-documents/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Support both file_data (new) and file_url (old/legacy)
      let fileData = response.data.file_data || response.data.file_url;
      
      if (!fileData) {
        Alert.alert('Error', 'Document data not available');
        return;
      }
      
      // Remove data URI prefix if present
      if (fileData.includes(',')) {
        fileData = fileData.split(',')[1];
      }
      
      const fileName = doc.file_name || `${doc.title}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Write file to cache
      await FileSystem.writeAsStringAsync(fileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: response.data.file_type || 'application/pdf',
          dialogTitle: `Share ${doc.title}`,
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert('Error', 'Failed to share document');
    }
  };

  const renderDocumentCard = (doc: Document) => {
    return (
      <TouchableOpacity key={doc.id} style={styles.card} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.iconCircle,
            { backgroundColor: getCategoryColor(doc.category || 'other') + '20' }
          ]}>
            <Ionicons
              name={getCategoryIcon(doc.category || 'other') as any}
              size={28}
              color={getCategoryColor(doc.category || 'other')}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.documentTitle}>{doc.title}</Text>
            {doc.description && (
              <Text style={styles.description} numberOfLines={2}>{doc.description}</Text>
            )}
          </View>
        </View>

        <View style={styles.metadata}>
          <View style={styles.metaRow}>
            <View style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(doc.category || 'other') }
            ]}>
              <Text style={styles.categoryText}>{(doc.category || 'other').toUpperCase()}</Text>
            </View>
            
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
              <Text style={styles.metaText}>{formatDate(doc.upload_date)}</Text>
            </View>
          </View>

          {doc.file_name && (
            <View style={styles.fileInfo}>
              <Ionicons name="document-attach" size={14} color="#8E8E93" />
              <Text style={styles.fileName} numberOfLines={1}>{doc.file_name}</Text>
              {doc.file_size && (
                <Text style={styles.fileSize}>{formatFileSize(doc.file_size)}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleViewDocument(doc)}>
            <Ionicons name="eye-outline" size={20} color="#007AFF" />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDownloadDocument(doc)}>
            <Ionicons name="download-outline" size={20} color="#007AFF" />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleShareDocument(doc)}>
            <Ionicons name="share-outline" size={20} color="#007AFF" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>HOA Documents</Text>
          <View style={{ width: 28 }} />
        </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons
              name={cat.icon as any}
              size={16}
              color={selectedCategory === cat.id ? '#007AFF' : '#8E8E93'}
            />
            <Text style={[
              styles.categoryChipText,
              selectedCategory === cat.id && styles.categoryChipTextActive
            ]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {documents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No documents found</Text>
            <Text style={styles.emptySubtext}>
              {selectedCategory === 'all'
                ? 'Documents will appear here when uploaded'
                : `No ${selectedCategory} documents available`}
            </Text>
          </View>
        ) : (
          documents.map(renderDocumentCard)
        )}
      </ScrollView>

      {/* Floating Upload Button (Admin Only) */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setShowUploadModal(true)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={uploadForm.title}
                onChangeText={(text) => setUploadForm({ ...uploadForm, title: text })}
                placeholder="e.g., 2024 Annual Meeting Minutes"
              />

              <Text style={styles.modalLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                {categories.filter(c => c.id !== 'all').map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      uploadForm.category === cat.id && styles.categoryChipActive
                    ]}
                    onPress={() => setUploadForm({ ...uploadForm, category: cat.id })}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={18}
                      color={uploadForm.category === cat.id ? '#fff' : '#007AFF'}
                    />
                    <Text style={[
                      styles.categoryChipText,
                      uploadForm.category === cat.id && styles.categoryChipTextActive
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={uploadForm.description}
                onChangeText={(text) => setUploadForm({ ...uploadForm, description: text })}
                placeholder="Brief description..."
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity style={styles.filePickerButton} onPress={pickDocument}>
                <Ionicons name="document-attach" size={20} color="#007AFF" />
                <Text style={styles.filePickerText}>
                  {uploadForm.fileName || 'Select Document (PDF, DOC, DOCX)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                onPress={handleUpload}
                disabled={uploading}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image Viewer Modal (iOS Images Only) */}
      <Modal visible={viewerModalVisible} animationType="slide" transparent>
        <View style={styles.viewerModalContainer}>
          <View style={styles.viewerModalContent}>
            <View style={styles.viewerModalHeader}>
              <Text style={styles.viewerModalTitle} numberOfLines={1}>{viewerDocument?.title}</Text>
              <TouchableOpacity onPress={() => setViewerModalVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            {viewerDocument && (
              <ScrollView style={styles.imageViewerContainer} contentContainerStyle={styles.imageViewerContent}>
                <Image
                  source={{ uri: `data:${viewerDocument.mimeType};base64,${viewerDocument.fileData}` }}
                  style={styles.documentImage}
                  resizeMode="contain"
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  categoriesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    height: 50,
    maxHeight: 50,
    flexGrow: 0,
    flexShrink: 0,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
    minHeight: 50,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#E5F0FF',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#007AFF',
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
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
  categorySelector: {
    maxHeight: 60,
    marginBottom: 8,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  filePickerText: {
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  uploadButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
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
  documentTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  metadata: {
    gap: 8,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#007AFF',
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
  viewerModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  viewerModalContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  viewerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  viewerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 16,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageViewerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  documentImage: {
    width: '100%',
    height: 500,
    minHeight: 300,
  },
  webView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
});