import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useLocalSearchParams } from 'expo-router';
import DocumentsScreen from '../../screens/property/DocumentsScreen';
import FixturesScreen from '../../screens/property/FixturesScreen';
import MeasurementsScreen from '../../screens/property/MeasurementsScreen';
import VastuScreen from '../../screens/property/VastuScreen';
import NearMeScreen from '../../screens/property/NearMeScreen';
import HealthScoreScreen from '../../screens/property/HealthScoreScreen';

const Tab = createMaterialTopTabNavigator();

export default function PropertyDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarIndicatorStyle: {
          backgroundColor: '#007AFF',
          height: 3,
        },
        tabBarStyle: {
          backgroundColor: '#fff',
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          textTransform: 'none',
        },
        tabBarScrollEnabled: true,
      }}
    >
      <Tab.Screen
        name="Health"
        children={() => <HealthScoreScreen propertyId={id!} />}
      />
      <Tab.Screen
        name="Documents"
        children={() => <DocumentsScreen propertyId={id!} />}
      />
      <Tab.Screen
        name="Fixtures"
        children={() => <FixturesScreen propertyId={id!} />}
      />
      <Tab.Screen
        name="Measurements"
        children={() => <MeasurementsScreen propertyId={id!} />}
      />
      <Tab.Screen
        name="Vastu"
        children={() => <VastuScreen propertyId={id!} />}
      />
      <Tab.Screen
        name="Near Me"
        children={() => <NearMeScreen propertyId={id!} />}
      />
    </Tab.Navigator>
  );
}
