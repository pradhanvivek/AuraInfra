import { useLocalSearchParams } from 'expo-router';
import FixturesScreen from '../../screens/property/FixturesScreen';

export default function PropertyFixturesRoute() {
  const { id } = useLocalSearchParams();
  return <FixturesScreen propertyId={id as string} />;
}
