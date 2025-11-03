import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Property {
  id: string;
  name: string;
  address: string;
}

export default function RegisterWithApproval() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Property & Role, 3: Documents
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [role, setRole] = useState<'owner' | 'tenant' | 'resident'>('resident');
  const [documents, setDocuments] = useState<string[]>([]);
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 2) {
      fetchProperties();
    }
  }, [step]);

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/properties`);
      setProperties(response.data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleStep1Next = () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedProperty) {
      Alert.alert('Error', 'Please select a property');
      return;
    }
    setStep(3);
  };

  const pickDocument = async () => {
    if (documents.length >= 2) {
      Alert.alert('Error', 'Maximum 2 documents allowed');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll permissions are required to upload documents');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setDocuments([...documents, base64Image]);
      setDocumentNames([...documentNames, `Document ${documents.length + 1}`]);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
    setDocumentNames(documentNames.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (documents.length !== 2) {
      Alert.alert('Error', 'Please upload exactly 2 documents');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Register user
      const registerResponse = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        email,
        password,
      });

      const { access_token, user_id } = registerResponse.data;

      // Step 2: Submit approval request
      await axios.post(
        `${API_URL}/api/user/request-property-approval`,
        {
          property_id: selectedProperty,
          requested_role: role,
          documents: documents,
          document_names: documentNames,
        },
        {
          headers: { 'Authorization': `Bearer ${access_token}` }
        }
      );

      Alert.alert(
        'Registration Submitted!',
        'Your registration has been submitted for approval. You will be notified once the HOA admin reviews your request.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
          <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
          <View style={[styles.progressDot, step >= 3 && styles.progressDotActive]} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Enter your basic information</Text>

              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <TouchableOpacity style={styles.button} onPress={handleStep1Next}>
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Property & Role */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Select Property</Text>
              <Text style={styles.subtitle}>Choose your property and role</Text>

              <Text style={styles.label}>Property</Text>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={[
                    styles.propertyCard,
                    selectedProperty === property.id && styles.propertyCardSelected,
                  ]}
                  onPress={() => setSelectedProperty(property.id)}
                >
                  <View style={styles.propertyInfo}>
                    <Text style={styles.propertyName}>{property.name}</Text>
                    <Text style={styles.propertyAddress}>{property.address}</Text>
                  </View>
                  {selectedProperty === property.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Your Role</Text>
              <View style={styles.roleSelector}>
                {['owner', 'tenant', 'resident'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleButton,
                      role === r && styles.roleButtonSelected,
                    ]}
                    onPress={() => setRole(r as any)}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === r && styles.roleButtonTextSelected,
                      ]}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => setStep(1)}
                >
                  <Text style={styles.buttonTextSecondary}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleStep2Next}>
                  <Text style={styles.buttonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Documents */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Upload Documents</Text>
              <Text style={styles.subtitle}>Submit 2 proof documents for verification</Text>

              <View style={styles.documentsContainer}>
                {documents.map((doc, index) => (
                  <View key={index} style={styles.documentCard}>
                    <Image source={{ uri: doc }} style={styles.documentImage} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeDocument(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}

                {documents.length < 2 && (
                  <TouchableOpacity style={styles.uploadCard} onPress={pickDocument}>
                    <Ionicons name="cloud-upload-outline" size={48} color="#007AFF" />
                    <Text style={styles.uploadText}>Upload Document</Text>
                    <Text style={styles.uploadSubtext}>
                      {documents.length}/2 uploaded
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#007AFF" />
                <Text style={styles.infoText}>
                  Upload proof of residence such as utility bills, lease agreement, or ownership documents.
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => setStep(2)}
                >
                  <Text style={styles.buttonTextSecondary}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading || documents.length !== 2}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.loginLinkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E5EA',
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  propertyCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  propertyInfo: {
    flex: 1,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  propertyAddress: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  roleButtonTextSelected: {
    color: '#007AFF',
  },
  documentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  documentCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  uploadCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
  uploadSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: '#F2F2F7',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  loginLink: {
    padding: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#007AFF',
  },
});
