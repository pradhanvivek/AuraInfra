import React, { useEffect, useState } from 'react';
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
import { WebView } from 'react-native-webview';
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
  const [loading, setLoading] = useState(true);
  const [fileUri, setFileUri] = useState<string>('');
  const [showWebView, setShowWebView] = useState(false);

  useEffect(() => {
    if (visible && fileData) {
      prepareDocument();
    }
  }, [visible, fileData]);

  const prepareDocument = async () => {
    try {
      setLoading(true);
      
      // Generate filename with proper extension
      const extension = mimeType.includes('pdf') ? 'pdf' : 'doc';
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
      const localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Write base64 data to file
      await FileSystem.writeAsStringAsync(localFileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('File written to:', localFileUri);
      
      if (Platform.OS === 'android') {
        // Android: Use IntentLauncher to open document directly in viewer app
        console.log('Opening document on Android with IntentLauncher');
        const contentUri = await FileSystem.getContentUriAsync(localFileUri);
        console.log('Content URI:', contentUri);
        
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: mimeType,
        });
        
        setLoading(false);
        // Close modal after opening
        setTimeout(() => {
          onClose();
        }, 500);
        
      } else if (Platform.OS === 'ios') {
        // iOS: Display PDF in WebView for direct viewing
        console.log('Opening document on iOS with WebView');
        setFileUri(localFileUri);
        setShowWebView(true);
        setLoading(false);
      }
      
    } catch (error: any) {
      console.error('Error preparing document:', error);
      setLoading(false);
      Alert.alert('Error', `Failed to open document: ${error.message}`);
      onClose();
    }
  };

  const handleShare = async () => {
    try {
      if (fileUri) {
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          dialogTitle: title,
          UTI: mimeType,
        });
      }
    } catch (error: any) {
      console.error('Error sharing document:', error);
      Alert.alert('Error', `Failed to share document: ${error.message}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      {showWebView && fileUri ? (
        // iOS: Show WebView with PDF
        <SafeAreaView style={styles.viewerContainer} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Ionicons name="close" size={28} color="#007AFF" />
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: fileUri }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(error) => {
              console.error('WebView error:', error);
              Alert.alert('Error', 'Failed to load PDF');
            }}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingOverlayText}>Loading PDF...</Text>
            </View>
          )}
        </SafeAreaView>
      ) : (
        // Loading state
        <View style={styles.loadingModal}>
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
      )}
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
