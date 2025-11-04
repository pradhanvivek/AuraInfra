import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const categories = [
  { id: 'announcement', name: 'Announcement', icon: 'megaphone', color: '#FF3B30' },
  { id: 'discussion', name: 'Discussion', icon: 'chatbubbles', color: '#007AFF' },
  { id: 'event', name: 'Event', icon: 'calendar', color: '#FF9500' },
  { id: 'complaint', name: 'Complaint', icon: 'alert-circle', color: '#FF2D55' },
  { id: 'general', name: 'General', icon: 'document-text', color: '#8E8E93' },
];

export default function CreateCommunityPost() {
  const router = useRouter();
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('announcement');
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState('');

  useEffect(() => {
    fetchPropertyId();
  }, []);

  const fetchPropertyId = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.managed_properties?.length > 0) {
        setPropertyId(response.data.managed_properties[0]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async () => {
    if (!title || !content) {
      Alert.alert('Error', 'Please enter title and content');
      return;
    }

    if (!propertyId) {
      Alert.alert('Error', 'Property not loaded. Please try again.');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/properties/${propertyId}/create-post`,
        {
          property_id: propertyId,
          title,
          content,
          category,
          photos: []
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      Alert.alert('Success', 'Post created successfully!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  category === cat.id && { backgroundColor: cat.color },
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={20}
                  color={category === cat.id ? '#fff' : cat.color}
                />
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter post title"
          />

          <Text style={styles.label}>Content *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={content}
            onChangeText={setContent}
            placeholder="Write your announcement or message here..."
            multiline
            numberOfLines={8}
          />

          <View style={styles.noteCard}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.noteText}>
              Posts marked as "Announcement" will be pinned and all residents will receive notifications.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.submitButtonText}>
              {saving ? 'Creating...' : 'Create Post'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
  content: {
    flex: 1,
    padding: 16,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  categoriesList: {
    maxHeight: 70,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginLeft: 6,
  },
  categoryTextSelected: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  noteText: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
