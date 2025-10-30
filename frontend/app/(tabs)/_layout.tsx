import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api';
import { View, Text, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    // Check for warranties on mount
    notificationApi.checkWarranties(token!).catch(console.error);
  }, []);

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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          height: 80,
          paddingBottom: 20,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
          href: null, // Hide from tabs
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications-outline" size={size} color={color} />
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
        listeners={{
          tabPress: () => {
            fetchUnreadCount();
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
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
