import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useLocalSearchParams, Stack } from 'expo-router';
import DocumentsScreen from '../../screens/property/DocumentsScreen';
import FixturesScreen from '../../screens/property/FixturesScreen';
import MeasurementsScreen from '../../screens/property/MeasurementsScreen';

const Tab = createMaterialTopTabNavigator();

export default function PropertyDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Property Details',
          headerShown: true,
        }}
      />
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
            fontSize: 14,
            fontWeight: '600',
            textTransform: 'none',
          },
        }}
      >
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
      </Tab.Navigator>
    </>
  );
}
