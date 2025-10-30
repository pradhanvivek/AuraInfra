import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface ImageViewerProps {
  visible?: boolean;
  images?: string[];
  imageUri?: string;
  initialIndex?: number;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export default function ImageViewer({ visible = true, images, imageUri, initialIndex = 0, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Support both single image (imageUri) and multiple images (images array)
  const imageList = images || (imageUri ? [imageUri] : []);
  const currentImageUri = imageList[currentIndex];

  const handleShare = async () => {
    try {
      if (!currentImageUri) {
        Alert.alert('Error', 'No image to share');
        return;
      }
      
      // For base64 images, we need to save to file first
      if (currentImageUri.startsWith('data:image')) {
        const base64Data = currentImageUri.split(',')[1];
        
        if (!base64Data) {
          Alert.alert('Error', 'Invalid image format');
          return;
        }
        
        const filename = `share_${Date.now()}.jpg`;
        const fileUri = FileSystem.documentDirectory + filename;
        
        // Write file using the FileSystem API
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Share Image',
            UTI: 'public.jpeg',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else if (currentImageUri.startsWith('http')) {
        // For HTTP URLs - try to share directly
        await Share.share({ url: currentImageUri });
      } else {
        // For base64 without data:image prefix
        const filename = `share_${Date.now()}.jpg`;
        const fileUri = FileSystem.documentDirectory + filename;
        
        await FileSystem.writeAsStringAsync(fileUri, currentImageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Share Image',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error: any) {
      console.error('Error sharing image:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        FileSystem: typeof FileSystem,
        EncodingType: typeof FileSystem?.EncodingType,
      });
      Alert.alert('Error', `Failed to share image: ${error.message}`);
    }
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Images */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          contentOffset={{ x: initialIndex * width, y: 0 }}
        >
          {imageList.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Page Indicator */}
        {imageList.length > 1 && (
          <View style={styles.pageIndicator}>
            {imageList.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  currentIndex === index && styles.activeDot,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerButton: {
    padding: 8,
  },
  imageContainer: {
    width: width,
    height: height - 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height - 100,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
