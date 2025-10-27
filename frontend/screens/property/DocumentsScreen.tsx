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
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { documentApi } from '../../services/api';

interface Document {
  id: string;
  name: string;
  file_type: string;
  file_data: string;
  uploaded_at: string;
}

interface DocumentsScreenProps {
  propertyId: string;
}

export default function DocumentsScreen({ propertyId }: DocumentsScreenProps) {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [tempFileData, setTempFileData] = useState<{base64: string, type: string} | null>(null);
  const [documentName, setDocumentName] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const data = await documentApi.getAll(token!, propertyId);
      setDocuments(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });
      
      const fileType = file.mimeType || 'application/octet-stream';
      
      setTempFileData({ base64: base64, type: fileType });
      setDocumentName(file.name || 'Document');
      setNameModalVisible(true);

    } catch (error: any) {
      console.error('Document picker error:', error);
      Alert.alert('Error', error.message || 'Failed to select document');
    }
  };

  const handleSaveDocument = async () => {
    if (!documentName.trim()) {
      Alert.alert('Error', 'Please enter a document name');
      return;
    }

    if (!tempFileData) {
      Alert.alert('Error', 'No file selected');
      return;
    }

    setUploading(true);
    setNameModalVisible(false);

    try {
      await documentApi.create(token!, propertyId, {
        name: documentName.trim(),
        file_data: tempFileData.base64,
        file_type: tempFileData.type,
      });

      Alert.alert('Success', 'Document uploaded successfully');
      setTempFileData(null);
      setDocumentName('');
      await fetchDocuments();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    // For PDFs, save to file system and open with native viewer
    if (doc.file_type === 'application/pdf') {
      try {
        setLoading(true);
        
        // Create a temporary file path
        const fileUri = `${FileSystem.documentDirectory}${doc.name.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;
        
        // Write the base64 data to file
        await FileSystem.writeAsStringAsync(fileUri, doc.file_data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Check if sharing is available
        const canShare = await Sharing.isAvailableAsync();
        
        if (canShare) {
          // Share/Open the file with system PDF viewer
          await Sharing.shareAsync(fileUri, {
            UTI: 'com.adobe.pdf',
            mimeType: 'application/pdf',
          });
        } else {
          Alert.alert('Error', 'PDF viewing is not available on this device');
        }
        
        setLoading(false);
      } catch (error: any) {
        setLoading(false);
        console.error('PDF viewing error:', error);
        Alert.alert('Error', 'Failed to open PDF: ' + error.message);
      }
    } else {
      // For images and other files, show in modal
      setSelectedDocument(doc);
      setViewModalVisible(true);
    }
  };

  const handleDeleteDocument = (doc: Document) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentApi.delete(token!, propertyId, doc.id);
              fetchDocuments();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return 'document-text';
    if (fileType.includes('image')) return 'image';
    if (fileType.includes('video')) return 'videocam';
    return 'document';
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <TouchableOpacity 
      style={styles.documentCard}
      onPress={() => handleViewDocument(item)}
    >
      <View style={styles.documentIcon}>
        <Ionicons name={getFileIcon(item.file_type)} size={24} color="#007AFF" />
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.documentDate}>
          {new Date(item.uploaded_at).toLocaleDateString()}
        </Text>
        {item.file_type === 'application/pdf' && (
          <Text style={styles.pdfBadge}>Tap to open in PDF viewer</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteDocument(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>No documents yet</Text>
          <Text style={styles.emptySubtext}>Upload your first document</Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          style={styles.flatList}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={handleUploadDocument}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name="add" size={28} color="#fff" />
        )}
      </TouchableOpacity>

      {/* Name Input Modal */}
      <Modal
        visible={nameModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setNameModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Name Document</Text>
            <TouchableOpacity onPress={handleSaveDocument}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.label}>Document Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Property Deed, Insurance Policy"
              value={documentName}
              onChangeText={setDocumentName}
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Document Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <SafeAreaView style={styles.viewModalContainer} edges={['top', 'bottom']}>
          <View style={styles.viewModalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setViewModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.viewModalTitle} numberOfLines={1}>
              {selectedDocument?.name}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView 
            style={styles.viewModalContent}
            contentContainerStyle={styles.viewModalContentContainer}
            bounces={false}
          >
            {selectedDocument && (
              <>
                {selectedDocument.file_type.startsWith('image') ? (
                  <Image
                    source={{ uri: `data:${selectedDocument.file_type};base64,${selectedDocument.file_data}` }}
                    style={styles.documentImage}
                    resizeMode="contain"
                  />
                ) : selectedDocument.file_type === 'application/pdf' ? (
                  <View style={styles.pdfContainer}>
                    <WebView
                      source={{ 
                        html: `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                              <style>
                                body { margin: 0; padding: 0; background: #000; }
                                iframe { border: none; width: 100%; height: 100vh; }
                              </style>
                            </head>
                            <body>
                              <iframe src="data:application/pdf;base64,${selectedDocument.file_data}"></iframe>
                            </body>
                          </html>
                        `
                      }}
                      style={styles.webview}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      startInLoadingState={true}
                      renderLoading={() => (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="large" color="#007AFF" />
                          <Text style={styles.loadingText}>Loading PDF...</Text>
                        </View>
                      )}
                    />
                  </View>
                ) : (
                  <View style={styles.pdfPlaceholder}>
                    <Ionicons name="document-text" size={64} color="#007AFF" />
                    <Text style={styles.pdfText}>Document</Text>
                    <Text style={styles.pdfSubtext}>File preview not available</Text>
                  </View>
                )}
                <View style={styles.documentDetails}>
                  <Text style={styles.detailsLabel}>Name</Text>
                  <Text style={styles.detailsValue}>{selectedDocument.name}</Text>

                  <Text style={styles.detailsLabel}>Type</Text>
                  <Text style={styles.detailsValue}>{selectedDocument.file_type}</Text>

                  <Text style={styles.detailsLabel}>Uploaded</Text>
                  <Text style={styles.detailsValue}>
                    {new Date(selectedDocument.uploaded_at).toLocaleString()}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
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
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  flatList: {
    flex: 1,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  deleteButton: {
    padding: 8,
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
  fabDisabled: {
    opacity: 0.6,
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
  viewModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 22,
  },
  viewModalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  viewModalContent: {
    flex: 1,
  },
  viewModalContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  documentImage: {
    width: '100%',
    height: 400,
    maxHeight: 400,
    backgroundColor: '#000',
  },
  pdfContainer: {
    width: '100%',
    height: 500,
    backgroundColor: '#000',
    marginVertical: 10,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#fff',
  },
  pdfPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  pdfText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  pdfSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  documentDetails: {
    backgroundColor: '#1C1C1E',
    padding: 16,
    margin: 16,
    marginTop: 20,
    borderRadius: 12,
  },
  detailsLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 12,
    marginBottom: 4,
  },
  detailsValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});
