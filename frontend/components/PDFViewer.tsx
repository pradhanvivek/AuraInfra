import React, { useEffect, useEffectEvent } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  ScrollView,
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

// Map a mime type to a sensible file extension
const getExtension = (mimeType: string): string => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (mimeType.includes('msword')) return 'doc';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'bin';
};

export default function PDFViewer({
  visible,
  onClose,
  title,
  fileData,
  mimeType = 'application/pdf',
}: PDFViewerProps) {
  const isImage = mimeType.startsWith('image/');
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    if (!visible || !fileData || isImage) return;
    let cancelled = false;
    let localFileUri: string | undefined;
    const open = async () => {
      try {
        const safeTitle = (title || 'document').replace(/[^a-z0-9]/gi, '_').slice(0, 80);
        const fileName = `${safeTitle}_${Date.now()}.${getExtension(mimeType)}`;
        if (Platform.OS === 'web') {
          const binary = atob(fileData.replace(/^data:[^,]+,/, ''));
          const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
          const link = document.createElement('a');
          link.href = url; link.download = fileName;
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } else {
          localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(localFileUri, fileData.replace(/^data:[^,]+,/, ''), {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (cancelled) return;
          if (Platform.OS === 'android') {
            try {
              const contentUri = await FileSystem.getContentUriAsync(localFileUri);
              await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri, flags: 1, type: mimeType,
              });
            } catch {
              if (!await Sharing.isAvailableAsync()) throw new Error('Install an app that can open this document.');
              await Sharing.shareAsync(localFileUri, { mimeType });
            }
          } else {
            if (!await Sharing.isAvailableAsync()) throw new Error('Document sharing is unavailable on this device.');
            await Sharing.shareAsync(localFileUri, {
              mimeType, ...(mimeType.includes('pdf') ? { UTI: 'com.adobe.pdf' } : {}),
            });
          }
        }
      } catch {
        if (!cancelled) Alert.alert('Unable to open document', 'Please try again or use a compatible document viewer.');
      } finally {
        if (localFileUri) await FileSystem.deleteAsync(localFileUri, { idempotent: true }).catch(() => {});
        if (!cancelled) close();
      }
    };
    void open();
    return () => { cancelled = true; };
  }, [visible, fileData, mimeType, title, isImage]);

  // Images render in-app for a smooth preview
  if (isImage) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.imageViewerContainer} edges={['top']}>
          <View style={styles.imageHeader}>
            <Text style={styles.imageHeaderTitle} numberOfLines={1}>
              {title || 'Document'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.imageScroll}
            contentContainerStyle={styles.imageScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            <Image
              source={{ uri: `data:${mimeType};base64,${fileData}` }}
              style={styles.documentImage}
              resizeMode="contain"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // PDFs / documents: brief loading state while the system viewer opens
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.loadingModal}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Opening {title || 'document'}...</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  imageHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginRight: 12,
  },
  headerButton: {
    padding: 4,
  },
  imageScroll: {
    flex: 1,
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentImage: {
    width: '100%',
    height: 500,
  },
});
