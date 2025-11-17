import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api';
import { View, Text, StyleSheet, Platform } from 'react-native';
import AppTour, { useAppTour } from '../../components/AppTour';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function TabsLayout() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const { tourVisible, completeTour, skipTour } = useAppTour();

  useEffect(() => {
    fetchUnreadCount();
    checkAdminStatus();
    // Check for warranties on mount
    notificationApi.checkWarranties(token!).catch(console.error);
  }, []);

  const checkAdminStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Check if user has managed_properties (is an admin)
      setIsAdmin(response.data.managed_properties && response.data.managed_properties.length > 0);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const notifications = await notificationApi.getAll(token!);
      const unread = notifications.filter((n: any) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  return (
    <>
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          height: Platform.select({
            ios: 90,
            android: 70,
            web: 70,
          }),
          paddingBottom: Platform.select({
            ios: 25,      // More padding for iOS devices with home indicator
            android: 10,  // Standard padding for Android
            web: 10,      // Standard padding for web
          }),
          paddingTop: Platform.select({
            ios: 10,
            android: 8,
            web: 8,
          }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#fff',
          height: Platform.select({
            ios: 110,
            android: 60,
            web: 60,
          }),
        },
        headerTitleStyle: {
          fontSize: Platform.select({
            ios: 20,
            android: 18,
            web: 20,
          }),
          fontWeight: 'bold',
        },
        headerTitleAlign: 'left',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Properties',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Assets',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Conditionally show Admin tab only for admins */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          headerShown: false,
          href: isAdmin ? '/(tabs)/admin' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="person-outline" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      {/* Hide these from tabs but keep them accessible */}
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hide from tab bar
          headerShown: false, // Hide the default header
        }}
      />
    </Tabs>
    {/* App Tour Overlay */}
    <AppTour
      visible={tourVisible}
      onComplete={completeTour}
      onSkip={skipTour}
    />
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
