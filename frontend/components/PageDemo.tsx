import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DemoStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface PageDemoProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  steps: DemoStep[];
}

export default function PageDemo({ visible, onClose, title, steps }: PageDemoProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.pageTitle}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: step.color + '20' }]}>
              <Ionicons name={step.icon as any} size={56} color={step.color} />
            </View>

            {/* Step counter */}
            <View style={styles.stepCounter}>
              <Text style={styles.stepText}>
                Tip {currentStep + 1} of {steps.length}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{step.title}</Text>

            {/* Description */}
            <Text style={styles.description}>{step.description}</Text>

            {/* Progress dots */}
            <View style={styles.dotsContainer}>
              {steps.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentStep(index)}
                  style={[
                    styles.dot,
                    index === currentStep && [styles.activeDot, { backgroundColor: step.color }],
                  ]}
                />
              ))}
            </View>
          </ScrollView>

          {/* Navigation buttons */}
          <View style={styles.buttonContainer}>
            <View style={styles.navButtons}>
              {!isFirstStep && (
                <TouchableOpacity
                  style={[styles.button, styles.previousButton]}
                  onPress={handlePrevious}
                >
                  <Ionicons name="arrow-back" size={20} color="#007AFF" />
                  <Text style={styles.previousButtonText}>Previous</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.nextButton, { backgroundColor: step.color }]}
                onPress={handleNext}
              >
                <Text style={styles.nextButtonText}>
                  {isLastStep ? 'Got It!' : 'Next'}
                </Text>
                {!isLastStep && (
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Properties Page Demo Steps
export const propertiesPageSteps: DemoStep[] = [
  {
    id: 'overview',
    title: 'Properties Hub 🏠',
    description: 'This is your central hub for managing all your properties. Track documents, measurements, maintenance, and more - all in one place!',
    icon: 'home',
    color: '#007AFF',
  },
  {
    id: 'my-property',
    title: 'Quick Access Tiles',
    description: 'Tap any tile to quickly access:\n• My Documents - Upload property papers\n• My Fixtures - Track appliances\n• House Measurements - Room dimensions\n• Vastu & Feng Shui - Property analysis\n• Paint Estimate - Calculate paint needs\n• My Builder - View builder info',
    icon: 'grid',
    color: '#34C759',
  },
  {
    id: 'view-more',
    title: 'View More Features',
    description: 'Tap "View More" to see all available property features including Property Health Score and additional tools.',
    icon: 'ellipsis-horizontal-circle',
    color: '#FF9500',
  },
  {
    id: 'add-property',
    title: 'Add New Property',
    description: 'Tap "Add New Property" to register a new property in your portfolio. You can add residential, commercial, or any type of property.',
    icon: 'add-circle',
    color: '#5856D6',
  },
  {
    id: 'hoa-management',
    title: 'HOA Management',
    description: 'Access HOA features like:\n• Maintenance charges & payments\n• Visitor management\n• Community board posts\n• Amenities booking\n• Service requests\n• HOA documents & meetings',
    icon: 'people',
    color: '#FF3B30',
  },
  {
    id: 'property-selector',
    title: 'Switch Properties',
    description: 'Tap the property selector at the top to switch between your properties. All data is organized per property for easy management.',
    icon: 'swap-horizontal',
    color: '#00C7BE',
  },
];

// Assets Page Demo Steps
export const assetsPageSteps: DemoStep[] = [
  {
    id: 'overview',
    title: 'Assets Management 📦',
    description: 'Manage all your valuable assets in one place. Track warranties, maintenance, and value - from vehicles to jewelry!',
    icon: 'cube',
    color: '#007AFF',
  },
  {
    id: 'categories',
    title: 'Asset Categories',
    description: 'Your assets are organized into categories:\n• Vehicles - Cars, bikes, boats\n• Appliances - Home appliances\n• Furniture - Tables, sofas, beds\n• Jewelry - Precious items\n• Art - Paintings, sculptures',
    icon: 'apps',
    color: '#34C759',
  },
  {
    id: 'add-asset',
    title: 'Add New Assets',
    description: 'Tap the "+" button on any category to add a new asset. Fill in details like:\n• Purchase date & price\n• Warranty information\n• Serial numbers\n• Photos & receipts',
    icon: 'add-circle',
    color: '#5856D6',
  },
  {
    id: 'ai-scanning',
    title: 'AI Receipt Scanning 🤖',
    description: 'Use AI to scan receipts! Just take a photo and AI will automatically extract:\n• Item details\n• Purchase date\n• Price & warranty\n• Serial numbers\nSaves you time entering data manually!',
    icon: 'scan',
    color: '#FF9500',
  },
  {
    id: 'view-details',
    title: 'Asset Details',
    description: 'Tap any asset card to view full details, edit information, upload photos, or delete the asset.',
    icon: 'information-circle',
    color: '#00C7BE',
  },
  {
    id: 'portfolio',
    title: 'Portfolio Value',
    description: 'See your total asset value in the dashboard. Track depreciation, warranties expiring, and get maintenance reminders.',
    icon: 'cash',
    color: '#FFD700',
  },
  {
    id: 'search-filter',
    title: 'Search & Filter (Coming Soon)',
    description: 'Soon you\'ll be able to search assets by name, filter by category, and sort by value or purchase date.',
    icon: 'search',
    color: '#8E8E93',
  },
];

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    width: Platform.OS === 'web' ? Math.min(SCREEN_WIDTH * 0.9, 500) : SCREEN_WIDTH * 0.92,
    maxHeight: Platform.OS === 'web' ? SCREEN_HEIGHT * 0.85 : SCREEN_HEIGHT * 0.75,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepCounter: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    textAlign: 'center',
    marginBottom: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
  },
  activeDot: {
    width: 24,
  },
  buttonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  previousButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  previousButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  nextButton: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
