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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && fileData) {
      openDocument();
    }
  }, [visible, fileData]);

  const openDocument = async () => {
    try {
      setLoading(true);
      
      console.log('=== PDF VIEWER DEBUG START ===');
      console.log('Title:', title);
      console.log('MimeType:', mimeType);
      console.log('FileData length:', fileData?.length || 0);
      
      if (!fileData) {
        throw new Error('No file data provided');
      }
      
      const safeTitle = title || 'document';
      const extension = mimeType.includes('pdf') ? 'pdf' : 'doc';
      const fileName = `${safeTitle.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
      const localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Write base64 data to file
      await FileSystem.writeAsStringAsync(localFileUri, fileData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('File written to:', localFileUri);
      
      if (Platform.OS === 'android') {
        // Android: Use IntentLauncher
        console.log('Android: Opening with IntentLauncher');
        const contentUri = await FileSystem.getContentUriAsync(localFileUri);
        
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
      } else {
        // iOS: Use Sharing API (opens in system PDF viewer)
        console.log('iOS: Opening with Sharing API');
        await Sharing.shareAsync(localFileUri, {
          UTI: 'com.adobe.pdf',
          mimeType: mimeType,
        });
      }
      
      console.log('=== PDF VIEWER DEBUG END ===');
      setLoading(false);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error: any) {
      console.error('=== PDF VIEWER ERROR ===');
      console.error('Error:', error.message);
      setLoading(false);
      Alert.alert('Error', `Failed to open document: ${error.message}`);
      onClose();
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
            onLoadStart={() => {
              console.log('WebView: Load started');
              setLoading(true);
            }}
            onLoadEnd={() => {
              console.log('WebView: Load ended');
              setLoading(false);
            }}
            onLoad={() => {
              console.log('WebView: Loaded successfully');
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error (native):', nativeEvent);
              console.error('WebView error description:', nativeEvent.description);
              console.error('WebView error code:', nativeEvent.code);
              Alert.alert('Error', 'Failed to load PDF');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView HTTP error:', nativeEvent);
              console.error('HTTP status code:', nativeEvent.statusCode);
            }}
            onMessage={(event) => {
              console.log('WebView message:', event.nativeEvent.data);
            }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
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
  viewerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 4,
    minWidth: 40,
  },
  headerTitle: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#525659',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlayText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  loadingModal: {
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
