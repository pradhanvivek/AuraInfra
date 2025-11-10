import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MyBuilderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Builder</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Builder Profile Card */}
        <View style={styles.builderCard}>
          <View style={styles.builderLogo}>
            <Ionicons name="business" size={48} color="#007AFF" />
          </View>
          <Text style={styles.builderName}>Level Constructions</Text>
          <Text style={styles.builderTagline}>Building Dreams, Creating Homes</Text>
          
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.ratingText}>4.8</Text>
            <Text style={styles.ratingCount}>(245 reviews)</Text>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#007AFF" />
              <Text style={styles.infoText}>+1 (555) 123-4567</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#007AFF" />
              <Text style={styles.infoText}>info@levelconstructions.com</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#007AFF" />
              <Text style={styles.infoText}>123 Builder Street, Construction City, CA 90210</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={20} color="#007AFF" />
              <Text style={styles.infoText}>www.levelconstructions.com</Text>
            </View>
          </View>
        </View>

        {/* Current Projects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Projects</Text>
          
          <View style={styles.projectCard}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400' }}
              style={styles.projectImage}
            />
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>Skyline Residences</Text>
              <Text style={styles.projectLocation}>Downtown, Phase 3</Text>
              <View style={styles.projectMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="home-outline" size={16} color="#8E8E93" />
                  <Text style={styles.metaText}>2, 3 & 4 BHK</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                  <Text style={styles.metaText}>Launching Q1 2026</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.expressInterestButton}>
                <Text style={styles.expressInterestText}>Express Interest</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.projectCard}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400' }}
              style={styles.projectImage}
            />
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>Green Valley Apartments</Text>
              <Text style={styles.projectLocation}>Suburbs, Phase 2</Text>
              <View style={styles.projectMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="home-outline" size={16} color="#8E8E93" />
                  <Text style={styles.metaText}>1, 2 & 3 BHK</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
                  <Text style={styles.metaText}>Launching Q3 2026</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.expressInterestButton}>
                <Text style={styles.expressInterestText}>Express Interest</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Completed Projects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed Projects</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>150+</Text>
              <Text style={styles.statLabel}>Projects</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>5000+</Text>
              <Text style={styles.statLabel}>Happy Families</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>25+</Text>
              <Text style={styles.statLabel}>Years</Text>
            </View>
          </View>
        </View>

        {/* Certifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Certifications & Awards</Text>
          <View style={styles.certificationCard}>
            <Ionicons name="medal-outline" size={24} color="#FFD700" />
            <Text style={styles.certificationText}>ISO 9001:2015 Certified</Text>
          </View>
          <View style={styles.certificationCard}>
            <Ionicons name="medal-outline" size={24} color="#FFD700" />
            <Text style={styles.certificationText}>Best Builder Award 2024</Text>
          </View>
          <View style={styles.certificationCard}>
            <Ionicons name="medal-outline" size={24} color="#FFD700" />
            <Text style={styles.certificationText}>Green Building Certified</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  builderCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  builderLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  builderName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  builderTagline: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  ratingCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectImage: {
    width: '100%',
    height: 200,
  },
  projectInfo: {
    padding: 16,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  projectLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  projectMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  expressInterestButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  expressInterestText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  certificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  certificationText: {
    fontSize: 16,
    color: '#000',
  },
});
