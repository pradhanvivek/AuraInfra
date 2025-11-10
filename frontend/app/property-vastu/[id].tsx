import { useLocalSearchParams } from 'expo-router';
import VastuScreen from '../../screens/property/VastuScreen';

export default function PropertyVastuRoute() {
  const { id } = useLocalSearchParams();
  return <VastuScreen propertyId={id as string} geomancyType="vastu" />;
}
