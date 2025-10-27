import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { documentApi } from '../../services/api';

interface Document {
  id: string;
  name: string;
  file_type: string;
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
      // First try with images using ImagePicker for better mobile support
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library permissions to upload files');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploading(true);
      const file = result.assets[0];

      try {
        // Use base64 if available, otherwise read from URI
        let base64Data = file.base64;
        
        if (!base64Data && file.uri) {
          // Try to read from file system
          try {
            base64Data = await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (fsError) {
            console.error('FileSystem read error:', fsError);
            throw new Error('Unable to read file. Please try a different file.');
          }
        }

        if (!base64Data) {
          throw new Error('Unable to process file. Please try again.');
        }

        // Determine file name and type
        const fileName = file.fileName || file.uri.split('/').pop() || 'document';
        const fileType = file.type === 'image' ? 'image/jpeg' : 'application/octet-stream';

        await documentApi.create(token!, propertyId, {
          name: fileName,
          file_data: base64Data,
          file_type: fileType,
        });

        Alert.alert('Success', 'Document uploaded successfully');
        await fetchDocuments();
      } catch (uploadError: any) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
    } catch (error: any) {
      console.error('Document picker error:', error);
      Alert.alert('Error', error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
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
    <View style={styles.documentCard}>
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
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteDocument(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
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
});
