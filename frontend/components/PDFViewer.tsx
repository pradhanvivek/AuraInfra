import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

interface PDFViewerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  fileData: string; // base64 encoded file data
  mimeType?: string;
}

export default function PDFViewer({
  visible,
  onClose,
  title,
  fileData,
  mimeType = 'application/pdf',
}: PDFViewerProps) {
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (visible && fileData) {
      openDocument();
    }
  }, [visible, fileData]);

  const openDocument = async () => {
    try {
      setLoading(true);
      
      // Generate filename with proper extension
      const extension = mimeType.includes('pdf') ? 'pdf' : 'doc';
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Write base64 data to file
      await FileSystem.writeAsStringAsync(fileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('File written to:', fileUri);
      
      if (Platform.OS === 'android') {
        // Android: Use IntentLauncher to open document directly in viewer app
        console.log('Opening document on Android with IntentLauncher');
        const contentUri = await FileSystem.getContentUriAsync(fileUri);
        console.log('Content URI:', contentUri);
        
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: mimeType,
        });
      } else if (Platform.OS === 'ios') {
        // iOS: Use Sharing API which opens document in QuickLook viewer
        console.log('Opening document on iOS with Sharing API');
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          dialogTitle: title,
          UTI: mimeType,
        });
      }
      
      setLoading(false);
      
      // Close modal after opening
      // Give a small delay to ensure viewer opens first
      setTimeout(() => {
        onClose();
      }, 500);
      
    } catch (error: any) {
      console.error('Error opening document:', error);
      setLoading(false);
      Alert.alert('Error', `Failed to open document: ${error.message}`);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Opening {title}...</Text>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
