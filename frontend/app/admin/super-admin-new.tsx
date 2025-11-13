import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SuperAdminPanel() {
  const router = useRouter();

  const tiles = [
    {
      id: 'community-properties',
      title: 'Community Properties',
      description: 'Manage properties for registration',
      icon: 'business',
      color: '#007AFF',
      route: '/admin/community-properties',
    },
    {
      id: 'properties',
      title: 'Properties Management',
      description: 'View all user properties',
      icon: 'home',
      color: '#34C759',
      route: '/admin/properties-management',
    },
    {
      id: 'hoa-admins',
      title: 'HOA Admins',
      description: 'Assign & manage property admins',
      icon: 'shield-checkmark',
      color: '#FF9500',
      route: '/admin/hoa-admins',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Super Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.welcomeText}>Welcome, Super Admin</Text>
        <Text style={styles.subtitle}>Manage your platform</Text>

        <View style={styles.tilesContainer}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              style={styles.tile}
              onPress={() => router.push(tile.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.tileIconContainer, { backgroundColor: tile.color + '20' }]}>
                <Ionicons name={tile.icon as any} size={32} color={tile.color} />
              </View>
              <View style={styles.tileContent}>
                <Text style={styles.tileTitle}>{tile.title}</Text>
                <Text style={styles.tileDescription}>{tile.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#C7C7CC" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Super Admin Access</Text>
            <Text style={styles.infoText}>
              You have full control over community properties, user management, and admin assignments.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  tilesContainer: {
    gap: 16,
    marginBottom: 24,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tileIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tileContent: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  tileDescription: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D0E8FF',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
});
