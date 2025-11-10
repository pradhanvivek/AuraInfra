import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  highlightArea?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to AuraInfra.ai! 🏠',
    description: 'Your personal property and asset management platform. Let\'s take a quick tour to show you around!',
    icon: 'home',
  },
  {
    id: 'properties',
    title: 'Properties Tab',
    description: 'This is your home base! View all your properties, access quick links to documents, fixtures, measurements, and more.',
    icon: 'business',
  },
  {
    id: 'my-property',
    title: 'My Property Features',
    description: 'Quick access to:\n• My Documents - Upload and manage property documents\n• My Fixtures - Track appliances and fixtures\n• House Measurements - Record room dimensions\n• Vastu & Feng Shui - Get spiritual property analysis\n• My Builder - View builder information',
    icon: 'grid',
  },
  {
    id: 'add-property',
    title: 'Add New Property',
    description: 'Tap here to add a new property to your portfolio. You can add residential, commercial, or any type of property.',
    icon: 'add-circle',
  },
  {
    id: 'property-management',
    title: 'Property Management',
    description: 'Access HOA features:\n• Maintenance charges\n• Visitor management\n• Community board\n• Amenities booking\n• Service requests\n• HOA documents & meetings',
    icon: 'briefcase',
  },
  {
    id: 'assets',
    title: 'Assets Tab',
    description: 'Manage all your valuable assets:\n• Vehicles - Cars, bikes, boats\n• Appliances - Home appliances with warranties\n• Furniture - Track furniture and condition\n• Jewelry - Catalog precious items\n• Art - Manage art collection',
    icon: 'cube',
  },
  {
    id: 'ai-scanning',
    title: 'AI-Powered Scanning 🤖',
    description: 'Use AI to scan receipts and automatically extract:\n• Item details\n• Purchase date\n• Price and warranty info\n• Serial numbers\nJust take a photo of your receipt!',
    icon: 'scan',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'View your portfolio summary:\n• Total asset value\n• Property health scores\n• Warranty expiration alerts\n• Maintenance reminders\n• Quick statistics',
    icon: 'stats-chart',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Stay updated with:\n• Warranty expiration alerts\n• Maintenance reminders\n• HOA announcements\n• Payment due dates\n• Community updates',
    icon: 'notifications',
  },
  {
    id: 'profile',
    title: 'Profile Settings',
    description: 'Customize your experience:\n• Update personal information\n• Set currency preference\n• Choose measurement system\n• Configure warranty reminder days\n• Select Vastu or Feng Shui preference',
    icon: 'person-circle',
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🎉',
    description: 'You now know the basics of AuraInfra.ai. Start by adding your first property or asset. You can replay this tour anytime from your profile settings.',
    icon: 'checkmark-circle',
  },
];

interface AppTourProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export default function AppTour({ visible, onComplete, onSkip }: AppTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        {/* Spotlight effect - semi-transparent background */}
        <View style={styles.darkOverlay} />

        {/* Content card */}
        <View style={styles.contentContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name={step.icon as any} size={48} color="#007AFF" />
            </View>
          </View>

          {/* Step counter */}
          <View style={styles.stepCounter}>
            <Text style={styles.stepText}>
              Step {currentStep + 1} of {tourSteps.length}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{step.title}</Text>

          {/* Description - Scrollable */}
          <ScrollView
            style={styles.descriptionScroll}
            contentContainerStyle={styles.descriptionContent}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            <Text style={styles.description}>{step.description}</Text>
          </ScrollView>

          {/* Progress dots */}
          <View style={styles.dotsContainer}>
            {tourSteps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentStep && styles.activeDot,
                ]}
              />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip Tour</Text>
            </TouchableOpacity>

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
                style={[styles.button, styles.nextButton]}
                onPress={handleNext}
              >
                <Text style={styles.nextButtonText}>
                  {isLastStep ? 'Get Started' : 'Next'}
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

// Hook to manage tour state
export function useAppTour() {
  const [tourVisible, setTourVisible] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);

  useEffect(() => {
    checkTourStatus();
    
    // Poll for tour_show_now signal every 500ms
    const interval = setInterval(async () => {
      try {
        const showNow = await AsyncStorage.getItem('tour_show_now');
        if (showNow === 'true') {
          await AsyncStorage.removeItem('tour_show_now');
          setTourVisible(true);
          setTourCompleted(false);
        }
      } catch (error) {
        console.error('Error checking tour signal:', error);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  const checkTourStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem('tour_completed');
      if (completed === 'true') {
        setTourCompleted(true);
      } else {
        // Show tour for first-time users after a short delay
        setTimeout(() => {
          setTourVisible(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking tour status:', error);
    }
  };

  const completeTour = async () => {
    try {
      await AsyncStorage.setItem('tour_completed', 'true');
      setTourCompleted(true);
      setTourVisible(false);
    } catch (error) {
      console.error('Error completing tour:', error);
    }
  };

  const skipTour = async () => {
    try {
      await AsyncStorage.setItem('tour_completed', 'true');
      setTourCompleted(true);
      setTourVisible(false);
    } catch (error) {
      console.error('Error skipping tour:', error);
    }
  };

  const startTour = () => {
    setTourVisible(true);
  };

  const resetTour = async () => {
    try {
      await AsyncStorage.removeItem('tour_completed');
      await AsyncStorage.setItem('tour_show_now', 'true');
      setTourCompleted(false);
      setTourVisible(true);
    } catch (error) {
      console.error('Error resetting tour:', error);
    }
  };

  return {
    tourVisible,
    tourCompleted,
    completeTour,
    skipTour,
    startTour,
    resetTour,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    width: Platform.OS === 'web' ? Math.min(SCREEN_WIDTH * 0.9, 500) : SCREEN_WIDTH * 0.9,
    maxHeight: Platform.OS === 'web' ? SCREEN_HEIGHT * 0.8 : SCREEN_HEIGHT * 0.75,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
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
  descriptionScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  descriptionContent: {
    flexGrow: 1,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3C3C43',
    textAlign: 'center',
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
    backgroundColor: '#007AFF',
    width: 24,
  },
  buttonContainer: {
    marginTop: 16,
    gap: 12,
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
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
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
    backgroundColor: '#007AFF',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
